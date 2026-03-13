import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import {
  findContactIdByEmail,
  resolveAmoCrmContactTelegramUsernameFieldId,
  getUserSync,
  isAmoCrmEnabled,
  updateContact,
  upsertUserSync,
} from '@/lib/amocrm';

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

    // If user already synced to amoCRM, update contact fields so phone becomes visible on lead.
    // (We intentionally do NOT create new leads here to avoid pushing old users.)
    try {
      if (isAmoCrmEnabled()) {
        const sync = await withTimeout(getUserSync(session.id), 600);
        let contactId = sync?.amocrm_contact_id ? Number(sync.amocrm_contact_id) : 0;
          const updatedUser = result.rows[0] as any;
          const emailValue = typeof updatedUser.email === 'string' ? updatedUser.email : '';
          const phoneValue = typeof updatedUser.phone === 'string' ? updatedUser.phone : '';
          const telegramValue = typeof updatedUser.telegram_username === 'string' ? updatedUser.telegram_username : '';

          if (!(contactId > 0) && emailValue) {
            const found = await withTimeout(findContactIdByEmail(emailValue), 1200);
            if (found && found > 0) {
              contactId = found;
              await upsertUserSync({ userId: session.id, amocrmContactId: contactId });
            }
          }

          if (contactId > 0) {
            const customFields: Array<{ field_code?: string; field_id?: number; values: Array<{ value: string; enum_code?: string }> }> = [];
            if (emailValue) customFields.push({ field_code: 'EMAIL', values: [{ value: emailValue, enum_code: 'WORK' }] });
            if (phoneValue) customFields.push({ field_code: 'PHONE', values: [{ value: phoneValue, enum_code: 'WORK' }] });

            const tgFieldId = await withTimeout(resolveAmoCrmContactTelegramUsernameFieldId(), 1200);
            if (telegramValue && tgFieldId && tgFieldId > 0) {
              customFields.push({ field_id: tgFieldId, values: [{ value: telegramValue }] });
            }
            if (customFields.length > 0) {
              const resp = await withTimeout(updateContact(contactId, { custom_fields_values: customFields }), 1200);
              if (!resp.ok) {
                console.warn('amoCRM contact update failed after contact update:', {
                  userId: session.id,
                  contactId,
                  status: resp.status,
                  text: resp.text,
                });
              }
            }
          }
      }
    } catch (err) {
      console.warn('amoCRM contact update exception after contact update:', { userId: session.id, err });
    }

    return NextResponse.json({ success: true, user: result.rows[0] });
  } catch (error) {
    console.error('Contact update error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
