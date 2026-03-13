/**
 * 🔐 User Password Change Endpoint
 * POST /api/auth/change-password
 * 
 * Allows authenticated user to change their own password
 * Security: Requires JWT token verification
 */

import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getAuthenticatedUserAccount } from '@/lib/subscription';
import { query } from '@/lib/db';

const BCRYPT_ROUNDS = 12;

// Validate password
function validatePassword(password: string): { valid: boolean; message?: string } {
  if (password.length < 6) {
    return { valid: false, message: 'Parol kamida 6 belgi bo\'lishi kerak' };
  }
  if (password.length > 128) {
    return { valid: false, message: 'Parol 128 belgidan oshmasligi kerak' };
  }
  return { valid: true };
}

export async function POST(request: NextRequest) {
  try {
    // 1️⃣ Get current user
    const user = await getAuthenticatedUserAccount();
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // 2️⃣ Parse request body
    const { currentPassword, newPassword, confirmPassword } = await request.json();

    // 3️⃣ Validate inputs
    if (!currentPassword || !newPassword || !confirmPassword) {
      return NextResponse.json(
        { error: 'Barcha maydonlar to\'ldirilishi kerak' },
        { status: 400 }
      );
    }

    if (newPassword !== confirmPassword) {
      return NextResponse.json(
        { error: 'Yangi parollar mos kelmadi' },
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

    // 4️⃣ Get current password hash from database
    const userResult = await query(
      'SELECT password_hash FROM users WHERE id = $1',
      [user.id]
    );

    if (userResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Foydalanuvchi topilmadi' },
        { status: 404 }
      );
    }

    // 5️⃣ Verify current password
    const passwordMatch = await bcrypt.compare(
      currentPassword,
      userResult.rows[0].password_hash
    );

    if (!passwordMatch) {
      return NextResponse.json(
        { error: 'Joriy parol noto\'g\'ri' },
        { status: 401 }
      );
    }

    // 6️⃣ Hash new password
    const newPasswordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

    // 7️⃣ Update password in database
    await query(
      'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
      [newPasswordHash, user.id]
    );

    console.log(`✅ User ${user.email} changed password`);

    return NextResponse.json(
      { success: true, message: 'Parol muvaffaqiyatli o\'zgartirildi' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Password change error:', error);
    return NextResponse.json(
      { error: 'Parol o\'zgartirishda xatolik yuz berdi' },
      { status: 500 }
    );
  }
}
