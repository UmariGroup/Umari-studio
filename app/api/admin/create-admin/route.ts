/**
 * 👥 Create New Admin Endpoint
 * POST /api/admin/create-admin
 * 
 * Allows existing admin to create new admin account
 * Security: Requires JWT token, admin role verification
 */

import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import bcrypt from 'bcryptjs';
import { getCurrentUser } from '@/lib/auth';

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'umari_studio',
});

const BCRYPT_ROUNDS = 12;

// Validate email
function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Validate password
function validatePassword(password: string): { valid: boolean; message?: string } {
  if (password.length < 6) {
    return { valid: false, message: 'Password must be at least 6 characters' };
  }
  if (password.length > 128) {
    return { valid: false, message: 'Password must not exceed 128 characters' };
  }
  return { valid: true };
}

export async function POST(request: NextRequest) {
  try {
    // 1️⃣ Get current user (must be admin)
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // 2️⃣ Verify admin role
    if (currentUser.role !== 'admin') {
      return NextResponse.json(
        { error: 'Forbidden: Admin access required' },
        { status: 403 }
      );
    }

    // 3️⃣ Parse request body
    const { email, firstName, lastName, password } = await request.json();

    // 4️⃣ Validate inputs
    if (!email || !firstName || !lastName || !password) {
      return NextResponse.json(
        { error: 'Missing required fields: email, firstName, lastName, password' },
        { status: 400 }
      );
    }

    // 5️⃣ Validate email format
    if (!validateEmail(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      );
    }

    // 6️⃣ Validate password
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      return NextResponse.json(
        { error: passwordValidation.message },
        { status: 400 }
      );
    }

    // 7️⃣ Check if email already exists
    const existingUser = await pool.query(
      'SELECT id FROM users WHERE LOWER(email) = LOWER($1)',
      [email]
    );

    if (existingUser.rows.length > 0) {
      return NextResponse.json(
        { error: 'Email already exists' },
        { status: 400 }
      );
    }

    // 8️⃣ Hash password
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    // 9️⃣ Create new admin user
    const result = await pool.query(
      `INSERT INTO users (
        email,
        password_hash,
        first_name,
        last_name,
        role,
        subscription_status,
        subscription_plan,
        subscription_expires_at,
        tokens_remaining,
        created_at,
        updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
      RETURNING id, email, first_name, last_name, role, created_at`,
      [
        email.toLowerCase(),
        passwordHash,
        firstName,
        lastName,
        'admin',
        'active',
        '1year',
        new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        999999,
      ]
    );

    const newAdmin = result.rows[0];

    // 🔟 Log admin action
    await pool.query(
      `INSERT INTO admin_logs (admin_id, action, target_user_id, changes, created_at)
       VALUES ($1, $2, $3, $4, NOW())`,
      [
        currentUser.id,
        'create_admin',
        newAdmin.id,
        JSON.stringify({
          created_by: currentUser.email,
          new_admin_email: newAdmin.email,
          new_admin_name: `${newAdmin.first_name} ${newAdmin.last_name}`,
          timestamp: new Date().toISOString(),
        }),
      ]
    );

    console.log(`✅ New admin created: ${newAdmin.email} by ${currentUser.email}`);

    return NextResponse.json(
      {
        success: true,
        message: 'New admin created successfully',
        data: {
          id: newAdmin.id,
          email: newAdmin.email,
          name: `${newAdmin.first_name} ${newAdmin.last_name}`,
          role: newAdmin.role,
          createdAt: newAdmin.created_at,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('❌ Create admin error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * 👥 List all admins
 * GET /api/admin/create-admin
 */
export async function GET(request: NextRequest) {
  try {
    // 1️⃣ Verify admin role
    const currentUser = await getCurrentUser();
    if (!currentUser || currentUser.role !== 'admin') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // 2️⃣ Get all admins
    const result = await pool.query(
      `SELECT id, email, first_name, last_name, role, created_at, updated_at
       FROM users 
       WHERE role = $1
       ORDER BY created_at DESC`,
      ['admin']
    );

    return NextResponse.json(
      {
        success: true,
        data: result.rows,
        count: result.rows.length,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('❌ Get admins error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
