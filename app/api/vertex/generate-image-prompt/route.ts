import { NextRequest, NextResponse } from 'next/server';
import {
  BillingError,
  getAuthenticatedUserAccount,
  getImagePolicy,
  recordTokenUsage,
  refundTokens,
  reserveTokens,
} from '@/lib/subscription';
import { generateMarketplacePromptFromImages } from '@/services/gemini';

export async function POST(request: NextRequest) {
  let userId: string | null = null;
  let reservedTokens = 0;
  let billingSettled = false;
  let reserveMeta: { debited?: { subscription: number; referral: number }; referralDebits?: Array<{ rewardId: string; tokens: number }> } | null = null;

  try {
    const user = await getAuthenticatedUserAccount();
    userId = user.id;

    const body = await request.json().catch(() => null);
    const productImages = Array.isArray(body?.productImages) ? body.productImages.filter(Boolean) : [];
    const requestedModeRaw = typeof body?.mode === 'string' ? body.mode.trim().toLowerCase() : '';
    const requestedMode = requestedModeRaw === 'basic' || requestedModeRaw === 'ultra' ? requestedModeRaw : 'pro';

    if (productImages.length === 0) {
      return NextResponse.json({ error: "Kamida bitta mahsulot rasmi kerak." }, { status: 400 });
    }

    const plan = user.role === 'admin' ? 'business_plus' : user.subscription_plan;
    if (plan === 'free' && user.role !== 'admin') {
      throw new BillingError({
        status: 403,
        code: 'PLAN_RESTRICTED',
        message: "Bu funksiya Starter va undan yuqori tariflarda mavjud.",
        recommendedPlan: 'starter',
      });
    }

    const imagePolicy = getImagePolicy(plan, requestedMode);

    const promptTokenCost = 1;
    reservedTokens = promptTokenCost;

    let tokensRemaining = user.role === 'admin' ? 999999 : Number(user.tokens_remaining || 0);
    if (user.role !== 'admin') {
      const reserveResult = await reserveTokens({ userId: user.id, tokens: promptTokenCost });
      reserveMeta = { debited: reserveResult.debited, referralDebits: reserveResult.referralDebits };
      tokensRemaining = reserveResult.tokensRemaining;
    }

    const prompt = await generateMarketplacePromptFromImages(productImages.slice(0, imagePolicy.maxProductImages), {
      mode: requestedMode,
      outputCount: imagePolicy.outputCount,
    });

    if (user.role !== 'admin') {
      await recordTokenUsage({
        userId: user.id,
        tokensUsed: promptTokenCost,
        serviceType: 'image_prompt_assist',
        modelUsed: null,
        prompt,
      });
    }
    billingSettled = true;

    return NextResponse.json({
      success: true,
      prompt,
      tokens_charged: user.role === 'admin' ? 0 : promptTokenCost,
      tokens_remaining: user.role === 'admin' ? 999999 : Number(tokensRemaining.toFixed(2)),
    });
  } catch (error) {
    if (!billingSettled && userId && reservedTokens > 0) {
      try {
        await refundTokens({
          userId,
          tokens: reservedTokens,
          debited: reserveMeta?.debited,
          referralDebits: reserveMeta?.referralDebits,
        });
      } catch {
        // ignore
      }
    }

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
