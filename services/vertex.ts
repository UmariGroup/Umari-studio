/**
 * Vertex AI service (optional provider)
 * Uses OAuth via google-auth-library and calls the Vertex AI REST API.
 */

import axios from 'axios';
import { GoogleAuth } from 'google-auth-library';
import { promises as fs } from 'fs';
import path from 'path';

type VertexApiVersion = 'v1' | 'v1beta1';

const VERTEX_PROJECT_ID =
  process.env.VERTEX_PROJECT_ID ||
  process.env.NEXT_PUBLIC_VERTEX_PROJECT_ID ||
  process.env.VITE_VERTEX_PROJECT_ID ||
  '';

const VERTEX_LOCATION =
  process.env.VERTEX_LOCATION ||
  process.env.VERTEX_IMAGE_LOCATION ||
  process.env.NEXT_PUBLIC_VERTEX_LOCATION ||
  process.env.VITE_VERTEX_LOCATION ||
  'us-central1';

const DEFAULT_VERTEX_IMAGE_MODEL =
  process.env.VERTEX_IMAGE_MODEL || '' ;

const GOOGLE_APPLICATION_CREDENTIALS_JSON =
  process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON || '';

const GOOGLE_APPLICATION_CREDENTIALS_FILE =
  process.env.GOOGLE_APPLICATION_CREDENTIALS_FILE ||
  process.env.GOOGLE_APPLICATION_CREDENTIALS ||
  '';

function requireVertexConfig(): void {
  if (!VERTEX_PROJECT_ID) {
    throw new Error(
      'Vertex AI is not configured: set VERTEX_PROJECT_ID (or NEXT_PUBLIC_VERTEX_PROJECT_ID) in .env.local'
    );
  }
  if (!GOOGLE_APPLICATION_CREDENTIALS_JSON && !GOOGLE_APPLICATION_CREDENTIALS_FILE) {
    throw new Error(
      'Vertex AI auth is missing: set GOOGLE_APPLICATION_CREDENTIALS (path to service account json) or GOOGLE_APPLICATION_CREDENTIALS_JSON (service account JSON) in .env.local'
    );
  }
}

function parseDataUrl(dataUrl: string): { mimeType: string; data: string } | null {
  const match = /^data:([^;]+);base64,(.+)$/.exec(dataUrl);
  if (!match) return null;
  return { mimeType: match[1], data: match[2] };
}

function normalizeAspectRatio(aspectRatio: string): string {
  const allowed = new Set(['1:1', '2:3', '3:2', '3:4', '4:3', '9:16', '16:9']);
  return allowed.has(aspectRatio) ? aspectRatio : '1:1';
}

async function getVertexAccessToken(): Promise<string> {
  requireVertexConfig();

  const scopes = ['https://www.googleapis.com/auth/cloud-platform'];

  let auth: GoogleAuth;

  if (GOOGLE_APPLICATION_CREDENTIALS_JSON) {
    let credentials: any;
    try {
      credentials = JSON.parse(GOOGLE_APPLICATION_CREDENTIALS_JSON);
    } catch {
      throw new Error('GOOGLE_APPLICATION_CREDENTIALS_JSON is not valid JSON');
    }

    auth = new GoogleAuth({ credentials, scopes });
  } else {
    const configured = GOOGLE_APPLICATION_CREDENTIALS_FILE.trim();
    const resolved = path.isAbsolute(configured)
      ? configured
      : path.resolve(process.cwd(), configured);

    try {
      await fs.access(resolved);
    } catch {
      throw new Error(
        `Vertex credentials file not found: ${resolved}. Set GOOGLE_APPLICATION_CREDENTIALS to a valid path (e.g. .secrets/vertex-sa.json).`
      );
    }

    auth = new GoogleAuth({ keyFile: resolved, scopes });
  }

  const client = await auth.getClient();
  const tokenResponse = await client.getAccessToken();
  const token = typeof tokenResponse === 'string' ? tokenResponse : tokenResponse?.token;
  if (!token) {
    throw new Error('Failed to acquire Vertex AI access token');
  }
  return token;
}

async function vertexPredictImagen(
  prompt: string,
  aspectRatio: string,
  modelOverride?: string,
  referenceImageDataUrl?: string | null
): Promise<string> {
  const modelId = (modelOverride || DEFAULT_VERTEX_IMAGE_MODEL).trim();
  const location = VERTEX_LOCATION.trim();

  const url = `https://${location}-aiplatform.googleapis.com/v1/projects/${encodeURIComponent(
    VERTEX_PROJECT_ID
  )}/locations/${encodeURIComponent(location)}/publishers/google/models/${encodeURIComponent(
    modelId
  )}:predict`;

  const instance: any = { prompt };

  // Best-effort: if a reference image is provided, attach it.
  // If the chosen Imagen model doesn't support it, Vertex will return a 400.
  if (referenceImageDataUrl) {
    const parsed = parseDataUrl(referenceImageDataUrl);
    if (parsed) {
      instance.image = { bytesBase64Encoded: parsed.data };
    }
  }

  const body: any = {
    instances: [instance],
    parameters: {
      sampleCount: 1,
      aspectRatio: normalizeAspectRatio(aspectRatio),
    },
  };

  const token = await getVertexAccessToken();
  const requestConfig = {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    timeout: 120_000,
  } as const;

  const hasReferenceImage = Boolean(instance.image);

  const postWithRetry = async (payload: any, maxAttempts: number): Promise<any> => {
    let lastError: unknown;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await axios.post(url, payload, requestConfig);
      } catch (error: unknown) {
        lastError = error;

        if (!axios.isAxiosError(error)) throw error;

        const status = error.response?.status;
        const retryable =
          status === 429 ||
          status === 500 ||
          status === 502 ||
          status === 503 ||
          status === 504;

        if (!retryable || attempt === maxAttempts) break;

        const backoffMs = Math.min(10_000, 750 * Math.pow(2, attempt - 1));
        const jitterMs = Math.floor(Math.random() * 250);
        await new Promise((resolve) => setTimeout(resolve, backoffMs + jitterMs));
      }
    }

    throw lastError;
  };

  const throwVertexRequestError = (err: unknown): never => {
    if (axios.isAxiosError(err)) {
      const status = err.response?.status;
      const statusText = err.response?.statusText;
      const data = err.response?.data;

      const details = truncateDetails(safeJsonStringify(data));
      const suffix = details ? `\nVertex response: ${details}` : '';
      throw new Error(
        `Vertex AI error${status ? ` (${status}${statusText ? ` ${statusText}` : ''})` : ''}: ${err.message}${suffix}`
      );
    }

    throw err;
  };

  let res: any;
  try {
    res = await postWithRetry(body, 3);
  } catch (error: unknown) {
    // Best effort: If we used a reference image and the model/endpoint chokes (400/500s),
    // retry once as text-only.
    if (hasReferenceImage && axios.isAxiosError(error)) {
      const status = error.response?.status;
      if (status === 400 || status === 500 || status === 502 || status === 503 || status === 504) {
        const bodyWithoutImage: any = {
          ...body,
          instances: [{ prompt }],
        };

        try {
          res = await postWithRetry(bodyWithoutImage, 2);
        } catch (fallbackError: unknown) {
          throwVertexRequestError(fallbackError);
        }
      } else {
        throwVertexRequestError(error);
      }
    } else {
      throwVertexRequestError(error);
    }
  }

  const prediction = res.data?.predictions?.[0];
  const bytes =
    prediction?.bytesBase64Encoded ||
    prediction?.bytes_base64_encoded ||
    prediction?.image?.bytesBase64Encoded ||
    prediction?.image?.bytes_base64_encoded;

  const mimeType = prediction?.mimeType || prediction?.mime_type || 'image/png';

  if (typeof bytes !== 'string' || !bytes) {
    throw new Error('Vertex AI did not return image bytes');
  }

  return `data:${mimeType};base64,${bytes}`;
}

function truncateDetails(details: string, maxLen = 2500): string {
  if (!details) return '';
  return details.length > maxLen ? details.slice(0, maxLen) + '...' : details;
}

function safeJsonStringify(data: unknown): string {
  try {
    return typeof data === 'string' ? data : JSON.stringify(data);
  } catch {
    return '';
  }
}

async function pollPredictOperation(
  endpointName: string,
  operationName: string,
  token: string,
  maxAttempts = 240,
  apiVersion: VertexApiVersion = 'v1'
): Promise<any> {
  // IMPORTANT: Veo (and other async publisher model predictions) are polled via `:fetchPredictOperation`.
  // Using GET on `/operations/...` will fail for UUID operation IDs.
  const url = `https://${VERTEX_LOCATION.trim()}-aiplatform.googleapis.com/${apiVersion}/${endpointName}:fetchPredictOperation`;

  for (let i = 0; i < maxAttempts; i++) {
    try {
      const res = await axios.post(
        url,
        { operationName },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          timeout: 30_000,
        }
      );

      const op = res.data;
      if (op?.done) {
        if (op?.error) {
          const msg = op.error?.message || 'Unknown error';
          throw new Error(`Vertex LRO Error: ${msg}`);
        }
        return op;
      }
    } catch (error: unknown) {
      // Important: rethrow as a normal Error so callers don't accidentally log axios config
      // (which can include Bearer tokens in headers).
      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        const statusText = error.response?.statusText;
        const data = error.response?.data;

        const details = truncateDetails(safeJsonStringify(data));
        const suffix = details ? `\nVertex response: ${details}` : '';
        throw new Error(
          `Vertex fetchPredictOperation error${status ? ` (${status}${statusText ? ` ${statusText}` : ''})` : ''}: ${error.message}${suffix}`
        );
      }

      throw error;
    }

    // Wait 2 seconds
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  throw new Error('Video generation timed out (polling limit reached)');
}

async function vertexPredictVeo(
  prompt: string,
  aspectRatio: string,
  modelOverride?: string,
  image?: string | null,
  video?: string | null,
  durationSeconds?: number | null
): Promise<string> {

  // Use a default Veo model if none provided
  const modelId = (modelOverride || 'veo-3.0-fast-generate-001').trim();
  const location = VERTEX_LOCATION.trim();

  // Veo video generation uses `:predictLongRunning`, then polling via `:fetchPredictOperation`.
  const apiVersion: VertexApiVersion = 'v1';
  const url = `https://${location}-aiplatform.googleapis.com/${apiVersion}/projects/${encodeURIComponent(
    VERTEX_PROJECT_ID
  )}/locations/${encodeURIComponent(location)}/publishers/google/models/${encodeURIComponent(
    modelId
  )}:predictLongRunning`;

  const instance: any = { prompt };

  if (video) {
    if (typeof video === 'string' && video.trim().startsWith('gs://')) {
      instance.video = { gcsUri: video.trim() };
    } else {
      const parsedVideo = parseDataUrl(video);
      if (parsedVideo && parsedVideo.mimeType.startsWith('video/')) {
        instance.video = {
          bytesBase64Encoded: parsedVideo.data,
          mimeType: parsedVideo.mimeType,
        };
      }
    }
  }

  if (image) {
    const parsed = parseDataUrl(image);
    if (parsed) {
      instance.image = {
        bytesBase64Encoded: parsed.data,
        mimeType: parsed.mimeType
      };
    }
  }

  const body = {
    instances: [instance],
    parameters: {
      sampleCount: 1,
      aspectRatio: normalizeAspectRatio(aspectRatio),
      ...(Number.isFinite(Number(durationSeconds)) && Number(durationSeconds) > 0
        ? { durationSeconds: Math.max(1, Math.round(Number(durationSeconds))) }
        : {}),
    },
  };

  const token = await getVertexAccessToken();

  let opRes: any;
  try {
    opRes = await axios.post(url, body, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
  } catch (error: unknown) {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      const statusText = error.response?.statusText;
      const details = truncateDetails(safeJsonStringify(error.response?.data), 500);
      const suffix = details ? `\nVertex response: ${details}` : '';
      throw new Error(
        `Veo request failed${status ? ` (${status}${statusText ? ` ${statusText}` : ''})` : ''}: ${error.message}${suffix}`
      );
    }
    throw error;
  }

  const operationName = opRes.data.name; // e.g. "projects/.../operations/..."
  if (!operationName) {
    throw new Error('Veo did not return an operation name');
  }

  const endpointName = `projects/${encodeURIComponent(VERTEX_PROJECT_ID)}/locations/${encodeURIComponent(
    location
  )}/publishers/google/models/${encodeURIComponent(modelId)}`;

  // Poll for completion
  const finalRes = await pollPredictOperation(endpointName, operationName, token, 60, apiVersion);

  const response = finalRes?.response;

  // Veo typically returns a GenerateVideoResponse with `videos[]`.
  const videos = response?.videos;
  if (Array.isArray(videos) && videos.length > 0) {
    const v0 = videos[0];
    const mimeType = v0?.mimeType || 'video/mp4';
    const bytes =
      v0?.bytesBase64Encoded ||
      v0?.bytes_base64_encoded ||
      v0?.video?.bytesBase64Encoded ||
      v0?.video?.bytes_base64_encoded;

    if (typeof bytes === 'string' && bytes) {
      return `data:${mimeType};base64,${bytes}`;
    }

    const gcsUri = v0?.gcsUri || v0?.gcs_uri || v0?.video?.gcsUri || v0?.video?.gcs_uri;
    if (typeof gcsUri === 'string' && gcsUri) {
      return gcsUri;
    }
  }

  // Fallback: some Vertex APIs return a PredictResponse-like structure.
  const predictions = response?.predictions || response?.success?.predictions;
  if (Array.isArray(predictions) && predictions[0]) {
    const p0 = predictions[0];
    const bytes = p0?.bytesBase64Encoded || p0?.video?.bytesBase64Encoded;
    if (typeof bytes === 'string' && bytes) {
      return `data:video/mp4;base64,${bytes}`;
    }

    const uri = p0?.gcsUri || p0?.video?.gcsUri;
    if (typeof uri === 'string' && uri) {
      return uri;
    }
  }

  throw new Error('Veo operation completed but returned no videos');
}

export async function generateMarketplaceVideo(
  prompt: string,
  image?: string | string[],
  model = 'veo-3.0-fast-generate-001',
  aspectRatio = '16:9',
  durationSeconds?: number
): Promise<string> {
  const firstImage = Array.isArray(image) ? image.find(Boolean) : image;
  return vertexPredictVeo(prompt, aspectRatio, model, firstImage || undefined, null, durationSeconds);
}

export async function generateMarketplaceVideoUpsampled(
  prompt: string,
  image?: string | string[],
  aspectRatio: string = '16:9',
  sourceVideoUrl?: string | null,
  durationSeconds?: number
): Promise<string> {
  const firstImage = Array.isArray(image) ? image.find(Boolean) : image;
  return vertexPredictVeo(
    prompt,
    aspectRatio,
    'veo3_upsampler_video_generation',
    firstImage || undefined,
    sourceVideoUrl || null,
    durationSeconds
  );
}

export async function generateMarketplaceImage(
  prompt: string,
  productImages: string[] = [],
  styleImages: string[] = [],
  aspectRatio: string = '1:1',
  options?: { model?: string }
): Promise<string> {
  const reference = productImages?.[0] || styleImages?.[0] || null;
  return vertexPredictImagen(prompt, aspectRatio, options?.model, reference);
}
