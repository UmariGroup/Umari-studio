import { NextRequest, NextResponse } from 'next/server';
import {
  BillingError,
  getAuthenticatedUserAccount,
  getInfografikaPolicy,
  recordTokenUsage,
  refundTokens,
  reserveTokens,
} from '@/lib/subscription';
import { generateInfografikaImageFromVariant, generateInfografikaVariantsFromImage } from '@/services/gemini';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

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
    const productNameRaw = typeof body?.productName === 'string' ? body.productName : '';
    const productDescriptionRaw = typeof body?.productDescription === 'string' ? body.productDescription : '';

    if (!image || !image.startsWith('data:image/')) {
      return NextResponse.json({ error: 'Rasm kerak (data URL).' }, { status: 400 });
    }

    const plan = user.role === 'admin' ? 'business_plus' : user.subscription_plan;
    const policy = getInfografikaPolicy(plan);

    const productName = productNameRaw.trim().slice(0, policy.maxProductNameChars);
    const productDescription = productDescriptionRaw.trim().slice(0, policy.maxAdditionalInfoChars);

    const combinedInfo = [productName ? `NAME: ${productName}` : '', productDescription ? `DESC: ${productDescription}` : '']
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

    // Professional designer-like render using marketplace image models.
    // Best-effort: if image generation fails for a variant, client will fall back to canvas rendering.
    const imageResults = await Promise.allSettled(
      variants.map(async (v) => {
        const img = await generateInfografikaImageFromVariant(image, v, {
          model: policy.imageModel,
          fallbackModels: policy.imageFallbackModels,
          aspectRatio: '3:4',
        });
        return { ...v, image: img, image_error: null } as (typeof variants)[number] & {
          image?: string | null;
          image_error?: string | null;
        };
      })
    );

    const variantsWithImages = imageResults.map((res, idx) => {
      if (res.status === 'fulfilled') return res.value;
      const msg = res.reason instanceof Error ? res.reason.message : String(res.reason);
      return { ...variants[idx], image: null, image_error: msg.slice(0, 2000) } as (typeof variants)[number] & {
        image?: string | null;
        image_error?: string | null;
      };
    });

    if (user.role !== 'admin') {
      await recordTokenUsage({
        userId: user.id,
        tokensUsed: reservedTokens,
        serviceType: 'infografika_variants',
        modelUsed: `${policy.textModel} + ${policy.imageModel}`,
        prompt: combinedInfo,
      });
    }

    billingSettled = true;

    return NextResponse.json({
      success: true,
      variants: variantsWithImages,
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
