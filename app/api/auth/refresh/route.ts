import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import {
  AUTH_COOKIE_NAMES,
  clearAuthCookiesOnResponse,
  setAuthCookies,
  verifyRefreshToken,
} from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const refreshToken = req.cookies.get(AUTH_COOKIE_NAMES.refresh)?.value;
    if (!refreshToken) {
      return NextResponse.json({ error: 'Refresh token required' }, { status: 401 });
    }

    const payload = verifyRefreshToken(refreshToken);
    if (!payload) {
      const failed = NextResponse.json({ error: 'Invalid refresh token' }, { status: 401 });
      clearAuthCookiesOnResponse(failed);
      return failed;
    }

    const result = await query(
      `SELECT id, email, role, subscription_status
       FROM users
       WHERE id = $1`,
      [payload.id]
    );

    if (result.rows.length === 0) {
      const failed = NextResponse.json({ error: 'User not found' }, { status: 401 });
      clearAuthCookiesOnResponse(failed);
      return failed;
    }

    const user = result.rows[0];
    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        subscription_status: user.subscription_status,
      },
    });

    setAuthCookies(response, {
      id: user.id,
      email: user.email,
      role: user.role === 'admin' ? 'admin' : 'user',
      subscription_status:
        user.subscription_status === 'active' || user.subscription_status === 'expired'
          ? user.subscription_status
          : 'free',
    });

    return response;
  } catch (error) {
    console.error('Refresh token error:', error);
    const failed = NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    clearAuthCookiesOnResponse(failed);
    return failed;
  }
}
