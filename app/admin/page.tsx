'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { FREE_TRIAL_TOKENS, SUBSCRIPTION_PLANS } from '@/lib/subscription-plans';
import {
  FiBarChart2,
  FiCheck,
  FiCreditCard,
  FiDollarSign,
  FiFileText,
  FiGift,
  FiLogOut,
  FiShield,
  FiUsers,
  FiClock,
  FiZap,
  FiArrowRight,
} from 'react-icons/fi';

interface DashboardStats {
  totalUsers: number;
  activeSubscriptions: number;
  totalRevenue: number;
  freeUsers: number;
  starterUsers: number;
  proUsers: number;
  businessUsers: number;
  expiredUsers: number;
  totalTokensUsed: number;
}

interface AdminReferralTopReferrer {
  id: string;
  email: string;
  first_name: string | null;
  invited_count: number;
  rewards_count: number;
  tokens_awarded: number;
}

interface AdminReferralStats {
  totals: {
    invited_users: number;
    rewarded_users: number;
    tokens_awarded: number;
  };
  by_plan: {
    starter?: { rewards_count: number; tokens_awarded: number };
    pro?: { rewards_count: number; tokens_awarded: number };
    business_plus?: { rewards_count: number; tokens_awarded: number };
    [key: string]: { rewards_count: number; tokens_awarded: number } | undefined;
  };
  top_referrers: AdminReferralTopReferrer[];
}

const QUICK_ACTIONS = [
  {
    href: '/admin/users',
    icon: <FiUsers className="h-6 w-6" />,
    title: 'Foydalanuvchilar',
    description: "Barcha akkauntlarni boshqarish va filtrlar bilan ko'rish.",
    tone: 'from-blue-500 to-indigo-600',
  },
  {
    href: '/admin/admins',
    icon: <FiShield className="h-6 w-6" />,
    title: 'Adminlar',
    description: "Administrator huquqlarini nazorat qilish va boshqarish.",
    tone: 'from-violet-500 to-fuchsia-600',
  },
  {
    href: '/admin/subscriptions',
    icon: <FiCreditCard className="h-6 w-6" />,
    title: 'Tariflar',
    description: 'Narx, token va obuna holatlarini yangilash.',
    tone: 'from-emerald-500 to-teal-600',
  },
  {
    href: '/admin/logs',
    icon: <FiFileText className="h-6 w-6" />,
    title: 'Loglar',
    description: 'Admin amallari tarixi va xavfsizlik kuzatuvi.',
    tone: 'from-slate-600 to-slate-700',
  },
  {
    href: '/admin/statistics',
    icon: <FiBarChart2 className="h-6 w-6" />,
    title: 'Model statistikasi',
    description: "Model bo'yicha kunlik, haftalik va oylik so'rovlar.",
    tone: 'from-indigo-500 to-violet-600',
  },
  {
    href: '/admin/tokens',
    icon: <FiGift className="h-6 w-6" />,
    title: "Token qo'shish",
    description: "Foydalanuvchi balansiga qo'lda token qo'shish.",
    tone: 'from-emerald-500 to-green-600',
  },
  {
    href: '/admin/inactive-users',
    icon: <FiClock className="h-6 w-6" />,
    title: 'Inaktiv userlar',
    description: "3/7/10 kun token ishlatmagan pullik foydalanuvchilar nazorati.",
    tone: 'from-amber-500 to-orange-600',
  },
];

export default function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    totalUsers: 0,
    activeSubscriptions: 0,
    totalRevenue: 0,
    freeUsers: 0,
    starterUsers: 0,
    proUsers: 0,
    businessUsers: 0,
    expiredUsers: 0,
    totalTokensUsed: 0,
  });
  const [loading, setLoading] = useState(true);
  const [referralStats, setReferralStats] = useState<AdminReferralStats | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch('/api/admin/dashboard');
        const data = await response.json();
        if (data.success) {
          setStats(data.stats);
        }

        const referralRes = await fetch('/api/admin/referrals/stats');
        if (referralRes.ok) {
          const referralData = await referralRes.json();
          if (referralData?.success) {
            setReferralStats({
              totals: referralData.totals,
              by_plan: referralData.by_plan || {},
              top_referrers: Array.isArray(referralData.top_referrers) ? referralData.top_referrers : [],
            });
          }
        }
      } catch (error) {
        console.error('Error fetching stats:', error);
      } finally {
        setLoading(false);
      }
    };

    void fetchStats();
  }, []);

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login';
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-50">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-20 top-0 h-72 w-72 rounded-full bg-blue-300/25 blur-3xl" />
        <div className="absolute right-0 top-20 h-80 w-80 rounded-full bg-violet-300/25 blur-3xl" />
      </div>


      <main className="relative mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
            <StatCard
              label="Jami foydalanuvchilar"
              value={loading ? '...' : stats.totalUsers}
              accent="text-blue-700"
              icon={<FiUsers className="h-5 w-5" />}
            />
            <StatCard
              label="Faol obunalar"
              value={loading ? '...' : stats.activeSubscriptions}
              accent="text-emerald-700"
              icon={<FiCheck className="h-5 w-5" />}
            />
            <StatCard
              label="Bepul foydalanuvchilar"
              value={loading ? '...' : stats.freeUsers}
              accent="text-amber-700"
              icon={<FiClock className="h-5 w-5" />}
            />
            <StatCard
              label="Jami daromad"
              value={loading ? '...' : `$${stats.totalRevenue}`}
              accent="text-violet-700"
              icon={<FiDollarSign className="h-5 w-5" />}
            />
            <StatCard
              label="Ishlatilgan token"
              value={loading ? '...' : stats.totalTokensUsed}
              accent="text-indigo-700"
              icon={<FiZap className="h-5 w-5" />}
            />
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-5 inline-flex items-center gap-2 text-lg font-bold text-slate-900">
            <FiBarChart2 className="text-blue-600" /> Tariflar bo'yicha taqsimot
          </h2>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
            <PlanMiniCard title="Bepul" users={stats.freeUsers} meta={`${FREE_TRIAL_TOKENS} token sinov`} tone="text-slate-700 border-slate-200 bg-slate-50" />
            <PlanMiniCard title="Starter" users={stats.starterUsers || 0} meta={`$9/oy • ${SUBSCRIPTION_PLANS.starter.monthlyTokens} token`} tone="text-emerald-700 border-emerald-200 bg-emerald-50" />
            <PlanMiniCard title="Pro" users={stats.proUsers || 0} meta={`$19/oy • ${SUBSCRIPTION_PLANS.pro.monthlyTokens} token`} tone="text-blue-700 border-blue-200 bg-blue-50" />
            <PlanMiniCard title="Business+" users={stats.businessUsers || 0} meta={`$29/oy • ${SUBSCRIPTION_PLANS.business_plus.monthlyTokens} token`} tone="text-violet-700 border-violet-200 bg-violet-50" />
            <PlanMiniCard title="Tugagan" users={stats.expiredUsers || 0} meta="Muddati tugagan" tone="text-rose-700 border-rose-200 bg-rose-50" />
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-5 inline-flex items-center gap-2 text-lg font-bold text-slate-900">
            <FiUsers className="text-emerald-600" /> Referral statistikasi
          </h2>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs text-slate-500">Jami taklif qilinganlar</p>
              <p className="mt-1 text-2xl font-black text-slate-900">{loading ? '...' : (referralStats?.totals?.invited_users ?? 0)}</p>
              <p className="mt-1 text-xs text-slate-500">referral biriktirilgan userlar</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs text-slate-500">Bonus olganlar</p>
              <p className="mt-1 text-2xl font-black text-slate-900">{loading ? '...' : (referralStats?.totals?.rewarded_users ?? 0)}</p>
              <p className="mt-1 text-xs text-slate-500">1-marta sotib olish bo‘yicha</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs text-slate-500">Jami bonus token</p>
              <p className="mt-1 text-2xl font-black text-slate-900">{loading ? '...' : (referralStats?.totals?.tokens_awarded ?? 0)}</p>
              <p className="mt-1 text-xs text-slate-500">referrer’lar balansiga qo‘shilgan</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-gradient-to-r from-emerald-50 to-blue-50 p-4">
              <p className="text-xs font-semibold text-slate-700">Plan bo‘yicha</p>
              <div className="mt-2 space-y-1 text-sm text-slate-700">
                <div className="flex items-center justify-between">
                  <span className="font-semibold">Starter</span>
                  <span>{referralStats?.by_plan?.starter?.rewards_count ?? 0} / {referralStats?.by_plan?.starter?.tokens_awarded ?? 0} token</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-semibold">Pro</span>
                  <span>{referralStats?.by_plan?.pro?.rewards_count ?? 0} / {referralStats?.by_plan?.pro?.tokens_awarded ?? 0} token</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-semibold">Business+</span>
                  <span>{referralStats?.by_plan?.business_plus?.rewards_count ?? 0} / {referralStats?.by_plan?.business_plus?.tokens_awarded ?? 0} token</span>
                </div>
              </div>
              <p className="mt-2 text-xs text-slate-500">format: bonuslar soni / token</p>
            </div>
          </div>

          <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Top referrer</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Taklif</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Bonuslar</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Token</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {(referralStats?.top_referrers || []).length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-6 text-center text-slate-500">
                        {loading ? 'Yuklanmoqda...' : 'Hozircha referral ma’lumot yo‘q.'}
                      </td>
                    </tr>
                  ) : (
                    (referralStats?.top_referrers || []).map((r) => (
                      <tr key={r.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3">
                          <div className="font-semibold text-slate-900">{r.first_name || 'User'}</div>
                          <div className="text-xs text-slate-500">{r.email}</div>
                        </td>
                        <td className="px-4 py-3 font-semibold text-slate-700">{r.invited_count}</td>
                        <td className="px-4 py-3 font-semibold text-slate-700">{r.rewards_count}</td>
                        <td className="px-4 py-3">
                          <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">{r.tokens_awarded}</span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section>
          <h2 className="mb-5 text-lg font-bold text-slate-900">Tez harakatlar</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            {QUICK_ACTIONS.map((action) => (
              <Link
                key={action.href}
                href={action.href}
                className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className={`mb-4 inline-flex rounded-xl bg-gradient-to-r p-3 text-white ${action.tone}`}>
                  {action.icon}
                </div>
                <h3 className="text-base font-bold text-slate-900">{action.title}</h3>
                <p className="mt-1 text-sm leading-6 text-slate-600">{action.description}</p>
                <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-blue-700">
                  Ochish <FiArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
                </span>
              </Link>
            ))}
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-gradient-to-r from-blue-50 via-violet-50 to-indigo-50 p-6">
          <h2 className="mb-4 inline-flex items-center gap-2 text-lg font-bold text-slate-900">
            <FiFileText className="text-indigo-600" /> Tariflar bo'yicha qisqa eslatma
          </h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <PlanSummary
              title="Starter"
              subtitle="$9/oy"
              bullets={[
                `${SUBSCRIPTION_PLANS.starter.monthlyTokens} token / oy`,
                'Rasm: Oddiy + Pro',
                'Video: Umari Flash',
                'Copywriter: 18 blok',
              ]}
            />
            <PlanSummary
              title="Pro"
              subtitle="$19/oy"
              bullets={[
                `${SUBSCRIPTION_PLANS.pro.monthlyTokens} token / oy`,
                'Rasm: Oddiy + Pro',
                'Video: Flash + Pro',
                'Katalog ish jarayoni',
              ]}
            />
            <PlanSummary
              title="Business+"
              subtitle="$29/oy"
              bullets={[
                `${SUBSCRIPTION_PLANS.business_plus.monthlyTokens} token / oy`,
                'Eng kuchli rasm rejimi',
                "Ko'p video va rakurs",
                'Yuqori throughput',
              ]}
            />
          </div>
        </section>
      </main>
    </div>
  );
}

function StatCard({
  label,
  value,
  accent,
  icon,
}: {
  label: string;
  value: string | number;
  accent: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className={`mb-2 inline-flex rounded-lg bg-white p-2 ${accent}`}>{icon}</div>
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`text-2xl font-black ${accent}`}>{value}</p>
    </div>
  );
}

function PlanMiniCard({
  title,
  users,
  meta,
  tone,
}: {
  title: string;
  users: number;
  meta: string;
  tone: string;
}) {
  return (
    <div className={`rounded-2xl border p-4 ${tone}`}>
      <p className="text-sm font-bold">{title}</p>
      <p className="mt-1 text-2xl font-black">{users}</p>
      <p className="mt-1 text-xs opacity-80">{meta}</p>
    </div>
  );
}

function PlanSummary({
  title,
  subtitle,
  bullets,
}: {
  title: string;
  subtitle: string;
  bullets: string[];
}) {
  return (
    <article className="rounded-2xl border border-white/80 bg-white/80 p-4 shadow-sm backdrop-blur">
      <p className="text-sm font-bold text-slate-900">{title}</p>
      <p className="mb-3 text-sm font-semibold text-blue-700">{subtitle}</p>
      <ul className="space-y-1 text-sm text-slate-600">
        {bullets.map((bullet) => (
          <li key={`${title}-${bullet}`}>• {bullet}</li>
        ))}
      </ul>
    </article>
  );
}
