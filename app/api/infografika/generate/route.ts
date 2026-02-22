import { NextRequest, NextResponse } from 'next/server';
import {
  BillingError,
  getAuthenticatedUserAccount,
  getInfografikaPolicy,
  recordTokenUsage,
  refundTokens,
  reserveTokens,
} from '@/lib/subscription';
import { generateInfografikaVariantsFromImage } from '@/services/gemini';

export async function POST(request: NextRequest) {
  let userId: string | null = null;
  let reservedTokens = 0;
  let billingSettled = false;
  let reserveMeta:
    | {
        debited?: { subscription: number; referral: number };
        referralDebits?: Array<{ rewardId: string; tokens: number }>;
      }
    | null = null;

  try {
    const user = await getAuthenticatedUserAccount();
    userId = user.id;

    const body = await request.json().catch(() => null);
    const image = typeof body?.image === 'string' ? body.image : '';
    const productName = typeof body?.productName === 'string' ? body.productName : '';
    const productDescription = typeof body?.productDescription === 'string' ? body.productDescription : '';

    if (!image || !image.startsWith('data:image/')) {
      return NextResponse.json({ error: 'Rasm kerak (data URL).' }, { status: 400 });
    }

    const plan = user.role === 'admin' ? 'business_plus' : user.subscription_plan;
    const policy = getInfografikaPolicy(plan);

    const combinedInfo = [
      productName ? `NAME: ${productName}` : '',
      productDescription ? `DESC: ${productDescription}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    reservedTokens = Number(policy.costPerGenerate.toFixed(2));
    if (user.role !== 'admin') {
      const reserveRes = await reserveTokens({ userId: user.id, tokens: reservedTokens });
      reserveMeta = { debited: reserveRes.debited, referralDebits: reserveRes.referralDebits };
    }

    const variants = await generateInfografikaVariantsFromImage(image, {
      model: policy.textModel,
      variantCount: policy.variantCount,
      additionalInfo: combinedInfo.slice(0, policy.maxAdditionalInfoChars),
      language: 'uz',
    });

    if (user.role !== 'admin') {
      await recordTokenUsage({
        userId: user.id,
        tokensUsed: reservedTokens,
        serviceType: 'infografika_variants',
        modelUsed: policy.textModel,
        prompt: combinedInfo,
      });
    }

    billingSettled = true;

    return NextResponse.json({
      success: true,
      variants,
      variant_count: policy.variantCount,
      tokens_charged: user.role === 'admin' ? 0 : reservedTokens,
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
    return NextResponse.json({ error: message || 'Infografika yaratishda xatolik.' }, { status: 500 });
  }
}
