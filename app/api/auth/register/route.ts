import { NextRequest, NextResponse } from 'next/server';
import { getClient, query } from '@/lib/db';
import { hashPassword, setAuthCookies } from '@/lib/auth';
import { validateEmail, validatePassword, sanitizeInput } from '@/lib/password';
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
    const { email, password, first_name, last_name } = await req.json();
    const referralCookie = req.cookies.get(REFERRAL_COOKIE_NAME)?.value;

    // 🔐 Validate email
    const emailValidation = validateEmail(email);
    if (!emailValidation.valid) {
      return NextResponse.json(
        { error: emailValidation.error },
        { status: 400 }
      );
    }

    // 🔐 Validate password
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      return NextResponse.json(
        { error: passwordValidation.error },
        { status: 400 }
      );
    }

    // 🔐 Sanitize names
    const sanitizedFirstName = sanitizeInput(first_name || '');
    const sanitizedLastName = sanitizeInput(last_name || '');

    // Check if user already exists
    const existingUser = await query(
      'SELECT id FROM users WHERE email = $1',
      [email.toLowerCase()]
    );

    if (existingUser.rows.length > 0) {
      return NextResponse.json(
        { error: 'Email already registered' },
        { status: 409 }
      );
    }

    // 🔐 Hash password with bcrypt 12 rounds
    const password_hash = await hashPassword(password);

    // Create user + referral ops in a transaction (backward compatible migrations)
    const client = await getClient();
    let user: any;
    let referralAttached = false;
    try {
      await client.query('BEGIN');
      await ensureReferralSchema(client);

      const result = await client.query(
        `INSERT INTO users (email, password_hash, first_name, last_name, role, subscription_status, tokens_remaining)
         VALUES ($1, $2, $3, $4, 'user', 'free', 0)
         RETURNING id, email, first_name, last_name, role, subscription_status`,
        [email.toLowerCase(), password_hash, sanitizedFirstName, sanitizedLastName]
      );

      user = result.rows[0];

      // Ensure every user has their own referral code
      await ensureUserReferralCode(client, user.id);

      // Attach referral if present
      const attachRes = await maybeAttachReferralToUser(client, user.id, referralCookie);
      referralAttached = attachRes.attached;

      await client.query('COMMIT');
    } catch (err) {
      try {
        await client.query('ROLLBACK');
      } catch {
        // ignore
      }
      throw err;
    } finally {
      client.release();
    }

    const authPayload = {
      id: user.id,
      email: user.email,
      role: user.role,
      subscription_status: user.subscription_status,
    };

    // Set cookie and return
    const response = NextResponse.json(
      {
        success: true,
        user: {
          id: user.id,
          email: user.email,
          first_name: user.first_name,
          role: user.role,
          subscription_status: user.subscription_status,
        },
      },
      { status: 201 }
    );

    setAuthCookies(response, authPayload);

    // amoCRM sync (best-effort; never block registration)
    try {
      await withTimeout(syncNewUserToAmoCrm(user.id), 1500);
    } catch {
      // ignore
    }

    if (referralAttached) {
      response.cookies.set(REFERRAL_COOKIE_NAME, '', {
        path: '/',
        maxAge: 0,
        sameSite: 'lax',
      });
    }

    return response;
  } catch (error) {
    console.error('Register error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

