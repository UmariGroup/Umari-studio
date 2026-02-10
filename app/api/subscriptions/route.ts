import { NextRequest, NextResponse } from 'next/server';
import { getClient, query } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { normalizeSubscriptionPlan } from '@/lib/subscription';
import { applyReferralRewardForPurchase, ensureReferralSchema } from '@/lib/referral';

/**
 * Subscribe user to a plan
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { plan_id } = await req.json();

    if (!plan_id) {
      return NextResponse.json(
        { error: 'Plan ID required' },
        { status: 400 }
      );
    }

    const client = await getClient();
    try {
      await client.query('BEGIN');
      await ensureReferralSchema(client);

      // Get plan details
      const planResult = await client.query(
        'SELECT id, name, duration_months, price, tokens_included FROM subscription_plans WHERE id = $1',
        [plan_id]
      );

      if (planResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return NextResponse.json({ error: 'Plan not found' }, { status: 404 });
      }

      const plan = planResult.rows[0];
      const expiresAt = new Date();
      expiresAt.setMonth(expiresAt.getMonth() + plan.duration_months);

      const planSlug = normalizeSubscriptionPlan(plan.name);
      if (planSlug === 'free') {
        await client.query('ROLLBACK');
        return NextResponse.json({ error: 'Invalid plan' }, { status: 400 });
      }

      // Ensure only one active history row per user
      await client.query(
        `UPDATE subscriptions_history
         SET status = 'expired'
         WHERE user_id = $1 AND status = 'active'`,
        [user.id]
      );

      // Create subscription record
      const subResult = await client.query(
        `INSERT INTO subscriptions_history 
         (user_id, plan_id, expires_at, price_paid, tokens_allocated, status)
         VALUES ($1, $2, $3, $4, $5, 'active')
         RETURNING *`,
        [user.id, plan_id, expiresAt, plan.price, plan.tokens_included]
      );

      // Update user subscription status
      await client.query(
        `UPDATE users SET 
          subscription_status = 'active',
          subscription_plan = $1,
          subscription_expires_at = $2,
          tokens_remaining = $3,
          updated_at = NOW()
         WHERE id = $4`,
        [planSlug, expiresAt, plan.tokens_included, user.id]
      );

      // Apply referral reward (one-time per referred user)
      const reward = await applyReferralRewardForPurchase(client, user.id, planSlug);

      await client.query('COMMIT');

      return NextResponse.json({
        success: true,
        subscription: subResult.rows[0],
        referral_reward: reward,
        message: `Subscription activated for ${plan.duration_months} months`,
      });
    } catch (error) {
      try {
        await client.query('ROLLBACK');
      } catch {
        // ignore
      }
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Subscription error:', error);
    return NextResponse.json(
      { error: 'Failed to create subscription' },
      { status: 500 }
    );
  }
}

/**
 * Get user's current subscription
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const result = await query(
      `SELECT sh.*, sp.name, sp.tokens_included FROM subscriptions_history sh
       LEFT JOIN subscription_plans sp ON sh.plan_id = sp.id
       WHERE sh.user_id = $1 AND sh.status = 'active'
       ORDER BY sh.created_at DESC LIMIT 1`,
      [user.id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({
        success: true,
        subscription: null,
        message: 'No active subscription',
      });
    }

    return NextResponse.json({
      success: true,
      subscription: result.rows[0],
    });
  } catch (error) {
    console.error('Error fetching subscription:', error);
    return NextResponse.json(
      { error: 'Failed to fetch subscription' },
      { status: 500 }
    );
  }
}
