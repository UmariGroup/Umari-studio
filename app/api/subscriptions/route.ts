import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { normalizeSubscriptionPlan } from '@/lib/subscription';

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

    // Get plan details
    const planResult = await query(
      'SELECT id, name, duration_months, price, tokens_included FROM subscription_plans WHERE id = $1',
      [plan_id]
    );

    if (planResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Plan not found' },
        { status: 404 }
      );
    }

    const plan = planResult.rows[0];
    const expiresAt = new Date();
    expiresAt.setMonth(expiresAt.getMonth() + plan.duration_months);

    const planSlug = normalizeSubscriptionPlan(plan.name);
    if (planSlug === 'free') {
      return NextResponse.json({ error: 'Invalid plan' }, { status: 400 });
    }

    // Ensure only one active history row per user
    await query(
      `UPDATE subscriptions_history
       SET status = 'expired'
       WHERE user_id = $1 AND status = 'active'`,
      [user.id]
    );

    // Create subscription record
    const subResult = await query(
      `INSERT INTO subscriptions_history 
       (user_id, plan_id, expires_at, price_paid, tokens_allocated, status)
       VALUES ($1, $2, $3, $4, $5, 'active')
       RETURNING *`,
      [user.id, plan_id, expiresAt, plan.price, plan.tokens_included]
    );

    // Update user subscription status
    await query(
      `UPDATE users SET 
        subscription_status = 'active',
        subscription_plan = $1,
        subscription_expires_at = $2,
        tokens_remaining = $3
       WHERE id = $4`,
      [planSlug, expiresAt, plan.tokens_included, user.id]
    );

    return NextResponse.json({
      success: true,
      subscription: subResult.rows[0],
      message: `Subscription activated for ${plan.duration_months} months`,
    });
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
