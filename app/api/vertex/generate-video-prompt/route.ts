import { NextRequest, NextResponse } from 'next/server';
import {
  BillingError,
  getAuthenticatedUserAccount,
  getVideoPolicy,
  recordTokenUsage,
  reserveTokens,
} from '@/lib/subscription';
import { generateVideoPromptBundleFromImages } from '@/services/vertex';

export async function POST(request: NextRequest) {
  let reservedTokens = 0;

  try {
    const user = await getAuthenticatedUserAccount();

    const body = await request.json().catch(() => null);
    const images = Array.isArray(body?.images)
      ? body.images.filter(Boolean)
      : Array.isArray(body?.productImages)
        ? body.productImages.filter(Boolean)
        : [];

    const requestedModeRaw = typeof body?.mode === 'string' ? body.mode.trim().toLowerCase() : '';
    const requestedMode = requestedModeRaw === 'pro' || requestedModeRaw === 'premium' ? requestedModeRaw : 'basic';

    if (images.length === 0) {
      return NextResponse.json({ error: 'Kamida bitta rasm kerak.' }, { status: 400 });
    }

    const plan = user.role === 'admin' ? 'business_plus' : user.subscription_plan;
    if (plan === 'free' && user.role !== 'admin') {
      throw new BillingError({
        status: 403,
        code: 'PLAN_RESTRICTED',
        message: 'Bu funksiya Starter va undan yuqori tariflarda mavjud.',
        recommendedPlan: 'starter',
      });
    }

    const policy = getVideoPolicy(plan, requestedMode as any);

    const promptTokenCost = 1;
    reservedTokens = promptTokenCost;
    let tokensRemaining = user.role === 'admin' ? 999999 : Number(user.tokens_remaining || 0);
    if (user.role !== 'admin' && tokensRemaining < promptTokenCost) {
      throw new BillingError({
        status: 402,
        code: 'INSUFFICIENT_TOKENS',
        message: "Tokenlaringiz yetarli emas. Tarifni yangilang yoki yuqori tarifga o'ting.",
        recommendedPlan: plan === 'free' ? 'starter' : null,
      });
    }

    const { promptUz, promptEn } = await generateVideoPromptBundleFromImages(
      images.slice(0, policy.maxImages),
      {
        mode: requestedMode as any,
        maxPromptChars: policy.maxPromptChars,
      }
    );

    if (user.role !== 'admin') {
      const reserveResult = await reserveTokens({ userId: user.id, tokens: promptTokenCost });
      tokensRemaining = reserveResult.tokensRemaining;
      await recordTokenUsage({
        userId: user.id,
        tokensUsed: promptTokenCost,
        serviceType: 'video_prompt_assist',
        modelUsed: null,
        prompt: promptUz,
      });
    }

    return NextResponse.json({
      success: true,
      prompt: promptUz,
      prompt_uz: promptUz,
      prompt_en: promptEn,
      tokens_charged: user.role === 'admin' ? 0 : promptTokenCost,
      tokens_remaining: user.role === 'admin' ? 999999 : Number(tokensRemaining.toFixed(2)),
    });
  } catch (error) {
    if (error instanceof BillingError) {
      return NextResponse.json(
        { error: error.message, code: error.code, recommended_plan: error.recommendedPlan ?? null },
        { status: error.status }
      );
    }

    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message || 'Prompt yaratishda xatolik.' }, { status: 500 });
  }
}
