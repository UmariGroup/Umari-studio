import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

function getCronSecret(): string {
  return (
    process.env.CRON_SECRET ||
    process.env.CRON_JOB_SECRET ||
    process.env.CRONJOB_SECRET ||
    ''
  ).trim();
}

function isAuthorized(req: NextRequest): boolean {
  const expected = getCronSecret();
  if (!expected) return false;

  const header = req.headers.get('authorization') || '';
  const bearer = header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : '';
  const querySecret = req.nextUrl.searchParams.get('secret') || '';

  const provided = bearer || querySecret;
  return provided === expected;
}

export async function GET(req: NextRequest) {
  if (!getCronSecret()) {
    return NextResponse.json(
      { error: 'CRON_SECRET is not configured' },
      { status: 500 }
    );
  }

  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const expiredUsersRes = await query(
    `UPDATE users
     SET subscription_status = 'expired',
         tokens_remaining = 0,
         updated_at = NOW()
     WHERE subscription_status = 'active'
       AND subscription_expires_at IS NOT NULL
       AND subscription_expires_at <= NOW()
     RETURNING id`
  );

  const expiredHistoryRes = await query(
    `UPDATE subscriptions_history
     SET status = 'expired'
     WHERE status = 'active'
       AND expires_at <= NOW()
     RETURNING id`
  );

  return NextResponse.json({
    success: true,
    expired_users: expiredUsersRes.rowCount || 0,
    expired_subscriptions: expiredHistoryRes.rowCount || 0,
    now: new Date().toISOString(),
  });
}

