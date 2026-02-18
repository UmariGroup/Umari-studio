import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

export async function PATCH(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || currentUser.role !== 'admin') {
      return NextResponse.json({ error: 'Admin huquqi kerak' }, { status: 403 });
    }

    const { email } = await req.json();
    const normalizedEmail = String(email || '').trim().toLowerCase();
    if (!normalizedEmail) {
      return NextResponse.json({ error: 'Email talab qilinadi' }, { status: 400 });
    }

    const result = await query(
      `UPDATE users
       SET role = 'admin',
           subscription_plan = 'business_plus',
           subscription_status = 'active',
           tokens_remaining = GREATEST(tokens_remaining, 999999),
           updated_at = NOW()
       WHERE LOWER(email) = $1
       RETURNING id, email, first_name, role`,
      [normalizedEmail]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Foydalanuvchi topilmadi' }, { status: 404 });
    }

    await query(
      `INSERT INTO admin_logs (admin_id, action, target_user_id, changes)
       VALUES ($1, 'MAKE_ADMIN', $2, $3::jsonb)`,
      [
        currentUser.id,
        result.rows[0].id,
        JSON.stringify({ email: normalizedEmail, by: currentUser.email }),
      ]
    );

    return NextResponse.json({
      success: true,
      message: 'Foydalanuvchi admin qilib tayinlandi',
      user: result.rows[0],
    });
  } catch (error) {
    console.error('Make admin error:', error);
    return NextResponse.json({ error: 'Server xatosi' }, { status: 500 });
  }
}
