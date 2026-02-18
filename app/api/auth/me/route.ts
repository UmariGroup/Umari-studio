import { NextRequest, NextResponse } from 'next/server';
import { BillingError, getAuthenticatedUserAccount, getNextPlan, SUBSCRIPTION_PLANS } from '@/lib/subscription';
import {
  AUTH_COOKIE_NAMES,
  setAuthCookies,
  verifyRefreshToken,
  verifyToken,
} from '@/lib/auth';

/**
 * Get current authenticated user
 */
export async function GET(req: NextRequest) {
  try {
    const accessRaw =
      req.cookies.get(AUTH_COOKIE_NAMES.access)?.value || req.cookies.get(AUTH_COOKIE_NAMES.legacy)?.value;
    const refreshRaw = req.cookies.get(AUTH_COOKIE_NAMES.refresh)?.value;
    const accessPayload = accessRaw ? verifyToken(accessRaw) : null;
    const refreshPayload = refreshRaw ? verifyRefreshToken(refreshRaw) : null;

    const user = await getAuthenticatedUserAccount();
    const planMeta = SUBSCRIPTION_PLANS[user.subscription_plan] || SUBSCRIPTION_PLANS.free;

    const tokensTotal = user.role === 'admin' ? 999999 : planMeta.monthlyTokens;
    const tokensUsed = Math.max(0, Number(tokensTotal) - Number(user.tokens_remaining));

    const isExpired =
      user.subscription_status === 'expired' ||
      (user.subscription_status === 'active' &&
        Boolean(user.subscription_expires_at) &&
        new Date(user.subscription_expires_at as any) <= new Date());

    const outOfTokens = user.role !== 'admin' && Number(user.tokens_remaining) <= 0;
    const blockedReason = isExpired ? 'expired' : outOfTokens ? 'no_tokens' : null;
    const canUse = user.role === 'admin' ? true : !blockedReason;

    const response = NextResponse.json({
      success: true,
      user: {
        ...user,
        subscription_plan_label: planMeta.label,
        tokens_total: tokensTotal,
        tokens_used: tokensUsed,
      },
      can_use: canUse,
      blocked_reason: blockedReason,
      recommended_plan: blockedReason === 'no_tokens' ? getNextPlan(user.subscription_plan) : null,
    });

    if (!accessPayload && refreshPayload) {
      setAuthCookies(response, refreshPayload);
    }

    return response;
  } catch (error) {
    if (error instanceof BillingError) {
      return NextResponse.json(
        { error: error.message, code: error.code, recommended_plan: error.recommendedPlan ?? null },
        { status: error.status }
      );
    }
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
