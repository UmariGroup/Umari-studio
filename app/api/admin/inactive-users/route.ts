import { NextRequest, NextResponse } from 'next/server';
import { getClient } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import {
  ensureTokenInactivityTable,
  refreshTokenInactivityAlerts,
} from '@/lib/token-inactivity';

function parsePositiveInt(raw: string | null, fallback: number, min: number, max: number): number {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(parsed)));
}

export async function GET(req: NextRequest) {
  const admin = await getCurrentUser();
  if (!admin || admin.role !== 'admin') {
    return NextResponse.json({ error: "Ruxsat yo'q: faqat admin kirishi mumkin" }, { status: 403 });
  }

  const searchParams = req.nextUrl.searchParams;
  const statusRaw = String(searchParams.get('status') || 'open').trim().toLowerCase();
  const search = String(searchParams.get('search') || '').trim();
  const page = parsePositiveInt(searchParams.get('page'), 1, 1, 10_000);
  const limit = parsePositiveInt(searchParams.get('limit'), 20, 5, 200);
  const refresh = searchParams.get('refresh') !== '0';

  const status =
    statusRaw === 'all' || statusRaw === 'resolved' || statusRaw === 'open' ? statusRaw : 'open';

  const client = await getClient();
  try {
    await client.query('BEGIN');
    await ensureTokenInactivityTable(client);

    let syncResult: { active: number; openedOrUpdated: number; resolved: number } | null = null;
    if (refresh) {
      syncResult = await refreshTokenInactivityAlerts(client);
    }

    const likeSearch = `%${search}%`;
    const where: string[] = [];
    const params: any[] = [];

    if (status !== 'all') {
      params.push(status);
      where.push(`ua.status = $${params.length}`);
    }
    if (search) {
      params.push(likeSearch);
      where.push(
        `(u.email ILIKE $${params.length} OR COALESCE(u.first_name, '') ILIKE $${params.length} OR ua.user_id::text ILIKE $${params.length})`
      );
    }

    const whereClause = `WHERE u.subscription_status = 'active'${where.length > 0 ? ` AND ${where.join(' AND ')}` : ''}`;

    const countRes = await client.query(
      `
        SELECT COUNT(DISTINCT ua.user_id)::int AS total
        FROM user_token_inactivity_alerts ua
        JOIN users u ON u.id = ua.user_id
        ${whereClause}
      `,
      params
    );
    const total = Number(countRes.rows?.[0]?.total || 0);
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const safePage = Math.min(page, totalPages);
    const offset = (safePage - 1) * limit;

    const listParams = [...params, limit, offset];
    const listRes = await client.query(
      `
        WITH ranked AS (
          SELECT
            ua.id::text,
            ua.user_id::text,
            ua.threshold_days,
            ua.purchase_started_at,
            ua.last_token_usage_at,
            ua.usage_count_after_purchase,
            ua.days_without_usage,
            ua.status,
            ua.first_detected_at,
            ua.last_detected_at,
            ua.resolved_at,
            ua.updated_at,
            ua.meta,
            u.email,
            u.first_name,
            u.subscription_plan,
            u.subscription_status,
            COALESCE(u.tokens_remaining, 0)::float8 AS tokens_remaining,
            ROW_NUMBER() OVER (
              PARTITION BY ua.user_id
              ORDER BY
                CASE WHEN ua.status = 'open' THEN 0 ELSE 1 END,
                ua.threshold_days DESC,
                ua.days_without_usage DESC,
                ua.last_detected_at DESC
            ) AS rn
          FROM user_token_inactivity_alerts ua
          JOIN users u ON u.id = ua.user_id
          ${whereClause}
        )
        SELECT
          id,
          user_id,
          threshold_days,
          purchase_started_at,
          last_token_usage_at,
          usage_count_after_purchase,
          days_without_usage,
          status,
          first_detected_at,
          last_detected_at,
          resolved_at,
          updated_at,
          meta,
          email,
          first_name,
          subscription_plan,
          subscription_status,
          tokens_remaining
        FROM ranked
        WHERE rn = 1
        ORDER BY
          CASE WHEN status = 'open' THEN 0 ELSE 1 END,
          threshold_days DESC,
          days_without_usage DESC,
          last_detected_at DESC
        LIMIT $${listParams.length - 1}
        OFFSET $${listParams.length}
      `,
      listParams
    );

    const summaryRes = await client.query(
      `
        SELECT threshold_days, status, COUNT(*)::int AS total
        FROM user_token_inactivity_alerts ua
        JOIN users u ON u.id = ua.user_id
        WHERE u.subscription_status = 'active'
        GROUP BY threshold_days, status
      `
    );

    await client.query('COMMIT');

    const summary = {
      open_by_threshold: {
        3: 0,
        7: 0,
        10: 0,
      } as Record<'3' | '7' | '10', number>,
      resolved_by_threshold: {
        3: 0,
        7: 0,
        10: 0,
      } as Record<'3' | '7' | '10', number>,
    };

    for (const row of summaryRes.rows) {
      const thresholdKey = String(row.threshold_days) as '3' | '7' | '10';
      const bucket = row.status === 'resolved' ? summary.resolved_by_threshold : summary.open_by_threshold;
      if (thresholdKey in bucket) {
        bucket[thresholdKey] = Number(row.total || 0);
      }
    }

    return NextResponse.json({
      success: true,
      data: listRes.rows.map((row) => ({
        ...row,
        threshold_days: Number(row.threshold_days),
        usage_count_after_purchase: Number(row.usage_count_after_purchase || 0),
        days_without_usage: Number(row.days_without_usage || 0),
        tokens_remaining: Number(row.tokens_remaining || 0),
      })),
      pagination: {
        page: safePage,
        limit,
        total,
        pages: totalPages,
        has_prev: safePage > 1,
        has_next: safePage < totalPages,
      },
      filters: {
        status,
        search,
      },
      summary,
      sync: refresh
        ? {
            ...syncResult,
            refreshed_at: new Date().toISOString(),
          }
        : null,
    });
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // ignore
    }
    console.error('Admin inactive users error:', error);
    return NextResponse.json({ error: 'Ichki server xatosi' }, { status: 500 });
  } finally {
    client.release();
  }
}

