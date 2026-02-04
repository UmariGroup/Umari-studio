'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { planLabelUz } from '@/lib/uzbek-errors';

interface UserData {
  id: string;
  email: string;
  first_name: string | null;
  role: string;
  subscription_plan: string;
  subscription_plan_label?: string;
  subscription_status: string;
  subscription_expires_at?: string | null;
  tokens_remaining: number;
  tokens_total: number;
  tokens_used?: number;
}

interface TokenCostInfo {
  basic: number;
  pro: number;
  videoBasic: number;
  videoPro?: number;
  videoPremium?: number;
  copywriter: number;
}

const TOKEN_COSTS: Record<string, TokenCostInfo> = {
  free: { basic: 3, pro: 10, videoBasic: 20, copywriter: 4 },
  starter: { basic: 2, pro: 7, videoBasic: 15, copywriter: 3 },
  pro: { basic: 1.5, pro: 6, videoBasic: 25, videoPro: 35, copywriter: 2 },
  business_plus: { basic: 1, pro: 5, videoBasic: 20, videoPro: 30, videoPremium: 45, copywriter: 1 },
};

export default function DashboardPage() {
  const [user, setUser] = useState<UserData | null>(null);
  const [access, setAccess] = useState<{
    canUse: boolean;
    blockedReason: 'expired' | 'no_tokens' | null;
    recommendedPlan: string | null;
  }>({
    canUse: true,
    blockedReason: null,
    recommendedPlan: null,
  });
  const [stats, setStats] = useState({
    tokensRemaining: 0,
    tokensUsed: 0,
    tokensTotal: 0,
    operationsCount: 0,
  });
  const [loading, setLoading] = useState(true);

  const formatTokens = (n: number) =>
    Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 });

  const isAdmin = user?.role === 'admin';
  const plan = user?.subscription_plan || 'free';
  const planTokenCosts = TOKEN_COSTS[plan] || TOKEN_COSTS.starter;

  useEffect(() => {
    fetchUserData();
  }, []);

  const fetchUserData = async () => {
    try {
      const response = await fetch('/api/auth/me');
      if (!response.ok) {
        window.location.href = '/login';
        return;
      }
      const data = await response.json();
      if (data.success) {
        setUser(data.user);
        setAccess({
          canUse: Boolean(data.can_use),
          blockedReason: data.blocked_reason || null,
          recommendedPlan: data.recommended_plan || null,
        });
        setStats({
          tokensRemaining: Number(data.user.tokens_remaining || 0),
          tokensUsed: Number(data.user.tokens_used || (data.user.tokens_total - data.user.tokens_remaining) || 0),
          tokensTotal: Number(data.user.tokens_total || 0),
          operationsCount: 0,
        });
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
      window.location.href = '/login';
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      localStorage.removeItem('userData');
      window.location.href = '/login';
    } catch (error) {
      console.error('Logout error:', error);
      localStorage.removeItem('userData');
      window.location.href = '/login';
    }
  };

  const tokenPercentage = stats.tokensTotal > 0 
    ? Math.round((stats.tokensRemaining / stats.tokensTotal) * 100)
    : 0;

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-purple-50 to-pink-50 flex items-center justify-center">
        <div className="text-center">
          <div className="relative w-20 h-20 mx-auto mb-6">
            <div className="absolute inset-0 rounded-full border-4 border-purple-200"></div>
            <div className="absolute inset-0 rounded-full border-4 border-purple-600 border-t-transparent animate-spin"></div>
          </div>
          <p className="text-gray-600 font-medium">Yuklanimoqda...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-purple-50/30 to-pink-50/30">
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Alert Banners */}
        {access.blockedReason === 'expired' && (
          <div className="mb-8 rounded-2xl border-2 border-amber-300 bg-gradient-to-r from-amber-50 to-orange-50 p-6 shadow-lg">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-amber-200 rounded-xl">
                  <svg className="w-8 h-8 text-amber-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-xl font-extrabold text-amber-900">Obuna muddati tugagan! ⏰</h3>
                  <p className="text-sm text-amber-800 mt-1">
                    Davom etish uchun tarifni qayta faollashtiring.
                  </p>
                </div>
              </div>
              <Link
                href={`/pricing?plan=${encodeURIComponent(user?.subscription_plan || 'starter')}`}
                className="inline-flex items-center justify-center px-6 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 text-white font-bold hover:shadow-lg transition-all"
              >
                Tarifni faollashtirish →
              </Link>
            </div>
          </div>
        )}

        {access.blockedReason === 'no_tokens' && (
          <div className="mb-8 rounded-2xl border-2 border-red-300 bg-gradient-to-r from-red-50 to-pink-50 p-6 shadow-lg">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-red-200 rounded-xl">
                  <svg className="w-8 h-8 text-red-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-xl font-extrabold text-red-900">Token tugadi! 🔴</h3>
                  <p className="text-sm text-red-800 mt-1">
                    Rejani yangilang yoki yuqori tarifga o'ting.
                  </p>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <Link
                  href={`/pricing?plan=${encodeURIComponent(user?.subscription_plan || 'starter')}`}
                  className="inline-flex items-center justify-center px-6 py-3 rounded-xl bg-gradient-to-r from-red-500 to-pink-600 text-white font-bold hover:shadow-lg transition-all"
                >
                  Rejani yangilash
                </Link>
                {access.recommendedPlan && (
                  <Link
                    href={`/pricing?plan=${encodeURIComponent(access.recommendedPlan)}`}
                    className="inline-flex items-center justify-center px-6 py-3 rounded-xl bg-white text-red-700 font-bold border-2 border-red-200 hover:border-red-400 transition-all"
                  >
                    {planLabelUz(access.recommendedPlan) || 'Upgrade'} ga o'tish
                  </Link>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Token Pricing Info */}
        <div className="mb-8 bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden">
          <div className="bg-gradient-to-r from-purple-50 to-pink-50 px-8 py-5 border-b border-gray-100">
            <h2 className="text-xl font-bold text-gray-800 flex items-center gap-3">
              <span className="p-2 bg-purple-100 rounded-xl">
                <svg className="w-5 h-5 text-purple-600" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z" />
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.51-1.31c-.562-.649-1.413-1.076-2.353-1.253V5z" clipRule="evenodd" />
                </svg>
              </span>
              Token narxlari
              <span className="ml-2 px-3 py-1 text-sm bg-purple-100 text-purple-700 rounded-full font-medium">
                {plan === 'business_plus' ? 'Business+' : planLabelUz(plan) || 'Free'}
              </span>
            </h2>
          </div>
          <div className="p-8">
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {/* Basic Image */}
              <div className="bg-gradient-to-br from-emerald-50 to-teal-50 p-5 rounded-2xl border border-emerald-100">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-2xl">🖼️</span>
                  <span className="font-bold text-emerald-700 text-sm">Oddiy rasm</span>
                </div>
                <p className="text-3xl font-black text-emerald-600">{planTokenCosts.basic}</p>
                <p className="text-xs text-emerald-500 mt-1">token / rasm</p>
              </div>
              
              {/* Pro Image */}
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-5 rounded-2xl border border-blue-100">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-2xl">✨</span>
                  <span className="font-bold text-blue-700 text-sm">Pro rasm</span>
                </div>
                <p className="text-3xl font-black text-blue-600">{planTokenCosts.pro}</p>
                <p className="text-xs text-blue-500 mt-1">token / rasm</p>
              </div>
              
              {/* Basic Video */}
              <div className="bg-gradient-to-br from-amber-50 to-orange-50 p-5 rounded-2xl border border-amber-100">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-2xl">🎬</span>
                  <span className="font-bold text-amber-700 text-sm">Oddiy video</span>
                </div>
                <p className="text-3xl font-black text-amber-600">{planTokenCosts.videoBasic}</p>
                <p className="text-xs text-amber-500 mt-1">token / video</p>
              </div>

              {/* Pro Video */}
              {planTokenCosts.videoPro && (
                <div className="bg-gradient-to-br from-purple-50 to-pink-50 p-5 rounded-2xl border border-purple-100">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-2xl">🎥</span>
                    <span className="font-bold text-purple-700 text-sm">Pro video</span>
                  </div>
                  <p className="text-3xl font-black text-purple-600">{planTokenCosts.videoPro}</p>
                  <p className="text-xs text-purple-500 mt-1">token / video</p>
                </div>
              )}

              {/* Premium Video */}
              {planTokenCosts.videoPremium && (
                <div className="bg-gradient-to-br from-rose-50 to-red-50 p-5 rounded-2xl border border-rose-100">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-2xl">💎</span>
                    <span className="font-bold text-rose-700 text-sm">Premium video</span>
                  </div>
                  <p className="text-3xl font-black text-rose-600">{planTokenCosts.videoPremium}</p>
                  <p className="text-xs text-rose-500 mt-1">token / video</p>
                </div>
              )}

              {/* Copywriter */}
              <div className="bg-gradient-to-br from-green-50 to-emerald-50 p-5 rounded-2xl border border-green-100">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-2xl">✍️</span>
                  <span className="font-bold text-green-700 text-sm">Kopywriter</span>
                </div>
                <p className="text-3xl font-black text-green-600">{planTokenCosts.copywriter}</p>
                <p className="text-xs text-green-500 mt-1">token / matn</p>
              </div>
            </div>
          </div>
        </div>

        {/* Studio Cards */}
        <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-3">
          <span className="p-2 bg-gradient-to-br from-purple-100 to-pink-100 rounded-xl">
            <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </span>
          AI Studiyalar
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* Marketplace Studio */}
          <Link href="/marketplace" className="group">
            <div className="bg-white rounded-3xl shadow-lg border border-gray-100 overflow-hidden hover:shadow-2xl transition-all duration-300 group-hover:scale-[1.02]">
              <div className="h-3 bg-gradient-to-r from-purple-500 via-pink-500 to-rose-500"></div>
              <div className="p-8">
                <div className="flex items-start gap-5">
                  <div className="p-4 bg-gradient-to-br from-purple-100 to-pink-100 rounded-2xl group-hover:scale-110 transition-transform">
                    <svg className="w-10 h-10 text-purple-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-2xl font-black text-gray-800 mb-2">🖼️ Marketplace Studio</h3>
                    <p className="text-gray-600 mb-4">
                      Professional 4K mahsulot rasmlari yarating. Uzum, Amazon, OZON uchun optimallashtirilgan.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <span className="px-3 py-1 bg-purple-100 text-purple-700 text-xs font-bold rounded-full">
                        ✨ AI Enhanced
                      </span>
                      <span className="px-3 py-1 bg-pink-100 text-pink-700 text-xs font-bold rounded-full">
                        {planTokenCosts.basic} - {planTokenCosts.pro} token
                      </span>
                    </div>
                  </div>
                  <svg className="w-8 h-8 text-gray-300 group-hover:text-purple-500 group-hover:translate-x-2 transition-all" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
              </div>
            </div>
          </Link>

          {/* Video Studio */}
          <Link href="/video-studio" className="group">
            <div className="bg-white rounded-3xl shadow-lg border border-gray-100 overflow-hidden hover:shadow-2xl transition-all duration-300 group-hover:scale-[1.02]">
              <div className="h-3 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500"></div>
              <div className="p-8">
                <div className="flex items-start gap-5">
                  <div className="p-4 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-2xl group-hover:scale-110 transition-transform">
                    <svg className="w-10 h-10 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-2xl font-black text-gray-800 mb-2">🎬 Video Studio</h3>
                    <p className="text-gray-600 mb-4">
                      Rasmlardan jonli video yarating. Veo AI bilan professional mahsulot videolari.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <span className="px-3 py-1 bg-blue-100 text-blue-700 text-xs font-bold rounded-full">
                        🎥 Veo 3.0 AI
                      </span>
                      <span className="px-3 py-1 bg-indigo-100 text-indigo-700 text-xs font-bold rounded-full">
                        {planTokenCosts.videoBasic}{planTokenCosts.videoPro ? ` - ${planTokenCosts.videoPremium || planTokenCosts.videoPro}` : ''} token
                      </span>
                    </div>
                  </div>
                  <svg className="w-8 h-8 text-gray-300 group-hover:text-blue-500 group-hover:translate-x-2 transition-all" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
              </div>
            </div>
          </Link>

          {/* Copywriter Studio */}
          <Link href="/copywriter" className="group">
            <div className="bg-white rounded-3xl shadow-lg border border-gray-100 overflow-hidden hover:shadow-2xl transition-all duration-300 group-hover:scale-[1.02]">
              <div className="h-3 bg-gradient-to-r from-green-500 via-emerald-500 to-teal-500"></div>
              <div className="p-8">
                <div className="flex items-start gap-5">
                  <div className="p-4 bg-gradient-to-br from-green-100 to-emerald-100 rounded-2xl group-hover:scale-110 transition-transform">
                    <svg className="w-10 h-10 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-6-3a2 2 0 11-4 0 2 2 0 014 0zm-2 4a5 5 0 00-4.546 2.916A5.986 5.986 0 0010 16a5.986 5.986 0 004.546-2.084A5 5 0 0010 11z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-2xl font-black text-gray-800 mb-2">✍️ Copywriter Studio</h3>
                    <p className="text-gray-600 mb-4">
                      Blog, email, social media postlar. SEO-optimized professional content.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <span className="px-3 py-1 bg-green-100 text-green-700 text-xs font-bold rounded-full">
                        📝 SEO Ready
                      </span>
                      <span className="px-3 py-1 bg-emerald-100 text-emerald-700 text-xs font-bold rounded-full">
                        {planTokenCosts.copywriter} token
                      </span>
                    </div>
                  </div>
                  <svg className="w-8 h-8 text-gray-300 group-hover:text-green-500 group-hover:translate-x-2 transition-all" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
              </div>
            </div>
          </Link>

          {/* AI Chat */}
          <Link href="/chat" className="group">
            <div className="bg-white rounded-3xl shadow-lg border border-gray-100 overflow-hidden hover:shadow-2xl transition-all duration-300 group-hover:scale-[1.02]">
              <div className="h-3 bg-gradient-to-r from-amber-500 via-orange-500 to-red-500"></div>
              <div className="p-8">
                <div className="flex items-start gap-5">
                  <div className="p-4 bg-gradient-to-br from-amber-100 to-orange-100 rounded-2xl group-hover:scale-110 transition-transform">
                    <svg className="w-10 h-10 text-amber-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-2xl font-black text-gray-800 mb-2">💬 AI Chat</h3>
                    <p className="text-gray-600 mb-4">
                      Umumi savol-javoblar, individual maslahatlar va professional AI yordam.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <span className="px-3 py-1 bg-amber-100 text-amber-700 text-xs font-bold rounded-full">
                        🤖 24/7 Yordam
                      </span>
                      <span className="px-3 py-1 bg-orange-100 text-orange-700 text-xs font-bold rounded-full">
                        Cheksiz
                      </span>
                    </div>
                  </div>
                  <svg className="w-8 h-8 text-gray-300 group-hover:text-amber-500 group-hover:translate-x-2 transition-all" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
              </div>
            </div>
          </Link>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100 text-center">
            <div className="text-4xl mb-2">🖼️</div>
            <p className="text-3xl font-black text-purple-600">{Math.floor(stats.tokensRemaining / planTokenCosts.basic)}</p>
            <p className="text-xs text-gray-500">Oddiy rasm (taxminan)</p>
          </div>
          <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100 text-center">
            <div className="text-4xl mb-2">✨</div>
            <p className="text-3xl font-black text-blue-600">{Math.floor(stats.tokensRemaining / planTokenCosts.pro)}</p>
            <p className="text-xs text-gray-500">Pro rasm (taxminan)</p>
          </div>
          <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100 text-center">
            <div className="text-4xl mb-2">🎬</div>
            <p className="text-3xl font-black text-amber-600">{Math.floor(stats.tokensRemaining / planTokenCosts.videoBasic)}</p>
            <p className="text-xs text-gray-500">Video (taxminan)</p>
          </div>
          <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100 text-center">
            <div className="text-4xl mb-2">✍️</div>
            <p className="text-3xl font-black text-green-600">{Math.floor(stats.tokensRemaining / planTokenCosts.copywriter)}</p>
            <p className="text-xs text-gray-500">Matn (taxminan)</p>
          </div>
        </div>

        {/* Upgrade Banner */}
        {(!user?.subscription_plan || user?.subscription_plan === 'free' || user?.subscription_plan === 'starter') && (
          <div className="bg-gradient-to-r from-purple-600 via-pink-600 to-rose-600 rounded-3xl p-8 text-white shadow-2xl">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
              <div>
                <h3 className="text-2xl font-black mb-2 flex items-center gap-2">
                  <span>💎</span>
                  {plan === 'starter' ? "Pro ga o'ting!" : "Premium-ga o'ting!"}
                </h3>
                <p className="text-white/80">
                  {plan === 'starter' 
                    ? "Pro tarif bilan 250 token, Veo 3 Pro video va ko'proq imkoniyatlar!"
                    : "Unlimited generations, priority support, advanced features va ko'p narsalar!"
                  }
                </p>
              </div>
              <Link
                href="/pricing"
                className="inline-flex items-center justify-center px-8 py-4 bg-white text-purple-600 rounded-xl font-bold hover:shadow-xl transition-all text-lg"
              >
                Tariflarni ko'rish →
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
