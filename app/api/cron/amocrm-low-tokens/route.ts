import { NextRequest, NextResponse } from 'next/server';
import { getClient, query } from '@/lib/db';
import { getAmoCrmLowTokenBatchLimit, getAmoCrmLowTokenThreshold, isAmoCrmEnabled } from '@/lib/amocrm';
import { syncLowTokenUserToAmoCrm } from '@/lib/amocrm-sync';
import { ensureAmoCrmSchema } from '@/lib/amocrm-schema';

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
    return NextResponse.json({ error: 'CRON_SECRET is not configured' }, { status: 500 });
  }

  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!isAmoCrmEnabled()) {
    return NextResponse.json({
      success: false,
      skipped: true,
      reason: 'AMOCRM_ENABLED is not true',
      now: new Date().toISOString(),
    });
  }

  const threshold = getAmoCrmLowTokenThreshold();
  const limit = getAmoCrmLowTokenBatchLimit();

  // Make sure the sync table exists (backward compatible deployments)
  try {
    const client = await getClient();
    try {
      await client.query('BEGIN');
      await ensureAmoCrmSchema(client);
      await client.query('COMMIT');
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
  } catch (err) {
    return NextResponse.json(
      { success: false, error: 'Failed to ensure amoCRM schema', detail: String((err as any)?.message || err) },
      { status: 500 }
    );
  }

  // Only trigger when crossing from >threshold to <=threshold (dedupe)
  const candidatesRes = await query(
    `SELECT u.id
     FROM users u
     LEFT JOIN amocrm_user_sync s ON s.user_id = u.id
     WHERE u.subscription_status = 'active'
       AND COALESCE(u.subscription_plan, 'free') <> 'free'
       AND u.tokens_remaining < $1
       AND (
         s.user_id IS NULL
         OR s.resale_synced_at IS NULL
         OR COALESCE(s.last_tokens_remaining, 1e9) > $1
       )
     ORDER BY u.updated_at DESC
     LIMIT $2`,
    [threshold, limit]
  );

  const userIds = candidatesRes.rows.map((r: any) => String(r.id));

  let okCount = 0;
  let failCount = 0;
  const failures: Array<{ user_id: string; reason?: string }> = [];

  for (const userId of userIds) {
    const res = await syncLowTokenUserToAmoCrm(userId);
    if (res.ok) {
      okCount++;
    } else {
      failCount++;
      failures.push({ user_id: userId, reason: res.reason });
    }
  }

  return NextResponse.json({
    success: true,
    threshold,
    limit,
    candidates: userIds.length,
    synced: okCount,
    failed: failCount,
    failures: failures.slice(0, 20),
    now: new Date().toISOString(),
  });
}
