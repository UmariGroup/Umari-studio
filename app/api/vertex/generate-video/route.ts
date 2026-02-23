
import { NextRequest, NextResponse } from 'next/server';
import { generateMarketplaceVideo, generateMarketplaceVideoUpsampled } from '@/services/vertex';
import {
  BillingError,
  getAuthenticatedUserAccount,
  getNextPlan,
  getVideoPolicy,
  recordTokenUsage,
  reserveTokens,
  VideoMode,
} from '@/lib/subscription';
import { query } from '@/lib/db';
import { promises as fs } from 'fs';
import path from 'path';

export const maxDuration = 60; // Allow longer timeout for video generation (Vercel/Next.js limit)

function normalizeVideoAspectRatio(value: unknown): '16:9' | '9:16' {
  return value === '9:16' ? '9:16' : '16:9';
}

function inferVideoMode(requestedMode: unknown, model: string): VideoMode {
  const raw = String(requestedMode || '').trim().toLowerCase();
  if (raw === 'basic' || raw === 'pro' || raw === 'premium') return raw as VideoMode;

  const m = (model || '').toLowerCase();
  if (m.includes('upsampler')) return 'premium';
  if (m.includes('veo-3.0-generate')) return 'pro';
  if (m.includes('veo-3.0-fast')) return 'basic';
  if (m.includes('veo-3.0')) return 'pro';
  return 'basic';
}

function getVideoServiceType(mode: VideoMode): string {
  if (mode === 'premium') return 'video_generate_premium';
  if (mode === 'pro') return 'video_generate_pro';
  return 'video_generate_basic';
}

function getTargetVideoDurationSeconds(plan: string, mode: VideoMode): number | null {
  if (plan === 'starter') {
    return mode === 'basic' ? 4 : null;
  }

  if (plan === 'pro') {
    if (mode === 'basic') return 6;
    if (mode === 'pro') return 6;
    return null;
  }

  if (plan === 'business_plus') {
    if (mode === 'basic') return 4;
    if (mode === 'pro') return 6;
    if (mode === 'premium') return 8;
  }

  return null;
}

function getSupportedDurationsForModel(model: string): number[] | null {
  const m = String(model || '').toLowerCase();
  if (m.includes('veo-3.0-fast') || m.includes('veo-3.0-generate')) {
    return [4, 6, 8];
  }
  return null;
}

function pickNearestDuration(target: number, supported: number[]): number {
  let best = supported[0];
  let bestDistance = Math.abs(best - target);

  for (const value of supported.slice(1)) {
    const distance = Math.abs(value - target);
    if (distance < bestDistance || (distance === bestDistance && value > best)) {
      best = value;
      bestDistance = distance;
    }
  }

  return best;
}

function parseSupportedDurationsFromError(message: string): number[] | null {
  const match = /supported durations are\s*\[([^\]]+)\]/i.exec(String(message || ''));
  if (!match) return null;

  const values = match[1]
    .split(',')
    .map((part) => Number(part.trim()))
    .filter((value) => Number.isFinite(value) && value > 0)
    .map((value) => Math.round(value));

  return values.length > 0 ? Array.from(new Set(values)).sort((a, b) => a - b) : null;
}

function getMonthlyVideoLimit(plan: string, mode: VideoMode): number | null {
  if (plan === 'pro') {
    if (mode === 'pro') return 4;
    if (mode === 'basic') return 6;
  }
  if (plan === 'business_plus') {
    if (mode === 'premium') return 5;
    if (mode === 'pro') return 7;
    return 10;
  }
  return null; // Starter: token-limited only (no hard cap in spec)
}

async function ensureVideoJobsTable(): Promise<void> {
  await query(
    `CREATE TABLE IF NOT EXISTS video_jobs (
      id UUID PRIMARY KEY,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      status VARCHAR(32) NOT NULL CHECK (status IN ('processing','succeeded','failed')),
      original_video_url TEXT,
      upscaled_video_url TEXT,
      base_model VARCHAR(128),
      upscale_model VARCHAR(128),
      aspect_ratio VARCHAR(16),
      error_text TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`
  );
  await query(`CREATE INDEX IF NOT EXISTS idx_video_jobs_user ON video_jobs(user_id)`);
}

function parseDataUrl(dataUrl: string): { mimeType: string; data: string } | null {
  const match = /^data:([^;]+);base64,(.+)$/.exec(dataUrl);
  if (!match) return null;
  return { mimeType: match[1], data: match[2] };
}

function extensionForMime(mimeType: string): string {
  switch (mimeType) {
    case 'video/mp4':
      return 'mp4';
    case 'video/webm':
      return 'webm';
    case 'video/quicktime':
      return 'mov';
    default:
      return 'mp4';
  }
}

async function tryPersistVideoDataUrlToPublic(videoUrl: string): Promise<string | null> {
  const parsed = parseDataUrl(videoUrl);
  if (!parsed) return null;
  if (!parsed.mimeType.startsWith('video/')) return null;

  const ext = extensionForMime(parsed.mimeType);
  const dir = path.join(process.cwd(), 'public', 'generated', 'videos');
  await fs.mkdir(dir, { recursive: true });

  let fileName = '';
  try {
    fileName = `${crypto.randomUUID()}.${ext}`;
  } catch {
    fileName = `${Date.now()}-${Math.random().toString(16).slice(2)}.${ext}`;
  }

  const filePath = path.join(dir, fileName);
  const buffer = Buffer.from(parsed.data, 'base64');
  await fs.writeFile(filePath, buffer);
  return `/generated/videos/${fileName}`;
}

export async function POST(req: NextRequest) {
  let userId: string | null = null;
  let reservedTokens = 0;

  try {
    const user = await getAuthenticatedUserAccount();
    userId = user.id;

    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const prompt = typeof body?.prompt === 'string' ? body.prompt.trim() : '';
    const modelInput = typeof body?.model === 'string' ? body.model.trim() : '';
    const aspectRatio = normalizeVideoAspectRatio(body?.aspectRatio);

    const imagesRaw = Array.isArray(body?.images) ? body.images : body?.image ? [body.image] : [];
    const images = imagesRaw.filter(Boolean);

    if (!prompt && images.length === 0) {
      return NextResponse.json(
        { error: 'Prompt yoki rasm kerak (video uchun).' },
        { status: 400 }
      );
    }

    const mode = inferVideoMode(body?.mode, modelInput);
    const plan = user.role === 'admin' ? 'business_plus' : user.subscription_plan;
    const policy = getVideoPolicy(plan, mode);

    const selectedModel = (modelInput || policy.allowedModels[0] || '').trim();
    if (!selectedModel || !policy.allowedModels.includes(selectedModel)) {
      throw new BillingError({
        status: 403,
        code: 'PLAN_RESTRICTED',
        message: `Bu tarifda tanlangan model ishlamaydi. Ruxsat etilgan model(lar): ${policy.allowedModels.join(
          ', '
        )}`,
        recommendedPlan: null,
      });
    }

    const safePrompt = prompt.slice(0, policy.maxPromptChars);
    const targetDurationSeconds = getTargetVideoDurationSeconds(plan, mode);
    const supportedDurations = getSupportedDurationsForModel(selectedModel);
    let effectiveDurationSeconds =
      targetDurationSeconds && supportedDurations
        ? pickNearestDuration(targetDurationSeconds, supportedDurations)
        : targetDurationSeconds;

    const safeImages = images.slice(0, policy.maxImages);

    // Monthly cap (per plan rules)
    if (user.role !== 'admin') {
      const limit = getMonthlyVideoLimit(plan, mode);
      if (limit && user.subscription_expires_at) {
        const periodEnd = new Date(user.subscription_expires_at);
        const periodStart = new Date(periodEnd);
        periodStart.setMonth(periodStart.getMonth() - 1);

        const serviceType = getVideoServiceType(mode);
        const countRes = await query(
          `SELECT COUNT(*)::int AS count
           FROM token_usage
           WHERE user_id = $1
             AND service_type = $2
             AND created_at >= $3
             AND created_at < $4`,
          [user.id, serviceType, periodStart, periodEnd]
        );

        const used = Number(countRes.rows[0]?.count || 0);
        if (used >= limit) {
          throw new BillingError({
            status: 403,
            code: 'PLAN_RESTRICTED',
            message: `Bu oy uchun video limiti tugadi (${used}/${limit}). Tarifni yangilang yoki yuqori tarifga o'ting.`,
            recommendedPlan: getNextPlan(plan),
          });
        }
      }
    }

    reservedTokens = Number(policy.costPerVideo.toFixed(2));
    let tokensRemaining = user.role === 'admin' ? 999999 : Number(user.tokens_remaining || 0);
    if (user.role !== 'admin' && tokensRemaining < reservedTokens) {
      throw new BillingError({
        status: 402,
        code: 'INSUFFICIENT_TOKENS',
        message: "Tokenlaringiz yetarli emas. Tarifni yangilang yoki yuqori tarifga o'ting.",
        recommendedPlan: getNextPlan(plan),
      });
    }

    console.log(`[GenerateVideo] Plan=${plan}, Mode=${mode}, Model=${selectedModel}`);

    let durationPrompt =
      effectiveDurationSeconds && effectiveDurationSeconds > 0
        ? `${safePrompt}\n\nCRITICAL: Final video duration must be exactly ${effectiveDurationSeconds} seconds.`
        : safePrompt;

    let rawVideoUrl: string;
    try {
      rawVideoUrl = await generateMarketplaceVideo(
        durationPrompt,
        safeImages,
        selectedModel,
        aspectRatio,
        effectiveDurationSeconds || undefined
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      const supportedFromError = parseSupportedDurationsFromError(message);

      if (!supportedFromError || !effectiveDurationSeconds) {
        throw err;
      }

      const fallbackDuration = pickNearestDuration(effectiveDurationSeconds, supportedFromError);
      if (fallbackDuration === effectiveDurationSeconds) {
        throw err;
      }

      effectiveDurationSeconds = fallbackDuration;
      durationPrompt = `${safePrompt}\n\nCRITICAL: Final video duration must be exactly ${effectiveDurationSeconds} seconds.`;

      rawVideoUrl = await generateMarketplaceVideo(
        durationPrompt,
        safeImages,
        selectedModel,
        aspectRatio,
        effectiveDurationSeconds
      );
    }
    let persisted: string | null = null;
    try {
      persisted = await tryPersistVideoDataUrlToPublic(rawVideoUrl);
    } catch {
      // best-effort only (containers can be read-only)
      persisted = null;
    }
    const videoUrl = persisted || rawVideoUrl;

    if (user.role !== 'admin') {
      const reserveRes = await reserveTokens({ userId: user.id, tokens: reservedTokens });
      tokensRemaining = reserveRes.tokensRemaining;

      await recordTokenUsage({
        userId: user.id,
        tokensUsed: reservedTokens,
        serviceType: getVideoServiceType(mode),
        modelUsed:
          plan === 'business_plus' && mode === 'premium' && policy.upsamplerModel
            ? `${selectedModel} + ${policy.upsamplerModel}`
            : selectedModel,
        prompt: safePrompt,
      });
    }

    let upscaleJobId: string | null = null;
    if (plan === 'business_plus' && mode === 'premium' && policy.upsamplerModel) {
      await ensureVideoJobsTable();

      try {
        upscaleJobId = crypto.randomUUID();
      } catch {
        upscaleJobId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      }

      await query(
        `INSERT INTO video_jobs (id, user_id, status, original_video_url, base_model, upscale_model, aspect_ratio, updated_at)
         VALUES ($1, $2, 'processing', $3, $4, $5, $6, NOW())`,
        [
          upscaleJobId,
          user.id,
          videoUrl,
          selectedModel,
          policy.upsamplerModel,
          aspectRatio,
        ]
      );

      // Fire-and-forget background upscale
      void (async () => {
        try {
          // Prefer upsampling the generated video output if it's a data URL / GCS URI.
          const upscaledRaw = await generateMarketplaceVideoUpsampled(
            durationPrompt,
            safeImages,
            aspectRatio,
            rawVideoUrl
          );
          let upscaledPersisted: string | null = null;
          try {
            upscaledPersisted = await tryPersistVideoDataUrlToPublic(upscaledRaw);
          } catch {
            upscaledPersisted = null;
          }
          const upscaledUrl = upscaledPersisted || upscaledRaw;

          await query(
            `UPDATE video_jobs
             SET status = 'succeeded',
                 upscaled_video_url = $1,
                 updated_at = NOW()
             WHERE id = $2 AND user_id = $3`,
            [upscaledUrl, upscaleJobId, user.id]
          );
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          try {
            await query(
              `UPDATE video_jobs
               SET status = 'failed',
                   error_text = $1,
                   updated_at = NOW()
               WHERE id = $2 AND user_id = $3`,
              [msg.slice(0, 5000), upscaleJobId, user.id]
            );
          } catch {
            // ignore
          }
        }
      })();
    }

    return NextResponse.json({
      success: true,
      videoUrl,
      upscaleJobId,
      requested_duration_seconds: targetDurationSeconds,
      duration_seconds: effectiveDurationSeconds,
      tokens_charged: user.role === 'admin' ? 0 : reservedTokens,
      tokens_remaining: user.role === 'admin' ? 999999 : Number(tokensRemaining.toFixed(2)),
    });
  } catch (error: any) {
    console.error('Generate video error:', error);

    if (error instanceof BillingError) {
      return NextResponse.json(
        { error: error.message, code: error.code, recommended_plan: error.recommendedPlan ?? null },
        { status: error.status }
      );
    }

    const message = error?.message || 'Internal Server Error';

    // Vertex safety policy / sensitive words block
    if (
      typeof message === 'string' &&
      (message.toLowerCase().includes('sensitive words') ||
        message.toLowerCase().includes('responsible ai') ||
        message.toLowerCase().includes('violat') && message.toLowerCase().includes('practices'))
    ) {
      return NextResponse.json(
        {
          error:
            "Prompt Google Responsible AI qoidalariga mos kelmadi. Iltimos, promptni yumshoqroq/neytral qilib qayta yozing (taqiqlangan yoki sezgir so'zlarsiz).",
          code: 'PROMPT_POLICY_BLOCKED',
        },
        { status: 400 }
      );
    }
    const status =
      message.includes('(400') ? 400 :
        message.includes('(401') ? 401 :
          message.includes('(403') ? 403 :
            message.includes('(404') ? 404 :
              message.includes('(429') ? 429 :
                message.includes('(503') ? 503 :
                  message.includes('(504') ? 504 :
                    500;

    return NextResponse.json({ error: message }, { status });
  }
}
