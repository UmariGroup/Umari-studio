'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useLanguage } from '@/lib/LanguageContext';
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

interface ReferralInvitedUser {
  id: string;
  email_masked: string | null;
  first_name: string | null;
  created_at: string | null;
  referred_at: string | null;
  subscription_plan: string | null;
  subscription_status: string | null;
  reward: {
    tokens_awarded: number;
    plan: string;
    created_at: string | null;
  } | null;
}

interface ReferralData {
  referral_code: string | null;
  stats: {
    invited_count: number;
    rewards_count: number;
    tokens_earned: number;
  };
  invited_users: ReferralInvitedUser[];
}

const TOKEN_COSTS: Record<string, TokenCostInfo> = {
  free: { basic: 2, pro: 999, videoBasic: 999, copywriter: 999 },
  starter: { basic: 2, pro: 7, videoBasic: 15, copywriter: 3 },
  pro: { basic: 1.5, pro: 6, videoBasic: 25, videoPro: 35, copywriter: 2 },
  business_plus: { basic: 1, pro: 5, videoBasic: 20, videoPro: 30, videoPremium: 45, copywriter: 1 },
};

export default function DashboardPage() {
  const { t, language } = useLanguage();
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

  const [referral, setReferral] = useState<ReferralData | null>(null);
  const [referralLink, setReferralLink] = useState<string>('');
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'error'>('idle');

  const isAdmin = user?.role === 'admin';
  const plan = user?.subscription_plan || 'free';
  const planTokenCosts = TOKEN_COSTS[plan] || TOKEN_COSTS.starter;

  const planLabel = (planId: string | null | undefined): string => {
    const p = (planId || '').toString().trim().toLowerCase();
    if (p === 'starter') return t('plan.starter', 'Starter');
    if (p === 'pro') return t('plan.pro', 'Pro');
    if (p === 'business_plus' || p === 'business+') return t('plan.businessPlus', 'Business+');
    if (p === 'free') return t('plan.free', language === 'ru' ? 'Бесплатно' : 'Bepul');
    return planId ? String(planId) : '-';
  };

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

          // Fetch referral info (best-effort)
          try {
            const refRes = await fetch('/api/referrals');
            if (refRes.ok) {
              const refData = await refRes.json();
              if (refData?.success) {
                setReferral({
                  referral_code: refData.referral_code || null,
                  stats: refData.stats,
                  invited_users: Array.isArray(refData.invited_users) ? refData.invited_users : [],
                });
              }
            }
          } catch (e) {
            // ignore
          }
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

  useEffect(() => {
    const code = referral?.referral_code;
    if (!code) return;
    try {
      const path = window.location.pathname || '/';
      const m = path.match(/^\/(uz|ru)(?=\/|$)/);
      const langPrefix = m ? `/${m[1]}` : '';
      const origin = window.location.origin;
      setReferralLink(`${origin}${langPrefix}/?ref=${encodeURIComponent(code)}`);
    } catch {
      // ignore
    }
  }, [referral?.referral_code]);

  const copyReferralLink = async () => {
    if (!referralLink) return;
    try {
      await navigator.clipboard.writeText(referralLink);
      setCopyStatus('copied');
      window.setTimeout(() => setCopyStatus('idle'), 1500);
    } catch {
      setCopyStatus('error');
      window.setTimeout(() => setCopyStatus('idle'), 2000);
    }
  };

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
          <p className="font-medium text-slate-600">{t('common.loading', 'Yuklanmoqda...')}</p>
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
              <p className="text-sm font-semibold text-white/80">{t('dashboard.hero.kicker', 'Umari boshqaruv paneli')}</p>
              <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">
                {t('dashboard.hero.greeting', language === 'ru' ? 'Здравствуйте' : 'Assalomu alaykum')}{user?.first_name ? `, ${user.first_name}` : ''}
              </h1>
              <p className="mt-2 text-sm text-white/80">
                {t('dashboard.hero.subtitle', "Barcha studiyalar bitta joyda: Market, Video va Copywriter.")}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              <div className="rounded-2xl border border-white/20 bg-white/10 p-4 backdrop-blur">
                <p className="text-xs text-white/70">{t('dashboard.labels.plan', 'Tarif')}</p>
                <p className="text-xl font-bold">{planLabel(plan)}</p>
              </div>
              <div className="rounded-2xl border border-white/20 bg-white/10 p-4 backdrop-blur">
                <p className="text-xs text-white/70">{t('dashboard.labels.tokensRemaining', 'Qolgan token')}</p>
                <p className="text-xl font-black">{isAdmin ? '∞' : stats.tokensRemaining.toLocaleString()}</p>
              </div>
            </div>
          </div>

          {!isAdmin && (
            <div className="mt-6">
              <div className="mb-2 flex items-center justify-between text-xs text-white/80">
                <span>{t('dashboard.labels.tokenStatus', 'Token holati')}</span>
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
                  <h3 className="font-bold text-amber-900">{t('dashboard.blocked.expired.title', 'Obuna muddati tugagan')}</h3>
                  <p className="text-sm text-amber-800">{t('dashboard.blocked.expired.body', 'Davom etish uchun tarifni qayta faollashtiring.')}</p>
                </div>
              </div>
              <Link
                href={`/pricing?plan=${encodeURIComponent(user?.subscription_plan || 'starter')}`}
                className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 px-5 py-3 font-semibold text-white"
              >
                {t('dashboard.blocked.expired.cta', 'Tarifni faollashtirish')} <FiArrowRight className="ml-2 h-4 w-4" />
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
                  <h3 className="font-bold text-rose-900">{t('dashboard.blocked.noTokens.title', 'Token tugagan')}</h3>
                  <p className="text-sm text-rose-800">{t('dashboard.blocked.noTokens.body', "Rejani yangilang yoki yuqori tarifga o'ting.")}</p>
                </div>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Link
                  href={`/pricing?plan=${encodeURIComponent(user?.subscription_plan || 'starter')}`}
                  className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-rose-500 to-pink-600 px-5 py-3 font-semibold text-white"
                >
                  {t('dashboard.blocked.noTokens.renew', 'Rejani yangilash')}
                </Link>
                {access.recommendedPlan && (
                  <Link
                    href={`/pricing?plan=${encodeURIComponent(access.recommendedPlan)}`}
                    className="inline-flex items-center justify-center rounded-xl border border-rose-300 bg-white px-5 py-3 font-semibold text-rose-700"
                  >
                    {t('dashboard.blocked.noTokens.upgradePrefix', 'Tarifni yangilash')}: {planLabel(access.recommendedPlan)}
                  </Link>
                )}
              </div>
            </div>
          </section>
        )}

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-black text-slate-900">{t('dashboard.referral.title', 'Referral dasturi')}</h2>
              <p className="mt-1 text-sm text-slate-600">
                {t('dashboard.referral.subtitle', "Do'stlaringizni taklif qiling. Ular tarif sotib olsa sizga bonus token beriladi.")}
              </p>
              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                <span className="rounded-full bg-emerald-50 px-3 py-1 font-semibold text-emerald-700">{t('plan.starter', 'Starter')}: +30 {t('common.token', language === 'ru' ? 'токен' : 'token')}</span>
                <span className="rounded-full bg-blue-50 px-3 py-1 font-semibold text-blue-700">{t('plan.pro', 'Pro')}: +50 {t('common.token', language === 'ru' ? 'токен' : 'token')}</span>
                <span className="rounded-full bg-violet-50 px-3 py-1 font-semibold text-violet-700">{t('plan.businessPlus', 'Business+')}: +100 {t('common.token', language === 'ru' ? 'токен' : 'token')}</span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs text-slate-500">{t('dashboard.referral.stats.invites', 'Takliflar')}</p>
                <p className="mt-1 text-xl font-black text-slate-900">{referral?.stats?.invited_count ?? 0}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs text-slate-500">{t('dashboard.referral.stats.bonuses', 'Bonuslar')}</p>
                <p className="mt-1 text-xl font-black text-slate-900">{referral?.stats?.rewards_count ?? 0}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs text-slate-500">{t('dashboard.referral.stats.tokens', "Yig'ilgan token")}</p>
                <p className="mt-1 text-xl font-black text-slate-900">{referral?.stats?.tokens_earned ?? 0}</p>
              </div>
            </div>
          </div>

          <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-sm font-semibold text-slate-900">{t('dashboard.referral.linkTitle', 'Sizning referral linkingiz')}</p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
              <input
                value={referralLink || (referral?.referral_code ? `ref=${referral.referral_code}` : '')}
                readOnly
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-800"
              />
              <button
                onClick={copyReferralLink}
                disabled={!referralLink}
                className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {copyStatus === 'copied'
                  ? t('common.copied', 'Nusxalandi!')
                  : copyStatus === 'error'
                    ? t('common.error', 'Xatolik')
                    : t('common.copy', 'Nusxalash')}
              </button>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              {t('dashboard.referral.hint', "Linkni ulashing. Ular shu link orqali kirib (URL: ref=code) tarif sotib olsa, bonus sizning balansingizga qo‘shiladi.")}
            </p>
          </div>

          <div className="mt-6">
            <h3 className="text-sm font-bold text-slate-900">{t('dashboard.referral.invitedTitle', 'Taklif qilinganlar')}</h3>
            <div className="mt-3 overflow-hidden rounded-2xl border border-slate-200">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">{t('dashboard.referral.table.user', 'Foydalanuvchi')}</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">{t('dashboard.referral.table.plan', 'Tarif')}</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">{t('dashboard.referral.table.bonus', 'Bonus')}</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">{t('dashboard.referral.table.date', 'Sana')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {(referral?.invited_users || []).length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-4 py-6 text-center text-slate-500">
                          {t('dashboard.referral.empty', "Hozircha taklif qilinganlar yo‘q.")}
                        </td>
                      </tr>
                    ) : (
                      (referral?.invited_users || []).map((inv) => (
                        <tr key={inv.id} className="hover:bg-slate-50">
                          <td className="px-4 py-3">
                            <div className="font-semibold text-slate-900">{inv.first_name || t('dashboard.referral.table.userFallback', 'User')}</div>
                            <div className="text-xs text-slate-500">{inv.email_masked || ''}</div>
                          </td>
                          <td className="px-4 py-3 text-slate-700">
                            {inv.subscription_plan ? planLabel(inv.subscription_plan) : '-'}
                          </td>
                          <td className="px-4 py-3">
                            {inv.reward ? (
                              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">+{inv.reward.tokens_awarded} {t('common.token', language === 'ru' ? 'токен' : 'token')}</span>
                            ) : (
                              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{t('dashboard.referral.pending', 'kutilmoqda')}</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-500">
                            {inv.reward?.created_at
                              ? new Date(inv.reward.created_at).toLocaleDateString()
                              : inv.created_at
                                ? new Date(inv.created_at).toLocaleDateString()
                                : '-'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-center gap-2">
            <span className="rounded-xl bg-blue-100 p-2 text-blue-700"><FaCoins className="h-5 w-5" /></span>
            <h2 className="text-lg font-bold text-slate-900">{t('dashboard.costs.title', 'Token narxlari')}</h2>
            <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
              {planLabel(plan)}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6">
            <TokenCard title={t('dashboard.costs.basicImage', 'Oddiy rasm')} value={planTokenCosts.basic} subtitle={t('dashboard.costs.perRequest', "token / so'rov")} tone="emerald" icon={<FiImage className="h-5 w-5" />} />
            <TokenCard title={t('dashboard.costs.proImage', 'Pro rasm')} value={planTokenCosts.pro} subtitle={t('dashboard.costs.perRequest', "token / so'rov")} tone="blue" icon={<FiZap className="h-5 w-5" />} />
            <TokenCard title={t('dashboard.costs.basicVideo', 'Oddiy video')} value={planTokenCosts.videoBasic} subtitle={t('dashboard.costs.perVideo', 'token / video')} tone="amber" icon={<FiVideo className="h-5 w-5" />} />
            {planTokenCosts.videoPro ? <TokenCard title={t('dashboard.costs.proVideo', 'Pro video')} value={planTokenCosts.videoPro} subtitle={t('dashboard.costs.perVideo', 'token / video')} tone="violet" icon={<FiFilm className="h-5 w-5" />} /> : null}
            {planTokenCosts.videoPremium ? <TokenCard title={t('dashboard.costs.premiumVideo', 'Premium video')} value={planTokenCosts.videoPremium} subtitle={t('dashboard.costs.perVideo', 'token / video')} tone="rose" icon={<FaGem className="h-5 w-5" />} /> : null}
            <TokenCard title={t('dashboard.costs.copywriter', 'Copywriter studiya')} value={planTokenCosts.copywriter} subtitle={t('dashboard.costs.perText', 'token / matn')} tone="green" icon={<FiEdit3 className="h-5 w-5" />} />
          </div>
        </section>

        <section>
          <h2 className="mb-4 text-xl font-bold text-slate-900">{t('dashboard.studios.title', 'AI studiyalar')}</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StudioCard
              href="/marketplace"
              title={t('nav.marketplace', 'Market studiya')}
              description={t('dashboard.studios.marketplace.desc', 'Mahsulot rasmlari, listingga tayyor format va marketplace ish jarayoni.')}
              badge={`${t('dashboard.studios.badge.request', "So'rov")}: ${planTokenCosts.basic} - ${planTokenCosts.pro} ${t('common.token', language === 'ru' ? 'токен' : 'token')}`}
              icon={<FiImage className="h-6 w-6" />}
              gradient="from-blue-500 to-indigo-600"
            />
            <StudioCard
              href="/video-studio"
              title={t('nav.videoStudio', 'Video studiya')}
              description={t('dashboard.studios.video.desc', 'Mahsulot rasmlaridan tez promo video va reklama variantlari.')}
              badge={`${t('dashboard.studios.badge.video', 'Video')}: ${planTokenCosts.videoBasic}${planTokenCosts.videoPro ? ` - ${planTokenCosts.videoPremium || planTokenCosts.videoPro}` : ''} ${t('common.token', language === 'ru' ? 'токен' : 'token')}`}
              icon={<FiVideo className="h-6 w-6" />}
              gradient="from-indigo-500 to-violet-600"
            />
            <StudioCard
              href="/copywriter"
              title={t('nav.copywriter', 'Copywriter studiya')}
              description={t('dashboard.studios.copywriter.desc', 'UZ/RU marketplace matnlari, 18 blokli strukturada kontent yaratish.')}
              badge={`${t('dashboard.studios.badge.text', 'Matn')}: ${planTokenCosts.copywriter} ${t('common.token', language === 'ru' ? 'токен' : 'token')}`}
              icon={<FiEdit3 className="h-6 w-6" />}
              gradient="from-violet-500 to-fuchsia-600"
            />
            <StudioCard
              href="/chat"
              title={t('dashboard.studios.chat.title', 'AI suhbat')}
              description={t('dashboard.studios.chat.desc', "Savol-javob, kontent va strategiya bo'yicha yordamchi chat.")}
              badge={t('dashboard.studios.chat.badge', '24/7 yordam')}
              icon={<FiMessageSquare className="h-6 w-6" />}
              gradient="from-sky-500 to-blue-600"
            />
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-bold text-slate-900">{t('dashboard.estimate.title', 'Taxminiy imkoniyat')}</h2>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <EstimateCard title={t('dashboard.costs.basicImage', 'Oddiy rasm')} value={estimateUsage(planTokenCosts.basic)} tone="text-blue-700" icon={<FiImage className="h-5 w-5" />} />
            <EstimateCard title={t('dashboard.costs.proImage', 'Pro rasm')} value={estimateUsage(planTokenCosts.pro)} tone="text-indigo-700" icon={<FiZap className="h-5 w-5" />} />
            <EstimateCard title={t('nav.videoStudio', 'Video studiya')} value={estimateUsage(planTokenCosts.videoBasic)} tone="text-violet-700" icon={<FiFilm className="h-5 w-5" />} />
            <EstimateCard title={t('nav.copywriter', 'Copywriter studiya')} value={estimateUsage(planTokenCosts.copywriter)} tone="text-emerald-700" icon={<FiSearch className="h-5 w-5" />} />
          </div>
        </section>

        {(!user?.subscription_plan || user.subscription_plan === 'free' || user.subscription_plan === 'starter') && (
          <section className="rounded-3xl bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 p-7 text-white shadow-2xl shadow-blue-200/30">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h3 className="mb-1 flex items-center gap-2 text-2xl font-black">
                  <FaGem className="text-white" /> {plan === 'starter' ? t('dashboard.promo.upgrade', "Pro ga o'ting") : t('dashboard.promo.start', 'Starter bilan boshlang')}
                </h3>
                <p className="text-white/80">
                  {t('dashboard.promo.body', "Ko'proq token, kengroq studio imkoniyatlari va tezroq ish jarayoni uchun tarifni yangilang.")}
                </p>
              </div>
              <Link
                href="/pricing"
                className="inline-flex items-center justify-center rounded-xl bg-white px-7 py-3 text-base font-bold text-indigo-700"
              >
                {t('dashboard.promo.cta', "Tariflarni ko'rish")} <FiArrowRight className="ml-2 h-4 w-4" />
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
  const { t } = useLanguage();
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-center">
      <div className={`mx-auto mb-2 inline-flex rounded-lg bg-white p-2 ${tone}`}>{icon}</div>
      <p className="text-xs text-slate-500">{title}</p>
      <p className={`text-2xl font-black ${tone}`}>{value}</p>
      <p className="text-xs text-slate-400">{t('dashboard.estimate.approxRequests', "taxminan so'rov")}</p>
    </div>
  );
}
