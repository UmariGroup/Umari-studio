/**
 * Vertex AI service (optional provider)
 * Uses OAuth via google-auth-library and calls the Vertex AI REST API.
 */

import axios from 'axios';
import { GoogleAuth } from 'google-auth-library';
import { promises as fs } from 'fs';
import path from 'path';

type VertexApiVersion = 'v1' | 'v1beta1';
type ChatMessage = { role: string; content: string };

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

function parseLocationList(value: string): string[] {
  const list = String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  const unique = Array.from(new Set(list));
  return unique.length > 0 ? unique : ['us-central1'];
}

const VERTEX_TEXT_LOCATIONS = parseLocationList(
  process.env.VERTEX_TEXT_LOCATIONS || process.env.VERTEX_LOCATIONS || VERTEX_LOCATION
);
const VERTEX_IMAGE_LOCATIONS = parseLocationList(
  process.env.VERTEX_IMAGE_LOCATIONS ||
    process.env.VERTEX_LOCATIONS ||
    process.env.VERTEX_IMAGE_LOCATION ||
    VERTEX_LOCATION
);
const VERTEX_VIDEO_LOCATIONS = parseLocationList(
  process.env.VERTEX_VIDEO_LOCATIONS ||
    process.env.VERTEX_LOCATIONS ||
    process.env.VERTEX_VIDEO_LOCATION ||
    VERTEX_LOCATION
);

const DEFAULT_VERTEX_IMAGE_MODEL =
  process.env.VERTEX_IMAGE_MODEL || '' ;

const DEFAULT_VERTEX_TEXT_MODEL =
  process.env.VERTEX_TEXT_MODEL ||
  process.env.GEMINI_TEXT_MODEL ||
  'gemini-2.5-flash';

const VERTEX_TEXT_FALLBACK_MODELS = (
  process.env.VERTEX_TEXT_FALLBACK_MODELS ||
  'gemini-2.5-pro,gemini-2.5-flash,gemini-2.5-flash-lite,gemini-2.0-flash-lite-001'
)
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);

const VERTEX_RETRY_ATTEMPTS = Math.max(1, Number(process.env.VERTEX_RETRY_ATTEMPTS || 3));
const VERTEX_MAX_CONCURRENT = Math.max(1, Number(process.env.VERTEX_MAX_CONCURRENT || 3));

const GOOGLE_APPLICATION_CREDENTIALS_JSON =
  process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON || '';

const GOOGLE_APPLICATION_CREDENTIALS_FILE =
  process.env.GOOGLE_APPLICATION_CREDENTIALS_FILE ||
  process.env.GOOGLE_APPLICATION_CREDENTIALS ||
  '';

class Semaphore {
  private available: number;
  private queue: Array<() => void> = [];

  constructor(count: number) {
    this.available = count;
  }

  async acquire(): Promise<void> {
    if (this.available > 0) {
      this.available -= 1;
      return;
    }
    await new Promise<void>((resolve) => {
      this.queue.push(resolve);
    });
  }

  release(): void {
    const next = this.queue.shift();
    if (next) {
      next();
      return;
    }
    this.available += 1;
  }

  async use<T>(fn: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      return await fn();
    } finally {
      this.release();
    }
  }
}

const vertexSemaphore = new Semaphore(VERTEX_MAX_CONCURRENT);

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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseRetryAfterMs(value: unknown): number | null {
  if (!value) return null;
  const raw = Array.isArray(value) ? value[0] : value;
  const s = String(raw).trim();
  const seconds = Number(s);
  if (Number.isFinite(seconds) && seconds > 0) return Math.min(60_000, Math.floor(seconds * 1000));
  return null;
}

function validateInlineImage(mimeType: string, base64: string): void {
  const allowed = new Set(['image/png', 'image/jpeg', 'image/webp']);
  if (!allowed.has(mimeType)) return;

  const approxBytes = Math.floor((base64.length * 3) / 4);
  const maxBytesPerImage = 9 * 1024 * 1024;
  if (approxBytes > maxBytesPerImage) {
    throw new Error('Image is too large. Please upload an image under 9MB.');
  }
}

function toInlineDataPart(image: string): { inlineData: { mimeType: string; data: string } } | null {
  const parsed = parseDataUrl(image);
  if (!parsed) return null;

  const mimeType = parsed.mimeType === 'image/jpg' ? 'image/jpeg' : parsed.mimeType;
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(mimeType)) return null;

  validateInlineImage(mimeType, parsed.data);
  return { inlineData: { mimeType, data: parsed.data } };
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

function isVertexModelNotFound(error: unknown): boolean {
  if (!axios.isAxiosError(error)) return false;
  const status = error.response?.status;
  if (status !== 404) return false;

  const message = String(error.response?.data?.error?.message || error.message || '').toLowerCase();
  return message.includes('publisher model') || message.includes('not found') || message.includes('does not have access');
}

function isVertexRateLimited(error: unknown): boolean {
  if (!axios.isAxiosError(error)) return false;
  return error.response?.status === 429;
}

function isVertexTemporarilyUnavailable(error: unknown): boolean {
  if (!axios.isAxiosError(error)) return false;
  const status = error.response?.status;
  return status === 408 || status === 500 || status === 502 || status === 503 || status === 504;
}

function toVertexApiError(error: unknown, prefix = 'Vertex AI error'): Error {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status;
    const statusText = error.response?.statusText;
    const details = truncateDetails(safeJsonStringify(error.response?.data));
    const suffix = details ? `\nVertex response: ${details}` : '';
    return new Error(
      `${prefix}${status ? ` (${status}${statusText ? ` ${statusText}` : ''})` : ''}: ${error.message}${suffix}`
    );
  }

  return error instanceof Error ? error : new Error(String(error));
}

async function vertexGenerateContentSingle(model: string, body: unknown): Promise<any> {
  const modelId = (model || '').trim();
  if (!modelId) {
    throw new Error('Vertex text model is empty. Set VERTEX_TEXT_MODEL or pass model explicitly.');
  }

  return vertexSemaphore.use(async () => {
    const token = await getVertexAccessToken();
    let lastError: unknown;

    for (const location of VERTEX_TEXT_LOCATIONS) {
      const url = `https://${location}-aiplatform.googleapis.com/v1/projects/${encodeURIComponent(
        VERTEX_PROJECT_ID
      )}/locations/${encodeURIComponent(location)}/publishers/google/models/${encodeURIComponent(
        modelId
      )}:generateContent`;

      for (let attempt = 1; attempt <= VERTEX_RETRY_ATTEMPTS; attempt++) {
        try {
          const res = await axios.post(url, body, {
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            timeout: 120_000,
          });
          return res.data;
        } catch (error: unknown) {
          lastError = error;
          if (!axios.isAxiosError(error)) throw error;

          const status = error.response?.status;
          const retryable =
            status === 408 ||
            status === 429 ||
            status === 500 ||
            status === 502 ||
            status === 503 ||
            status === 504;

          if (retryable && attempt < VERTEX_RETRY_ATTEMPTS) {
            const retryAfterMs = parseRetryAfterMs((error.response?.headers as any)?.['retry-after']);
            const expBackoffMs = Math.min(20_000, 900 * Math.pow(2, attempt - 1));
            const jitterMs = Math.floor(Math.random() * 350);
            await sleep(Math.max(retryAfterMs || 0, expBackoffMs) + jitterMs);
            continue;
          }

          if (isVertexModelNotFound(error) || isVertexRateLimited(error) || isVertexTemporarilyUnavailable(error)) {
            break;
          }

          throw toVertexApiError(error);
        }
      }
    }

    throw toVertexApiError(lastError, 'Vertex AI error (all regions failed)');
  });
}

async function vertexGenerateContent(model: string, body: unknown): Promise<any> {
  const requested = (model || '').trim();
  const candidates = Array.from(new Set([requested, ...VERTEX_TEXT_FALLBACK_MODELS].filter(Boolean)));
  let lastError: unknown;

  for (const candidate of candidates) {
    try {
      return await vertexGenerateContentSingle(candidate, body);
    } catch (error: unknown) {
      lastError = error;
      if (isVertexModelNotFound(error)) {
        continue;
      }
      throw error;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error('Vertex text generation failed after model fallbacks.');
}

function extractText(response: any): string {
  if (!response) return '';
  if (typeof response.text === 'string') return response.text;

  const parts = response?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return '';

  return parts
    .map((part: any) => (typeof part?.text === 'string' ? part.text : ''))
    .filter(Boolean)
    .join('');
}

async function vertexPredictImagen(
  prompt: string,
  aspectRatio: string,
  modelOverride?: string,
  referenceImageDataUrl?: string | null
): Promise<string> {
  const modelId = (modelOverride || DEFAULT_VERTEX_IMAGE_MODEL).trim();
  const instance: any = { prompt };

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

  return vertexSemaphore.use(async () => {
    const token = await getVertexAccessToken();
    const hasReferenceImage = Boolean(instance.image);
    let lastError: unknown;

    for (const location of VERTEX_IMAGE_LOCATIONS) {
      const url = `https://${location}-aiplatform.googleapis.com/v1/projects/${encodeURIComponent(
        VERTEX_PROJECT_ID
      )}/locations/${encodeURIComponent(location)}/publishers/google/models/${encodeURIComponent(
        modelId
      )}:predict`;

      const requestConfig = {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        timeout: 120_000,
      } as const;

      const postWithRetry = async (payload: any, maxAttempts: number): Promise<any> => {
        let localError: unknown;

        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
          try {
            return await axios.post(url, payload, requestConfig);
          } catch (error: unknown) {
            localError = error;
            if (!axios.isAxiosError(error)) throw error;

            const status = error.response?.status;
            const retryable =
              status === 429 ||
              status === 500 ||
              status === 502 ||
              status === 503 ||
              status === 504;

            if (!retryable || attempt === maxAttempts) break;

            const retryAfterMs = parseRetryAfterMs((error.response?.headers as any)?.['retry-after']);
            const backoffMs = Math.min(12_000, 900 * Math.pow(2, attempt - 1));
            const jitterMs = Math.floor(Math.random() * 250);
            await sleep(Math.max(retryAfterMs || 0, backoffMs) + jitterMs);
          }
        }

        throw localError;
      };

      let res: any;
      let regionError: unknown;
      try {
        res = await postWithRetry(body, VERTEX_RETRY_ATTEMPTS);
      } catch (error: unknown) {
        regionError = error;
        if (hasReferenceImage && axios.isAxiosError(error)) {
          const status = error.response?.status;
          if (status === 400 || status === 429 || status === 500 || status === 502 || status === 503 || status === 504) {
            const bodyWithoutImage: any = {
              ...body,
              instances: [{ prompt }],
            };
            try {
              res = await postWithRetry(bodyWithoutImage, Math.max(2, VERTEX_RETRY_ATTEMPTS - 1));
              regionError = null;
            } catch (fallbackError: unknown) {
              regionError = fallbackError;
            }
          }
        }
      }

      if (regionError) {
        lastError = regionError;
        if (
          isVertexRateLimited(regionError) ||
          isVertexTemporarilyUnavailable(regionError) ||
          isVertexModelNotFound(regionError)
        ) {
          continue;
        }
        throw toVertexApiError(regionError);
      }

      const prediction = res?.data?.predictions?.[0];
      const bytes =
        prediction?.bytesBase64Encoded ||
        prediction?.bytes_base64_encoded ||
        prediction?.image?.bytesBase64Encoded ||
        prediction?.image?.bytes_base64_encoded;

      const mimeType = prediction?.mimeType || prediction?.mime_type || 'image/png';

      if (typeof bytes === 'string' && bytes) {
        return `data:${mimeType};base64,${bytes}`;
      }

      lastError = new Error(`Vertex AI did not return image bytes for location ${location}`);
    }

    throw toVertexApiError(lastError, 'Vertex image error (all regions failed)');
  });
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
  apiVersion: VertexApiVersion = 'v1',
  location = VERTEX_LOCATION.trim()
): Promise<any> {
  // IMPORTANT: Veo (and other async publisher model predictions) are polled via `:fetchPredictOperation`.
  // Using GET on `/operations/...` will fail for UUID operation IDs.
  const url = `https://${location}-aiplatform.googleapis.com/${apiVersion}/${endpointName}:fetchPredictOperation`;

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

  return vertexSemaphore.use(async () => {
    const token = await getVertexAccessToken();
    const apiVersion: VertexApiVersion = 'v1';
    let lastError: unknown;

    for (const location of VERTEX_VIDEO_LOCATIONS) {
      const url = `https://${location}-aiplatform.googleapis.com/${apiVersion}/projects/${encodeURIComponent(
        VERTEX_PROJECT_ID
      )}/locations/${encodeURIComponent(location)}/publishers/google/models/${encodeURIComponent(
        modelId
      )}:predictLongRunning`;

      let opRes: any;
      try {
        opRes = await axios.post(url, body, {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });
      } catch (error: unknown) {
        lastError = error;
        if (isVertexRateLimited(error) || isVertexTemporarilyUnavailable(error) || isVertexModelNotFound(error)) {
          continue;
        }
        throw toVertexApiError(error, 'Veo request failed');
      }

      const operationName = opRes?.data?.name;
      if (!operationName) {
        lastError = new Error(`Veo did not return operation name for location ${location}`);
        continue;
      }

      const endpointName = `projects/${encodeURIComponent(VERTEX_PROJECT_ID)}/locations/${encodeURIComponent(
        location
      )}/publishers/google/models/${encodeURIComponent(modelId)}`;

      let finalRes: any;
      try {
        finalRes = await pollPredictOperation(endpointName, operationName, token, 60, apiVersion, location);
      } catch (error: unknown) {
        lastError = error;
        if (isVertexRateLimited(error) || isVertexTemporarilyUnavailable(error)) {
          continue;
        }
        throw toVertexApiError(error, 'Veo polling failed');
      }

      const response = finalRes?.response;

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

      lastError = new Error(`Veo operation completed without video for location ${location}`);
    }

    throw toVertexApiError(lastError, 'Veo error (all regions failed)');
  });
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

async function generateText(
  model: string,
  systemInstruction: string | null,
  userText: string,
  cfg?: { temperature?: number; maxOutputTokens?: number; topP?: number }
): Promise<string> {
  const body: any = {
    contents: [{ role: 'user', parts: [{ text: userText }] }],
    generationConfig: {
      temperature: cfg?.temperature ?? 0.7,
      maxOutputTokens: cfg?.maxOutputTokens ?? 2500,
      topP: cfg?.topP ?? 0.95,
    },
  };

  if (systemInstruction) {
    body.systemInstruction = { parts: [{ text: systemInstruction }] };
  }

  const response = await vertexGenerateContent(model, body);
  return extractText(response).trim();
}

export async function enhancePrompt(prompt: string, options?: { model?: string }): Promise<string> {
  const model = (options?.model || DEFAULT_VERTEX_TEXT_MODEL).trim();

  const systemInstruction =
    'You are an expert ecommerce prompt engineer. Return ONLY the final prompt text, in English. No quotes, no markdown, no extra commentary.';
  const userText =
    `Quyidagi qisqa mahsulot tavsifini professional marketplace promptiga aylantirib ber. ` +
    `Faqat prompt matnini ingliz tilida qaytar:\n\n${prompt}`;

  return generateText(model, systemInstruction, userText);
}

const COPYWRITER_MARKERS = [
  'CAT',
  'NAME',
  'COUNTRY',
  'BRAND',
  'MODEL',
  'WARRANTY',
  'SHORT_DESC',
  'FULL_DESC',
  'PHOTOS_INFO',
  'VIDEO_REC',
  'SPECS',
  'PROPS',
  'INSTR',
  'SIZE',
  'COMP',
  'CARE',
  'SKU',
  'IKPU',
] as const;

function normalizeOneLine(text: string): string {
  return String(text || '').replace(/\s+/g, ' ').trim();
}

const COPYWRITER_LIMITS = {
  NAME_MAX: 90,
  SHORT_DESC_MAX: 390,
  SPECS_LINE_MAX: 255,
} as const;

function clampTextLength(text: string, maxLen: number): string {
  const normalized = normalizeOneLine(text);
  if (normalized.length <= maxLen) return normalized;

  const cut = normalized.slice(0, maxLen);
  const lastSpace = cut.lastIndexOf(' ');
  if (lastSpace > Math.floor(maxLen * 0.6)) {
    return cut.slice(0, lastSpace).trim();
  }
  return cut.trim();
}

function extractLangPart(block: string, lang: 'UZ' | 'RU'): string {
  const text = String(block || '');
  if (lang === 'UZ') {
    const match = text.match(/UZ:\s*([\s\S]*?)(?=\n\s*RU:|$)/i);
    return (match?.[1] || '').trim();
  }
  const match = text.match(/RU:\s*([\s\S]*?)$/i);
  return (match?.[1] || '').trim();
}

function rebuildLangBlock(uz: string, ru: string): string {
  return `UZ: ${uz}\nRU: ${ru}`;
}

function clampLangBlock(block: string, maxLen: number): string {
  let uz = extractLangPart(block, 'UZ');
  let ru = extractLangPart(block, 'RU');

  if (!uz && !ru) {
    const base = clampTextLength(block, maxLen);
    return rebuildLangBlock(base, base);
  }

  if (!uz) uz = ru;
  if (!ru) ru = uz;

  return rebuildLangBlock(clampTextLength(uz, maxLen), clampTextLength(ru, maxLen));
}

function normalizeMultiLine(text: string): string {
  return String(text || '')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function sanitizeFullDescriptionSource(raw: string): string {
  return normalizeMultiLine(raw)
    .replace(/\b(?:variant|вариант)\s*[a-zа-я0-9\s-]*(?:\([^)]*\))?\s*:?/gi, ' ')
    .replace(
      /\b(?:cta\s*urg['`’]?u|cta|call[\s-]*to[\s-]*action|призыв[\s-]*к[\s-]*действию)\s*:?/gi,
      ' '
    )
    .replace(/^\s*\d+[.)-]\s*/gm, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function collectDescriptionIdeas(raw: string): string[] {
  const normalized = sanitizeFullDescriptionSource(raw);
  if (!normalized) return [];

  const lines = normalized
    .split('\n')
    .map((line) =>
      line
        .replace(/^\s*(?:[-*•]|\d+[.)-])\s*/g, '')
        .replace(
          /^(?:asosiy\s+sotuv\s+matni|seo\s+va\s+afzallik|cta\s*urg['`’]?u|главный\s+продающий\s+текст|seo\s+и\s+преимущества)\s*:\s*/i,
          ''
        )
        .trim()
    )
    .filter(Boolean);

  if (lines.length >= 3) return lines;

  const paragraphs = normalized
    .split(/\n{2,}/)
    .map((paragraph) => normalizeOneLine(paragraph))
    .filter(Boolean);

  if (paragraphs.length >= 3) return paragraphs;

  const sentences = (normalized.match(/[^.!?]+[.!?]?/g) || [])
    .map((sentence) => normalizeOneLine(sentence))
    .filter(Boolean);

  if (sentences.length >= 3) return sentences;
  if (sentences.length > 0) return [sentences.join(' ')];
  return [normalizeOneLine(normalized)];
}

function getExpectedImagePromptCount(plan: string): number {
  const normalized = String(plan || '').trim().toLowerCase();
  if (normalized === 'business_plus' || normalized === 'business+') return 4;
  if (normalized === 'pro') return 3;
  if (normalized === 'starter') return 2;
  return 1;
}

function splitPromptItems(text: string): string[] {
  const normalized = normalizeMultiLine(text);
  if (!normalized) return [];

  const lines = normalized
    .split('\n')
    .map((line) =>
      line
        .replace(/^\s*(?:[-*•]|\d+[.)-])\s*/g, '')
        .trim()
    )
    .filter(Boolean);

  if (lines.length >= 2) return lines;

  const bySemicolon = normalized
    .split(/[;|]+/)
    .map((item) =>
      item
        .replace(/^\s*(?:[-*•]|\d+[.)-])\s*/g, '')
        .trim()
    )
    .filter(Boolean);

  if (bySemicolon.length >= 2) return bySemicolon;
  return lines.length > 0 ? lines : [normalizeOneLine(normalized)];
}

function defaultImagePromptTemplate(index: number, lang: 'UZ' | 'RU'): string {
  const presetsUz = [
    "Hero: Mahsulotni 3:4 formatda, premium studio yorug'likda, markazda va toza fon bilan ko'rsating.",
    "Close-up: Material teksturasi, choklar va sifat detallarini yaqin planda, aniq fokus bilan ko'rsating.",
    "Detail: Mahsulotning asosiy ustun jihatini macro uslubda, premium reklama kayfiyatida tasvirlang.",
    "Lifestyle: Mahsulotni real foydalanish kontekstida, dinamik kompozitsiya va tabiiy yorug'lik bilan ko'rsating.",
  ];

  const presetsRu = [
    'Hero: Покажите товар в формате 3:4, с премиальным студийным светом, по центру и на чистом фоне.',
    'Close-up: Покажите фактуру, швы и качество материала крупным планом с четким фокусом.',
    'Detail: Передайте ключевое преимущество товара в макро-кадре в премиальном рекламном стиле.',
    'Lifestyle: Покажите товар в реальном сценарии использования с динамичной композицией и естественным светом.',
  ];

  const list = lang === 'UZ' ? presetsUz : presetsRu;
  return list[Math.min(index, list.length - 1)];
}

function normalizeImagePromptItems(raw: string, count: number, lang: 'UZ' | 'RU'): string {
  const items = splitPromptItems(raw)
    .map((item) => clampTextLength(item, 260))
    .filter(Boolean);

  const finalItems: string[] = [];
  for (let index = 0; index < count; index++) {
    finalItems.push(items[index] || defaultImagePromptTemplate(index, lang));
  }

  return finalItems.map((item, index) => `${index + 1}) ${item}`).join('\n');
}

function clampSpecLines(block: string, maxLenPerLine: number): string {
  const lines = String(block || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) return clampTextLength(block, maxLenPerLine);

  return lines
    .map((line) => {
      const match = line.match(/^((?:[-*•]|\d+[.)])\s+)?([\s\S]*)$/);
      const prefix = match?.[1] || '';
      const content = match?.[2] || line;
      const maxContentLen = Math.max(10, maxLenPerLine - prefix.length);
      return `${prefix}${clampTextLength(content, maxContentLen)}`;
    })
    .join('\n');
}

function getFullDescBounds(plan: string): { min: number; max: number } {
  const normalized = String(plan || '').trim().toLowerCase();
  if (normalized === 'business_plus' || normalized === 'business+') {
    return { min: 2600, max: 4200 };
  }
  if (normalized === 'pro') {
    return { min: 1700, max: 2600 };
  }
  return { min: 1100, max: 1600 };
}

function buildSingleFullDescription(raw: string, lang: 'UZ' | 'RU', minLen: number, maxLen: number): string {
  const text = sanitizeFullDescriptionSource(String(raw || ''));
  if (!text) {
    return lang === 'UZ'
      ? "Mahsulot kundalik foydalanish uchun qulay, puxta va ishonchli yechim bo'lib, dizayn hamda funksionallikni birlashtiradi. Hoziroq buyurtma bering va mahsulotning amaliy afzalliklarini birinchi kundan his qiling."
      : 'Товар сочетает удобство, надежность и продуманный дизайн для ежедневного использования. Оформите заказ сейчас и оцените практические преимущества уже с первых дней.';
  }

  const ideas = collectDescriptionIdeas(text);
  let composed = normalizeOneLine(ideas.join(' ').replace(/\b(?:variant|вариант)\s*[a-zа-я0-9\s-]*:?/gi, ''));

  composed = normalizeOneLine(ideas.join(' '));

  const fillersUz = [
    "Har bir detalida amaliy qulaylik, estetik ko'rinish va uzoq muddatli foydalanish ustuvor qilingan.",
    "Mahsulot o'z segmentida sifat, funksionallik va dizayn uyg'unligi bilan ajralib turadi.",
    "Bu yechim kundalik foydalanishda vaqtni tejaydi va natijani yanada barqaror qiladi.",
  ];
  const fillersRu = [
    'В каждой детали учтены практичность, эстетика и комфорт в повседневном использовании.',
    'Товар выгодно выделяется сочетанием качества, функциональности и современного дизайна.',
    'Это решение помогает экономить время и получать стабильный результат каждый день.',
  ];
  const fillers = lang === 'UZ' ? fillersUz : fillersRu;

  let fillIndex = 0;
  while (composed.length < minLen && fillIndex < 14) {
    composed = `${composed} ${fillers[fillIndex % fillers.length]}`.trim();
    fillIndex += 1;
  }

  const ctaUz = "Hoziroq buyurtma bering va mahsulotning afzalliklarini amalda his qiling.";
  const ctaRu = 'Оформите заказ сейчас и оцените преимущества товара на практике.';
  const hasCta = /buyurtma|xarid|hoziroq|закаж|оформ/i.test(composed);
  const hasCtaNormalized = hasCta || /закаж|оформ/i.test(composed);
  if (!hasCtaNormalized) {
    composed = `${composed} ${lang === 'UZ' ? ctaUz : ctaRu}`.trim();
  }

  return clampTextLength(composed, maxLen);
}

function normalizeCopywriterOutput(rawText: string, plan: string): string {
  const text = String(rawText || '').trim();
  if (!text) return '';

  const sections: Record<string, string> = {};
  for (let index = 0; index < COPYWRITER_MARKERS.length; index++) {
    const key = COPYWRITER_MARKERS[index];
    const nextKey = COPYWRITER_MARKERS[index + 1];
    const pattern = new RegExp(`---${key}---([\\s\\S]*?)(?=---${nextKey}---|$)`);
    const match = text.match(pattern);
    if (match) {
      sections[key] = (match[1] || '').trim();
    }
  }

  if (Object.keys(sections).length === 0) {
    return text;
  }

  if (sections.NAME) {
    sections.NAME = clampLangBlock(sections.NAME, COPYWRITER_LIMITS.NAME_MAX);
  }
  if (sections.SHORT_DESC) {
    sections.SHORT_DESC = clampLangBlock(sections.SHORT_DESC, COPYWRITER_LIMITS.SHORT_DESC_MAX);
  }
  if (sections.SPECS) {
    const uz = clampSpecLines(extractLangPart(sections.SPECS, 'UZ'), COPYWRITER_LIMITS.SPECS_LINE_MAX);
    const ru = clampSpecLines(extractLangPart(sections.SPECS, 'RU'), COPYWRITER_LIMITS.SPECS_LINE_MAX);
    sections.SPECS = rebuildLangBlock(uz, ru);
  }
  if (sections.FULL_DESC) {
    const bounds = getFullDescBounds(plan);
    const uz = buildSingleFullDescription(extractLangPart(sections.FULL_DESC, 'UZ'), 'UZ', bounds.min, bounds.max);
    const ru = buildSingleFullDescription(extractLangPart(sections.FULL_DESC, 'RU'), 'RU', bounds.min, bounds.max);
    sections.FULL_DESC = rebuildLangBlock(uz, ru);
  }
  if (sections.PHOTOS_INFO) {
    const count = getExpectedImagePromptCount(plan);
    const uz = normalizeImagePromptItems(extractLangPart(sections.PHOTOS_INFO, 'UZ'), count, 'UZ');
    const ru = normalizeImagePromptItems(extractLangPart(sections.PHOTOS_INFO, 'RU'), count, 'RU');
    sections.PHOTOS_INFO = rebuildLangBlock(uz, ru);
  }

  return COPYWRITER_MARKERS
    .filter((marker) => Object.prototype.hasOwnProperty.call(sections, marker))
    .map((marker) => `---${marker}---\n${sections[marker]}`)
    .join('\n\n')
    .trim();
}

export async function* generateMarketplaceDescriptionStream(
  images: string[],
  marketplace: string = 'uzum',
  additionalInfo: string = '',
  options?: { model?: string; plan?: string }
): AsyncGenerator<string, void, unknown> {
  const plan = (options?.plan || '').toString().trim().toLowerCase();
  const model = (options?.model || DEFAULT_VERTEX_TEXT_MODEL).trim();
  const expectedImagePrompts = getExpectedImagePromptCount(plan);

  let planRules = '';
  if (plan === 'starter') {
    planRules = `
QO'SHIMCHA TALABLAR (STARTER):
- Matn qisqa va sodda bo'lsin (marketplace uchun tayyor).
- FULL_DESC: taxminan 1100-1600 belgi (UZ va RU alohida), bitta uzluksiz matn.
- SPECS: 6-8 ta band.
- PROPS: 6-8 ta band.
- VIDEO_REC: 1-2 ta qisqa g'oya.`;
  } else if (plan === 'pro') {
    planRules = `
QO'SHIMCHA TALABLAR (PRO):
- Matn to'liq va SEO kuchli bo'lsin.
- FULL_DESC: taxminan 1700-2600 belgi (UZ va RU alohida), bitta uzluksiz matn.
- SPECS: 10-12 ta band.
- PROPS: 8-12 ta band.
- VIDEO_REC: 3-5 ta g'oya.`;
  } else if (plan === 'business_plus' || plan === 'business+') {
    planRules = `
QO'SHIMCHA TALABLAR (BUSINESS+):
- Maksimal detal: agency/katalog darajasida yozing.
- NAME: 1 ta kuchli sotuv nomi bering (har tilda 90 belgidan oshmasin).
- FULL_DESC: taxminan 2600-4200 belgi (UZ va RU alohida), bitta uzluksiz matn.
- SPECS: 15-20 ta band.
- PROPS: 8-12 ta band.
- VIDEO_REC: 4-6 ta g'oya.`;
  }

  const systemInstruction = `Siz professional marketplace-copywriter va SEO mutaxassisiz.
Vazifa: Yuklangan rasmlar asosida ${marketplace} platformasi uchun 18 ta blokdan iborat kartani yaratish.

MUHIM QOIDALAR:
1. HAR BIR blokni ---KEY_NAME--- markeridan boshlang.
2. Har bir band ichida "UZ:" va "RU:" prefikslaridan foydalaning.
3. Toza matn qaytaring: markdown (#, *, _, **) ishlatmang.
4. KAFOLAT: FAQAT "10 kun (ishlab chiqaruvchi nuqsonlari uchun)" deb yozing.
5. LIMITLAR:
   - NAME (tovar nomi): har tilda maksimum ${COPYWRITER_LIMITS.NAME_MAX} belgi.
   - SHORT_DESC (qisqacha tavsif): har tilda maksimum ${COPYWRITER_LIMITS.SHORT_DESC_MAX} belgi.
   - SPECS (tovar xususiyatlari): har bir band maksimum ${COPYWRITER_LIMITS.SPECS_LINE_MAX} belgi.
6. FULL_DESC bo'limida har tilda FAQAT BITTA uzun, copy-pastega tayyor tavsif yozing.
   - Variant A/B/C yozmang.
   - Ro'yxat (1), 2), 3)) yozmang.
   - Sarlavha yoki "CTA:" yorlig'ini yozmang.
   - Oxirgi jumla kuchli chaqiriq (CTA) bo'lsin.
7. PHOTOS_INFO bo'limida har bir tilda aynan ${expectedImagePrompts} ta rasm prompt bo'lsin (na ko'p, na kam).
   - Har prompt alohida qatorda va 1), 2), 3)... formatida yozilsin.
   - Har bir prompt marketplace image generationga tayyor bo'lsin.
8. Matnlar bozorga tayyor bo'lsin: aniq foyda, aniq auditoriya va aniq chaqiriq (CTA) bo'lsin.
${planRules}

MARKERLAR:
---CAT---, ---NAME---, ---COUNTRY---, ---BRAND---, ---MODEL---, ---WARRANTY---, ---SHORT_DESC---, ---FULL_DESC---, ---PHOTOS_INFO---, ---VIDEO_REC---, ---SPECS---, ---PROPS---, ---INSTR---, ---SIZE---, ---COMP---, ---CARE---, ---SKU---, ---IKPU---`;

  const parts: any[] = [];
  for (const img of (images || []).slice(0, 3)) {
    const inline = toInlineDataPart(img);
    if (inline) parts.push(inline);
  }

  parts.push({
    text:
      `Ushbu mahsulot uchun ${marketplace} standartida 18 banddan iborat professional kartani tayyorlang. ` +
      `Qo'shimcha ma'lumot: ${additionalInfo || "Yo'q"}`,
  });

  const body: any = {
    contents: [{ role: 'user', parts }],
    systemInstruction: { parts: [{ text: systemInstruction }] },
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: plan === 'business_plus' || plan === 'business+' ? 6500 : plan === 'pro' ? 5000 : 4000,
      topP: 0.95,
    },
  };

  const response = await vertexGenerateContent(model, body);
  const normalized = normalizeCopywriterOutput(extractText(response).trim(), plan);
  yield normalized;
}

export async function generateVideoScript(
  topic: string,
  platform: string = 'youtube',
  duration: string = '1-3',
  tone: string = 'professional'
): Promise<string> {
  const systemInstruction =
    'You are a senior video script writer. Output a structured script with hook, body, CTA, and on-screen text suggestions. Keep it practical and audience-friendly.';
  const userText = `Topic: ${topic}\nPlatform: ${platform}\nDuration: ${duration} minutes\nTone: ${tone}`;
  return generateText(DEFAULT_VERTEX_TEXT_MODEL, systemInstruction, userText);
}

function extractDualPrompt(text: string): { en: string; uz: string } | null {
  const raw = String(text || '').trim();
  if (!raw) return null;

  const enMatch = raw.match(/\bEN\s*:\s*([\s\S]*?)(?=\n\s*UZ\s*:|$)/i);
  const uzMatch = raw.match(/\bUZ\s*:\s*([\s\S]*?)(?=\n\s*EN\s*:|$)/i);
  const en = (enMatch?.[1] || '').trim();
  const uz = (uzMatch?.[1] || '').trim();
  if (!en && !uz) return null;
  return { en, uz };
}

function clampOneLine(text: string, maxChars: number): string {
  const normalized = String(text || '').replace(/\s+/g, ' ').trim();
  if (!maxChars || maxChars <= 0) return normalized;
  if (normalized.length <= maxChars) return normalized;
  return normalized.slice(0, maxChars).trim();
}

export async function generateVideoPromptBundleFromImages(
  images: string[],
  options: {
    mode: 'basic' | 'pro' | 'premium';
    maxPromptChars: number;
    model?: string;
  }
): Promise<{ promptUz: string; promptEn: string }>
{
  const safeImages = Array.isArray(images) ? images.filter(Boolean).slice(0, 4) : [];
  if (safeImages.length === 0) {
    throw new Error('Kamida bitta rasm kerak.');
  }

  const mode = (options?.mode || 'basic').toString().toLowerCase();
  const maxPromptChars = Math.max(30, Math.min(300, Number(options?.maxPromptChars || 120)));
  const model = (options?.model || DEFAULT_VERTEX_TEXT_MODEL).trim();

  const modeRules =
    mode === 'premium'
      ? 'Premium: rich cinematic motion + subtle camera moves, ad-style pacing.'
      : mode === 'pro'
        ? 'Pro: smooth camera motion, premium lighting, clean ad look.'
        : 'Basic: simple motion, stable camera, clean background.';

  const systemInstruction =
    'You are a video prompt engineer for ecommerce product videos. ' +
    'Given reference product image(s), write a SINGLE short motion prompt for video generation. ' +
    'Preserve the product identity exactly (shape, color, materials, branding). ' +
    'Avoid surreal changes, hallucinated accessories, wrong colors. ' +
    'Return EXACTLY two lines in this format:\n' +
    'UZ: <very short motion prompt in Uzbek (Latin)>, max ' +
    maxPromptChars +
    ' characters\n' +
    'EN: <same prompt in English>, max ' +
    maxPromptChars +
    ' characters\n' +
    'No extra text.';

  const parts: any[] = [];
  for (const img of safeImages) {
    const inline = toInlineDataPart(img);
    if (inline) parts.push(inline);
  }

  parts.push({
    text:
      'Task: Generate a short motion/camera prompt for a product video based on the images. ' +
      `Mode: ${mode}. ${modeRules}. ` +
      'Constraints: no text overlays, no watermark, no logo changes, realistic lighting, clean ecommerce look.'
  });

  const body: any = {
    contents: [{ role: 'user', parts }],
    systemInstruction: { parts: [{ text: systemInstruction }] },
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 350,
      topP: 0.95,
    },
  };

  const response = await vertexGenerateContent(model, body);
  const rawText = extractText(response).trim();

  const parsed = extractDualPrompt(rawText);
  const promptUz = clampOneLine(parsed?.uz || rawText, maxPromptChars);
  const promptEn = clampOneLine(parsed?.en || '', maxPromptChars);
  return { promptUz, promptEn: promptEn || promptUz };
}

export async function generateCopywriterContent(
  contentType: string,
  topic: string,
  tone: string = 'professional',
  length: string = 'medium',
  keywords: string[] = []
): Promise<string> {
  const systemInstruction =
    'You are a direct-response copywriter. Produce conversion-focused Uzbek copy. Avoid vague advice; write the actual copy.';

  const userText =
    `Content type: ${contentType}\n` +
    `Topic/product: ${topic}\n` +
    `Tone: ${tone}\nLength: ${length}\n` +
    `Keywords (if any): ${keywords.join(', ')}`;

  return generateText(DEFAULT_VERTEX_TEXT_MODEL, systemInstruction, userText);
}

export async function analyzeMarketingMetrics(
  metrics: string,
  analysisType: string = 'marketing-metrics'
): Promise<string> {
  const systemInstruction =
    'You are a performance marketing analyst. Analyze the metrics and provide specific actions, calculations, and prioritized recommendations.';
  const userText = `Analysis type: ${analysisType}\n\nMetrics:\n${metrics}`;
  return generateText(DEFAULT_VERTEX_TEXT_MODEL, systemInstruction, userText);
}

export async function chat(message: string, history: ChatMessage[] = []): Promise<string> {
  const systemInstruction =
    "You are Umari AI assistant. Reply in Uzbek by default. Be concise, practical, and helpful for ecommerce and content creation.";

  const contents: any[] = [];
  for (const item of history) {
    const role = item?.role === 'assistant' || item?.role === 'model' ? 'model' : 'user';
    const content = typeof item?.content === 'string' ? item.content : '';
    if (!content) continue;
    contents.push({ role, parts: [{ text: content }] });
  }
  contents.push({ role: 'user', parts: [{ text: message }] });

  const body: any = {
    contents,
    systemInstruction: { parts: [{ text: systemInstruction }] },
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 2500,
      topP: 0.95,
    },
  };

  const response = await vertexGenerateContent(DEFAULT_VERTEX_TEXT_MODEL, body);
  return extractText(response) || '';
}
