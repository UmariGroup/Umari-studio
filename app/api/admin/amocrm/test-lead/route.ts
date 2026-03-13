import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { createComplexLead } from '@/lib/amocrm';

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as any;

  const statusId = Number(body?.status_id || 0);
  const email = String(body?.email || '').trim();
  const phone = String(body?.phone || '').trim();
  const name = String(body?.name || 'Test lead from Umari').trim();

  if (!statusId) {
    return NextResponse.json({ error: 'status_id is required' }, { status: 400 });
  }

  if (!email) {
    return NextResponse.json({ error: 'email is required' }, { status: 400 });
  }

  const resp = await createComplexLead({
    status_id: statusId,
    name,
    _embedded: {
      contacts: [
        {
          name,
          custom_fields_values: [
            { field_code: 'EMAIL', values: [{ value: email, enum_code: 'WORK' }] },
            ...(phone ? [{ field_code: 'PHONE', values: [{ value: phone, enum_code: 'WORK' }] }] : []),
          ],
        },
      ],
    },
  });

  return NextResponse.json(
    { success: resp.ok, status: resp.status, data: resp.json, raw: resp.ok ? undefined : resp.text },
    { status: resp.ok ? 200 : 502 }
  );
}
