import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { generateToken } from '@/lib/auth';
import { OAuth2Client } from 'google-auth-library';
import { FREE_TRIAL_TOKENS } from '@/lib/subscription-plans';
import { getClient } from '@/lib/db';
import { REFERRAL_COOKIE_NAME, ensureReferralSchema, ensureUserReferralCode, maybeAttachReferralToUser } from '@/lib/referral';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const referralCookie = req.cookies.get(REFERRAL_COOKIE_NAME)?.value;
    const credential: string | undefined = body?.credential;

    if (!credential) {
      return NextResponse.json({ error: 'Missing credential' }, { status: 400 });
    }

    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    if (!clientId) {
      return NextResponse.json(
        { error: 'Google OAuth is not configured on server' },
        { status: 500 }
      );
    }

    const oauthClient = new OAuth2Client(clientId);
    const ticket = await oauthClient.verifyIdToken({
      idToken: credential,
      audience: clientId,
    });

    const payload = ticket.getPayload();
    if (!payload?.sub || !payload.email) {
      return NextResponse.json({ error: 'Invalid Google token' }, { status: 401 });
    }

    const google_id = payload.sub;
    const email = payload.email;
    const first_name = payload.given_name || '';
    const last_name = payload.family_name || '';
    const avatar_url = payload.picture || null;

    // Check if user exists
    let result = await query(
      'SELECT id, email, first_name, role, subscription_status FROM users WHERE google_id = $1',
      [google_id]
    );

    let user = result.rows[0];

    if (!user) {
      // Check if email already exists (for linking Google to existing email account)
      const emailResult = await query(
        'SELECT id FROM users WHERE email = $1',
        [email]
      );

      if (emailResult.rows.length === 0) {
        // Create new user with Google OAuth
        const createResult = await query(
          `INSERT INTO users (google_id, email, first_name, last_name, avatar_url, role, subscription_status, tokens_remaining)
           VALUES ($1, $2, $3, $4, $5, 'user', 'free', $6)
           RETURNING id, email, first_name, role, subscription_status`,
          [google_id, email, first_name || '', last_name || '', avatar_url || null, FREE_TRIAL_TOKENS]
        );
        user = createResult.rows[0];
      } else {
        // Link Google to existing email account
        const linkResult = await query(
          `UPDATE users SET google_id = $1, avatar_url = COALESCE($2, avatar_url)
           WHERE email = $3
           RETURNING id, email, first_name, role, subscription_status`,
          [google_id, avatar_url || null, email]
        );
        user = linkResult.rows[0];
      }
    }

    // Update last login
    await query(
      'UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = $1',
      [user.id]
    );

    // Referral ops (best-effort)
    let referralAttached = false;
    const client = await getClient();
    try {
      await client.query('BEGIN');
      await ensureReferralSchema(client);
      await ensureUserReferralCode(client, user.id);
      const attachRes = await maybeAttachReferralToUser(client, user.id, referralCookie);
      referralAttached = attachRes.attached;
      await client.query('COMMIT');
    } catch (err) {
      try {
        await client.query('ROLLBACK');
      } catch {
        // ignore
      }
      console.warn('Referral attach failed on google auth:', err);
    } finally {
      client.release();
    }

    // Generate token
    const token = generateToken({
      id: user.id,
      email: user.email,
      role: user.role,
      subscription_status: user.subscription_status,
    });

    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        role: user.role,
        subscription_status: user.subscription_status,
      },
    });

    response.cookies.set('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60,
      path: '/',
    });

    if (referralAttached) {
      response.cookies.set(REFERRAL_COOKIE_NAME, '', {
        path: '/',
        maxAge: 0,
        sameSite: 'lax',
      });
    }

    return response;
  } catch (error) {
    console.error('Google OAuth error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
