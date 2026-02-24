'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  IMAGE_TOKEN_COSTS,
  SUBSCRIPTION_PLANS,
  VIDEO_TOKEN_COSTS,
  normalizeSubscriptionPlan,
} from '@/lib/subscription-plans';
import {
  availableDurations,
  computeOldPrice,
  durationLabelUz,
  featuresToList,
  pickPlanForDuration,
  safeDiscountPercent,
  type DbSubscriptionPlanRow,
} from '@/lib/subscription-plan-catalog';
import { FiCheck, FiChevronDown, FiStar } from 'react-icons/fi';
import { FaCoins, FaTelegramPlane } from 'react-icons/fa';

interface UserData {
  subscription_plan: string;
  tokens_remaining: number;
  role: string;
}

interface PlanConfig {
  id: string;
  name: string;
  nameUz: string;
  price: number;
  oldPrice?: number | null;
  discountPercent?: number;
  tokens: number;
  durationMonths: number;
  description: string;
  popular?: boolean;
  features: {
    imageBasic: { model: string; tokenCost: number };
    imagePro: { model: string; tokenCost: number } | null;
    videoBasic: { model: string; tokenCost: number; duration: number };
    videoPro: { model: string; tokenCost: number; duration: number } | null;
    videoPremium: { model: string; tokenCost: number; duration: number } | null;
    copywriter: { tokenCost: number };
    imageLimit: number;
    videoLimit: number;
  };
  benefits: string[];
}

const COPYWRITER_TOKEN_COST: Record<string, number> = {
  starter: 3,
  pro: 2,
  business_plus: 1,
};

function buildPlanConfig(slug: string, durationMonths: number, dbPlan?: DbSubscriptionPlanRow): PlanConfig | null {
  if (slug !== 'starter' && slug !== 'pro' && slug !== 'business_plus') return null;
  const meta = SUBSCRIPTION_PLANS[slug as keyof typeof SUBSCRIPTION_PLANS];
  if (!meta) return null;

  const imageCosts = IMAGE_TOKEN_COSTS[slug as keyof typeof IMAGE_TOKEN_COSTS];
  const videoCosts = VIDEO_TOKEN_COSTS[slug as keyof typeof VIDEO_TOKEN_COSTS];
  const basicVideoDuration = slug === 'pro' ? 6 : 4;

  const proImage = imageCosts.pro >= 900 ? null : { model: 'gemini-3-pro-image-preview', tokenCost: imageCosts.pro };
  const proVideo = videoCosts.pro >= 900 ? null : { model: 'veo-3.0-generate-001', tokenCost: videoCosts.pro, duration: 6 };
  const premiumVideo =
    videoCosts.premium >= 900
      ? null
      : { model: 'veo3_upsampler_video_generation', tokenCost: videoCosts.premium, duration: 8 };

  const benefitsFromDb = dbPlan ? featuresToList(dbPlan.features) : [];
  const benefits = benefitsFromDb.length > 0 ? benefitsFromDb : meta.highlights;

  const price = dbPlan?.price ?? meta.monthlyPriceUsd;
  const discountPercent = safeDiscountPercent(dbPlan?.discount_percent);
  const oldPrice = computeOldPrice(price, discountPercent);

  return {
    id: slug,
    name: meta.label,
    nameUz: meta.labelUz,
    price,
    oldPrice,
    discountPercent,
    tokens: dbPlan?.tokens_included ?? meta.monthlyTokens,
    durationMonths,
    description: dbPlan?.description || 'Tarif',
    popular: slug === 'pro',
    features: {
      imageBasic: { model: 'gemini-2.5-flash-image', tokenCost: imageCosts.basic },
      imagePro: proImage,
      videoBasic: { model: 'veo-3.0-fast-generate-001', tokenCost: videoCosts.basic, duration: basicVideoDuration },
      videoPro: proVideo,
      videoPremium: premiumVideo,
      copywriter: { tokenCost: COPYWRITER_TOKEN_COST[slug] ?? 0 },
      imageLimit: slug === 'starter' ? 50 : slug === 'pro' ? 120 : 300,
      videoLimit: slug === 'starter' ? 10 : slug === 'pro' ? 10 : 22,
    },
    benefits,
  };
}

export default function PricingPage() {
  const [user, setUser] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [plans, setPlans] = useState<PlanConfig[]>([]);
  const [dbPlans, setDbPlans] = useState<DbSubscriptionPlanRow[]>([]);
  const [durationMonths, setDurationMonths] = useState<number>(1);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [showComparison, setShowComparison] = useState(false);

  useEffect(() => {
    fetchUser();
    fetchPlans();

    // Check URL params for pre-selected plan
    const params = new URLSearchParams(window.location.search);
    const planParam = params.get('plan');
    if (planParam) {
      const normalized = normalizeSubscriptionPlan(planParam);
      if (normalized && normalized !== 'free') {
        setSelectedPlan(normalized);
      }
    }
  }, []);

  const fetchPlans = async () => {
    try {
      const res = await fetch('/api/subscriptions/plans');
      const data = await res.json();
      const rows: DbSubscriptionPlanRow[] = Array.isArray(data?.plans) ? (data.plans as DbSubscriptionPlanRow[]) : [];
      setDbPlans(rows);
    } catch {
      // ignore; fall back to metadata
    }
  };

  const fetchUser = async () => {
    try {
      const response = await fetch('/api/auth/me');
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.user) {
          setUser({
            subscription_plan: data.user.subscription_plan || 'free',
            tokens_remaining: data.user.tokens_remaining || 0,
            role: data.user.role || 'user',
          });
        }
      }
    } catch (error) {
      // Ignore
    } finally {
      setLoading(false);
    }
  };

  const handleSubscribe = (planId: string) => {
    // Open Telegram user chat with a ready message
    import('@/lib/telegram').then(({ getTelegramSubscribeUrl }) => {
      window.open(getTelegramSubscribeUrl(planId), '_blank');
    });
  };

  const currentPlan = user?.subscription_plan || 'free';
  const durationOptions = availableDurations(dbPlans);
  useEffect(() => {
    if (!durationOptions.includes(durationMonths)) {
      setDurationMonths(durationOptions[0] || 1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [durationOptions.join(','), durationMonths]);

  useEffect(() => {
    if (!dbPlans || dbPlans.length === 0) return;
    const order = ['starter', 'pro', 'business_plus'];
    const mapped: PlanConfig[] = [];
    for (const slug of order) {
      const row = pickPlanForDuration(dbPlans, slug as any, durationMonths);
      const cfg = buildPlanConfig(slug, durationMonths, row || undefined);
      if (cfg) mapped.push(cfg);
    }
    if (mapped.length > 0) setPlans(mapped);
  }, [dbPlans, durationMonths]);

  const displayPlans =
    plans.length > 0
      ? plans
      : (['starter', 'pro', 'business_plus']
          .map((slug) => buildPlanConfig(slug, durationMonths))
          .filter(Boolean) as PlanConfig[]);

  const durationText = durationLabelUz(durationMonths);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-purple-50/30 to-pink-50/30">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 via-pink-600 to-rose-600 py-16 px-4">
        <div className="max-w-6xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-black text-white mb-4 tracking-tight">
            Tariflar
          </h1>
          <p className="text-xl text-white/80 max-w-2xl mx-auto">
            Professional AI vositalaridan foydalanish uchun o'zingizga mos tarifni tanlang
          </p>
          {user && (
            <div className="mt-6 inline-flex items-center gap-3 bg-white/10 backdrop-blur-sm rounded-full px-6 py-3 border border-white/20">
              <span className="text-white/80">Hozirgi tarif:</span>
              <span className="font-bold text-white capitalize">
                {currentPlan === 'business_plus' ? 'Business+' : currentPlan === 'free' ? 'Bepul' : currentPlan}
              </span>
              <span className="text-white/60">|</span>
              <span className="text-white/80">{user.tokens_remaining} token</span>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-12 -mt-8">
        {durationOptions.length > 1 && (
          <div className="mb-8 flex items-center justify-center">
            <div className="inline-flex items-center gap-2 rounded-2xl border border-gray-200 bg-white p-2 shadow-sm">
              {durationOptions.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setDurationMonths(m)}
                  className={`rounded-xl px-4 py-2 text-sm font-bold transition ${
                    m === durationMonths ? 'bg-gray-900 text-white' : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {durationLabelUz(m)}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {displayPlans.map((plan) => {
            const isCurrentPlan = currentPlan === plan.id;
            const isUpgrade = 
              (currentPlan === 'free') ||
              (currentPlan === 'starter' && (plan.id === 'pro' || plan.id === 'business_plus')) ||
              (currentPlan === 'pro' && plan.id === 'business_plus');

            return (
              <div
                key={plan.id}
                className={`relative bg-white rounded-3xl shadow-xl overflow-hidden transition-all duration-300 hover:shadow-2xl hover:scale-[1.02] ${
                  plan.popular ? 'ring-4 ring-purple-500 ring-opacity-50' : ''
                } ${selectedPlan === plan.id ? 'ring-4 ring-pink-500' : ''}`}
              >
                {/* Popular Badge */}
                {plan.popular && (
                  <div className="absolute top-0 right-0 bg-gradient-to-r from-purple-500 to-pink-500 text-white text-xs font-bold px-4 py-2 rounded-bl-2xl">
                    <span className="inline-flex items-center gap-1">
                      <FiStar /> Eng mashhur
                    </span>
                  </div>
                )}

                {/* Header */}
                <div className={`px-8 pt-8 pb-6 ${
                  plan.id === 'starter' 
                    ? 'bg-gradient-to-br from-emerald-50 to-teal-50' 
                    : plan.id === 'pro' 
                      ? 'bg-gradient-to-br from-purple-50 to-pink-50'
                      : 'bg-gradient-to-br from-amber-50 to-orange-50'
                }`}>
                  <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-1">
                    {plan.nameUz}
                  </h3>
                  <h2 className="text-3xl font-black text-gray-900 mb-2">{plan.name}</h2>
                  <p className="text-gray-600 text-sm mb-4">{plan.description}</p>
                  
                  <div className="flex items-baseline gap-1">
                    {plan.oldPrice ? (
                      <span className="text-sm font-bold text-gray-400 line-through">${Number(plan.oldPrice).toFixed(2)}</span>
                    ) : null}
                    <span className="text-5xl font-black text-gray-900">${Number(plan.price).toFixed(2)}</span>
                    <span className="text-gray-500 font-medium">/{durationText}</span>
                  </div>

                  {Number(plan.discountPercent || 0) > 0 ? (
                    <div className="mt-2 inline-flex items-center gap-2 rounded-full bg-rose-50 px-4 py-2 text-xs font-black text-rose-700">
                      -{plan.discountPercent}% chegirma
                    </div>
                  ) : null}
                  
                  <div className={`mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold ${
                    plan.id === 'starter' 
                      ? 'bg-emerald-100 text-emerald-700' 
                      : plan.id === 'pro' 
                        ? 'bg-purple-100 text-purple-700'
                        : 'bg-amber-100 text-amber-700'
                  }`}>
                    <FaCoins className="w-5 h-5" />
                    {plan.tokens} token / {durationText}
                  </div>
                </div>

                {/* Features */}
                <div className="px-8 py-6">
                  <h4 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center">
                      <FiCheck className="w-4 h-4 text-green-600" />
                    </span>
                    Xususiyatlar
                  </h4>
                  <ul className="space-y-3">
                    {plan.benefits.map((benefit, idx) => (
                      <li key={idx} className="flex items-start gap-3 text-sm">
                        <FiCheck className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                        <span className="text-gray-700">{benefit}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Token Costs Mini Table */}
                <div className="px-8 pb-4">
                  <div className="bg-gray-50 rounded-xl p-4">
                    <h5 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Token narxlari</h5>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="flex justify-between">
                        <span className="text-gray-500">Oddiy rasm (so'rov):</span>
                        <span className="font-bold text-gray-700">{plan.features.imageBasic.tokenCost}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Pro rasm (so'rov):</span>
                        <span className="font-bold text-gray-700">{plan.features.imagePro?.tokenCost || '—'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Video:</span>
                        <span className="font-bold text-gray-700">{plan.features.videoBasic.tokenCost}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Matn:</span>
                        <span className="font-bold text-gray-700">{plan.features.copywriter.tokenCost}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* CTA Button */}
                <div className="px-8 pb-8">
                  {isCurrentPlan ? (
                    <button
                      disabled
                      className="w-full py-4 px-6 rounded-xl font-bold text-gray-500 bg-gray-100 cursor-not-allowed"
                    >
                      ✓ Hozirgi tarif
                    </button>
                  ) : (
                    <button
                      onClick={() => handleSubscribe(plan.id)}
                      className={`w-full py-4 px-6 rounded-xl font-bold text-white transition-all hover:shadow-lg ${
                        plan.id === 'starter'
                          ? 'bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700'
                          : plan.id === 'pro'
                            ? 'bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700'
                            : 'bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700'
                      }`}
                    >
                      {isUpgrade ? "Yangilash" : "Obuna bo'lish"} →
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Comparison Toggle */}
        <div className="mt-12 text-center">
          <button
            onClick={() => setShowComparison(!showComparison)}
            className="inline-flex items-center gap-2 px-6 py-3 bg-white rounded-xl shadow-lg hover:shadow-xl transition-all text-gray-700 font-medium"
          >
            <FiChevronDown className={`w-5 h-5 transition-transform ${showComparison ? 'rotate-180' : ''}`} />
            {showComparison ? "Solishtiruvni yopish" : "Tariflarni solishtirish"}
          </button>
        </div>

        {/* Comparison Table */}
        {showComparison && (
          <div className="mt-8 bg-white rounded-3xl shadow-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gradient-to-r from-purple-50 to-pink-50">
                    <th className="text-left px-6 py-4 font-bold text-gray-700">Xususiyat</th>
                    <th className="px-6 py-4 font-bold text-emerald-700 text-center">
                      Starter (${Number(displayPlans.find((p) => p.id === 'starter')?.price ?? 0).toFixed(2)})
                    </th>
                    <th className="px-6 py-4 font-bold text-purple-700 text-center">
                      Pro (${Number(displayPlans.find((p) => p.id === 'pro')?.price ?? 0).toFixed(2)})
                    </th>
                    <th className="px-6 py-4 font-bold text-amber-700 text-center">
                      Business+ (${Number(displayPlans.find((p) => p.id === 'business_plus')?.price ?? 0).toFixed(2)})
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  <tr>
                    <td className="px-6 py-4 text-gray-600">Token ({durationText})</td>
                    <td className="px-6 py-4 text-center font-bold">{displayPlans.find((p) => p.id === 'starter')?.tokens ?? '—'}</td>
                    <td className="px-6 py-4 text-center font-bold">{displayPlans.find((p) => p.id === 'pro')?.tokens ?? '—'}</td>
                    <td className="px-6 py-4 text-center font-bold">{displayPlans.find((p) => p.id === 'business_plus')?.tokens ?? '—'}</td>
                  </tr>
                  <tr className="bg-gray-50/50">
                    <td className="px-6 py-4 text-gray-600">Oddiy rasm (so'rov, token)</td>
                    <td className="px-6 py-4 text-center">{displayPlans.find((p) => p.id === 'starter')?.features.imageBasic.tokenCost ?? '—'}</td>
                    <td className="px-6 py-4 text-center">{displayPlans.find((p) => p.id === 'pro')?.features.imageBasic.tokenCost ?? '—'}</td>
                    <td className="px-6 py-4 text-center">{displayPlans.find((p) => p.id === 'business_plus')?.features.imageBasic.tokenCost ?? '—'}</td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 text-gray-600">Pro rasm (so'rov, token)</td>
                    <td className="px-6 py-4 text-center">{displayPlans.find((p) => p.id === 'starter')?.features.imagePro?.tokenCost ?? '—'}</td>
                    <td className="px-6 py-4 text-center">{displayPlans.find((p) => p.id === 'pro')?.features.imagePro?.tokenCost ?? '—'}</td>
                    <td className="px-6 py-4 text-center">{displayPlans.find((p) => p.id === 'business_plus')?.features.imagePro?.tokenCost ?? '—'}</td>
                  </tr>
                  <tr className="bg-gray-50/50">
                    <td className="px-6 py-4 text-gray-600">Umari flash video</td>
                    <td className="px-6 py-4 text-center">✓ ({displayPlans.find((p) => p.id === 'starter')?.features.videoBasic.tokenCost ?? '—'} token)</td>
                    <td className="px-6 py-4 text-center">✓ ({displayPlans.find((p) => p.id === 'pro')?.features.videoBasic.tokenCost ?? '—'} token)</td>
                    <td className="px-6 py-4 text-center">✓ ({displayPlans.find((p) => p.id === 'business_plus')?.features.videoBasic.tokenCost ?? '—'} token)</td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 text-gray-600">Umari Pro video</td>
                    <td className="px-6 py-4 text-center text-gray-400">—</td>
                    <td className="px-6 py-4 text-center">{displayPlans.find((p) => p.id === 'pro')?.features.videoPro ? `✓ (${displayPlans.find((p) => p.id === 'pro')?.features.videoPro?.tokenCost} token)` : '—'}</td>
                    <td className="px-6 py-4 text-center">{displayPlans.find((p) => p.id === 'business_plus')?.features.videoPro ? `✓ (${displayPlans.find((p) => p.id === 'business_plus')?.features.videoPro?.tokenCost} token)` : '—'}</td>
                  </tr>
                  <tr className="bg-gray-50/50">
                    <td className="px-6 py-4 text-gray-600">Umari Premium Upscale video</td>
                    <td className="px-6 py-4 text-center text-gray-400">—</td>
                    <td className="px-6 py-4 text-center text-gray-400">—</td>
                    <td className="px-6 py-4 text-center">{displayPlans.find((p) => p.id === 'business_plus')?.features.videoPremium ? `✓ (${displayPlans.find((p) => p.id === 'business_plus')?.features.videoPremium?.tokenCost} token)` : '—'}</td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 text-gray-600">Copywriter (token)</td>
                    <td className="px-6 py-4 text-center">{displayPlans.find((p) => p.id === 'starter')?.features.copywriter.tokenCost ?? '—'}</td>
                    <td className="px-6 py-4 text-center">{displayPlans.find((p) => p.id === 'pro')?.features.copywriter.tokenCost ?? '—'}</td>
                    <td className="px-6 py-4 text-center">{displayPlans.find((p) => p.id === 'business_plus')?.features.copywriter.tokenCost ?? '—'}</td>
                  </tr>
                  <tr className="bg-gray-50/50">
                    <td className="px-6 py-4 text-gray-600">Oylik rasm limiti</td>
                    <td className="px-6 py-4 text-center">{displayPlans.find((p) => p.id === 'starter')?.features.imageLimit ?? '—'} ta</td>
                    <td className="px-6 py-4 text-center">{displayPlans.find((p) => p.id === 'pro')?.features.imageLimit ?? '—'} ta</td>
                    <td className="px-6 py-4 text-center">{displayPlans.find((p) => p.id === 'business_plus')?.features.imageLimit ?? '—'} ta</td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 text-gray-600">Oylik video limiti</td>
                    <td className="px-6 py-4 text-center">{displayPlans.find((p) => p.id === 'starter')?.features.videoLimit ?? '—'} ta</td>
                    <td className="px-6 py-4 text-center">{displayPlans.find((p) => p.id === 'pro')?.features.videoLimit ?? '—'} ta</td>
                    <td className="px-6 py-4 text-center">{displayPlans.find((p) => p.id === 'business_plus')?.features.videoLimit ?? '—'} ta</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* FAQ / Contact */}
        <div className="mt-16 bg-gradient-to-r from-purple-600 via-pink-600 to-rose-600 rounded-3xl p-8 md:p-12 text-white">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-2xl md:text-3xl font-black mb-4">Savollaringiz bormi?</h2>
            <p className="text-white/80 mb-8">
              Maxsus tarif kerakmi yoki savollaringiz bormi? Admin bilan bog'laning.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a
                href="https://t.me/@UmariAI_admin"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-white text-purple-600 rounded-xl font-bold hover:shadow-xl transition-all"
              >
                <FaTelegramPlane className="w-6 h-6" />
                Telegram orqali bog'lanish
              </a>
              <Link
                href="/dashboard"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-white/10 backdrop-blur-sm border border-white/30 text-white rounded-xl font-bold hover:bg-white/20 transition-all"
              >
                Bosh sahifaga qaytish
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
