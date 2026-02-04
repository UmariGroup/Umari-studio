import { NextRequest, NextResponse } from 'next/server';
import { getClient } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

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
  if (!userId) {
    return NextResponse.json({ error: 'User ID required' }, { status: 400 });
  }

  const client = await getClient();
  try {
    await client.query('BEGIN');

    const userRes = await client.query(`SELECT id, email FROM users WHERE id = $1 FOR UPDATE`, [userId]);
    if (userRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const updateRes = await client.query(
      `UPDATE users
       SET subscription_status = 'expired',
           tokens_remaining = 0,
           updated_at = NOW()
       WHERE id = $1
       RETURNING id, email, role, subscription_status, subscription_plan, subscription_expires_at, tokens_remaining`,
      [userId]
    );

    await client.query(
      `UPDATE subscriptions_history
       SET status = 'expired'
       WHERE user_id = $1 AND status = 'active'`,
      [userId]
    );

    await client.query(
      `INSERT INTO admin_logs (admin_id, action, target_user_id, changes)
       VALUES ($1, 'EXPIRE_SUBSCRIPTION', $2, $3)`,
      [
        admin.id,
        userId,
        JSON.stringify({
          subscription_status: 'expired',
          tokens_remaining: 0,
        }),
      ]
    );

    await client.query('COMMIT');

    return NextResponse.json({ success: true, user: updateRes.rows[0] });
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // ignore
    }
    console.error('Admin expire subscription error:', error);
    return NextResponse.json({ error: 'Failed to expire subscription' }, { status: 500 });
  } finally {
    client.release();
  }
}

