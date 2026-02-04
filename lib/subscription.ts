import { getClient, query } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

import {
  getNextPlan,
  normalizeSubscriptionPlan,
  SUBSCRIPTION_PLANS,
  type ImageMode,
  type SubscriptionPlan,
  type SubscriptionPlanMeta,
  type SubscriptionStatus,
  type VideoMode,
} from '@/lib/subscription-plans';

export { getNextPlan, normalizeSubscriptionPlan, SUBSCRIPTION_PLANS };
export type { ImageMode, SubscriptionPlan, SubscriptionPlanMeta, SubscriptionStatus, VideoMode };

export interface DbUserAccount {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  role: 'user' | 'admin';
  subscription_status: SubscriptionStatus;
  subscription_plan: SubscriptionPlan;
  subscription_expires_at: string | null;
  tokens_remaining: number;
}

function coerceTimestampToIso(value: unknown): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  const asString = String(value);
  return asString ? asString : null;
}

function coerceNumeric(value: unknown): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return value;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export class BillingError extends Error {
  status: number;
  code:
    | 'UNAUTHORIZED'
    | 'FORBIDDEN'
    | 'SUBSCRIPTION_EXPIRED'
    | 'INSUFFICIENT_TOKENS'
    | 'PLAN_RESTRICTED'
    | 'BAD_REQUEST';
  recommendedPlan?: SubscriptionPlan | null;

  constructor(opts: {
    message: string;
    status: number;
    code: BillingError['code'];
    recommendedPlan?: SubscriptionPlan | null;
  }) {
    super(opts.message);
    this.name = 'BillingError';
    this.status = opts.status;
    this.code = opts.code;
    this.recommendedPlan = opts.recommendedPlan;
  }
}

export async function getAuthenticatedUserAccount(): Promise<DbUserAccount> {
  const session = await getCurrentUser();
  if (!session) {
    throw new BillingError({
      status: 401,
      code: 'UNAUTHORIZED',
      message: "Avval tizimga kiring.",
      recommendedPlan: null,
    });
  }

  // Best-effort: burn tokens if subscription expired (even if cron hasn’t run yet).
  await query(
    `UPDATE users
     SET subscription_status = 'expired',
         tokens_remaining = 0,
         updated_at = NOW()
     WHERE id = $1
       AND subscription_status = 'active'
       AND subscription_expires_at IS NOT NULL
       AND subscription_expires_at <= NOW()`,
    [session.id]
  );

  const result = await query(
    `SELECT id, email, first_name, last_name, role,
            subscription_status, subscription_plan, subscription_expires_at, tokens_remaining
     FROM users
     WHERE id = $1`,
    [session.id]
  );

  if (result.rows.length === 0) {
    throw new BillingError({
      status: 401,
      code: 'UNAUTHORIZED',
      message: "Sessiya topilmadi. Qaytadan tizimga kiring.",
      recommendedPlan: null,
    });
  }

  const row = result.rows[0];
  return {
    id: String(row.id),
    email: String(row.email),
    first_name: row.first_name ?? null,
    last_name: row.last_name ?? null,
    role: row.role === 'admin' ? 'admin' : 'user',
    subscription_status: (row.subscription_status as SubscriptionStatus) || 'free',
    subscription_plan: normalizeSubscriptionPlan(row.subscription_plan),
    subscription_expires_at: coerceTimestampToIso(row.subscription_expires_at),
    tokens_remaining: coerceNumeric(row.tokens_remaining),
  };
}

export interface ReserveTokensArgs {
  userId: string;
  tokens: number;
}

export interface ReserveTokensResult {
  tokensRemaining: number;
}

export async function reserveTokens(args: ReserveTokensArgs): Promise<ReserveTokensResult> {
  const tokens = Number(args.tokens);
  if (!Number.isFinite(tokens) || tokens <= 0) {
    return { tokensRemaining: 0 };
  }

  const client = await getClient();
  try {
    await client.query('BEGIN');

    // Burn tokens if expired (atomic, on-demand)
    await client.query(
      `UPDATE users
       SET subscription_status = 'expired',
           tokens_remaining = 0,
           updated_at = NOW()
       WHERE id = $1
         AND subscription_status = 'active'
         AND subscription_expires_at IS NOT NULL
         AND subscription_expires_at <= NOW()`,
      [args.userId]
    );

    const userRes = await client.query(
      `SELECT role, subscription_status, subscription_plan, subscription_expires_at, tokens_remaining
       FROM users
       WHERE id = $1
       FOR UPDATE`,
      [args.userId]
    );

    if (userRes.rows.length === 0) {
      throw new BillingError({
        status: 401,
        code: 'UNAUTHORIZED',
        message: 'Foydalanuvchi topilmadi.',
        recommendedPlan: null,
      });
    }

    const user = userRes.rows[0];
    if (user.role === 'admin') {
      await client.query('COMMIT');
      return { tokensRemaining: 999999 };
    }

    const status = (user.subscription_status as SubscriptionStatus) || 'free';
    const plan = normalizeSubscriptionPlan(user.subscription_plan);
    const expiresAt = user.subscription_expires_at ? new Date(user.subscription_expires_at) : null;

    if (status === 'expired' || (status === 'active' && (!expiresAt || expiresAt <= new Date()))) {
      throw new BillingError({
        status: 403,
        code: 'SUBSCRIPTION_EXPIRED',
        message: "Oylik tarifingiz muddati tugagan. Tarifni qayta faollashtiring.",
        recommendedPlan: plan === 'free' ? 'starter' : plan,
      });
    }

    const remaining = coerceNumeric(user.tokens_remaining);
    if (remaining < tokens) {
      throw new BillingError({
        status: 402,
        code: 'INSUFFICIENT_TOKENS',
        message: "Tokenlaringiz yetarli emas. Tarifni yangilang yoki yuqori tarifga o'ting.",
        recommendedPlan: getNextPlan(plan),
      });
    }

    const updateRes = await client.query(
      `UPDATE users
       SET tokens_remaining = tokens_remaining - $1,
           updated_at = NOW()
       WHERE id = $2
       RETURNING tokens_remaining`,
      [tokens, args.userId]
    );

    await client.query('COMMIT');
    return { tokensRemaining: coerceNumeric(updateRes.rows[0]?.tokens_remaining) };
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // ignore rollback errors
    }
    throw err;
  } finally {
    client.release();
  }
}

export async function refundTokens(args: ReserveTokensArgs): Promise<void> {
  const tokens = Number(args.tokens);
  if (!Number.isFinite(tokens) || tokens <= 0) return;

  await query(
    `UPDATE users
     SET tokens_remaining = tokens_remaining + $1,
         updated_at = NOW()
     WHERE id = $2`,
    [tokens, args.userId]
  );
}

export interface TokenUsageArgs {
  userId: string;
  tokensUsed: number;
  serviceType: string;
  modelUsed?: string | null;
  prompt?: string | null;
}

export async function recordTokenUsage(args: TokenUsageArgs): Promise<void> {
  const tokensUsed = Number(args.tokensUsed);
  if (!Number.isFinite(tokensUsed) || tokensUsed <= 0) return;

  const prompt = (args.prompt || '').toString();
  const safePrompt = prompt.length > 1000 ? prompt.slice(0, 1000) + '...' : prompt;

  await query(
    `INSERT INTO token_usage (user_id, tokens_used, service_type, model_used, prompt)
     VALUES ($1, $2, $3, $4, $5)`,
    [args.userId, tokensUsed, args.serviceType, args.modelUsed || null, safePrompt || null]
  );
}

export interface ImagePolicy {
  costPerImage: number;
  outputCount: number;
  maxProductImages: number;
  maxStyleImages: number;
  maxPromptChars: number;
  allowedModels: string[];
}

export function getImagePolicy(plan: SubscriptionPlan, mode: ImageMode): ImagePolicy {
  if (plan === 'starter') {
    return mode === 'pro'
      ? {
          costPerImage: 7,
          outputCount: 2,
          maxProductImages: 3,
          maxStyleImages: 1,
          maxPromptChars: 150,
          allowedModels: ['gemini-3-pro-image-preview', 'nano-banana-pro-preview'],
        }
      : {
          costPerImage: 2,
          outputCount: 2,
          maxProductImages: 3,
          maxStyleImages: 1,
          maxPromptChars: 150,
          allowedModels: ['gemini-2.5-flash-image'],
        };
  }

  if (plan === 'pro') {
    return mode === 'pro'
      ? {
          costPerImage: 6,
          outputCount: 3,
          maxProductImages: 4,
          maxStyleImages: 1,
          maxPromptChars: 200,
          allowedModels: ['gemini-3-pro-image-preview', 'nano-banana-pro-preview'],
        }
      : {
          costPerImage: 1.5,
          outputCount: 2,
          maxProductImages: 3,
          maxStyleImages: 1,
          maxPromptChars: 150,
          allowedModels: ['gemini-2.5-flash-image'],
        };
  }

  if (plan === 'business_plus') {
    return mode === 'pro'
      ? {
          costPerImage: 5,
          outputCount: 4,
          maxProductImages: 5,
          maxStyleImages: 2,
          maxPromptChars: 300,
          allowedModels: ['gemini-3-pro-image-preview', 'nano-banana-pro-preview'],
        }
      : {
          costPerImage: 1,
          outputCount: 3,
          maxProductImages: 5,
          maxStyleImages: 2,
          maxPromptChars: 250,
          allowedModels: ['gemini-2.5-flash-image'],
        };
  }

  // Free: allow ONLY basic model (no pro)
  if (mode !== 'basic') {
    throw new BillingError({
      status: 403,
      code: 'PLAN_RESTRICTED',
      message: "Free tarifida faqat Basic rasm mavjud. Pullik tarifga o'ting.",
      recommendedPlan: 'starter',
    });
  }

  return {
    costPerImage: 2,
    outputCount: 1,
    maxProductImages: 1,
    maxStyleImages: 0,
    maxPromptChars: 50,
    allowedModels: ['gemini-2.5-flash-image'],
  };
}

export interface VideoPolicy {
  costPerVideo: number;
  maxImages: number;
  maxPromptChars: number;
  allowedModels: string[];
  upsamplerModel?: string;
}

export function getVideoPolicy(plan: SubscriptionPlan, mode: VideoMode): VideoPolicy {
  if (plan === 'starter') {
    if (mode !== 'basic') {
      throw new BillingError({
        status: 403,
        code: 'PLAN_RESTRICTED',
        message: "Starter tarifida faqat tez video (Veo 3 Fast) mavjud. Pro tarifga o'ting.",
        recommendedPlan: 'pro',
      });
    }
    return {
      costPerVideo: 15,
      maxImages: 2,
      maxPromptChars: 60,
      allowedModels: ['veo-3.0-fast-generate-001'],
    };
  }

  if (plan === 'pro') {
    if (mode === 'pro') {
      return {
        costPerVideo: 35,
        maxImages: 3,
        maxPromptChars: 120,
        allowedModels: ['veo-3.0-generate-001'],
      };
    }
    if (mode === 'basic') {
      return {
        costPerVideo: 25,
        maxImages: 2,
        maxPromptChars: 80,
        allowedModels: ['veo-3.0-fast-generate-001'],
      };
    }
    throw new BillingError({
      status: 403,
      code: 'PLAN_RESTRICTED',
      message: "Premium video faqat Business+ tarifida mavjud.",
      recommendedPlan: 'business_plus',
    });
  }

  if (plan === 'business_plus') {
    if (mode === 'premium') {
      return {
        // Business+ premium pipeline: FAST generate, then background upsampler
        costPerVideo: 45,
        maxImages: 4,
        maxPromptChars: 150,
        allowedModels: ['veo-3.0-fast-generate-001'],
        upsamplerModel: 'veo3_upsampler_video_generation',
      };
    }
    if (mode === 'pro') {
      return {
        costPerVideo: 30,
        maxImages: 3,
        maxPromptChars: 120,
        allowedModels: ['veo-3.0-fast-generate-001'],
      };
    }
    return {
      costPerVideo: 20,
      maxImages: 2,
      maxPromptChars: 80,
      allowedModels: ['veo-3.0-fast-generate-001'],
    };
  }

  throw new BillingError({
    status: 403,
    code: 'PLAN_RESTRICTED',
    message: "Video yaratish uchun tarif kerak. Starter tarifdan boshlang.",
    recommendedPlan: 'starter',
  });
}

export interface CopywriterPolicy {
  costPerCard: number;
  maxImages: number;
  maxAdditionalInfoChars: number;
  textModel: string;
}

export function getCopywriterPolicy(plan: SubscriptionPlan): CopywriterPolicy {
  if (plan === 'starter') {
    return { costPerCard: 8, maxImages: 1, maxAdditionalInfoChars: 500, textModel: 'gemini-2.0-flash' };
  }
  if (plan === 'pro') {
    return { costPerCard: 8, maxImages: 2, maxAdditionalInfoChars: 1000, textModel: 'gemini-2.5-flash' };
  }
  if (plan === 'business_plus') {
    return { costPerCard: 6, maxImages: 3, maxAdditionalInfoChars: 2500, textModel: 'gemini-2.5-pro' };
  }

  throw new BillingError({
    status: 403,
    code: 'PLAN_RESTRICTED',
    message: "Copywriter'dan foydalanish uchun tarif kerak. Starter tarifdan boshlang.",
    recommendedPlan: 'starter',
  });
}
