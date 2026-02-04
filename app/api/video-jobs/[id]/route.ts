import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserAccount } from '@/lib/subscription';
import { query } from '@/lib/db';

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthenticatedUserAccount();
    const { id } = await ctx.params;

    const jobId = String(id || '').trim();
    if (!jobId) {
      return NextResponse.json({ error: 'Missing job id' }, { status: 400 });
    }

    // Best-effort: if table doesn't exist yet, job can't exist.
    let res;
    try {
      res = await query(
        `SELECT id, status, original_video_url, upscaled_video_url, error_text, created_at, updated_at
         FROM video_jobs
         WHERE id = $1 AND user_id = $2
         LIMIT 1`,
        [jobId, user.id]
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.toLowerCase().includes('relation') && msg.toLowerCase().includes('video_jobs')) {
        return NextResponse.json({ error: 'Job not found' }, { status: 404 });
      }
      throw err;
    }

    if (!res || res.rows.length === 0) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    const row = res.rows[0];
    return NextResponse.json({
      success: true,
      job: {
        id: row.id,
        status: row.status,
        originalVideoUrl: row.original_video_url || null,
        upscaledVideoUrl: row.upscaled_video_url || null,
        error: row.error_text || null,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    const status = msg.toLowerCase().includes('avval tizimga kiring') ? 401 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
