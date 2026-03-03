import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { ensureAiRequestStatsTable } from '@/lib/ai-request-stats';
import { query } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized - Admin only' }, { status: 403 });
    }

    await ensureAiRequestStatsTable();

    const sp = req.nextUrl.searchParams;
    const limit = Math.max(1, Math.min(1000, Number(sp.get('limit') || 200)));
    const offset = Math.max(0, Number(sp.get('offset') || 0));

    const model = (sp.get('model') || '').trim();
    const provider = (sp.get('provider') || '').trim();
    const serviceType = (sp.get('service_type') || '').trim();

    const from = (sp.get('from') || '').trim();
    const to = (sp.get('to') || '').trim();

    const where: string[] = [];
    const params: any[] = [];

    const add = (sql: string, value: any) => {
      params.push(value);
      where.push(sql.replace('$', `$${params.length}`));
    };

    if (model) add('s.model = $', model);
    if (provider) add('s.provider = $', provider);
    if (serviceType) add('s.service_type = $', serviceType);

    if (from) add('s.created_at >= $', new Date(from));
    if (to) add('s.created_at <= $', new Date(to));

    const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

    const res = await query(
          `SELECT s.id, s.created_at, s.service_type, s.provider, s.model, s.plan, s.mode,
            s.prompt_words, s.prompt_chars,
            s.input_product_images, s.input_style_images,
            s.output_images,
            s.input_tokens_total, s.input_user_prompt_tokens, s.input_system_prompt_tokens, s.input_image_tokens,
            s.output_tokens_total, s.output_image_tokens, s.output_text_tokens,
            s.total_tokens,
              u.email AS user_email,
              s.batch_id,
              s.meta
       FROM ai_request_stats s
       JOIN users u ON u.id = s.user_id
       ${whereSql}
       ORDER BY s.created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );

    return NextResponse.json({ success: true, data: res.rows, limit, offset });
  } catch (error) {
    console.error('Error fetching ai requests:', error);
    return NextResponse.json({ error: 'Failed to fetch ai requests' }, { status: 500 });
  }
}
