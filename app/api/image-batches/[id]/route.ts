import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserAccount } from '@/lib/subscription';
import { query } from '@/lib/db';
import {
  ensureImageJobsTable,
  estimateAvgImageJobSeconds,
  getImageParallelLimit,
} from '@/lib/image-queue';

type BatchStatus = 'queued' | 'processing' | 'succeeded' | 'partial' | 'failed' | 'canceled';

function coerceInt(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : 0;
}

function coerceNumber(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function workloadSecondsByMode(
  rows: Array<{ mode: string; cnt: number }>,
  basicAvgSeconds: number,
  proAvgSeconds: number
): number {
  let total = 0;
  for (const row of rows) {
    const cnt = Number(row?.cnt || 0);
    if (!Number.isFinite(cnt) || cnt <= 0) continue;

    const mode = String(row?.mode || '').toLowerCase();
    const perJob = mode === 'pro' ? proAvgSeconds : basicAvgSeconds;
    total += cnt * perJob;
  }
  return total;
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    await ensureImageJobsTable();

    const user = await getAuthenticatedUserAccount();
    const { id } = await ctx.params;

    const batchId = String(id || '').trim();
    if (!batchId) {
      return NextResponse.json({ error: 'Missing batch id' }, { status: 400 });
    }

    const jobsRes = await query(
      `SELECT id, batch_index, status, label, result_url, error_text,
              plan, mode, provider, model, aspect_ratio,
              tokens_reserved, tokens_refunded,
              created_at, started_at, finished_at
       FROM image_jobs
       WHERE batch_id = $1 AND user_id = $2
       ORDER BY batch_index ASC`,
      [batchId, user.id]
    );

    const jobs = jobsRes.rows || [];
    if (jobs.length === 0) {
      return NextResponse.json({ error: 'Batch not found' }, { status: 404 });
    }

    const plan = String(jobs[0]?.plan || 'starter') as any;
    const mode = String(jobs[0]?.mode || 'basic').toLowerCase() === 'pro' ? 'pro' : 'basic';
    const parallelLimit = getImageParallelLimit(plan);
    const [basicAvgSeconds, proAvgSeconds] = await Promise.all([
      estimateAvgImageJobSeconds(plan, 'basic'),
      estimateAvgImageJobSeconds(plan, 'pro'),
    ]);
    const currentAvgSeconds = mode === 'pro' ? proAvgSeconds : basicAvgSeconds;

    const total = jobs.length;
    const counts = jobs.reduce(
      (acc: Record<string, number>, j: any) => {
        const s = String(j?.status || '').trim();
        acc[s] = (acc[s] || 0) + 1;
        return acc;
      },
      {}
    );

    const succeeded = coerceInt(counts.succeeded);
    const failed = coerceInt(counts.failed);
    const canceled = coerceInt(counts.canceled);
    const processing = coerceInt(counts.processing);
    const queued = coerceInt(counts.queued);

    const done = Math.min(total, succeeded + failed + canceled);
    const remaining = Math.max(0, total - done);
    const progressPct = total > 0 ? Math.round((done / total) * 100) : 0;

    let status: BatchStatus = 'queued';
    if (done >= total) {
      if (canceled >= total) status = 'canceled';
      else if (succeeded >= total) status = 'succeeded';
      else if (succeeded > 0) status = 'partial';
      else status = 'failed';
    } else if (processing > 0) {
      status = 'processing';
    } else if (queued > 0) {
      status = 'queued';
    }

    // Best-effort queue position + ETA (plan queue)
    let queuePosition: number | null = null;
    let etaSeconds: number | null = null;

    try {
      const firstQueued = jobs.find((j: any) => String(j?.status) === 'queued');
      if (firstQueued?.created_at) {
        const createdAt = firstQueued.created_at instanceof Date ? firstQueued.created_at : new Date(firstQueued.created_at);

        const [aheadRes, activeRes] = await Promise.all([
          query(
            `SELECT mode, COUNT(*)::int AS cnt
             FROM image_jobs
             WHERE plan = $1
               AND status = 'queued'
               AND created_at < $2
             GROUP BY mode`,
            [plan, createdAt]
          ),
          query(
            `SELECT mode, COUNT(*)::int AS cnt
             FROM image_jobs
             WHERE plan = $1
               AND status = 'processing'
             GROUP BY mode`,
            [plan]
          ),
        ]);

        const queuedRows = Array.isArray(aheadRes.rows)
          ? aheadRes.rows.map((row: any) => ({
              mode: String(row?.mode || ''),
              cnt: Number(row?.cnt || 0),
            }))
          : [];

        const activeRows = Array.isArray(activeRes.rows)
          ? activeRes.rows.map((row: any) => ({
              mode: String(row?.mode || ''),
              cnt: Number(row?.cnt || 0),
            }))
          : [];

        const ahead = queuedRows.reduce(
          (sum, row) => sum + (Number.isFinite(row.cnt) ? Math.max(0, row.cnt) : 0),
          0
        );

        queuePosition = Math.max(1, ahead + 1);
        const queuedWorkSeconds = workloadSecondsByMode(queuedRows, basicAvgSeconds, proAvgSeconds);
        const activeWorkSeconds = workloadSecondsByMode(activeRows, basicAvgSeconds, proAvgSeconds);
        const ownRemainingSeconds = Math.max(0, remaining) * currentAvgSeconds;
        etaSeconds = Math.max(5, Math.ceil((queuedWorkSeconds + activeWorkSeconds + ownRemainingSeconds) / parallelLimit));
      } else if (status === 'processing' && remaining > 0) {
        // For in-progress batches, only estimate remaining time for this batch.
        etaSeconds = Math.max(5, Math.ceil((remaining * currentAvgSeconds) / parallelLimit));
      }
    } catch {
      queuePosition = null;
      etaSeconds = null;
    }

    const tokensReserved = jobs.reduce((sum: number, j: any) => sum + coerceNumber(j?.tokens_reserved), 0);
    const tokensRefunded = jobs.reduce((sum: number, j: any) => sum + coerceNumber(j?.tokens_refunded), 0);
    const tokensCharged = Math.max(0, Number((tokensReserved - tokensRefunded).toFixed(2)));

    let tokensRemaining: number | null = null;
    if (user.role === 'admin') {
      tokensRemaining = 999999;
    } else {
      try {
        const uRes = await query(`SELECT tokens_remaining FROM users WHERE id = $1 LIMIT 1`, [user.id]);
        tokensRemaining = coerceNumber(uRes.rows?.[0]?.tokens_remaining);
      } catch {
        tokensRemaining = null;
      }
    }

    return NextResponse.json({
      success: true,
      batch: {
        id: batchId,
        status,
        plan,
        parallel_limit: parallelLimit,
        queue_position: queuePosition,
        eta_seconds: etaSeconds,
        progress: {
          done,
          total,
          percent: progressPct,
          queued,
          processing,
          succeeded,
          failed,
          canceled,
        },
        tokens_reserved: Number(tokensReserved.toFixed(2)),
        tokens_refunded: Number(tokensRefunded.toFixed(2)),
        tokens_charged: tokensCharged,
        tokens_remaining: tokensRemaining,
        items: jobs.map((j: any) => ({
          id: j.id,
          index: j.batch_index,
          status: j.status,
          label: j.label || null,
          imageUrl: j.result_url || null,
          error: j.error_text || null,
          createdAt: j.created_at,
          startedAt: j.started_at,
          finishedAt: j.finished_at,
        })),
      },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    const status = msg.toLowerCase().includes('avval tizimga kiring') ? 401 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
