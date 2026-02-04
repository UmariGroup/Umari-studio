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

    // Get stats
    const totalUsersResult = await query('SELECT COUNT(*) as count FROM users WHERE role = $1', ['user']);
    const activeSubsResult = await query(
      "SELECT COUNT(*) as count FROM subscriptions_history WHERE status = 'active'"
    );
    const freeUsersResult = await query(
      "SELECT COUNT(*) as count FROM users WHERE subscription_status = 'free'"
    );
    const revenueResult = await query(
      'SELECT COALESCE(SUM(price_paid), 0) as total FROM subscriptions_history WHERE status = $1',
      ['active']
    );

    return NextResponse.json({
      success: true,
      stats: {
        totalUsers: parseInt(totalUsersResult.rows[0].count),
        activeSubscriptions: parseInt(activeSubsResult.rows[0].count),
        freeUsers: parseInt(freeUsersResult.rows[0].count),
        totalRevenue: parseFloat(revenueResult.rows[0].total),
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
