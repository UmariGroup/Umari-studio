import { NextRequest, NextResponse } from 'next/server';
import { generateMarketplaceDescriptionStream } from '../../../../services/gemini';
import { asyncGeneratorToStream } from '@/lib/stream-utils';
import {
  BillingError,
  getAuthenticatedUserAccount,
  getCopywriterPolicy,
  getNextPlan,
  recordTokenUsage,
  refundTokens,
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

    if (!images || !Array.isArray(images) || images.length === 0) {
      return new Response('Rasm(lar) kerak', { status: 400 });
    }

    const plan = user.role === 'admin' ? 'business_plus' : user.subscription_plan;
    const policy = getCopywriterPolicy(plan);

    const safeImages = images.slice(0, policy.maxImages);
    const safeAdditionalInfo = additionalInfo.slice(0, policy.maxAdditionalInfoChars);

    // Optional monthly quota (as per product spec)
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
    if (user.role !== 'admin') {
      await reserveTokens({ userId: user.id, tokens: reservedTokens });
    }

    const generator = generateMarketplaceDescriptionStream(safeImages, marketplace, safeAdditionalInfo, {
      model: policy.textModel,
      plan,
    });

    let didComplete = false;

    async function* wrapped(): AsyncGenerator<string, void, unknown> {
      try {
        for await (const chunk of generator) {
          yield chunk;
        }
        didComplete = true;
      } catch (err) {
        if (user.role !== 'admin' && userId && reservedTokens) {
          await refundTokens({ userId, tokens: reservedTokens });
        }
        throw err;
      } finally {
        if (didComplete && user.role !== 'admin') {
          await recordTokenUsage({
            userId: user.id,
            tokensUsed: reservedTokens,
            serviceType: 'copywriter_card',
            modelUsed: policy.textModel,
            prompt: safeAdditionalInfo,
          });
        }
      }
    }

    // Return streaming response
    return new Response(asyncGeneratorToStream(wrapped()), {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Transfer-Encoding': 'chunked',
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

    if (userId && reservedTokens) {
      try {
        await refundTokens({ userId, tokens: reservedTokens });
      } catch {
        // ignore
      }
    }

    return new Response('Copywriter xatosi: maʼlumot yaratib bo‘lmadi', { status: 500 });
  }
}
