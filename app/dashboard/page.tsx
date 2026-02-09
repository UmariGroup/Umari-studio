'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { planLabelUz } from '@/lib/uzbek-errors';
import {
  FiAlertTriangle,
  FiArrowRight,
  FiClock,
  FiCpu,
  FiEdit3,
  FiFilm,
  FiImage,
  FiMessageSquare,
  FiSearch,
  FiVideo,
  FiZap,
} from 'react-icons/fi';
import { FaCoins, FaGem } from 'react-icons/fa';

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
  free: { basic: 2, pro: 999, videoBasic: 999, copywriter: 999 },
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
  });
  const [loading, setLoading] = useState(true);

  const isAdmin = user?.role === 'admin';
  const plan = user?.subscription_plan || 'free';
  const planTokenCosts = TOKEN_COSTS[plan] || TOKEN_COSTS.starter;

  useEffect(() => {
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
          });
        }
      } catch (error) {
        console.error('Error fetching user data:', error);
        window.location.href = '/login';
      } finally {
        setLoading(false);
      }
    };

    void fetchUserData();
  }, []);

  const tokenPercentage = stats.tokensTotal > 0
    ? Math.max(0, Math.min(100, Math.round((stats.tokensRemaining / stats.tokensTotal) * 100)))
    : 0;

  const estimateUsage = (cost: number): string => {
    if (isAdmin) return '∞';
    if (!Number.isFinite(cost) || cost <= 0 || cost >= 900) return '-';
    return Math.floor(stats.tokensRemaining / cost).toLocaleString();
  };

  if (loading) {
    return (
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-50">
        <div className="absolute -left-20 top-0 h-72 w-72 rounded-full bg-blue-300/20 blur-3xl" />
        <div className="absolute right-0 top-10 h-80 w-80 rounded-full bg-violet-300/20 blur-3xl" />
        <div className="relative text-center">
          <div className="mx-auto mb-5 h-16 w-16 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
          <p className="font-medium text-slate-600">Yuklanmoqda...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-50">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-20 top-0 h-72 w-72 rounded-full bg-blue-300/20 blur-3xl" />
        <div className="absolute right-0 top-16 h-80 w-80 rounded-full bg-violet-300/20 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
        <section className="overflow-hidden rounded-3xl border border-blue-200/60 bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 p-6 text-white shadow-2xl shadow-blue-200/30 sm:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-semibold text-white/80">Umari boshqaruv paneli</p>
              <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">
                Assalomu alaykum{user?.first_name ? `, ${user.first_name}` : ''}
              </h1>
              <p className="mt-2 text-sm text-white/80">
                Barcha studiyalar bitta joyda: Market, Video va Copywriter.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              <div className="rounded-2xl border border-white/20 bg-white/10 p-4 backdrop-blur">
                <p className="text-xs text-white/70">Tarif</p>
                <p className="text-xl font-bold">{plan === 'business_plus' ? 'Business+' : (planLabelUz(plan) || 'Bepul')}</p>
              </div>
              <div className="rounded-2xl border border-white/20 bg-white/10 p-4 backdrop-blur">
                <p className="text-xs text-white/70">Qolgan token</p>
                <p className="text-xl font-black">{isAdmin ? '∞' : stats.tokensRemaining.toLocaleString()}</p>
              </div>
            </div>
          </div>

          {!isAdmin && (
            <div className="mt-6">
              <div className="mb-2 flex items-center justify-between text-xs text-white/80">
                <span>Token holati</span>
                <span>{tokenPercentage}%</span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-white/20">
                <div className="h-full rounded-full bg-white" style={{ width: `${tokenPercentage}%` }} />
              </div>
            </div>
          )}
        </section>

        {access.blockedReason === 'expired' && (
          <section className="rounded-2xl border-2 border-amber-300 bg-gradient-to-r from-amber-50 to-orange-50 p-5 shadow-sm">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-amber-200 p-2.5">
                  <FiClock className="h-6 w-6 text-amber-700" />
                </div>
                <div>
                  <h3 className="font-bold text-amber-900">Obuna muddati tugagan</h3>
                  <p className="text-sm text-amber-800">Davom etish uchun tarifni qayta faollashtiring.</p>
                </div>
              </div>
              <Link
                href={`/pricing?plan=${encodeURIComponent(user?.subscription_plan || 'starter')}`}
                className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 px-5 py-3 font-semibold text-white"
              >
                Tarifni faollashtirish <FiArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </div>
          </section>
        )}

        {access.blockedReason === 'no_tokens' && (
          <section className="rounded-2xl border-2 border-rose-300 bg-gradient-to-r from-rose-50 to-pink-50 p-5 shadow-sm">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-rose-200 p-2.5">
                  <FiAlertTriangle className="h-6 w-6 text-rose-700" />
                </div>
                <div>
                  <h3 className="font-bold text-rose-900">Token tugagan</h3>
                  <p className="text-sm text-rose-800">Rejani yangilang yoki yuqori tarifga o'ting.</p>
                </div>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Link
                  href={`/pricing?plan=${encodeURIComponent(user?.subscription_plan || 'starter')}`}
                  className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-rose-500 to-pink-600 px-5 py-3 font-semibold text-white"
                >
                  Rejani yangilash
                </Link>
                {access.recommendedPlan && (
                  <Link
                    href={`/pricing?plan=${encodeURIComponent(access.recommendedPlan)}`}
                    className="inline-flex items-center justify-center rounded-xl border border-rose-300 bg-white px-5 py-3 font-semibold text-rose-700"
                  >
                    {planLabelUz(access.recommendedPlan) || 'Yuqori tarif'}ga o'tish
                  </Link>
                )}
              </div>
            </div>
          </section>
        )}

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-center gap-2">
            <span className="rounded-xl bg-blue-100 p-2 text-blue-700"><FaCoins className="h-5 w-5" /></span>
            <h2 className="text-lg font-bold text-slate-900">Token narxlari</h2>
            <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
              {plan === 'business_plus' ? 'Business+' : (planLabelUz(plan) || 'Bepul')}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6">
            <TokenCard title="Oddiy rasm" value={planTokenCosts.basic} subtitle="token / so'rov" tone="emerald" icon={<FiImage className="h-5 w-5" />} />
            <TokenCard title="Pro rasm" value={planTokenCosts.pro} subtitle="token / so'rov" tone="blue" icon={<FiZap className="h-5 w-5" />} />
            <TokenCard title="Oddiy video" value={planTokenCosts.videoBasic} subtitle="token / video" tone="amber" icon={<FiVideo className="h-5 w-5" />} />
            {planTokenCosts.videoPro ? <TokenCard title="Pro video" value={planTokenCosts.videoPro} subtitle="token / video" tone="violet" icon={<FiFilm className="h-5 w-5" />} /> : null}
            {planTokenCosts.videoPremium ? <TokenCard title="Premium video" value={planTokenCosts.videoPremium} subtitle="token / video" tone="rose" icon={<FaGem className="h-5 w-5" />} /> : null}
            <TokenCard title="Copywriter studiya" value={planTokenCosts.copywriter} subtitle="token / matn" tone="green" icon={<FiEdit3 className="h-5 w-5" />} />
          </div>
        </section>

        <section>
          <h2 className="mb-4 text-xl font-bold text-slate-900">AI studiyalar</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StudioCard
              href="/marketplace"
              title="Market studiya"
              description="Mahsulot rasmlari, listingga tayyor format va marketplace ish jarayoni."
              badge={`So'rov: ${planTokenCosts.basic} - ${planTokenCosts.pro} token`}
              icon={<FiImage className="h-6 w-6" />}
              gradient="from-blue-500 to-indigo-600"
            />
            <StudioCard
              href="/video-studio"
              title="Video studiya"
              description="Mahsulot rasmlaridan tez promo video va reklama variantlari."
              badge={`Video: ${planTokenCosts.videoBasic}${planTokenCosts.videoPro ? ` - ${planTokenCosts.videoPremium || planTokenCosts.videoPro}` : ''} token`}
              icon={<FiVideo className="h-6 w-6" />}
              gradient="from-indigo-500 to-violet-600"
            />
            <StudioCard
              href="/copywriter"
              title="Copywriter studiya"
              description="UZ/RU marketplace matnlari, 18 blokli strukturada kontent yaratish."
              badge={`Matn: ${planTokenCosts.copywriter} token`}
              icon={<FiEdit3 className="h-6 w-6" />}
              gradient="from-violet-500 to-fuchsia-600"
            />
            <StudioCard
              href="/chat"
              title="AI suhbat"
              description="Savol-javob, kontent va strategiya bo'yicha yordamchi chat."
              badge="24/7 yordam"
              icon={<FiMessageSquare className="h-6 w-6" />}
              gradient="from-sky-500 to-blue-600"
            />
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-bold text-slate-900">Taxminiy imkoniyat</h2>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <EstimateCard title="Oddiy rasm" value={estimateUsage(planTokenCosts.basic)} tone="text-blue-700" icon={<FiImage className="h-5 w-5" />} />
            <EstimateCard title="Pro rasm" value={estimateUsage(planTokenCosts.pro)} tone="text-indigo-700" icon={<FiZap className="h-5 w-5" />} />
            <EstimateCard title="Video studiya" value={estimateUsage(planTokenCosts.videoBasic)} tone="text-violet-700" icon={<FiFilm className="h-5 w-5" />} />
            <EstimateCard title="Copywriter studiya" value={estimateUsage(planTokenCosts.copywriter)} tone="text-emerald-700" icon={<FiSearch className="h-5 w-5" />} />
          </div>
        </section>

        {(!user?.subscription_plan || user.subscription_plan === 'free' || user.subscription_plan === 'starter') && (
          <section className="rounded-3xl bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 p-7 text-white shadow-2xl shadow-blue-200/30">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h3 className="mb-1 flex items-center gap-2 text-2xl font-black">
                  <FaGem className="text-white" /> {plan === 'starter' ? "Pro ga o'ting" : "Starter bilan boshlang"}
                </h3>
                <p className="text-white/80">
                  Ko'proq token, kengroq studio imkoniyatlari va tezroq ish jarayoni uchun tarifni yangilang.
                </p>
              </div>
              <Link
                href="/pricing"
                className="inline-flex items-center justify-center rounded-xl bg-white px-7 py-3 text-base font-bold text-indigo-700"
              >
                Tariflarni ko'rish <FiArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function StudioCard({
  href,
  title,
  description,
  badge,
  icon,
  gradient,
}: {
  href: string;
  title: string;
  description: string;
  badge: string;
  icon: React.ReactNode;
  gradient: string;
}) {
  return (
    <Link href={href} className="group">
      <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
        <div className={`mb-4 inline-flex rounded-xl bg-gradient-to-r p-3 text-white ${gradient}`}>
          {icon}
        </div>
        <h3 className="text-lg font-bold text-slate-900">{title}</h3>
        <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
        <div className="mt-4 inline-flex rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
          {badge}
        </div>
      </article>
    </Link>
  );
}

function TokenCard({
  title,
  value,
  subtitle,
  icon,
  tone,
}: {
  title: string;
  value: number;
  subtitle: string;
  icon: React.ReactNode;
  tone: 'emerald' | 'blue' | 'amber' | 'violet' | 'rose' | 'green';
}) {
  const toneMap: Record<string, string> = {
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    blue: 'border-blue-200 bg-blue-50 text-blue-700',
    amber: 'border-amber-200 bg-amber-50 text-amber-700',
    violet: 'border-violet-200 bg-violet-50 text-violet-700',
    rose: 'border-rose-200 bg-rose-50 text-rose-700',
    green: 'border-green-200 bg-green-50 text-green-700',
  };

  return (
    <div className={`rounded-2xl border p-4 ${toneMap[tone]}`}>
      <div className="mb-2 inline-flex rounded-lg bg-white p-2">{icon}</div>
      <p className="text-xs font-semibold">{title}</p>
      <p className="mt-1 text-2xl font-black">{value}</p>
      <p className="text-xs opacity-80">{subtitle}</p>
    </div>
  );
}

function EstimateCard({
  title,
  value,
  tone,
  icon,
}: {
  title: string;
  value: string;
  tone: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-center">
      <div className={`mx-auto mb-2 inline-flex rounded-lg bg-white p-2 ${tone}`}>{icon}</div>
      <p className="text-xs text-slate-500">{title}</p>
      <p className={`text-2xl font-black ${tone}`}>{value}</p>
      <p className="text-xs text-slate-400">taxminan so'rov</p>
    </div>
  );
}
