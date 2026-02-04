'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { normalizeSubscriptionPlan } from '@/lib/subscription-plans';

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
  tokens: number;
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

const PLANS: PlanConfig[] = [
  {
    id: 'starter',
    name: 'Starter',
    nameUz: 'Boshlang\'ich',
    price: 9,
    tokens: 150,
    description: "Boshlang'ich foydalanuvchilar uchun",
    features: {
      imageBasic: { model: 'gemini-2.5-flash-image', tokenCost: 2 },
      imagePro: { model: 'gemini-3-pro-image-preview', tokenCost: 7 },
      videoBasic: { model: 'veo-2.0-generate-001', tokenCost: 15, duration: 5 },
      videoPro: null,
      videoPremium: null,
      copywriter: { tokenCost: 3 },
      imageLimit: 50,
      videoLimit: 10,
    },
    benefits: [
      '150 token / oy',
      'Oddiy rasm (2 token)',
      'Pro rasm (7 token)',
      'Veo 2.0 video (15 token)',
      'Copywriter (3 token)',
      'Oy davomida 50 ta rasm',
      'Oy davomida 10 ta video',
      'Email qo\'llab-quvvatlash',
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    nameUz: 'Professional',
    price: 19,
    tokens: 400,
    description: 'Faol foydalanuvchilar uchun',
    popular: true,
    features: {
      imageBasic: { model: 'gemini-2.5-flash-image', tokenCost: 1.5 },
      imagePro: { model: 'gemini-3-pro-image-preview', tokenCost: 6 },
      videoBasic: { model: 'veo-2.0-generate-001', tokenCost: 25, duration: 6 },
      videoPro: { model: 'veo-3.0-fast-generate-001', tokenCost: 35, duration: 6 },
      videoPremium: null,
      copywriter: { tokenCost: 2 },
      imageLimit: 120,
      videoLimit: 10,
    },
    benefits: [
      '400 token / oy',
      'Oddiy rasm (1.5 token)',
      'Pro rasm (6 token)',
      'Veo 2.0 video (25 token)',
      'Pro video (35 token)',
      'Copywriter (2 token)',
      'Oy davomida 120 ta rasm',
      'Oy davomida 10 ta video',
      'Ustuvor qo\'llab-quvvatlash',
    ],
  },
  {
    id: 'business_plus',
    name: 'Business+',
    nameUz: 'Biznes+',
    price: 29,
    tokens: 700,
    description: 'Biznes va korxonalar uchun',
    features: {
      imageBasic: { model: 'gemini-2.5-flash-image', tokenCost: 1 },
      imagePro: { model: 'gemini-3-pro-image-preview', tokenCost: 5 },
      videoBasic: { model: 'veo-2.0-generate-001', tokenCost: 20, duration: 5 },
      videoPro: { model: 'veo-3.0-fast-generate-001', tokenCost: 30, duration: 7 },
      videoPremium: { model: 'veo3_upsampler_video_generation', tokenCost: 45, duration: 10 },
      copywriter: { tokenCost: 1 },
      imageLimit: 300,
      videoLimit: 22,
    },
    benefits: [
      '700 token / oy',
      'Oddiy rasm (1 token)',
      'Pro rasm (5 token)',
      'Veo 2.0 video (20 token)',
      'Pro video (30 token)',
      'Premium Upscale video (45 token)',
      'Copywriter (1 token)',
      'Oy davomida 300 ta rasm',
      'Oy davomida 22 ta video',
      '24/7 VIP qo\'llab-quvvatlash',
    ],
  },
];

export default function PricingPage() {
  const [user, setUser] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [showComparison, setShowComparison] = useState(false);

  useEffect(() => {
    fetchUser();

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
                {currentPlan === 'business_plus' ? 'Business+' : currentPlan === 'free' ? 'Free' : currentPlan}
              </span>
              <span className="text-white/60">|</span>
              <span className="text-white/80">{user.tokens_remaining} token</span>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-12 -mt-8">
        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {PLANS.map((plan) => {
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
                    ⭐ Eng Mashhur
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
                    <span className="text-5xl font-black text-gray-900">${plan.price}</span>
                    <span className="text-gray-500 font-medium">/oy</span>
                  </div>
                  
                  <div className={`mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold ${
                    plan.id === 'starter' 
                      ? 'bg-emerald-100 text-emerald-700' 
                      : plan.id === 'pro' 
                        ? 'bg-purple-100 text-purple-700'
                        : 'bg-amber-100 text-amber-700'
                  }`}>
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z" />
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.51-1.31c-.562-.649-1.413-1.076-2.353-1.253V5z" clipRule="evenodd" />
                    </svg>
                    {plan.tokens} token / oy
                  </div>
                </div>

                {/* Features */}
                <div className="px-8 py-6">
                  <h4 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center">
                      <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                      </svg>
                    </span>
                    Xususiyatlar
                  </h4>
                  <ul className="space-y-3">
                    {plan.benefits.map((benefit, idx) => (
                      <li key={idx} className="flex items-start gap-3 text-sm">
                        <svg className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
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
                        <span className="text-gray-500">🖼️ Oddiy rasm:</span>
                        <span className="font-bold text-gray-700">{plan.features.imageBasic.tokenCost}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">✨ Pro rasm:</span>
                        <span className="font-bold text-gray-700">{plan.features.imagePro?.tokenCost || '—'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">🎬 Video:</span>
                        <span className="font-bold text-gray-700">{plan.features.videoBasic.tokenCost}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">✍️ Matn:</span>
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
            <svg className={`w-5 h-5 transition-transform ${showComparison ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
            </svg>
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
                    <th className="px-6 py-4 font-bold text-emerald-700 text-center">Starter ($9)</th>
                    <th className="px-6 py-4 font-bold text-purple-700 text-center">Pro ($19)</th>
                    <th className="px-6 py-4 font-bold text-amber-700 text-center">Business+ ($29)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  <tr>
                    <td className="px-6 py-4 text-gray-600">Oylik token</td>
                    <td className="px-6 py-4 text-center font-bold">100</td>
                    <td className="px-6 py-4 text-center font-bold">250</td>
                    <td className="px-6 py-4 text-center font-bold">500</td>
                  </tr>
                  <tr className="bg-gray-50/50">
                    <td className="px-6 py-4 text-gray-600">🖼️ Oddiy rasm (token)</td>
                    <td className="px-6 py-4 text-center">2</td>
                    <td className="px-6 py-4 text-center">1.5</td>
                    <td className="px-6 py-4 text-center">1</td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 text-gray-600">✨ Pro rasm (token)</td>
                    <td className="px-6 py-4 text-center">7</td>
                    <td className="px-6 py-4 text-center">6</td>
                    <td className="px-6 py-4 text-center">5</td>
                  </tr>
                  <tr className="bg-gray-50/50">
                    <td className="px-6 py-4 text-gray-600">🎬 Veo 3 Fast video</td>
                    <td className="px-6 py-4 text-center">✓ (15 token)</td>
                    <td className="px-6 py-4 text-center">✓ (25 token)</td>
                    <td className="px-6 py-4 text-center">✓ (20 token)</td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 text-gray-600">🎥 Veo 3 Pro video</td>
                    <td className="px-6 py-4 text-center text-gray-400">—</td>
                    <td className="px-6 py-4 text-center">✓ (35 token)</td>
                    <td className="px-6 py-4 text-center">✓ (30 token)</td>
                  </tr>
                  <tr className="bg-gray-50/50">
                    <td className="px-6 py-4 text-gray-600">💎 Premium Upscale video</td>
                    <td className="px-6 py-4 text-center text-gray-400">—</td>
                    <td className="px-6 py-4 text-center text-gray-400">—</td>
                    <td className="px-6 py-4 text-center">✓ (45 token)</td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 text-gray-600">✍️ Copywriter (token)</td>
                    <td className="px-6 py-4 text-center">3</td>
                    <td className="px-6 py-4 text-center">2</td>
                    <td className="px-6 py-4 text-center">1</td>
                  </tr>
                  <tr className="bg-gray-50/50">
                    <td className="px-6 py-4 text-gray-600">Oylik rasm limiti</td>
                    <td className="px-6 py-4 text-center">50 ta</td>
                    <td className="px-6 py-4 text-center">120 ta</td>
                    <td className="px-6 py-4 text-center">300 ta</td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 text-gray-600">Oylik video limiti</td>
                    <td className="px-6 py-4 text-center">10 ta</td>
                    <td className="px-6 py-4 text-center">10 ta</td>
                    <td className="px-6 py-4 text-center">22 ta</td>
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
                href="https://t.me/Umarbek3838"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-white text-purple-600 rounded-xl font-bold hover:shadow-xl transition-all"
              >
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z"/>
                </svg>
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
