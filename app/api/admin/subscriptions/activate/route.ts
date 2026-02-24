import { NextRequest, NextResponse } from 'next/server';
import { getClient } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { normalizeSubscriptionPlan, SUBSCRIPTION_PLANS, SubscriptionPlan } from '@/lib/subscription';
import { applyReferralRewardForPurchase, ensureReferralSchema } from '@/lib/referral';

const PLAN_DB_NAME: Record<SubscriptionPlan, string> = {
  free: 'Free',
  starter: 'Starter',
  pro: 'Pro',
  business_plus: 'Business+',
};

export async function POST(req: NextRequest) {
  const admin = await getCurrentUser();
  if (!admin || admin.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized - Admin access required' }, { status: 403 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const userId = typeof body?.user_id === 'string' ? body.user_id : '';
  const planIdInput = typeof body?.plan_id === 'string' ? body.plan_id.trim() : '';
  const requestedDurationMonths = typeof body?.duration_months === 'number' ? Number(body.duration_months) : null;
  const planFromBody = normalizeSubscriptionPlan(body?.plan);

  if (!userId) {
    return NextResponse.json({ error: 'User ID required' }, { status: 400 });
  }

  if (!planIdInput && planFromBody === 'free') {
    return NextResponse.json({ error: 'Paid plan required' }, { status: 400 });
  }

  const planForFallback: SubscriptionPlan = planFromBody === 'free' ? 'starter' : planFromBody;
  const meta = SUBSCRIPTION_PLANS[planForFallback];
  if (!meta) return NextResponse.json({ error: 'Invalid plan' }, { status: 400 });

  const client = await getClient();
  try {
    await client.query('BEGIN');

    await ensureReferralSchema(client);

    // Backward-compatible DB migration
    await client.query(
      `ALTER TABLE subscription_plans
       ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true`
    );

    await client.query(
      `ALTER TABLE subscription_plans
       ADD COLUMN IF NOT EXISTS discount_percent NUMERIC DEFAULT 0`
    );

    const userRes = await client.query(`SELECT id, email FROM users WHERE id = $1 FOR UPDATE`, [userId]);
    if (userRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Ensure only one active subscription history row
    await client.query(
      `UPDATE subscriptions_history
       SET status = 'expired'
       WHERE user_id = $1 AND status = 'active'`,
      [userId]
    );

    let chosenPlanRow:
      | { id: string; name: string; duration_months: number; price: number; tokens_included: number }
      | null = null;

    if (planIdInput) {
      const byId = await client.query(
        `SELECT id, name, duration_months, price, tokens_included
         FROM subscription_plans
         WHERE id = $1
         LIMIT 1`,
        [planIdInput]
      );
      chosenPlanRow = byId.rows?.[0] || null;
      if (!chosenPlanRow) {
        await client.query('ROLLBACK');
        return NextResponse.json({ error: 'Plan not found' }, { status: 404 });
      }
    } else {
      const planName = PLAN_DB_NAME[planForFallback];
      const durationFilter = requestedDurationMonths && requestedDurationMonths > 0 ? requestedDurationMonths : 1;

      // Prefer DB as source of truth (price/tokens) to avoid stale constants.
      const dbPlanRes = await client.query(
        `SELECT id, name, duration_months, price, tokens_included
         FROM subscription_plans
         WHERE lower(name) = lower($1)
           AND duration_months = $2
           AND COALESCE(is_active, true) = true
         ORDER BY created_at DESC
         LIMIT 1`,
        [planName, durationFilter]
      );
      if (dbPlanRes.rows.length > 0) {
        chosenPlanRow = dbPlanRes.rows[0];
      } else {
        const insertPlanRes = await client.query(
          `INSERT INTO subscription_plans (name, duration_months, price, discount_percent, tokens_included, features, description, is_active)
           VALUES ($1, $2, $3, 0, $4, $5, $6, true)
           RETURNING id, name, duration_months, price, tokens_included`,
          [planName, durationFilter, meta.monthlyPriceUsd, meta.monthlyTokens, JSON.stringify([]), '']
        );
        chosenPlanRow = insertPlanRes.rows?.[0] || null;
      }
    }

    if (!chosenPlanRow?.id) {
      await client.query('ROLLBACK');
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 });
    }

    const chosenSlug = normalizeSubscriptionPlan(chosenPlanRow.name);
    if (chosenSlug === 'free') {
      await client.query('ROLLBACK');
      return NextResponse.json({ error: 'Paid plan required' }, { status: 400 });
    }

    const planId = chosenPlanRow.id;
    const durationMonths = Number(chosenPlanRow.duration_months) || 1;
    const pricePaid = Number(chosenPlanRow.price) || meta.monthlyPriceUsd;
    const tokensAllocated = Number(chosenPlanRow.tokens_included) || meta.monthlyTokens;

    if (!planId) {
      await client.query('ROLLBACK');
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 });
    }

    // Activate subscription: always (re)starts 1 month from NOW (per product rules)
    const updateUserRes = await client.query(
      `UPDATE users
       SET subscription_status = 'active',
           subscription_plan = $1,
           subscription_expires_at = NOW() + ($2 * INTERVAL '1 month'),
           tokens_remaining = $3,
           updated_at = NOW()
       WHERE id = $4
       RETURNING id, email, role, subscription_status, subscription_plan, subscription_expires_at, tokens_remaining`,
      [chosenSlug, durationMonths, tokensAllocated, userId]
    );

    // Referral reward (one-time per referred user)
    const referralReward = await applyReferralRewardForPurchase(client, userId, chosenSlug);

    const historyRes = await client.query(
      `INSERT INTO subscriptions_history (user_id, plan_id, started_at, expires_at, price_paid, tokens_allocated, status)
       VALUES ($1, $2, NOW(), NOW() + ($3 * INTERVAL '1 month'), $4, $5, 'active')
       RETURNING id`,
      [userId, planId, durationMonths, pricePaid, tokensAllocated]
    );

    await client.query(
      `INSERT INTO admin_logs (admin_id, action, target_user_id, changes)
       VALUES ($1, 'ACTIVATE_SUBSCRIPTION', $2, $3)`,
      [
        admin.id,
        userId,
        JSON.stringify({
          plan: chosenSlug,
          plan_id: planId,
          expires_at: updateUserRes.rows[0]?.subscription_expires_at,
          duration_months: durationMonths,
          price_paid: pricePaid,
          tokens_allocated: tokensAllocated,
        }),
      ]
    );

    await client.query('COMMIT');

    return NextResponse.json({
      success: true,
      user: updateUserRes.rows[0],
      subscription_history_id: historyRes.rows[0]?.id || null,
      referral_reward: referralReward,
    });
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // ignore
    }
    console.error('Admin activate subscription error:', error);
    return NextResponse.json({ error: 'Failed to activate subscription' }, { status: 500 });
  } finally {
    client.release();
  }
}
