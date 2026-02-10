import crypto from 'crypto';
import type { PoolClient } from 'pg';

export const REFERRAL_COOKIE_NAME = 'referral_code';

const REFERRAL_CODE_RE = /^[A-Z0-9]{6,16}$/;

export function sanitizeReferralCode(input: unknown): string | null {
  if (!input) return null;
  const code = String(input).trim().toUpperCase();
  if (!REFERRAL_CODE_RE.test(code)) return null;
  return code;
}

export function generateReferralCode(): string {
  // 10 chars, URL-safe, case-insensitive friendly.
  // Example: "4K9P1Q8Z7M"
  return crypto
    .randomBytes(8)
    .toString('base64url')
    .replace(/[^A-Za-z0-9]/g, '')
    .slice(0, 10)
    .toUpperCase();
}

export async function ensureReferralSchema(client: PoolClient): Promise<void> {
  await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_code TEXT`);
  await client.query(
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS referred_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL`
  );
  await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS referred_at TIMESTAMP`);

  // Unique only when present
  await client.query(
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_users_referral_code_unique
     ON users (referral_code)
     WHERE referral_code IS NOT NULL`
  );

  await client.query(
    `CREATE TABLE IF NOT EXISTS referral_rewards (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      referrer_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      referred_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      plan VARCHAR(50) NOT NULL CHECK (plan IN ('starter', 'pro', 'business_plus')),
      tokens_awarded INT NOT NULL CHECK (tokens_awarded > 0),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (referred_user_id)
    )`
  );

  await client.query(
    `CREATE INDEX IF NOT EXISTS idx_referral_rewards_referrer ON referral_rewards(referrer_user_id)`
  );
}

export async function ensureUserReferralCode(client: PoolClient, userId: string): Promise<string | null> {
  // Must be called inside a transaction when possible.
  const existing = await client.query(
    `SELECT referral_code FROM users WHERE id = $1 FOR UPDATE`,
    [userId]
  );
  if (existing.rows.length === 0) return null;

  const current = existing.rows[0]?.referral_code ? String(existing.rows[0].referral_code) : null;
  if (current && REFERRAL_CODE_RE.test(current)) return current;

  for (let i = 0; i < 12; i++) {
    const code = generateReferralCode();
    try {
      const updated = await client.query(
        `UPDATE users
         SET referral_code = $1, updated_at = NOW()
         WHERE id = $2
         RETURNING referral_code`,
        [code, userId]
      );
      const out = updated.rows?.[0]?.referral_code ? String(updated.rows[0].referral_code) : null;
      if (out) return out;
    } catch (err: any) {
      const code = err?.code ? String(err.code) : '';
      // Unique violation -> retry
      if (code === '23505') continue;
      throw err;
    }
  }

  throw new Error('Failed to generate unique referral code');
}

export async function maybeAttachReferralToUser(
  client: PoolClient,
  userId: string,
  referralCodeInput: unknown
): Promise<{ attached: boolean; referrerUserId: string | null }> {
  const referralCode = sanitizeReferralCode(referralCodeInput);
  if (!referralCode) return { attached: false, referrerUserId: null };

  const refRes = await client.query(`SELECT id FROM users WHERE referral_code = $1 LIMIT 1`, [referralCode]);
  const referrerUserId = refRes.rows?.[0]?.id ? String(refRes.rows[0].id) : null;
  if (!referrerUserId || referrerUserId === userId) return { attached: false, referrerUserId: null };

  // Only attribute if user has not purchased any plan yet.
  const upd = await client.query(
    `UPDATE users
     SET referred_by_user_id = $1,
         referred_at = NOW(),
         updated_at = NOW()
     WHERE id = $2
       AND referred_by_user_id IS NULL
       AND (subscription_plan = 'free' OR subscription_plan IS NULL)
       AND (subscription_status = 'free' OR subscription_status IS NULL)
     RETURNING id`,
    [referrerUserId, userId]
  );

  return { attached: upd.rowCount > 0, referrerUserId: upd.rowCount > 0 ? referrerUserId : null };
}

export function referralRewardTokensForPlan(plan: string): number {
  const normalized = String(plan || '').toLowerCase();
  if (normalized === 'starter') return 30;
  if (normalized === 'pro') return 50;
  if (normalized === 'business_plus') return 100;
  return 0;
}

export async function applyReferralRewardForPurchase(
  client: PoolClient,
  referredUserId: string,
  plan: string
): Promise<{ awarded: boolean; tokens: number; referrerUserId: string | null }> {
  const tokens = referralRewardTokensForPlan(plan);
  if (!tokens) return { awarded: false, tokens: 0, referrerUserId: null };

  const referredRes = await client.query(
    `SELECT id, referred_by_user_id FROM users WHERE id = $1 FOR UPDATE`,
    [referredUserId]
  );
  if (referredRes.rows.length === 0) return { awarded: false, tokens: 0, referrerUserId: null };

  const referrerUserId = referredRes.rows[0]?.referred_by_user_id
    ? String(referredRes.rows[0].referred_by_user_id)
    : null;
  if (!referrerUserId || referrerUserId === referredUserId) {
    return { awarded: false, tokens: 0, referrerUserId: null };
  }

  const ins = await client.query(
    `INSERT INTO referral_rewards (referrer_user_id, referred_user_id, plan, tokens_awarded)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (referred_user_id) DO NOTHING
     RETURNING id`,
    [referrerUserId, referredUserId, String(plan), tokens]
  );

  if (ins.rowCount === 0) {
    return { awarded: false, tokens: 0, referrerUserId };
  }

  await client.query(
    `UPDATE users
     SET tokens_remaining = COALESCE(tokens_remaining, 0) + $1,
         updated_at = NOW()
     WHERE id = $2`,
    [tokens, referrerUserId]
  );

  return { awarded: true, tokens, referrerUserId };
}
