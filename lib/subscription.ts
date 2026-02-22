import { getClient, query } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { ensureReferralSchema, getActiveReferralTokenBalance, consumeReferralTokens, refundReferralTokens } from '@/lib/referral';

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
  phone?: string | null;
  telegram_username?: string | null;
  role: 'user' | 'admin';
  subscription_status: SubscriptionStatus;
  subscription_plan: SubscriptionPlan;
  subscription_expires_at: string | null;
  tokens_remaining: number;
  tokens_subscription_remaining?: number;
  tokens_referral_remaining?: number;
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

  let result;
  try {
    result = await query(
      `SELECT id, email, first_name, last_name, phone, telegram_username, role,
              subscription_status, subscription_plan, subscription_expires_at, tokens_remaining
       FROM users
       WHERE id = $1`,
      [session.id]
    );
  } catch (err: any) {
    // Backward compatibility: older DBs might not have phone/telegram_username yet.
    const code = err?.code ? String(err.code) : '';
    const message = err?.message ? String(err.message) : '';
    const isUndefinedColumn = code === '42703' || message.toLowerCase().includes('does not exist');
    const mentionsContactColumns =
      message.toLowerCase().includes('phone') || message.toLowerCase().includes('telegram_username');

    if (isUndefinedColumn && mentionsContactColumns) {
      result = await query(
        `SELECT id, email, first_name, last_name, role,
                subscription_status, subscription_plan, subscription_expires_at, tokens_remaining
         FROM users
         WHERE id = $1`,
        [session.id]
      );
    } else {
      throw err;
    }
  }

  if (result.rows.length === 0) {
    throw new BillingError({
      status: 401,
      code: 'UNAUTHORIZED',
      message: "Sessiya topilmadi. Qaytadan tizimga kiring.",
      recommendedPlan: null,
    });
  }

  const row = result.rows[0];

  // Referral token balance (30-day grants). Best-effort for older DBs.
  let referralTokens = 0;
  try {
    const refRes = await query(
      `SELECT COALESCE(SUM(tokens_remaining), 0)::numeric AS total
       FROM referral_rewards
       WHERE referrer_user_id = $1
         AND tokens_remaining > 0
         AND (expires_at IS NULL OR expires_at > NOW())`,
      [session.id]
    );
    referralTokens = Number(refRes.rows?.[0]?.total || 0);
  } catch {
    referralTokens = 0;
  }

  const subscriptionTokens = coerceNumeric(row.tokens_remaining);
  const totalTokens = subscriptionTokens + (session ? referralTokens : 0);
  return {
    id: String(row.id),
    email: String(row.email),
    first_name: row.first_name ?? null,
    last_name: row.last_name ?? null,
    phone: 'phone' in row ? (row.phone ?? null) : null,
    telegram_username: 'telegram_username' in row ? (row.telegram_username ?? null) : null,
    role: row.role === 'admin' ? 'admin' : 'user',
    subscription_status: (row.subscription_status as SubscriptionStatus) || 'free',
    subscription_plan: normalizeSubscriptionPlan(row.subscription_plan),
    subscription_expires_at: coerceTimestampToIso(row.subscription_expires_at),
    tokens_remaining: totalTokens,
    tokens_subscription_remaining: subscriptionTokens,
    tokens_referral_remaining: referralTokens,
  };
}

export interface ReserveTokensArgs {
  userId: string;
  tokens: number;
}

export interface ReserveTokensResult {
  tokensRemaining: number;
  debited?: {
    subscription: number;
    referral: number;
  };
  referralDebits?: Array<{ rewardId: string; tokens: number }>;
}

export async function reserveTokens(args: ReserveTokensArgs): Promise<ReserveTokensResult> {
  const tokens = Number(args.tokens);
  if (!Number.isFinite(tokens) || tokens <= 0) {
    return { tokensRemaining: 0, debited: { subscription: 0, referral: 0 }, referralDebits: [] };
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
      return { tokensRemaining: 999999, debited: { subscription: 0, referral: 0 }, referralDebits: [] };
    }

    const status = (user.subscription_status as SubscriptionStatus) || 'free';
    const plan = normalizeSubscriptionPlan(user.subscription_plan);
    const expiresAt = user.subscription_expires_at ? new Date(user.subscription_expires_at) : null;

    // Referral schema/tokens (expiring grants)
    await ensureReferralSchema(client);
    const referralBalance = await getActiveReferralTokenBalance(client, args.userId);

    const isExpired = status === 'expired' || (status === 'active' && (!expiresAt || expiresAt <= new Date()));
    if (isExpired && referralBalance <= 0) {
      throw new BillingError({
        status: 403,
        code: 'SUBSCRIPTION_EXPIRED',
        message: "Oylik tarifingiz muddati tugagan. Tarifni qayta faollashtiring.",
        recommendedPlan: plan === 'free' ? 'starter' : plan,
      });
    }

    const subscriptionRemaining = Math.max(0, coerceNumeric(user.tokens_remaining));
    const totalRemaining = subscriptionRemaining + referralBalance;
    if (totalRemaining < tokens) {
      throw new BillingError({
        status: 402,
        code: 'INSUFFICIENT_TOKENS',
        message: "Tokenlaringiz yetarli emas. Tarifni yangilang yoki yuqori tarifga o'ting.",
        recommendedPlan: getNextPlan(plan),
      });
    }

    // Spend subscription tokens first, then referral tokens.
    const subscriptionDebit = Number(Math.min(subscriptionRemaining, tokens).toFixed(2));
    const referralNeed = Number((tokens - subscriptionDebit).toFixed(2));

    let updatedSubscriptionRemaining = subscriptionRemaining;
    if (subscriptionDebit > 0) {
      const updateRes = await client.query(
        `UPDATE users
         SET tokens_remaining = tokens_remaining - $1,
             updated_at = NOW()
         WHERE id = $2
         RETURNING tokens_remaining`,
        [subscriptionDebit, args.userId]
      );
      updatedSubscriptionRemaining = coerceNumeric(updateRes.rows[0]?.tokens_remaining);
    }

    let referralDebits: Array<{ rewardId: string; tokens: number }> = [];
    if (referralNeed > 0) {
      const consume = await consumeReferralTokens(client, args.userId, referralNeed);
      referralDebits = consume.debits;
      if (consume.consumed < referralNeed) {
        throw new BillingError({
          status: 402,
          code: 'INSUFFICIENT_TOKENS',
          message: "Tokenlaringiz yetarli emas. Tarifni yangilang yoki yuqori tarifga o'ting.",
          recommendedPlan: getNextPlan(plan),
        });
      }
    }

    const referralRemainingAfter = Number((referralBalance - referralNeed).toFixed(2));
    const combinedAfter = Number((Math.max(0, updatedSubscriptionRemaining) + Math.max(0, referralRemainingAfter)).toFixed(2));

    await client.query('COMMIT');
    return {
      tokensRemaining: combinedAfter,
      debited: { subscription: subscriptionDebit, referral: referralNeed },
      referralDebits,
    };
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

export async function refundTokens(args: ReserveTokensArgs & { referralDebits?: Array<{ rewardId: string; tokens: number }>; debited?: { subscription: number; referral: number } }): Promise<void> {
  const tokens = Number(args.tokens);
  if (!Number.isFinite(tokens) || tokens <= 0) return;

  const subscriptionRefund = Math.max(0, Number(args.debited?.subscription ?? tokens));
  const referralDebits = Array.isArray(args.referralDebits) ? args.referralDebits : [];

  if (referralDebits.length === 0) {
    await query(
      `UPDATE users
       SET tokens_remaining = tokens_remaining + $1,
           updated_at = NOW()
       WHERE id = $2`,
      [subscriptionRefund, args.userId]
    );
    return;
  }

  const client = await getClient();
  try {
    await client.query('BEGIN');
    await ensureReferralSchema(client);
    if (subscriptionRefund > 0) {
      await client.query(
        `UPDATE users
         SET tokens_remaining = tokens_remaining + $1,
             updated_at = NOW()
         WHERE id = $2`,
        [subscriptionRefund, args.userId]
      );
    }

    await refundReferralTokens(client, referralDebits);

    await client.query('COMMIT');
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // ignore
    }
    throw err;
  } finally {
    client.release();
  }
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
  costPerRequest: number;
  outputCount: number;
  maxProductImages: number;
  maxStyleImages: number;
  maxPromptChars: number;
  allowedModels: string[];
}

export function getImagePolicy(plan: SubscriptionPlan, mode: ImageMode): ImagePolicy {
  if (plan === 'starter') {
    if (mode === 'ultra') {
      throw new BillingError({
        status: 403,
        code: 'PLAN_RESTRICTED',
        message: "Ultra rejim faqat Business+ tarifida mavjud.",
        recommendedPlan: 'business_plus',
      });
    }

    return mode === 'pro'
      ? {
          costPerRequest: 7,
          outputCount: 2,
          maxProductImages: 3,
          maxStyleImages: 0,
          maxPromptChars: 150,
          allowedModels: ['nano-banana-pro-preview'],
        }
      : {
          costPerRequest: 2,
          outputCount: 2,
          maxProductImages: 3,
          maxStyleImages: 0,
          maxPromptChars: 150,
          allowedModels: ['gemini-2.5-flash-image'],
        };
  }

  if (plan === 'pro') {
    if (mode === 'ultra') {
      throw new BillingError({
        status: 403,
        code: 'PLAN_RESTRICTED',
        message: "Ultra rejim faqat Business+ tarifida mavjud.",
        recommendedPlan: 'business_plus',
      });
    }

    return mode === 'pro'
      ? {
          costPerRequest: 6,
          outputCount: 3,
          maxProductImages: 4,
          maxStyleImages: 0,
          maxPromptChars: 200,
          allowedModels: ['nano-banana-pro-preview'],
        }
      : {
          costPerRequest: 1.5,
          outputCount: 2,
          maxProductImages: 3,
          maxStyleImages: 0,
          maxPromptChars: 150,
          allowedModels: ['gemini-2.5-flash-image'],
        };
  }

  if (plan === 'business_plus') {
    if (mode === 'ultra') {
      return {
        costPerRequest: 15,
        outputCount: 4,
        maxProductImages: 5,
        maxStyleImages: 2,
        maxPromptChars: 320,
        allowedModels: ['gemini-3-pro-image-preview'],
      };
    }

    if (mode === 'pro') {
      return {
        costPerRequest: 5,
        outputCount: 4,
        maxProductImages: 5,
        maxStyleImages: 1,
        maxPromptChars: 300,
        allowedModels: ['nano-banana-pro-preview'],
      };
    }

    return {
      costPerRequest: 1,
      outputCount: 3,
      maxProductImages: 5,
      maxStyleImages: 0,
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
    costPerRequest: 2,
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
    return { costPerCard: 3, maxImages: 1, maxAdditionalInfoChars: 500, textModel: 'gemini-2.0-flash-lite-001' };
  }
  if (plan === 'pro') {
    return { costPerCard: 2, maxImages: 2, maxAdditionalInfoChars: 1000, textModel: 'gemini-2.5-flash-lite' };
  }
  if (plan === 'business_plus') {
    return { costPerCard: 1, maxImages: 3, maxAdditionalInfoChars: 2500, textModel: 'gemini-2.5-pro' };
  }

  throw new BillingError({
    status: 403,
    code: 'PLAN_RESTRICTED',
    message: "Copywriter'dan foydalanish uchun tarif kerak. Starter tarifdan boshlang.",
    recommendedPlan: 'starter',
  });
}

export interface InfografikaPolicy {
  costPerGenerate: number;
  variantCount: number;
  maxImages: number;
  maxProductNameChars: number;
  maxAdditionalInfoChars: number;
  textModel: string;
  imageModel: string;
  imageFallbackModels: string[];
}

export function getInfografikaPolicy(plan: SubscriptionPlan): InfografikaPolicy {
  // Infografika requires a multimodal TEXT model (it receives an image input and returns JSON text).
  // Provide sensible per-plan defaults, with env overrides.
  const starterTextModel = (process.env.GEMINI_INFOGRAFIKA_TEXT_MODEL_STARTER || process.env.GEMINI_INFOGRAFIKA_TEXT_MODEL || 'gemini-2.0-flash').trim();
  const proTextModel = (process.env.GEMINI_INFOGRAFIKA_TEXT_MODEL_PRO || process.env.GEMINI_INFOGRAFIKA_TEXT_MODEL || 'gemini-2.5-pro').trim();
  const businessTextModel = (process.env.GEMINI_INFOGRAFIKA_TEXT_MODEL_BUSINESS || process.env.GEMINI_INFOGRAFIKA_TEXT_MODEL || 'gemini-2.5-pro').trim();

  // Infografika rendering should use the same IMAGE models as Marketplace Studio.
  // Starter: "oddiy" marketplace model. Pro: nano-banana. Business+: gemini-3-pro.
  const starterImageModel = (process.env.GEMINI_INFOGRAFIKA_IMAGE_MODEL_STARTER || 'gemini-2.5-flash-image').trim();
  const proImageModel = (process.env.GEMINI_INFOGRAFIKA_IMAGE_MODEL_PRO || 'nano-banana-pro-preview').trim();
  const businessImageModel = (process.env.GEMINI_INFOGRAFIKA_IMAGE_MODEL_BUSINESS || 'gemini-3-pro-image-preview').trim();

  // Infografika: conversion-oriented variants. Free plan is not allowed.
  if (plan === 'starter') {
    return {
      costPerGenerate: 20,
      variantCount: 1,
      maxImages: 1,
      maxProductNameChars: 40,
      maxAdditionalInfoChars: 80,
      textModel: starterTextModel,
      imageModel: starterImageModel,
      imageFallbackModels: [proImageModel, businessImageModel].filter(Boolean),
    };
  }
  if (plan === 'pro') {
    return {
      costPerGenerate: 20,
      variantCount: 2,
      maxImages: 1,
      maxProductNameChars: 50,
      maxAdditionalInfoChars: 120,
      textModel: proTextModel,
      imageModel: proImageModel,
      imageFallbackModels: [starterImageModel, businessImageModel].filter(Boolean),
    };
  }
  if (plan === 'business_plus') {
    return {
      costPerGenerate: 20,
      variantCount: 3,
      maxImages: 1,
      maxProductNameChars: 60,
      maxAdditionalInfoChars: 150,
      textModel: businessTextModel,
      imageModel: businessImageModel,
      imageFallbackModels: [proImageModel, starterImageModel].filter(Boolean),
    };
  }

  throw new BillingError({
    status: 403,
    code: 'PLAN_RESTRICTED',
    message: "Infografika'dan foydalanish uchun tarif kerak. Starter tarifdan boshlang.",
    recommendedPlan: 'starter',
  });
}
