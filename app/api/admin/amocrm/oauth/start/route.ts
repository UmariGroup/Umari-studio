import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { buildAmoCrmAuthorizeUrl, getAmoCrmOAuthConfig } from '@/lib/amocrm';

const STATE_COOKIE = 'amocrm_oauth_state';

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  try {
    getAmoCrmOAuthConfig();
  } catch {
    return NextResponse.json(
      {
        error:
          'amoCRM env sozlanmagan. AMOCRM_BASE_URL (yoki AMOCRM_SUBDOMAIN), AMOCRM_CLIENT_ID, AMOCRM_CLIENT_SECRET, AMOCRM_REDIRECT_URI ni to‘ldiring.',
      },
      { status: 500 }
    );
  }

  const state = crypto.randomBytes(24).toString('hex');
  const url = buildAmoCrmAuthorizeUrl(state);

  const res = NextResponse.redirect(url);
  res.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 10 * 60,
  });

  return res;
}
