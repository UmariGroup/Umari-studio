import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

/**
 * Get admin dashboard statistics (ADMIN ONLY)
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();

    // 🔐 SECURITY: Admin role check + subscription check
    if (!user || user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Unauthorized - Admin access required' },
        { status: 403 }
      );
    }

    if (user.subscription_status === 'expired') {
      return NextResponse.json(
        { error: 'Subscription expired - Renew to access admin features' },
        { status: 403 }
      );
    }

    // Keep user subscription state fresh before aggregating stats.
    await query(
      `UPDATE users
       SET subscription_status = 'expired',
           tokens_remaining = 0,
           updated_at = NOW()
       WHERE role = 'user'
         AND subscription_status = 'active'
         AND subscription_expires_at IS NOT NULL
         AND subscription_expires_at <= NOW()`
    );

    const usersAggResult = await query(
      `SELECT
         COUNT(*) FILTER (WHERE role = 'user') AS total_users,
         COUNT(*) FILTER (
           WHERE role = 'user'
             AND subscription_status = 'active'
             AND subscription_plan <> 'free'
         ) AS active_subscriptions,
         COUNT(*) FILTER (
           WHERE role = 'user'
             AND (subscription_status = 'free' OR subscription_plan = 'free')
         ) AS free_users,
         COUNT(*) FILTER (
           WHERE role = 'user'
             AND subscription_status = 'active'
             AND subscription_plan = 'starter'
         ) AS starter_users,
         COUNT(*) FILTER (
           WHERE role = 'user'
             AND subscription_status = 'active'
             AND subscription_plan = 'pro'
         ) AS pro_users,
         COUNT(*) FILTER (
           WHERE role = 'user'
             AND subscription_status = 'active'
             AND subscription_plan = 'business_plus'
         ) AS business_users,
         COUNT(*) FILTER (
           WHERE role = 'user'
             AND subscription_status = 'expired'
         ) AS expired_users
       FROM users`
    );

    const revenueResult = await query(
      `SELECT COALESCE(SUM(price_paid), 0) AS total
       FROM subscriptions_history
       WHERE status <> 'cancelled'`
    );

    const usageResult = await query(
      `SELECT COALESCE(SUM(tu.tokens_used), 0) AS total_tokens_used
       FROM token_usage tu
       JOIN users u ON u.id = tu.user_id
       WHERE u.role = 'user'`
    );

    const row = usersAggResult.rows[0] || {};
    const toInt = (v: unknown) => Number.parseInt(String(v ?? 0), 10) || 0;
    const toNum = (v: unknown) => Number.parseFloat(String(v ?? 0)) || 0;

    return NextResponse.json({
      success: true,
      stats: {
        totalUsers: toInt(row.total_users),
        activeSubscriptions: toInt(row.active_subscriptions),
        freeUsers: toInt(row.free_users),
        starterUsers: toInt(row.starter_users),
        proUsers: toInt(row.pro_users),
        businessUsers: toInt(row.business_users),
        expiredUsers: toInt(row.expired_users),
        totalRevenue: toNum(revenueResult.rows[0]?.total),
        totalTokensUsed: toNum(usageResult.rows[0]?.total_tokens_used),
      },
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
