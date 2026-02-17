import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

type StatsRow = {
  period: string;
  model: string;
  requests: number;
  tokens: number;
};

function normalizeRows(rows: any[]): StatsRow[] {
  return (rows || []).map((row) => ({
    period: String(row.period || ''),
    model: String(row.model || 'unknown'),
    requests: Number(row.requests || 0),
    tokens: Number(row.tokens || 0),
  }));
}

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized - Admin access required' }, { status: 403 });
    }

    if (user.subscription_status === 'expired') {
      return NextResponse.json(
        { error: 'Subscription expired - Renew to access admin features' },
        { status: 403 }
      );
    }

    const [totalsRes, modelSummaryRes, dailyRes, weeklyRes, monthlyRes] = await Promise.all([
      query(
        `SELECT
           COUNT(*)::int AS total_requests,
           COALESCE(SUM(tokens_used), 0)::numeric AS total_tokens,
           COUNT(DISTINCT COALESCE(NULLIF(TRIM(model_used), ''), 'unknown'))::int AS unique_models
         FROM token_usage`
      ),
      query(
        `SELECT
           COALESCE(NULLIF(TRIM(model_used), ''), 'unknown') AS model,
           COUNT(*)::int AS requests,
           COALESCE(SUM(tokens_used), 0)::numeric AS tokens
         FROM token_usage
         GROUP BY model
         ORDER BY requests DESC, tokens DESC
         LIMIT 25`
      ),
      query(
        `SELECT
           TO_CHAR(date_trunc('day', created_at), 'YYYY-MM-DD') AS period,
           COALESCE(NULLIF(TRIM(model_used), ''), 'unknown') AS model,
           COUNT(*)::int AS requests,
           COALESCE(SUM(tokens_used), 0)::numeric AS tokens
         FROM token_usage
         WHERE created_at >= date_trunc('day', NOW()) - INTERVAL '30 days'
         GROUP BY period, model
         ORDER BY period DESC, requests DESC`
      ),
      query(
        `SELECT
           TO_CHAR(date_trunc('week', created_at), 'YYYY-MM-DD') AS period,
           COALESCE(NULLIF(TRIM(model_used), ''), 'unknown') AS model,
           COUNT(*)::int AS requests,
           COALESCE(SUM(tokens_used), 0)::numeric AS tokens
         FROM token_usage
         WHERE created_at >= date_trunc('week', NOW()) - INTERVAL '12 weeks'
         GROUP BY period, model
         ORDER BY period DESC, requests DESC`
      ),
      query(
        `SELECT
           TO_CHAR(date_trunc('month', created_at), 'YYYY-MM') AS period,
           COALESCE(NULLIF(TRIM(model_used), ''), 'unknown') AS model,
           COUNT(*)::int AS requests,
           COALESCE(SUM(tokens_used), 0)::numeric AS tokens
         FROM token_usage
         WHERE created_at >= date_trunc('month', NOW()) - INTERVAL '12 months'
         GROUP BY period, model
         ORDER BY period DESC, requests DESC`
      ),
    ]);

    const totals = totalsRes.rows?.[0] || {};

    return NextResponse.json({
      success: true,
      generated_at: new Date().toISOString(),
      totals: {
        total_requests: Number(totals.total_requests || 0),
        total_tokens: Number(totals.total_tokens || 0),
        unique_models: Number(totals.unique_models || 0),
      },
      model_summary: (modelSummaryRes.rows || []).map((row) => ({
        model: String(row.model || 'unknown'),
        requests: Number(row.requests || 0),
        tokens: Number(row.tokens || 0),
      })),
      daily: normalizeRows(dailyRes.rows || []),
      weekly: normalizeRows(weeklyRes.rows || []),
      monthly: normalizeRows(monthlyRes.rows || []),
    });
  } catch (error) {
    console.error('Admin model stats error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
