import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { comparePassword, setAuthCookies } from '@/lib/auth';
import { validateEmail, validatePassword } from '@/lib/password';
import { getClient } from '@/lib/db';
import { REFERRAL_COOKIE_NAME, ensureReferralSchema, ensureUserReferralCode, maybeAttachReferralToUser } from '@/lib/referral';
import { syncNewUserToAmoCrm } from '@/lib/amocrm-sync';

const withTimeout = async <T>(promise: Promise<T>, ms: number): Promise<T> => {
  let timeoutId: NodeJS.Timeout | null = null;
  const timeoutPromise = new Promise<T>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error('timeout')), ms);
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
};

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();
    const referralCookie = req.cookies.get(REFERRAL_COOKIE_NAME)?.value;

    // 🔐 Validate email format
    const emailValidation = validateEmail(email);
    if (!emailValidation.valid) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      );
    }

    // 🔐 Validate password exists
    if (!password) {
      return NextResponse.json(
        { error: 'Password required' },
        { status: 400 }
      );
    }

    // Check if user exists (case-insensitive email)
    const result = await query(
      'SELECT id, email, password_hash, first_name, role, subscription_status FROM users WHERE LOWER(email) = LOWER($1)',
      [email]
    );

    if (result.rows.length === 0) {
      // 🔐 Generic error message to prevent email enumeration
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    const user = result.rows[0];

    // 🔐 Verify password using bcrypt comparison
    if (!user.password_hash) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    const isPasswordValid = await comparePassword(password, user.password_hash);

    if (!isPasswordValid) {
      // 🔐 Generic error message to prevent timing attacks
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    // Update last login
    await query(
      'UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = $1',
      [user.id]
    );

    // Referral ops (best-effort)
    let referralAttached = false;
    if (referralCookie) {
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
        // Don't block login on referral issues
        console.warn('Referral attach failed on login:', err);
      } finally {
        client.release();
      }
    }

    const authPayload = {
      id: user.id,
      email: user.email,
      role: user.role,
      subscription_status: user.subscription_status,
    };

    // Set cookie
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

    setAuthCookies(response, authPayload);

    // amoCRM sync (best-effort; never block login)
    try {
      const amoRes = await withTimeout(syncNewUserToAmoCrm(user.id), 1200);
      if (!amoRes?.ok) {
        console.warn('amoCRM sync skipped/failed on login:', { userId: user.id, reason: amoRes?.reason });
      }
    } catch (err) {
      console.warn('amoCRM sync exception on login:', { userId: user.id, err });
    }

    if (referralAttached) {
      response.cookies.set(REFERRAL_COOKIE_NAME, '', {
        path: '/',
        maxAge: 0,
        sameSite: 'lax',
      });
    }

    return response;
  } catch (error: any) {
    // pg errors: https://www.postgresql.org/docs/current/errcodes-appendix.html
    const code = error?.code ? String(error.code) : '';
    const message = error?.message ? String(error.message) : '';

    // 28P01: invalid_password (very common when docker volume was created with an older password)
    if (code === '28P01' || message.includes('28P01') || message.toLowerCase().includes('password authentication failed')) {
      return NextResponse.json(
        {
          error:
            "DB ulanish xatosi: parol noto‘g‘ri (28P01). .env dagi DB_PASSWORD bilan Postgres konteyneridagi POSTGRES_PASSWORD bir xil bo‘lishi kerak. Agar parolni keyin o‘zgartirgan bo‘lsangiz, eski volume ichida eski parol qolib ketgan bo‘lishi mumkin.",
          code: 'DB_AUTH_FAILED',
        },
        { status: 503 }
      );
    }

    // Connection problems
    if (
      code === 'ECONNREFUSED' ||
      code === 'ENOTFOUND' ||
      message.toLowerCase().includes('connect econrefused') ||
      message.toLowerCase().includes('getaddrinfo enotfound')
    ) {
      return NextResponse.json(
        {
          error:
            'DB ulanish xatosi: Postgres topilmadi yoki ishga tushmagan. DB_HOST/DB_PORT va docker compose holatini tekshiring.',
          code: 'DB_UNREACHABLE',
        },
        { status: 503 }
      );
    }

    console.error('Login error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
