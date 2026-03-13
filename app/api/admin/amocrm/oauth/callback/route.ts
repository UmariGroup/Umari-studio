import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { exchangeCodeForTokens } from '@/lib/amocrm';

const STATE_COOKIE = 'amocrm_oauth_state';

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const redirectBaseUrl = (() => {
    const raw = process.env.AMOCRM_REDIRECT_URI;
    if (raw) {
      try {
        return new URL(raw).origin;
      } catch {
        // ignore
      }
    }
    return req.nextUrl.origin;
  })();

  const code = req.nextUrl.searchParams.get('code') || '';
  const state = req.nextUrl.searchParams.get('state') || '';
  const expectedState = req.cookies.get(STATE_COOKIE)?.value || '';

  if (!code) {
    return NextResponse.json({ error: 'Missing code' }, { status: 400 });
  }

  if (!state || !expectedState || state !== expectedState) {
    return NextResponse.json({ error: 'Invalid state' }, { status: 400 });
  }

  try {
    await exchangeCodeForTokens(code);

    const redirectUrl = new URL('/admin/amocrm?connected=1', redirectBaseUrl);
    const res = NextResponse.redirect(redirectUrl);
    res.cookies.set(STATE_COOKIE, '', { path: '/', maxAge: 0 });
    return res;
  } catch (err) {
    console.error('amoCRM OAuth callback error:', err);
    const redirectUrl = new URL('/admin/amocrm?connected=0', redirectBaseUrl);
    const res = NextResponse.redirect(redirectUrl);
    res.cookies.set(STATE_COOKIE, '', { path: '/', maxAge: 0 });
    return res;
  }
}
