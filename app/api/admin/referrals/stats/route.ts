import { NextRequest, NextResponse } from 'next/server';
import { getClient, query } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { ensureReferralSchema } from '@/lib/referral';

export async function GET(req: NextRequest) {
  try {
    const admin = await getCurrentUser();
    if (!admin || admin.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized - Admin access required' }, { status: 403 });
    }

    // Ensure schema exists for older DBs
    const client = await getClient();
    try {
      await client.query('BEGIN');
      await ensureReferralSchema(client);
      await client.query('COMMIT');
    } catch (err) {
      try {
        await client.query('ROLLBACK');
      } catch {
        // ignore
      }
      throw err;
    } finally {
      client.release();
    }

    const totalsRes = await query(
      `SELECT
         (SELECT COUNT(*)::int FROM users WHERE referred_by_user_id IS NOT NULL) AS invited_users,
         (SELECT COUNT(*)::int FROM referral_rewards) AS rewarded_users,
         (SELECT COALESCE(SUM(tokens_awarded), 0)::int FROM referral_rewards) AS tokens_awarded`,
      []
    );

    const byPlanRes = await query(
      `SELECT plan,
              COUNT(*)::int AS rewards_count,
              COALESCE(SUM(tokens_awarded), 0)::int AS tokens_awarded
       FROM referral_rewards
       GROUP BY plan`,
      []
    );

    const topReferrersRes = await query(
      `WITH invited AS (
         SELECT referred_by_user_id AS referrer_user_id, COUNT(*)::int AS invited_count
         FROM users
         WHERE referred_by_user_id IS NOT NULL
         GROUP BY referred_by_user_id
       ),
       rewards AS (
         SELECT referrer_user_id,
                COUNT(*)::int AS rewards_count,
                COALESCE(SUM(tokens_awarded), 0)::int AS tokens_awarded
         FROM referral_rewards
         GROUP BY referrer_user_id
       )
       SELECT u.id,
              u.email,
              u.first_name,
              COALESCE(inv.invited_count, 0)::int AS invited_count,
              COALESCE(r.rewards_count, 0)::int AS rewards_count,
              COALESCE(r.tokens_awarded, 0)::int AS tokens_awarded
       FROM users u
       LEFT JOIN invited inv ON inv.referrer_user_id = u.id
       LEFT JOIN rewards r ON r.referrer_user_id = u.id
       WHERE u.role = 'user'
         AND (COALESCE(inv.invited_count, 0) > 0 OR COALESCE(r.rewards_count, 0) > 0)
       ORDER BY COALESCE(r.tokens_awarded, 0) DESC, COALESCE(inv.invited_count, 0) DESC
       LIMIT 30`,
      []
    );

    const totals = totalsRes.rows?.[0] || { invited_users: 0, rewarded_users: 0, tokens_awarded: 0 };
    const byPlan: Record<string, { rewards_count: number; tokens_awarded: number }> = {
      starter: { rewards_count: 0, tokens_awarded: 0 },
      pro: { rewards_count: 0, tokens_awarded: 0 },
      business_plus: { rewards_count: 0, tokens_awarded: 0 },
    };

    for (const row of byPlanRes.rows || []) {
      const key = String(row.plan || '').toLowerCase();
      if (!key) continue;
      byPlan[key] = {
        rewards_count: Number(row.rewards_count || 0),
        tokens_awarded: Number(row.tokens_awarded || 0),
      };
    }

    return NextResponse.json({
      success: true,
      totals: {
        invited_users: Number(totals.invited_users || 0),
        rewarded_users: Number(totals.rewarded_users || 0),
        tokens_awarded: Number(totals.tokens_awarded || 0),
      },
      by_plan: byPlan,
      top_referrers: (topReferrersRes.rows || []).map((r: any) => ({
        id: String(r.id),
        email: String(r.email),
        first_name: r.first_name ?? null,
        invited_count: Number(r.invited_count || 0),
        rewards_count: Number(r.rewards_count || 0),
        tokens_awarded: Number(r.tokens_awarded || 0),
      })),
    });
  } catch (error) {
    console.error('Admin referral stats error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
