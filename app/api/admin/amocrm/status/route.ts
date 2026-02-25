import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getAmoCrmBaseUrl, getLatestTokens, isAmoCrmEnabled } from '@/lib/amocrm';

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const enabled = isAmoCrmEnabled();
  const baseUrl = getAmoCrmBaseUrl();
  const tokens = await getLatestTokens();
  const connected = Boolean(tokens?.accessToken);

  return NextResponse.json({
    success: true,
    enabled,
    baseUrl,
    connected,
    expiresAt: tokens?.expiresAt?.toISOString?.() || null,
  });
}
