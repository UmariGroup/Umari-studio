import type { ImageMode, SubscriptionPlan } from '@/lib/subscription-plans';
import { query } from '@/lib/db';

export type ImageJobStatus = 'queued' | 'processing' | 'succeeded' | 'failed' | 'canceled';

export interface ImageRateLimit {
  windowSeconds: number;
  maxBatches: number;
}

function readInt(value: unknown): number | null {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.trunc(n);
}

function readNumber(value: unknown): number | null {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return n;
}

function envInt(name: string): number | null {
  return readInt(process.env[name]);
}

function envNumber(name: string): number | null {
  return readNumber(process.env[name]);
}

export function getImageParallelLimit(plan: SubscriptionPlan): number {
  if (plan === 'starter') return Math.max(1, envInt('IMAGE_QUEUE_PARALLEL_STARTER') ?? 1);
  if (plan === 'pro') return Math.max(1, envInt('IMAGE_QUEUE_PARALLEL_PRO') ?? 2);
  if (plan === 'business_plus') return Math.max(1, envInt('IMAGE_QUEUE_PARALLEL_BUSINESS_PLUS') ?? 4);
  return Math.max(1, envInt('IMAGE_QUEUE_PARALLEL_FREE') ?? 1);
}

export function getImageQueuePriority(plan: SubscriptionPlan): number {
  if (plan === 'business_plus') return envInt('IMAGE_QUEUE_PRIORITY_BUSINESS_PLUS') ?? 30;
  if (plan === 'pro') return envInt('IMAGE_QUEUE_PRIORITY_PRO') ?? 20;
  if (plan === 'starter') return envInt('IMAGE_QUEUE_PRIORITY_STARTER') ?? 10;
  return envInt('IMAGE_QUEUE_PRIORITY_FREE') ?? 0;
}

export function getImageRateLimit(plan: SubscriptionPlan): ImageRateLimit | null {
  if (plan === 'starter') {
    const maxBatches = Math.max(1, envInt('IMAGE_RATE_LIMIT_STARTER_MAX') ?? 1);
    const windowSeconds = Math.max(10, envInt('IMAGE_RATE_LIMIT_STARTER_WINDOW_SEC') ?? 5 * 60);
    return { maxBatches, windowSeconds };
  }

  if (plan === 'pro') {
    const maxBatches = Math.max(1, envInt('IMAGE_RATE_LIMIT_PRO_MAX') ?? 2);
    const windowSeconds = Math.max(10, envInt('IMAGE_RATE_LIMIT_PRO_WINDOW_SEC') ?? 10 * 60);
    return { maxBatches, windowSeconds };
  }

  if (plan === 'business_plus') {
    const maxBatches = envInt('IMAGE_RATE_LIMIT_BUSINESS_PLUS_MAX');
    const windowSeconds = envInt('IMAGE_RATE_LIMIT_BUSINESS_PLUS_WINDOW_SEC');
    if (!maxBatches || !windowSeconds) return null; // Default: no cooldown (priority users)
    return { maxBatches: Math.max(1, maxBatches), windowSeconds: Math.max(10, windowSeconds) };
  }

  const maxBatches = envInt('IMAGE_RATE_LIMIT_FREE_MAX');
  const windowSeconds = envInt('IMAGE_RATE_LIMIT_FREE_WINDOW_SEC');
  if (!maxBatches || !windowSeconds) return null;
  return { maxBatches: Math.max(1, maxBatches), windowSeconds: Math.max(10, windowSeconds) };
}

export function getImageDailyLimit(plan: SubscriptionPlan): number | null {
  if (plan === 'starter') return envInt('IMAGE_DAILY_LIMIT_STARTER') ?? 100;
  if (plan === 'pro') return envInt('IMAGE_DAILY_LIMIT_PRO') ?? 250;
  if (plan === 'business_plus') {
    const v = envInt('IMAGE_DAILY_LIMIT_BUSINESS_PLUS');
    return v === null ? null : Math.max(1, v);
  }
  const free = envInt('IMAGE_DAILY_LIMIT_FREE');
  return free === null ? null : Math.max(1, free);
}

export async function ensureImageJobsTable(): Promise<void> {
  await query(
    `CREATE TABLE IF NOT EXISTS image_jobs (
      id UUID PRIMARY KEY,
      batch_id UUID NOT NULL,
      batch_index INT NOT NULL,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      plan VARCHAR(50) NOT NULL CHECK (plan IN ('free', 'starter', 'pro', 'business_plus')),
      mode VARCHAR(16) NOT NULL CHECK (mode IN ('basic', 'pro', 'ultra')),
      provider VARCHAR(32) NOT NULL DEFAULT 'gemini',
      model VARCHAR(128),
      aspect_ratio VARCHAR(16),
      label TEXT,
      base_prompt TEXT,
      prompt TEXT,
      product_images JSONB,
      style_images JSONB,
      status VARCHAR(32) NOT NULL CHECK (status IN ('queued', 'processing', 'succeeded', 'failed', 'canceled')),
      priority INT NOT NULL DEFAULT 0,
      result_url TEXT,
      error_text TEXT,
      tokens_reserved NUMERIC(10, 2) NOT NULL DEFAULT 0,
      tokens_refunded NUMERIC(10, 2) NOT NULL DEFAULT 0,
      usage_recorded BOOLEAN NOT NULL DEFAULT false,
      worker_id VARCHAR(128),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      started_at TIMESTAMP,
      finished_at TIMESTAMP
    )`
  );

  await query(`CREATE INDEX IF NOT EXISTS idx_image_jobs_user_created ON image_jobs(user_id, created_at)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_image_jobs_batch ON image_jobs(batch_id, batch_index)`);
  await query(
    `CREATE INDEX IF NOT EXISTS idx_image_jobs_queue ON image_jobs(plan, status, priority, created_at)`
  );

  await query(`ALTER TABLE image_jobs DROP CONSTRAINT IF EXISTS image_jobs_mode_check`);
  await query(
    `ALTER TABLE image_jobs
     ADD CONSTRAINT image_jobs_mode_check CHECK (mode IN ('basic', 'pro', 'ultra'))`
  );
}

export async function estimateAvgImageJobSeconds(plan: SubscriptionPlan, mode?: ImageMode): Promise<number> {
  const modeFallback =
    mode === 'basic'
      ? envNumber('IMAGE_QUEUE_ESTIMATE_SECONDS_BASIC')
      : mode === 'pro'
        ? envNumber('IMAGE_QUEUE_ESTIMATE_SECONDS_PRO')
        : mode === 'ultra'
          ? envNumber('IMAGE_QUEUE_ESTIMATE_SECONDS_ULTRA')
        : null;

  const fallback = Math.max(5, modeFallback ?? envNumber('IMAGE_QUEUE_ESTIMATE_SECONDS_PER_IMAGE') ?? 45);

  try {
    const modeFilter = mode ? 'AND mode = $2' : '';
    const params: unknown[] = mode ? [plan, mode] : [plan];

    const res = await query(
      `SELECT AVG(sec)::float AS avg_sec
       FROM (
         SELECT EXTRACT(EPOCH FROM (finished_at - started_at)) AS sec
         FROM image_jobs
         WHERE plan = $1
           ${modeFilter}
           AND status = 'succeeded'
           AND started_at IS NOT NULL
           AND finished_at IS NOT NULL
         ORDER BY finished_at DESC
         LIMIT 200
       ) t`,
      params
    );

    const avg = Number(res.rows?.[0]?.avg_sec);
    if (!Number.isFinite(avg) || avg <= 0) return fallback;
    // Cap to something sane to avoid UI showing hours after a single outlier.
    return Math.min(10 * 60, Math.max(5, avg));
  } catch {
    return fallback;
  }
}
