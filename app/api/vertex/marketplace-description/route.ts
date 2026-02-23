import { NextRequest, NextResponse } from 'next/server';
import { generateMarketplaceDescriptionStream } from '@/services/vertex';
import {
  BillingError,
  getAuthenticatedUserAccount,
  getCopywriterPolicy,
  getNextPlan,
  recordTokenUsage,
  reserveTokens,
} from '@/lib/subscription';
import { query } from '@/lib/db';

export async function POST(request: NextRequest) {
  let userId: string | null = null;
  let reservedTokens = 0;

  try {
    const user = await getAuthenticatedUserAccount();
    userId = user.id;

    const body = await request.json();
    const images = Array.isArray(body?.images) ? body.images.filter(Boolean) : [];
    const marketplace = typeof body?.marketplace === 'string' ? body.marketplace : 'uzum';
    const additionalInfo = typeof body?.additionalInfo === 'string' ? body.additionalInfo : '';

    if (!images || images.length === 0) {
      return new Response("Rasm(lar) kerak", { status: 400 });
    }

    const plan = user.role === 'admin' ? 'business_plus' : user.subscription_plan;
    const policy = getCopywriterPolicy(plan);

    const safeImages = images.slice(0, policy.maxImages);
    const safeAdditionalInfo = additionalInfo.slice(0, policy.maxAdditionalInfoChars);

    if (user.role !== 'admin' && plan === 'pro' && user.subscription_expires_at) {
      const periodEnd = new Date(user.subscription_expires_at);
      const periodStart = new Date(periodEnd);
      periodStart.setMonth(periodStart.getMonth() - 1);

      const countRes = await query(
        `SELECT COUNT(*)::int AS count
         FROM token_usage
         WHERE user_id = $1
           AND service_type = 'copywriter_card'
           AND created_at >= $2
           AND created_at < $3`,
        [user.id, periodStart, periodEnd]
      );

      const used = Number(countRes.rows[0]?.count || 0);
      const maxPerMonth = 15;
      if (used >= maxPerMonth) {
        throw new BillingError({
          status: 403,
          code: 'PLAN_RESTRICTED',
          message: `Bu oy uchun Copywriter limiti tugadi (${maxPerMonth} ta). Business+ tarifga o'ting.`,
          recommendedPlan: getNextPlan(plan),
        });
      }
    }

    reservedTokens = Number(policy.costPerCard.toFixed(2));
    if (user.role !== 'admin' && Number(user.tokens_remaining || 0) < reservedTokens) {
      throw new BillingError({
        status: 402,
        code: 'INSUFFICIENT_TOKENS',
        message: "Tokenlaringiz yetarli emas. Tarifni yangilang yoki yuqori tarifga o'ting.",
        recommendedPlan: getNextPlan(plan),
      });
    }

    const generator = generateMarketplaceDescriptionStream(safeImages, marketplace, safeAdditionalInfo, {
      model: policy.textModel,
      plan,
    });

    let fullText = '';
    for await (const chunk of generator) {
      fullText += chunk;
    }

    if (user.role !== 'admin') {
      await reserveTokens({ userId: user.id, tokens: reservedTokens });
      await recordTokenUsage({
        userId: user.id,
        tokensUsed: reservedTokens,
        serviceType: 'copywriter_card',
        modelUsed: policy.textModel,
        prompt: safeAdditionalInfo,
      });
    }

    return new Response(fullText, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
      },
    });
  } catch (error) {
    console.error('Marketplace description error:', error);

    if (error instanceof BillingError) {
      return NextResponse.json(
        { error: error.message, code: error.code, recommended_plan: error.recommendedPlan ?? null },
        { status: error.status }
      );
    }

    const message = error instanceof Error ? error.message : String(error);
    const isRateLimited =
      message.includes('Vertex AI error (429') ||
      message.includes('RESOURCE_EXHAUSTED') ||
      message.toLowerCase().includes('quota') ||
      message.toLowerCase().includes('too many requests');
    if (isRateLimited) {
      return new Response(
        "Vertex quota band. Avto region fallback ishladi, lekin hamma region band bo'ldi. 20-60 soniya kutib qayta urinib ko'ring.",
        {
          status: 429,
          headers: {
            'Retry-After': '25',
          },
        }
      );
    }

    const lower = message.toLowerCase();
    if (lower.includes('publisher model') || lower.includes('not found') || lower.includes('does not have access')) {
      return new Response("Tanlangan model bu loyiha uchun mavjud emas. Fallback modelga o'tildi, iltimos qayta urinib ko'ring.", { status: 400 });
    }

    return new Response("Copywriter xatosi: ma'lumot yaratib bo'lmadi", { status: 500 });
  }
}
