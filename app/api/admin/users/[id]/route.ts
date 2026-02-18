import { NextRequest, NextResponse } from 'next/server';
import { getClient, query } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { ensureReferralSchema } from '@/lib/referral';

function coerceNumber(value: unknown): number {
  if (value === null || value === undefined) return 0;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

function parsePositiveInt(raw: string | null, fallback: number, min: number, max: number): number {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(parsed)));
}

export async function GET(req: NextRequest, ctx: { params: { id: string } }) {
  try {
    const admin = await getCurrentUser();
    if (!admin || admin.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized - Admin access required' }, { status: 403 });
    }

    const userId = String(ctx?.params?.id || '').trim();
    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 });
    }

    const searchParams = req.nextUrl.searchParams;
    const usagePage = parsePositiveInt(searchParams.get('usage_page'), 1, 1, 10_000);
    const usageLimit = parsePositiveInt(searchParams.get('usage_limit'), 50, 10, 200);
    const usageOffset = (usagePage - 1) * usageLimit;

    // Ensure referral schema exists for older DBs.
    const client = await getClient();
    try {
      await client.query('BEGIN');
      await ensureReferralSchema(client);
      await client.query('COMMIT');
    } catch {
      try {
        await client.query('ROLLBACK');
      } catch {
        // ignore
      }
      // Continue; the page can still show non-referral data.
    } finally {
      client.release();
    }

    let userRes;
    try {
      userRes = await query(
        `SELECT u.*,
                COALESCE(ref.tokens_referral_remaining, 0)::numeric AS tokens_referral_remaining,
                (COALESCE(u.tokens_remaining, 0) + COALESCE(ref.tokens_referral_remaining, 0))::numeric AS tokens_total,
                ref.tokens_referral_total::numeric AS tokens_referral_total
         FROM users u
         LEFT JOIN LATERAL (
           SELECT
             COALESCE(SUM(rr.tokens_remaining) FILTER (WHERE rr.tokens_remaining > 0 AND (rr.expires_at IS NULL OR rr.expires_at > NOW())), 0) AS tokens_referral_remaining,
             COALESCE(SUM(rr.tokens_awarded), 0) AS tokens_referral_total
           FROM referral_rewards rr
           WHERE rr.referrer_user_id = u.id
         ) ref ON true
         WHERE u.id = $1
         LIMIT 1`,
        [userId]
      );
    } catch {
      userRes = await query(
        `SELECT u.*,
                0::numeric AS tokens_referral_remaining,
                COALESCE(u.tokens_remaining, 0)::numeric AS tokens_total,
                0::numeric AS tokens_referral_total
         FROM users u
         WHERE u.id = $1
         LIMIT 1`,
        [userId]
      );
    }

    if (userRes.rows.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const user = userRes.rows[0];

    // Token usage summary by service
    let usageSummary: Array<{ service_type: string; tokens_used: number; requests: number; last_used_at: string | null }> = [];
    let recentUsage: Array<{
      id: string;
      created_at: string;
      service_type: string;
      tokens_used: number;
      model_used: string | null;
      prompt: string | null;
    }> = [];
    let recentUsageTotal = 0;

    try {
      const usageRes = await query(
        `SELECT service_type,
                COALESCE(SUM(tokens_used), 0)::numeric AS tokens_used,
                COUNT(*)::int AS requests,
                MAX(created_at) AS last_used_at
         FROM token_usage
         WHERE user_id = $1
         GROUP BY service_type
         ORDER BY COALESCE(SUM(tokens_used), 0) DESC`,
        [userId]
      );

      usageSummary = (usageRes.rows || []).map((r: any) => ({
        service_type: String(r.service_type),
        tokens_used: coerceNumber(r.tokens_used),
        requests: Number(r.requests || 0),
        last_used_at: r.last_used_at ? new Date(r.last_used_at).toISOString() : null,
      }));

      const recentCountRes = await query(
        `SELECT COUNT(*)::int AS total
         FROM token_usage
         WHERE user_id = $1`,
        [userId]
      );
      recentUsageTotal = Number(recentCountRes.rows?.[0]?.total || 0);

      const recentRes = await query(
        `SELECT id, created_at, service_type, tokens_used, model_used, prompt
         FROM token_usage
         WHERE user_id = $1
         ORDER BY created_at DESC
         LIMIT $2
         OFFSET $3`,
        [userId, usageLimit, usageOffset]
      );

      recentUsage = (recentRes.rows || []).map((r: any) => ({
        id: String(r.id),
        created_at: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
        service_type: String(r.service_type),
        tokens_used: coerceNumber(r.tokens_used),
        model_used: r.model_used ?? null,
        prompt: r.prompt ?? null,
      }));
    } catch {
      usageSummary = [];
      recentUsage = [];
      recentUsageTotal = 0;
    }

    // Referral: invited users + rewards history for this referrer
    let invitedUsers: Array<any> = [];
    let rewards: Array<any> = [];
    try {
      const invitedRes = await query(
        `SELECT id, email, first_name, last_name, subscription_status, subscription_plan,
                referred_at, created_at
         FROM users
         WHERE referred_by_user_id = $1
         ORDER BY COALESCE(referred_at, created_at) DESC
         LIMIT 200`,
        [userId]
      );
      invitedUsers = (invitedRes.rows || []).map((r: any) => ({
        id: String(r.id),
        email: String(r.email),
        first_name: r.first_name ?? null,
        last_name: r.last_name ?? null,
        subscription_status: r.subscription_status ?? null,
        subscription_plan: r.subscription_plan ?? null,
        referred_at: r.referred_at ? new Date(r.referred_at).toISOString() : null,
        created_at: r.created_at ? new Date(r.created_at).toISOString() : null,
      }));

      const rewardsRes = await query(
        `SELECT rr.id,
                rr.referred_user_id,
                u.email AS referred_email,
                rr.plan,
                rr.tokens_awarded,
                rr.tokens_remaining,
                rr.expires_at,
                rr.created_at
         FROM referral_rewards rr
         LEFT JOIN users u ON u.id = rr.referred_user_id
         WHERE rr.referrer_user_id = $1
         ORDER BY rr.created_at DESC
         LIMIT 200`,
        [userId]
      );

      rewards = (rewardsRes.rows || []).map((r: any) => ({
        id: String(r.id),
        referred_user_id: String(r.referred_user_id),
        referred_email: r.referred_email ? String(r.referred_email) : null,
        plan: String(r.plan || ''),
        tokens_awarded: coerceNumber(r.tokens_awarded),
        tokens_remaining: coerceNumber(r.tokens_remaining),
        expires_at: r.expires_at ? new Date(r.expires_at).toISOString() : null,
        created_at: r.created_at ? new Date(r.created_at).toISOString() : null,
      }));
    } catch {
      // If referral tables aren't present, just show invited users list (if possible) and empty rewards.
      rewards = [];
    }

    return NextResponse.json({
      success: true,
      user: {
        id: String(user.id),
        email: String(user.email),
        first_name: user.first_name ?? null,
        last_name: user.last_name ?? null,
        phone: 'phone' in user ? (user.phone ?? null) : null,
        telegram_username: 'telegram_username' in user ? (user.telegram_username ?? null) : null,
        role: String(user.role || 'user'),
        subscription_status: String(user.subscription_status || 'free'),
        subscription_plan: String(user.subscription_plan || 'free'),
        subscription_expires_at: user.subscription_expires_at ? new Date(user.subscription_expires_at).toISOString() : null,
        tokens_subscription_remaining: coerceNumber(user.tokens_remaining),
        tokens_referral_remaining: coerceNumber(user.tokens_referral_remaining),
        tokens_total: coerceNumber(user.tokens_total),
        tokens_referral_total: coerceNumber(user.tokens_referral_total),
        created_at: user.created_at ? new Date(user.created_at).toISOString() : null,
        referred_by_user_id: user.referred_by_user_id ? String(user.referred_by_user_id) : null,
        referral_code: user.referral_code ? String(user.referral_code) : null,
      },
      usage: {
        summary_by_service: usageSummary,
        recent: recentUsage,
        recent_pagination: {
          page: usagePage,
          limit: usageLimit,
          total: recentUsageTotal,
          pages: Math.max(1, Math.ceil(recentUsageTotal / usageLimit)),
          has_prev: usagePage > 1,
          has_next: usagePage * usageLimit < recentUsageTotal,
        },
      },
      referrals: {
        invited_users: invitedUsers,
        rewards,
      },
    });
  } catch (error) {
    console.error('Admin user detail error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
