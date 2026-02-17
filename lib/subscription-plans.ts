/**
 * Subscription Plans Configuration
 * Based on tarif.md specifications
 */

export type SubscriptionStatus = 'free' | 'active' | 'expired';
export type SubscriptionPlan = 'free' | 'starter' | 'pro' | 'business_plus';

export type ImageMode = 'basic' | 'pro';
export type VideoMode = 'basic' | 'pro' | 'premium';

// ============ TOKEN COSTS ============

export interface ImageTokenCost {
  basic: number;
  pro: number;
}

export interface VideoTokenCost {
  basic: number;
  pro: number;
  premium: number;
}

export const IMAGE_TOKEN_COSTS: Record<SubscriptionPlan, ImageTokenCost> = {
  free: { basic: 2, pro: 999 },      // Faqat basic, pro mavjud emas
  starter: { basic: 2, pro: 7 },     // $9/oy - 140 token
  pro: { basic: 1.5, pro: 6 },       // $19/oy - 350 token
  business_plus: { basic: 1, pro: 5 }, // $29/oy - 600 token
};

export const VIDEO_TOKEN_COSTS: Record<SubscriptionPlan, VideoTokenCost> = {
  free: { basic: false as unknown as number, pro: false as unknown as number, premium: false  as unknown as number }, // Video mavjud emas
  starter: { basic: 15, pro: false as unknown as number, premium: false as unknown as number },
  pro: { basic: 25, pro: 35, premium: false as unknown as number },
  business_plus: { basic: 20, pro: 30, premium: 45 },
};

// ============ IMAGE MODELS ============

export interface ImageModelConfig {
  id: string;
  name: string;
  service: 'gemini' | 'vertex';
  mode: ImageMode;
  description: string;
}

export const IMAGE_MODELS: ImageModelConfig[] = [
  {
    id: 'gemini-2.5-flash-image',
    name: 'Umari Flash',
    service: 'gemini',
    mode: 'basic',
    description: 'Tez va tejamli - kundalik ishlar uchun',
  },
  {
    id: 'gemini-3-pro-image-preview',
    name: 'Umari Pro',
    service: 'gemini',
    mode: 'pro',
    description: 'Yuqori sifat - e-commerce uchun',
  },
  {
    id: 'nano-banana-pro-preview',
    name: 'Umari AI',
    service: 'gemini',
    mode: 'pro',
    description: 'Premium alternativ model',
  },
];

// ============ VIDEO MODELS ============

export interface VideoModelConfig {
  id: string;
  name: string;
  mode: VideoMode;
  duration: number;
  description: string;
  features: string[];
}

export const VIDEO_MODELS: VideoModelConfig[] = [
  {
    id: 'veo-3.0-fast-generate-001',
    name: 'Umari Flash Video',
    mode: 'basic',
    duration: 4,
    description: 'Tez generatsiya - oddiy videolar uchun',
    features: ['4 soniya', 'Tez rendering', 'Asosiy animatsiya'],
  },
  {
    id: 'veo-3.0-generate-001',
    name: 'Umari Pro Video',
    mode: 'pro',
    duration: 6,
    description: 'Yuqori sifat - reklama videolari uchun',
    features: ['6 soniya', 'Yumshoq kamera', "Yaxshi yorug'lik"],
  },
  {
    id: 'veo3_upsampler_video_generation',
    name: 'Umari AI Video',
    mode: 'premium',
    duration: 8,
    description: 'Eng yuqori sifat - professional reklama uchun',
    features: ['8 soniya', 'Upscale qilingan', 'Studio sifati', 'Reels/Ads uchun'],
  },
];

// ============ PLAN CONFIGURATIONS ============

export interface PlanImageConfig {
  maxProductImages: number;
  maxStyleImages: number;
  maxTextInput: number;
  outputCount: number;
  allowedModes: ImageMode[];
  allowedModels: string[];
}

export interface PlanVideoConfig {
  maxImages: number;
  maxTextInput: number;
  allowedModes: VideoMode[];
  allowedModels: string[];
  monthlyLimits: Record<VideoMode, number>;
}

export interface PlanCopywriterConfig {
  allowedModels: string[];
  maxBlocks: number;
  features: string[];
}

export interface SubscriptionPlanMeta {
  id: SubscriptionPlan;
  label: string;
  labelUz: string;
  monthlyPriceUsd: number;
  monthlyTokens: number;
  color: string;
  gradient: string;
  badge?: string;
  image: PlanImageConfig;
  video: PlanVideoConfig;
  copywriter: PlanCopywriterConfig;
  highlights: string[];
}

// Free users get 5 tokens for trial, no pro mode, no video
export const FREE_TRIAL_TOKENS = 5;

export const SUBSCRIPTION_PLANS: Record<SubscriptionPlan, SubscriptionPlanMeta> = {
  free: {
    id: 'free',
    label: 'Free',
    labelUz: 'Sinov',
    monthlyPriceUsd: 0,
    monthlyTokens: FREE_TRIAL_TOKENS,
    color: 'gray',
    gradient: 'from-gray-400 to-gray-600',
    image: {
      maxProductImages: 1,
      maxStyleImages: 0,
      maxTextInput: 50,
      outputCount: 1,
      allowedModes: ['basic'],
      allowedModels: ['gemini-2.5-flash-image'],
    },
    video: {
      maxImages: 0,
      maxTextInput: 0,
      allowedModes: [],
      allowedModels: [],
      monthlyLimits: { basic: 0, pro: 0, premium: 0 },
    },
    copywriter: {
      allowedModels: [],
      maxBlocks: 0,
      features: [],
    },
    highlights: ['5 token sinov', 'Faqat oddiy rasm', 'Video mavjud emas'],
  },
  starter: {
    id: 'starter',
    label: 'Starter',
    labelUz: 'Starter',
    monthlyPriceUsd: 9,
    monthlyTokens: 140,
    color: 'emerald',
    gradient: 'from-emerald-400 to-teal-600',
    badge: 'Ommabop',
    image: {
      maxProductImages: 3,
      maxStyleImages: 1,
      maxTextInput: 150,
      outputCount: 2,
      allowedModes: ['basic', 'pro'],
      allowedModels: ['gemini-2.5-flash-image', 'gemini-3-pro-image-preview'],
    },
    video: {
      maxImages: 2,
      maxTextInput: 60,
      allowedModes: ['basic'], // Faqat Veo 3 Fast, Pro/Premium yo'q
      allowedModels: ['veo-3.0-fast-generate-001'],
      monthlyLimits: { basic: 6, pro: 0, premium: 0 },
    },
    copywriter: {
      allowedModels: ['gemini-2.0-flash-lite-001'],
      maxBlocks: 18,
      features: ['Mahsulot nomi', 'Tavsifi', 'Xususiyatlar'],
    },
    highlights: [
      '140 token / oy',
      "Oddiy: 2 token/so'rov",
      "Pro: 7 token/so'rov",
      'Video: 15 token (4 sek)',
      'Faqat Veo 3 Fast',
    ],
  },
  pro: {
    id: 'pro',
    label: 'Pro',
    labelUz: 'Pro',
    monthlyPriceUsd: 19,
    monthlyTokens: 350,
    color: 'blue',
    gradient: 'from-blue-500 to-indigo-600',
    badge: 'Tavsiya etiladi',
    image: {
      maxProductImages: 4,
      maxStyleImages: 1,
      maxTextInput: 200,
      outputCount: 3,
      allowedModes: ['basic', 'pro'],
      allowedModels: ['gemini-2.5-flash-image', 'gemini-3-pro-image-preview', 'nano-banana-pro-preview'],
    },
    video: {
      maxImages: 3,
      maxTextInput: 120,
      allowedModes: ['basic', 'pro'], // Premium yo'q
      allowedModels: ['veo-3.0-fast-generate-001', 'veo-3.0-generate-001'],
      monthlyLimits: { basic: 6, pro: 4, premium: 0 },
    },
    copywriter: {
      allowedModels: ['gemini-2.5-flash-lite'],
      maxBlocks: 18,
      features: ['Marketplace copy', 'SEO tavsif', 'Uzun matn'],
    },
    highlights: [
      '350 token / oy',
      "Oddiy: 1.5 token/so'rov",
      "Pro: 6 token/so'rov",
      'Pro video: 35 token',
    ],
  },
  business_plus: {
    id: 'business_plus',
    label: 'Business+',
    labelUz: 'Business+',
    monthlyPriceUsd: 29,
    monthlyTokens: 600,
    color: 'purple',
    gradient: 'from-purple-500 to-pink-600',
    badge: 'Eng kuchli',
    image: {
      maxProductImages: 5,
      maxStyleImages: 2,
      maxTextInput: 300,
      outputCount: 4,
      allowedModes: ['basic', 'pro'],
      allowedModels: ['gemini-2.5-flash-image', 'gemini-3-pro-image-preview', 'nano-banana-pro-preview'],
    },
    video: {
      maxImages: 4,
      maxTextInput: 150,
      allowedModes: ['basic', 'pro', 'premium'],
      allowedModels: ['veo-3.0-fast-generate-001', 'veo3_upsampler_video_generation'],
      monthlyLimits: { basic: 10, pro: 7, premium: 5 },
    },
    copywriter: {
      allowedModels: ['gemini-2.5-pro', 'gemini-2.5-flash'],
      maxBlocks: 18,
      features: ['Product copy', 'Marketing/Ads', 'Long description', 'SEO Pro'],
    },
    highlights: [
      '600 token / oy',
      "Oddiy: 1 token/so'rov",
      "Pro: 5 token/so'rov",
      'Oddiy video: 20 token',
      'Pro video: 30 token',
      'Premium (Upscale): 45 token',
    ],
  },
};

// ============ HELPER FUNCTIONS ============

export function normalizeSubscriptionPlan(plan: unknown): SubscriptionPlan {
  const raw = String(plan || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');

  if (!raw) return 'free';
  if (raw === 'starter') return 'starter';
  if (raw === 'pro' || raw === 'professional') return 'pro';
  if (raw === 'business_plus' || raw === 'business+') return 'business_plus';
  if (raw === 'free') return 'free';

  if (raw === '1month') return 'starter';
  if (raw === '3months') return 'pro';
  if (raw === '6months' || raw === '1year') return 'business_plus';

  return 'free';
}

export function getNextPlan(plan: SubscriptionPlan): SubscriptionPlan | null {
  switch (plan) {
    case 'free':
      return 'starter';
    case 'starter':
      return 'pro';
    case 'pro':
      return 'business_plus';
    case 'business_plus':
      return null;
  }
}

export function getImageTokenCost(plan: SubscriptionPlan, mode: ImageMode): number {
  return IMAGE_TOKEN_COSTS[plan]?.[mode] ?? 999;
}

export function getVideoTokenCost(plan: SubscriptionPlan, mode: VideoMode): number {
  return VIDEO_TOKEN_COSTS[plan]?.[mode] ?? 999;
}

export function getImageModelsForPlan(plan: SubscriptionPlan): ImageModelConfig[] {
  const planConfig = SUBSCRIPTION_PLANS[plan];
  if (!planConfig) return [];
  return IMAGE_MODELS.filter(
    (m) => planConfig.image.allowedModels.includes(m.id) && planConfig.image.allowedModes.includes(m.mode)
  );
}

export function getVideoModelsForPlan(plan: SubscriptionPlan): VideoModelConfig[] {
  const planConfig = SUBSCRIPTION_PLANS[plan];
  if (!planConfig) return [];
  return VIDEO_MODELS.filter(
    (m) => planConfig.video.allowedModels.includes(m.id) && planConfig.video.allowedModes.includes(m.mode)
  );
}

export function canUseImageMode(plan: SubscriptionPlan, mode: ImageMode): boolean {
  return SUBSCRIPTION_PLANS[plan]?.image.allowedModes.includes(mode) ?? false;
}

export function canUseVideoMode(plan: SubscriptionPlan, mode: VideoMode): boolean {
  return SUBSCRIPTION_PLANS[plan]?.video.allowedModes.includes(mode) ?? false;
}

export function getVideoMonthlyLimit(plan: SubscriptionPlan, mode: VideoMode): number {
  return SUBSCRIPTION_PLANS[plan]?.video.monthlyLimits[mode] ?? 0;
}

export function formatTokens(n: number): string {
  return Number(n || 0).toLocaleString('uz-UZ', { maximumFractionDigits: 1 });
}

export function getPlanColor(plan: SubscriptionPlan): string {
  return SUBSCRIPTION_PLANS[plan]?.color ?? 'gray';
}

export function getPlanGradient(plan: SubscriptionPlan): string {
  return SUBSCRIPTION_PLANS[plan]?.gradient ?? 'from-gray-400 to-gray-600';
}
