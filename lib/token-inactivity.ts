import type { PoolClient } from 'pg';

export const INACTIVITY_THRESHOLDS = [3, 7, 10] as const;
export type InactivityThreshold = (typeof INACTIVITY_THRESHOLDS)[number];

export type InactivityCandidate = {
  user_id: string;
  email: string;
  first_name: string | null;
  subscription_plan: string;
  subscription_status: string;
  tokens_remaining: number;
  threshold_days: InactivityThreshold;
  purchase_started_at: string;
  last_token_usage_at: string | null;
  usage_count_after_purchase: number;
  days_without_usage: number;
};

export async function ensureTokenInactivityTable(client: PoolClient): Promise<void> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS user_token_inactivity_alerts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      threshold_days INT NOT NULL CHECK (threshold_days IN (3, 7, 10)),
      purchase_started_at TIMESTAMP NOT NULL,
      last_token_usage_at TIMESTAMP,
      usage_count_after_purchase INT NOT NULL DEFAULT 0,
      days_without_usage INT NOT NULL DEFAULT 0,
      status VARCHAR(16) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved')),
      first_detected_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      last_detected_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      resolved_at TIMESTAMP,
      meta JSONB,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (user_id, threshold_days)
    );
  `);

  await client.query(
    'CREATE INDEX IF NOT EXISTS idx_token_inactivity_status_threshold ON user_token_inactivity_alerts(status, threshold_days)'
  );
  await client.query(
    'CREATE INDEX IF NOT EXISTS idx_token_inactivity_days ON user_token_inactivity_alerts(days_without_usage DESC)'
  );
  await client.query(
    'CREATE INDEX IF NOT EXISTS idx_token_inactivity_user ON user_token_inactivity_alerts(user_id)'
  );
}

export async function buildTokenInactivityCandidates(client: PoolClient): Promise<InactivityCandidate[]> {
  const result = await client.query(
    `
      WITH latest_paid AS (
        SELECT DISTINCT ON (sh.user_id)
          sh.user_id,
          sh.started_at AS purchase_started_at
        FROM subscriptions_history sh
        WHERE sh.status <> 'cancelled'
          AND (COALESCE(sh.price_paid, 0) > 0 OR COALESCE(sh.tokens_allocated, 0) > 0)
        ORDER BY sh.user_id, sh.started_at DESC
      ),
      base AS (
        SELECT
          u.id AS user_id,
          u.email,
          u.first_name,
          u.subscription_plan,
          u.subscription_status,
          COALESCE(u.tokens_remaining, 0)::numeric AS tokens_remaining,
          lp.purchase_started_at,
          COALESCE(usage_after.usage_count_after_purchase, 0)::int AS usage_count_after_purchase,
          usage_after.last_token_usage_at,
          GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (NOW() - lp.purchase_started_at)) / 86400))::int AS days_without_usage
        FROM users u
        INNER JOIN latest_paid lp ON lp.user_id = u.id
        LEFT JOIN LATERAL (
          SELECT
            COUNT(*)::int AS usage_count_after_purchase,
            MAX(tu.created_at) AS last_token_usage_at
          FROM token_usage tu
          WHERE tu.user_id = u.id
            AND tu.created_at >= lp.purchase_started_at
        ) AS usage_after ON true
        WHERE u.role = 'user'
      )
      SELECT
        b.user_id::text,
        b.email::text,
        b.first_name::text,
        b.subscription_plan::text,
        b.subscription_status::text,
        b.tokens_remaining::float8,
        v.threshold_days::int,
        b.purchase_started_at,
        b.last_token_usage_at,
        b.usage_count_after_purchase,
        b.days_without_usage
      FROM base b
      CROSS JOIN (VALUES (3), (7), (10)) AS v(threshold_days)
      WHERE b.usage_count_after_purchase = 0
        AND b.days_without_usage >= v.threshold_days
      ORDER BY b.days_without_usage DESC, b.purchase_started_at ASC
    `
  );

  return result.rows.map((row) => ({
    user_id: String(row.user_id),
    email: String(row.email),
    first_name: row.first_name ? String(row.first_name) : null,
    subscription_plan: String(row.subscription_plan || 'free'),
    subscription_status: String(row.subscription_status || 'free'),
    tokens_remaining: Number(row.tokens_remaining || 0),
    threshold_days: Number(row.threshold_days) as InactivityThreshold,
    purchase_started_at: new Date(row.purchase_started_at).toISOString(),
    last_token_usage_at: row.last_token_usage_at ? new Date(row.last_token_usage_at).toISOString() : null,
    usage_count_after_purchase: Number(row.usage_count_after_purchase || 0),
    days_without_usage: Number(row.days_without_usage || 0),
  }));
}

export async function refreshTokenInactivityAlerts(
  client: PoolClient
): Promise<{ active: number; openedOrUpdated: number; resolved: number }> {
  const candidates = await buildTokenInactivityCandidates(client);
  let openedOrUpdated = 0;

  for (const candidate of candidates) {
    const upsertResult = await client.query(
      `
        INSERT INTO user_token_inactivity_alerts (
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
          meta,
          created_at,
          updated_at
        )
        VALUES (
          $1, $2, $3, $4, $5, $6,
          'open', NOW(), NOW(), NULL, $7::jsonb, NOW(), NOW()
        )
        ON CONFLICT (user_id, threshold_days)
        DO UPDATE SET
          purchase_started_at = EXCLUDED.purchase_started_at,
          last_token_usage_at = EXCLUDED.last_token_usage_at,
          usage_count_after_purchase = EXCLUDED.usage_count_after_purchase,
          days_without_usage = EXCLUDED.days_without_usage,
          status = 'open',
          last_detected_at = NOW(),
          resolved_at = NULL,
          meta = EXCLUDED.meta,
          updated_at = NOW()
      `,
      [
        candidate.user_id,
        candidate.threshold_days,
        candidate.purchase_started_at,
        candidate.last_token_usage_at,
        candidate.usage_count_after_purchase,
        candidate.days_without_usage,
        JSON.stringify({
          email: candidate.email,
          plan: candidate.subscription_plan,
          subscription_status: candidate.subscription_status,
          tokens_remaining: candidate.tokens_remaining,
        }),
      ]
    );
    openedOrUpdated += upsertResult.rowCount || 0;
  }

  const activeKeys = JSON.stringify(
    candidates.map((candidate) => ({
      user_id: candidate.user_id,
      threshold_days: candidate.threshold_days,
    }))
  );

  const resolvedResult = await client.query(
    `
      WITH active AS (
        SELECT
          (item->>'user_id')::uuid AS user_id,
          (item->>'threshold_days')::int AS threshold_days
        FROM jsonb_array_elements($1::jsonb) AS item
      )
      UPDATE user_token_inactivity_alerts ua
      SET
        status = 'resolved',
        resolved_at = NOW(),
        updated_at = NOW()
      WHERE ua.status = 'open'
        AND NOT EXISTS (
          SELECT 1
          FROM active a
          WHERE a.user_id = ua.user_id
            AND a.threshold_days = ua.threshold_days
        )
    `,
    [activeKeys]
  );

  return {
    active: candidates.length,
    openedOrUpdated,
    resolved: resolvedResult.rowCount || 0,
  };
}
