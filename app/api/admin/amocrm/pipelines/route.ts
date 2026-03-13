import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { listPipelines } from '@/lib/amocrm';

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const resp = await listPipelines();
  return NextResponse.json(
    {
      success: resp.ok,
      status: resp.status,
      data: resp.json,
      raw: resp.ok ? undefined : resp.text,
    },
    { status: resp.ok ? 200 : 502 }
  );
}
