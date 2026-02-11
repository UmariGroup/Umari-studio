import { NextRequest, NextResponse } from 'next/server';
import { getClient, query } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { ensureReferralSchema } from '@/lib/referral';

/**
 * Get all users (ADMIN ONLY)
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user || user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Unauthorized - Admin access required' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search');
    const role = searchParams.get('role');
    const subscription = searchParams.get('subscription');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = (page - 1) * limit;

    // Ensure referral schema exists (so token_total query doesn't fail on older DBs)
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
      // If schema setup fails, continue without blocking user listing.
    } finally {
      client.release();
    }

    let whereConditions = [];
    let params: any[] = [];

    if (search) {
      whereConditions.push(
        `(u.email ILIKE $${params.length + 1} OR u.first_name ILIKE $${params.length + 1})`
      );
      params.push(`%${search}%`);
    }

    if (role && ['user', 'admin'].includes(role)) {
      whereConditions.push(`u.role = $${params.length + 1}`);
      params.push(role);
    }

    if (subscription && ['free', 'active', 'expired'].includes(subscription)) {
      whereConditions.push(`u.subscription_status = $${params.length + 1}`);
      params.push(subscription);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // Get total count
    const countResult = await query(
      `SELECT COUNT(*) FROM users u ${whereClause}`,
      params
    );

    // Get paginated results
    let result;
    try {
      result = await query(
        `SELECT
           u.*, 
           COALESCE(ref.tokens_referral_remaining, 0)::numeric AS tokens_referral_remaining,
           (COALESCE(u.tokens_remaining, 0) + COALESCE(ref.tokens_referral_remaining, 0))::numeric AS tokens_total
         FROM users u
         LEFT JOIN LATERAL (
           SELECT COALESCE(SUM(rr.tokens_remaining), 0) AS tokens_referral_remaining
           FROM referral_rewards rr
           WHERE rr.referrer_user_id = u.id
             AND rr.tokens_remaining > 0
             AND (rr.expires_at IS NULL OR rr.expires_at > NOW())
         ) ref ON true
         ${whereClause}
         ORDER BY u.created_at DESC
         LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, limit, offset]
      );
    } catch {
      // If referral table doesn't exist / schema issues, show subscription-only tokens.
      result = await query(
        `SELECT
           u.*,
           0::numeric AS tokens_referral_remaining,
           COALESCE(u.tokens_remaining, 0)::numeric AS tokens_total
         FROM users u
         ${whereClause}
         ORDER BY u.created_at DESC
         LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, limit, offset]
      );
    }

    return NextResponse.json({
      success: true,
      users: result.rows,
      pagination: {
        page,
        limit,
        total: parseInt(countResult.rows[0].count),
        pages: Math.ceil(parseInt(countResult.rows[0].count) / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json(
      { error: 'Failed to fetch users' },
      { status: 500 }
    );
  }
}

/**
 * Update user subscription (ADMIN ONLY)
 */
export async function PATCH(req: NextRequest) {
  try {
    const admin = await getCurrentUser();

    if (!admin || admin.role !== 'admin') {
      return NextResponse.json(
        { error: 'Unauthorized - Admin access required' },
        { status: 403 }
      );
    }

    const { user_id, subscription_status, subscription_plan, tokens_remaining } = await req.json();

    if (!user_id) {
      return NextResponse.json(
        { error: 'User ID required' },
        { status: 400 }
      );
    }

    // Check if user exists
    const userCheck = await query('SELECT id FROM users WHERE id = $1', [user_id]);
    if (userCheck.rows.length === 0) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Prepare update query
    let updates = [];
    let params: any[] = [];

    if (subscription_status) {
      updates.push(`subscription_status = $${params.length + 1}`);
      params.push(subscription_status);
    }

    if (subscription_plan) {
      updates.push(`subscription_plan = $${params.length + 1}`);
      params.push(subscription_plan);
    }

    if (tokens_remaining !== undefined) {
      updates.push(`tokens_remaining = $${params.length + 1}`);
      params.push(tokens_remaining);
    }

    if (updates.length === 0) {
      return NextResponse.json(
        { error: 'No updates provided' },
        { status: 400 }
      );
    }

    params.push(user_id);
    const updateClause = updates.join(', ');

    const result = await query(
      `UPDATE users SET ${updateClause}, updated_at = CURRENT_TIMESTAMP
       WHERE id = $${params.length}
       RETURNING id, email, first_name, subscription_status, subscription_plan, tokens_remaining`,
      params
    );

    // Log admin action
    await query(
      `INSERT INTO admin_logs (admin_id, action, target_user_id, changes)
       VALUES ($1, 'UPDATE_USER', $2, $3)`,
      [admin.id, user_id, JSON.stringify({ subscription_status, subscription_plan, tokens_remaining })]
    );

    return NextResponse.json({
      success: true,
      user: result.rows[0],
      message: 'User updated successfully',
    });
  } catch (error) {
    console.error('Error updating user:', error);
    return NextResponse.json(
      { error: 'Failed to update user' },
      { status: 500 }
    );
  }
}
