import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { generateToken, hashPassword } from '@/lib/auth';
import { validateEmail, validatePassword, sanitizeInput } from '@/lib/password';

export async function POST(req: NextRequest) {
  try {
    const { email, password, first_name, last_name } = await req.json();

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

    // Create user
    const result = await query(
      `INSERT INTO users (email, password_hash, first_name, last_name, role, subscription_status, tokens_remaining)
       VALUES ($1, $2, $3, $4, 'user', 'free', 0)
       RETURNING id, email, first_name, last_name, role, subscription_status`,
      [email.toLowerCase(), password_hash, sanitizedFirstName, sanitizedLastName]
    );

    const user = result.rows[0];

    // Generate token
    const token = generateToken({
      id: user.id,
      email: user.email,
      role: user.role,
      subscription_status: user.subscription_status,
    });

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

    response.cookies.set('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60,
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Register error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

