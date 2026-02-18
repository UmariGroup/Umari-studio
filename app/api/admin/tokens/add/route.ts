import { NextRequest, NextResponse } from 'next/server';
import { getClient } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

type AddTokensBody = {
  user_id?: string;
  email?: string;
  tokens?: number;
  reason?: string;
};

export async function POST(req: NextRequest) {
  const admin = await getCurrentUser();
  if (!admin || admin.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized - Admin access required' }, { status: 403 });
  }

  let body: AddTokensBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const userId = String(body.user_id || '').trim();
  const email = String(body.email || '').trim().toLowerCase();
  const tokens = Number(body.tokens);
  const reason = String(body.reason || '').trim().slice(0, 300);
  const sourceIp =
    req.headers.get('x-forwarded-for')?.split(',')?.[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    null;
  const userAgent = req.headers.get('user-agent') || null;

  if (!Number.isFinite(tokens) || !Number.isInteger(tokens) || tokens <= 0) {
    return NextResponse.json({ error: "Token miqdori 0 dan katta bo'lishi kerak" }, { status: 400 });
  }
  if (tokens > 1_000_000) {
    return NextResponse.json({ error: 'Bir martalik token limiti: 1,000,000' }, { status: 400 });
  }
  if (!userId && !email) {
    return NextResponse.json({ error: 'user_id yoki email yuboring' }, { status: 400 });
  }

  const client = await getClient();
  try {
    await client.query('BEGIN');

    const lookup = userId
      ? await client.query(
          `SELECT id, email, role, tokens_remaining
           FROM users
           WHERE id = $1
           FOR UPDATE`,
          [userId]
        )
      : await client.query(
          `SELECT id, email, role, tokens_remaining
           FROM users
           WHERE LOWER(email) = $1
           FOR UPDATE`,
          [email]
        );

    if (lookup.rows.length === 0) {
      await client.query('ROLLBACK');
      return NextResponse.json({ error: 'Foydalanuvchi topilmadi' }, { status: 404 });
    }

    const target = lookup.rows[0];
    if (String(target.role || '').toLowerCase() === 'admin') {
      await client.query('ROLLBACK');
      return NextResponse.json({ error: "Admin akkauntiga token qo'shish o'chirib qo'yilgan" }, { status: 400 });
    }

    const before = Number(target.tokens_remaining || 0);
    const update = await client.query(
      `UPDATE users
       SET tokens_remaining = tokens_remaining + $1,
           updated_at = NOW()
       WHERE id = $2
       RETURNING id, email, tokens_remaining`,
      [tokens, target.id]
    );

    const after = Number(update.rows[0].tokens_remaining || 0);

    await client.query(
      `INSERT INTO admin_logs (admin_id, action, target_user_id, changes)
       VALUES ($1, 'ADD_TOKENS', $2, $3::jsonb)`,
      [
        admin.id,
        target.id,
        JSON.stringify({
          tokens_added: tokens,
          balance_before: before,
          balance_after: after,
          reason: reason || null,
          source_ip: sourceIp,
          user_agent: userAgent,
        }),
      ]
    );

    await client.query('COMMIT');

    return NextResponse.json({
      success: true,
      message: "Token muvaffaqiyatli qo'shildi",
      user: {
        id: update.rows[0].id,
        email: update.rows[0].email,
        tokens_remaining: after,
      },
      transaction: {
        tokens_added: tokens,
        balance_before: before,
        balance_after: after,
        reason: reason || null,
      },
    });
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // ignore
    }
    console.error('Admin add tokens error:', error);
    return NextResponse.json({ error: "Token qo'shishda xatolik" }, { status: 500 });
  } finally {
    client.release();
  }
}
