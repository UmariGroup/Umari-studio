import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

function normalizeTelegramUsername(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return '';
  return trimmed.startsWith('@') ? trimmed.slice(1) : trimmed;
}

function normalizeUzPhone(input: string): { normalized: string; isValid: boolean } {
  const trimmed = input.trim();
  if (!trimmed) return { normalized: '', isValid: true };

  // Keep digits only
  const digits = trimmed.replace(/\D/g, '');

  // Strict: Uzbekistan numbers should be +998 followed by 9 digits
  if (digits.length === 12 && digits.startsWith('998')) {
    return { normalized: `+${digits}`, isValid: true };
  }

  // Also accept local 9 digits and coerce to +998...
  if (digits.length === 9) {
    return { normalized: `+998${digits}`, isValid: true };
  }

  return { normalized: trimmed, isValid: false };
}

function isValidTelegramUsername(username: string): boolean {
  if (!username) return true;
  return /^[a-zA-Z0-9_]{5,32}$/.test(username);
}

export async function POST(req: NextRequest) {
  try {
    const session = await getCurrentUser();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = (await req.json().catch(() => ({}))) as {
      phone?: unknown;
      telegram_username?: unknown;
    };

    const rawPhone = typeof body.phone === 'string' ? body.phone : '';
    const phoneNorm = normalizeUzPhone(rawPhone);
    const phone = phoneNorm.normalized;
    const telegramUsernameRaw = typeof body.telegram_username === 'string' ? body.telegram_username : '';
    const telegram_username = normalizeTelegramUsername(telegramUsernameRaw);

    if (!phone && !telegram_username) {
      return NextResponse.json(
        { error: 'Telefon yoki Telegram username dan kamida bittasini kiriting.' },
        { status: 400 }
      );
    }

    if (!phoneNorm.isValid) {
      return NextResponse.json(
        { error: 'Telefon raqam formati noto‘g‘ri. Masalan: +998901234567' },
        { status: 400 }
      );
    }

    if (!isValidTelegramUsername(telegram_username)) {
      return NextResponse.json(
        { error: 'Telegram username noto‘g‘ri. Faqat harf/raqam/_ va uzunligi 5-32 bo‘lsin.' },
        { status: 400 }
      );
    }

    const result = await query(
      `UPDATE users
       SET phone = NULLIF($1, ''),
           telegram_username = NULLIF($2, ''),
           updated_at = NOW()
       WHERE id = $3
       RETURNING id, email, first_name, role, subscription_plan, tokens_remaining, phone, telegram_username`,
      [phone, telegram_username, session.id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, user: result.rows[0] });
  } catch (error) {
    console.error('Contact update error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
