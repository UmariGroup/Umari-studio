import { NextRequest, NextResponse } from 'next/server';
import { getClient } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { normalizeSubscriptionPlan, SUBSCRIPTION_PLANS, SubscriptionPlan } from '@/lib/subscription';

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
  const plan = normalizeSubscriptionPlan(body?.plan);

  if (!userId) {
    return NextResponse.json({ error: 'User ID required' }, { status: 400 });
  }
  if (plan === 'free') {
    return NextResponse.json({ error: 'Paid plan required' }, { status: 400 });
  }

  const meta = SUBSCRIPTION_PLANS[plan];
  if (!meta) {
    return NextResponse.json({ error: 'Invalid plan' }, { status: 400 });
  }

  const client = await getClient();
  try {
    await client.query('BEGIN');

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

    // Activate subscription: always (re)starts 1 month from NOW (per product rules)
    const updateUserRes = await client.query(
      `UPDATE users
       SET subscription_status = 'active',
           subscription_plan = $1,
           subscription_expires_at = NOW() + INTERVAL '1 month',
           tokens_remaining = $2,
           updated_at = NOW()
       WHERE id = $3
       RETURNING id, email, role, subscription_status, subscription_plan, subscription_expires_at, tokens_remaining`,
      [plan, meta.monthlyTokens, userId]
    );

    const planName = PLAN_DB_NAME[plan];
    let planId: string | null = null;

    const planIdRes = await client.query(
      `SELECT id FROM subscription_plans
       WHERE lower(name) = lower($1) AND duration_months = 1
       ORDER BY created_at DESC
       LIMIT 1`,
      [planName]
    );
    planId = planIdRes.rows[0]?.id || null;

    if (!planId) {
      const insertPlanRes = await client.query(
        `INSERT INTO subscription_plans (name, duration_months, price, tokens_included, features, description)
         VALUES ($1, 1, $2, $3, $4, $5)
         RETURNING id`,
        [planName, meta.monthlyPriceUsd, meta.monthlyTokens, JSON.stringify([]), '']
      );
      planId = insertPlanRes.rows[0]?.id || null;
    }

    const historyRes = await client.query(
      `INSERT INTO subscriptions_history (user_id, plan_id, started_at, expires_at, price_paid, tokens_allocated, status)
       VALUES ($1, $2, NOW(), NOW() + INTERVAL '1 month', $3, $4, 'active')
       RETURNING id`,
      [userId, planId, meta.monthlyPriceUsd, meta.monthlyTokens]
    );

    await client.query(
      `INSERT INTO admin_logs (admin_id, action, target_user_id, changes)
       VALUES ($1, 'ACTIVATE_SUBSCRIPTION', $2, $3)`,
      [
        admin.id,
        userId,
        JSON.stringify({
          plan,
          expires_at: updateUserRes.rows[0]?.subscription_expires_at,
          tokens_allocated: meta.monthlyTokens,
        }),
      ]
    );

    await client.query('COMMIT');

    return NextResponse.json({
      success: true,
      user: updateUserRes.rows[0],
      subscription_history_id: historyRes.rows[0]?.id || null,
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

