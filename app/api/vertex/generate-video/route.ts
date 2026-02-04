
import { NextRequest, NextResponse } from 'next/server';
import { generateMarketplaceVideo } from '@/services/vertex';
import {
  BillingError,
  getAuthenticatedUserAccount,
  getNextPlan,
  getVideoPolicy,
  recordTokenUsage,
  refundTokens,
  reserveTokens,
  VideoMode,
} from '@/lib/subscription';
import { query } from '@/lib/db';

export const maxDuration = 60; // Allow longer timeout for video generation (Vercel/Next.js limit)

function normalizeVideoAspectRatio(value: unknown): '16:9' | '9:16' {
  return value === '9:16' ? '9:16' : '16:9';
}

function inferVideoMode(requestedMode: unknown, model: string): VideoMode {
  const raw = String(requestedMode || '').trim().toLowerCase();
  if (raw === 'basic' || raw === 'pro' || raw === 'premium') return raw as VideoMode;

  const m = (model || '').toLowerCase();
  if (m.includes('veo-3.1-fast')) return 'premium';
  if (m.includes('veo-3.1')) return 'premium';
  if (m.includes('veo-3.0-fast')) return 'pro';
  if (m.includes('veo-3.0')) return 'pro';
  return 'basic';
}

function getVideoServiceType(mode: VideoMode): string {
  if (mode === 'premium') return 'video_generate_premium';
  if (mode === 'pro') return 'video_generate_pro';
  return 'video_generate_basic';
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
    let tokensRemaining = 999999;
    if (user.role !== 'admin') {
      const reserveRes = await reserveTokens({ userId: user.id, tokens: reservedTokens });
      tokensRemaining = reserveRes.tokensRemaining;
    }

    console.log(`[GenerateVideo] Plan=${plan}, Mode=${mode}, Model=${selectedModel}`);

    const videoUrl = await generateMarketplaceVideo(safePrompt, safeImages, selectedModel, aspectRatio);

    if (user.role !== 'admin') {
      await recordTokenUsage({
        userId: user.id,
        tokensUsed: reservedTokens,
        serviceType: getVideoServiceType(mode),
        modelUsed: selectedModel,
        prompt: safePrompt,
      });
    }

    return NextResponse.json({
      success: true,
      videoUrl,
      tokens_charged: reservedTokens,
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

    if (userId && reservedTokens) {
      try {
        await refundTokens({ userId, tokens: reservedTokens });
      } catch {
        // ignore
      }
    }

    const message = error?.message || 'Internal Server Error';
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
