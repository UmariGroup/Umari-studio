import { NextRequest, NextResponse } from 'next/server';
import { getClient, query } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import {
  ensureReferralSchema,
  ensureUserReferralCode,
} from '@/lib/referral';

function maskEmail(email: string): string {
  const at = email.indexOf('@');
  if (at <= 1) return email;
  const name = email.slice(0, at);
  const domain = email.slice(at);
  const masked = name.length <= 2 ? `${name[0]}*` : `${name.slice(0, 2)}***`;
  return `${masked}${domain}`;
}

export async function GET(req: NextRequest) {
  try {
    const session = await getCurrentUser();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const client = await getClient();
    try {
      await client.query('BEGIN');
      await ensureReferralSchema(client);
      const referralCode = await ensureUserReferralCode(client, session.id);
      await client.query('COMMIT');

      const rewardsRes = await query(
        `SELECT COUNT(*)::int AS rewards_count,
                COALESCE(SUM(tokens_awarded), 0)::int AS tokens_earned
         FROM referral_rewards
         WHERE referrer_user_id = $1`,
        [session.id]
      );

      const invitedRes = await query(
        `SELECT u.id,
                u.email,
                u.first_name,
                u.created_at,
                u.subscription_plan,
                u.subscription_status,
                u.referred_at,
                rr.tokens_awarded,
                rr.plan AS rewarded_plan,
                rr.created_at AS rewarded_at
         FROM users u
         LEFT JOIN referral_rewards rr ON rr.referred_user_id = u.id
         WHERE u.referred_by_user_id = $1
         ORDER BY u.created_at DESC
         LIMIT 200`,
        [session.id]
      );

      const rewardsSummary = rewardsRes.rows?.[0] || { rewards_count: 0, tokens_earned: 0 };

      return NextResponse.json({
        success: true,
        referral_code: referralCode,
        stats: {
          invited_count: invitedRes.rows.length,
          rewards_count: Number(rewardsSummary.rewards_count || 0),
          tokens_earned: Number(rewardsSummary.tokens_earned || 0),
        },
        invited_users: invitedRes.rows.map((r: any) => ({
          id: String(r.id),
          email_masked: r.email ? maskEmail(String(r.email)) : null,
          first_name: r.first_name ?? null,
          created_at: r.created_at ? new Date(r.created_at).toISOString() : null,
          referred_at: r.referred_at ? new Date(r.referred_at).toISOString() : null,
          subscription_plan: r.subscription_plan ?? null,
          subscription_status: r.subscription_status ?? null,
          reward: r.tokens_awarded
            ? {
                tokens_awarded: Number(r.tokens_awarded),
                plan: r.rewarded_plan,
                created_at: r.rewarded_at ? new Date(r.rewarded_at).toISOString() : null,
              }
            : null,
        })),
      });
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
  } catch (error) {
    console.error('Referrals API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
