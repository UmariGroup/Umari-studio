import { NextResponse } from 'next/server';
import { getAuthenticatedUserAccount } from '@/lib/subscription';
import { query } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type InfografikaLanguage = 'uz_latn' | 'uz_cyrl' | 'ru';

function safeParseUsagePrompt(prompt: unknown): {
  language: InfografikaLanguage;
  productName: string | null;
  productDescription: string | null;
} {
  const fallback = { language: 'uz_latn' as const, productName: null, productDescription: null };
  const raw = typeof prompt === 'string' ? prompt.trim() : '';
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw);
    const languageRaw = String(parsed?.language || '').trim();
    const language: InfografikaLanguage =
      languageRaw === 'ru' || languageRaw === 'uz_cyrl' || languageRaw === 'uz_latn' ? languageRaw : 'uz_latn';
    const productName = parsed?.productName ? String(parsed.productName).slice(0, 200) : null;
    const productDescription = parsed?.productDescription ? String(parsed.productDescription).slice(0, 500) : null;
    return { language, productName, productDescription };
  } catch {
    return fallback;
  }
}

export async function GET() {
  try {
    const user = await getAuthenticatedUserAccount();

    const res = await query(
      `SELECT id, tokens_used, model_used, prompt, created_at
       FROM token_usage
       WHERE user_id = $1 AND service_type = $2
       ORDER BY created_at DESC
       LIMIT 24`,
      [user.id, 'infografika']
    );

    const generations = (res.rows || []).map((r: any) => {
      const parsed = safeParseUsagePrompt(r.prompt);
      return {
        id: r.id,
        created_at: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
        language: parsed.language,
        product_name: parsed.productName,
        product_description: parsed.productDescription,
        tokens_used: Number(r.tokens_used || 0),
        model_used: r.model_used ?? null,
      };
    });

    return NextResponse.json({ success: true, generations });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg || 'Xatolik' }, { status: 401 });
  }
}
