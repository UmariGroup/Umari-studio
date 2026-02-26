import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { listContactCustomFields } from '@/lib/amocrm';

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const resp = await listContactCustomFields();

  // Convenience: also return a flattened list of id/name for quick lookup.
  const fields = Array.isArray((resp.json as any)?._embedded?.custom_fields)
    ? ((resp.json as any)._embedded.custom_fields as any[])
        .map((f) => ({
          id: Number(f?.id || 0),
          name: String(f?.name || '').trim(),
          code: f?.code ?? null,
          type: f?.type ?? null,
        }))
        .filter((f) => Number.isFinite(f.id) && f.id > 0 && f.name)
    : [];

  return NextResponse.json(
    {
      success: resp.ok,
      status: resp.status,
      fields,
      data: resp.json,
      raw: resp.ok ? undefined : resp.text,
    },
    { status: resp.ok ? 200 : 502 }
  );
}
