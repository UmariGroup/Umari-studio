/**
 * 🔐 Admin Password Change Endpoint
 * POST /api/admin/password-change
 * 
 * Allows authenticated admin to change their own password
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
    // 1️⃣ Get current user
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // 2️⃣ Verify admin role
    if (user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Forbidden: Admin access required' },
        { status: 403 }
      );
    }

    // 3️⃣ Parse request body
    const { currentPassword, newPassword, confirmPassword } = await request.json();

    // 4️⃣ Validate inputs
    if (!currentPassword || !newPassword || !confirmPassword) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    if (newPassword !== confirmPassword) {
      return NextResponse.json(
        { error: 'New passwords do not match' },
        { status: 400 }
      );
    }

    const passwordValidation = validatePassword(newPassword);
    if (!passwordValidation.valid) {
      return NextResponse.json(
        { error: passwordValidation.message },
        { status: 400 }
      );
    }

    // 5️⃣ Get current password hash from database
    const userResult = await pool.query(
      'SELECT password_hash FROM users WHERE id = $1',
      [user.id]
    );

    if (userResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // 6️⃣ Verify current password
    const passwordMatch = await bcrypt.compare(
      currentPassword,
      userResult.rows[0].password_hash
    );

    if (!passwordMatch) {
      return NextResponse.json(
        { error: 'Current password is incorrect' },
        { status: 401 }
      );
    }

    // 7️⃣ Hash new password
    const newPasswordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

    // 8️⃣ Update password in database
    await pool.query(
      'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
      [newPasswordHash, user.id]
    );

    // 9️⃣ Log admin action
    await pool.query(
      `INSERT INTO admin_logs (admin_id, action, changes, created_at)
       VALUES ($1, $2, $3, NOW())`,
      [
        user.id,
        'password_change',
        JSON.stringify({
          changed_by: user.email,
          timestamp: new Date().toISOString(),
        }),
      ]
    );

    console.log(`✅ Admin ${user.email} changed password`);

    return NextResponse.json(
      {
        success: true,
        message: 'Password changed successfully',
        data: {
          email: user.email,
          changedAt: new Date().toISOString(),
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('❌ Password change error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
