import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { verifyToken } from '@/lib/auth';

export async function PATCH(req: NextRequest) {
  try {
    // Faqat login qilingan admin foydalanishi mumkin
    const authToken = req.cookies.get('auth_token')?.value;
    
    if (!authToken) {
      return NextResponse.json(
        { error: 'Login qiling' },
        { status: 401 }
      );
    }

    const userPayload = verifyToken(authToken);
    if (!userPayload || userPayload.role !== 'admin') {
      return NextResponse.json(
        { error: 'Admin huquqi kerak' },
        { status: 403 }
      );
    }

    const { email } = await req.json();
    if (!email) {
      return NextResponse.json(
        { error: 'Email talab qilinadi' },
        { status: 400 }
      );
    }

    // Update user role to admin
    const result = await query(
      `UPDATE users SET 
         role = $1, 
         subscription_plan = $2, 
         subscription_status = $3,
         tokens_remaining = $4,
         updated_at = NOW()
       WHERE email = $5 
       RETURNING id, email, first_name, role`,
      ['admin', '1year', 'active', 999999, email]
    );

    if (result.length === 0) {
      return NextResponse.json(
        { error: 'Foydalanuvchi topilmadi' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Foydalanuvchi admin qilib tayinlandi',
      user: result[0]
    });

  } catch (error) {
    console.error('Make admin error:', error);
    return NextResponse.json(
      { error: 'Server xatosi' },
      { status: 500 }
    );
  }
}