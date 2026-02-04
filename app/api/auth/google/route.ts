import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { generateToken } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const { google_id, email, first_name, last_name, avatar_url } = await req.json();

    if (!google_id || !email) {
      return NextResponse.json(
        { error: 'Google ID and email required' },
        { status: 400 }
      );
    }

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
           VALUES ($1, $2, $3, $4, $5, 'user', 'free', 0)
           RETURNING id, email, first_name, role, subscription_status`,
          [google_id, email, first_name || '', last_name || '', avatar_url || null]
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

    return response;
  } catch (error) {
    console.error('Google OAuth error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
