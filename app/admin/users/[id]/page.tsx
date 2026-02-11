'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  FiArrowLeft,
  FiClock,
  FiGift,
  FiInfo,
  FiMail,
  FiPhone,
  FiTag,
  FiUser,
  FiUsers,
  FiZap,
} from 'react-icons/fi';

type UsageSummaryRow = {
  service_type: string;
  tokens_used: number;
  requests: number;
  last_used_at: string | null;
};

type RecentUsageRow = {
  id: string;
  created_at: string;
  service_type: string;
  tokens_used: number;
  model_used: string | null;
  prompt: string | null;
};

type InvitedUserRow = {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  subscription_status: string | null;
  subscription_plan: string | null;
  referred_at: string | null;
  created_at: string | null;
};

type ReferralRewardRow = {
  id: string;
  referred_user_id: string;
  referred_email: string | null;
  plan: string;
  tokens_awarded: number;
  tokens_remaining: number;
  expires_at: string | null;
  created_at: string | null;
};

type AdminUserDetail = {
  success: true;
  user: {
    id: string;
    email: string;
    first_name: string | null;
    last_name: string | null;
    phone: string | null;
    telegram_username: string | null;
    role: string;
    subscription_status: string;
    subscription_plan: string;
    subscription_expires_at: string | null;
    tokens_subscription_remaining: number;
    tokens_referral_remaining: number;
    tokens_total: number;
    tokens_referral_total: number;
    created_at: string | null;
    referred_by_user_id: string | null;
    referral_code: string | null;
  };
  usage: {
    summary_by_service: UsageSummaryRow[];
    recent: RecentUsageRow[];
  };
  referrals: {
    invited_users: InvitedUserRow[];
    rewards: ReferralRewardRow[];
  };
};

function fmtDate(value: string | null | undefined): string {
  if (!value) return '-';
  try {
    return new Date(value).toLocaleString('uz-UZ');
  } catch {
    return String(value);
  }
}

function fmtTokens(value: unknown): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return '0.00';
  return n.toFixed(2);
}

function labelServiceType(serviceType: string): string {
  const s = String(serviceType || '').toLowerCase();
  if (s === 'copywriter_card') return 'Copywriter (kartochka)';
  if (s === 'image_generate') return 'Rasm generatsiya';
  if (s.startsWith('video_generate')) return 'Video generatsiya';
  if (s === 'chat') return 'Chat';
  return serviceType || 'unknown';
}

export default function AdminUserDetailPage() {
  const params = useParams();
  const id = String((params as any)?.id || '').trim();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<AdminUserDetail | null>(null);

  useEffect(() => {
    if (!id) return;

    let isMounted = true;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`/api/admin/users/${id}`);
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || 'Failed to load user detail');
        if (isMounted) setData(json as AdminUserDetail);
      } catch (e: any) {
        if (isMounted) setError(e?.message || 'Xatolik yuz berdi');
      } finally {
        if (isMounted) setLoading(false);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [id]);

  const user = data?.user;

  const usageTotal = useMemo(() => {
    return (data?.usage?.summary_by_service || []).reduce((sum, row) => sum + Number(row.tokens_used || 0), 0);
  }, [data]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <nav className="bg-white/5 backdrop-blur-xl border-b border-white/10 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Link href="/admin/users" className="p-2 bg-white/10 rounded-xl hover:bg-white/20 transition-colors">
              <FiArrowLeft className="w-5 h-5 text-white" aria-hidden />
            </Link>
            <div>
              <h1 className="text-xl font-bold text-white">Foydalanuvchi tafsilotlari</h1>
              <p className="text-white/50 text-sm">{id}</p>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        {loading ? (
          <div className="bg-white/5 backdrop-blur-xl rounded-2xl p-12 border border-white/10 text-center">
            <div className="animate-spin w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full mx-auto"></div>
            <p className="text-white/50 mt-4">Yuklanmoqda...</p>
          </div>
        ) : error ? (
          <div className="bg-red-500/10 rounded-2xl p-6 border border-red-500/20">
            <p className="text-red-200 font-semibold">{error}</p>
          </div>
        ) : !user ? (
          <div className="bg-white/5 backdrop-blur-xl rounded-2xl p-12 border border-white/10 text-center">
            <p className="text-white/50">Foydalanuvchi topilmadi</p>
          </div>
        ) : (
          <>
            {/* Profile + balances */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="bg-white/5 backdrop-blur-xl rounded-2xl p-6 border border-white/10 lg:col-span-2">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h2 className="text-white text-xl font-bold truncate flex items-center gap-2">
                      <FiUser className="text-white/70" aria-hidden />
                      {[user.first_name, user.last_name].filter(Boolean).join(' ') || user.email}
                    </h2>
                    <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3 text-white/70 text-sm">
                      <div className="flex items-center gap-2 min-w-0">
                        <FiMail className="text-white/50" aria-hidden />
                        <span className="truncate">{user.email}</span>
                      </div>
                      <div className="flex items-center gap-2 min-w-0">
                        <FiPhone className="text-white/50" aria-hidden />
                        <span className="truncate">{user.phone || '-'}</span>
                      </div>
                      <div className="flex items-center gap-2 min-w-0">
                        <FiTag className="text-white/50" aria-hidden />
                        <span className="truncate">Telegram: {user.telegram_username || '-'}</span>
                      </div>
                      <div className="flex items-center gap-2 min-w-0">
                        <FiClock className="text-white/50" aria-hidden />
                        <span className="truncate">Ro'yxatdan: {fmtDate(user.created_at)}</span>
                      </div>
                      <div className="flex items-center gap-2 min-w-0">
                        <FiTag className="text-white/50" aria-hidden />
                        <span className="truncate">Referral code: {user.referral_code || '-'}</span>
                      </div>
                      <div className="flex items-center gap-2 min-w-0">
                        <FiUsers className="text-white/50" aria-hidden />
                        <span className="truncate">
                          Taklif qilgan: {user.referred_by_user_id ? (
                            <Link href={`/admin/users/${user.referred_by_user_id}`} className="text-purple-200 hover:underline">
                              {user.referred_by_user_id}
                            </Link>
                          ) : (
                            '-'
                          )}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <p className="text-white/40 text-xs">Tarif</p>
                    <p className="text-white font-semibold">
                      {user.subscription_plan === 'business_plus'
                        ? 'Business+'
                        : user.subscription_plan === 'free'
                          ? 'Bepul'
                          : user.subscription_plan}
                    </p>
                    <p className="text-white/40 text-xs mt-2">Holat</p>
                    <p className="text-white/70 text-sm">{user.subscription_status}</p>
                    <p className="text-white/40 text-xs mt-2">Muddat</p>
                    <p className="text-white/70 text-sm">{fmtDate(user.subscription_expires_at)}</p>
                  </div>
                </div>
              </div>

              <div className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 rounded-2xl p-6 border border-purple-500/20">
                <h3 className="text-white font-bold flex items-center gap-2">
                  <FiZap className="text-purple-300" aria-hidden />
                  Token balansi
                </h3>
                <div className="mt-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-white/60">Jami</span>
                    <span className="text-white font-bold">{fmtTokens(user.tokens_total)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-white/60">Tarif</span>
                    <span className="text-white/80">{fmtTokens(user.tokens_subscription_remaining)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-white/60">Referral (aktiv)</span>
                    <span className="text-white/80">{fmtTokens(user.tokens_referral_remaining)}</span>
                  </div>
                  <div className="pt-3 border-t border-white/10 flex items-center justify-between">
                    <span className="text-white/60">Referral (jami berilgan)</span>
                    <span className="text-white/80">{fmtTokens(user.tokens_referral_total)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Usage summary */}
            <div className="bg-white/5 backdrop-blur-xl rounded-2xl p-6 border border-white/10">
              <h3 className="text-white font-bold flex items-center gap-2">
                <FiInfo className="text-white/70" aria-hidden />
                Token sarfi (xizmatlar bo'yicha)
              </h3>
              <p className="text-white/50 text-sm mt-1">Jami ishlatilgan: {fmtTokens(usageTotal)}</p>

              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="text-white/50">
                      <th className="py-2 pr-4">Xizmat</th>
                      <th className="py-2 pr-4">So'rovlar</th>
                      <th className="py-2 pr-4">Token</th>
                      <th className="py-2 pr-4">Oxirgi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data?.usage?.summary_by_service || []).length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-3 text-white/40">
                          Hozircha token sarfi yo'q
                        </td>
                      </tr>
                    ) : (
                      (data?.usage?.summary_by_service || []).map((row) => (
                        <tr key={row.service_type} className="border-t border-white/10">
                          <td className="py-2 pr-4 text-white">{labelServiceType(row.service_type)}</td>
                          <td className="py-2 pr-4 text-white/70">{row.requests}</td>
                          <td className="py-2 pr-4 text-white/70">{fmtTokens(row.tokens_used)}</td>
                          <td className="py-2 pr-4 text-white/70">{fmtDate(row.last_used_at)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Referrals */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white/5 backdrop-blur-xl rounded-2xl p-6 border border-white/10">
                <h3 className="text-white font-bold flex items-center gap-2">
                  <FiUsers className="text-white/70" aria-hidden />
                  Taklif qilgan foydalanuvchilar
                </h3>
                <p className="text-white/50 text-sm mt-1">Jami: {(data?.referrals?.invited_users || []).length}</p>

                <div className="mt-4 overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="text-white/50">
                        <th className="py-2 pr-4">Email</th>
                        <th className="py-2 pr-4">Tarif</th>
                        <th className="py-2 pr-4">Holat</th>
                        <th className="py-2 pr-4">Sana</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(data?.referrals?.invited_users || []).length === 0 ? (
                        <tr>
                          <td colSpan={4} className="py-3 text-white/40">
                            Takliflar yo'q
                          </td>
                        </tr>
                      ) : (
                        (data?.referrals?.invited_users || []).map((inv) => (
                          <tr key={inv.id} className="border-t border-white/10">
                            <td className="py-2 pr-4 text-white truncate max-w-[220px]">
                              <Link href={`/admin/users/${inv.id}`} className="hover:underline">
                                {inv.email}
                              </Link>
                            </td>
                            <td className="py-2 pr-4 text-white/70">{inv.subscription_plan || '-'}</td>
                            <td className="py-2 pr-4 text-white/70">{inv.subscription_status || '-'}</td>
                            <td className="py-2 pr-4 text-white/70">{fmtDate(inv.referred_at || inv.created_at)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="bg-white/5 backdrop-blur-xl rounded-2xl p-6 border border-white/10">
                <h3 className="text-white font-bold flex items-center gap-2">
                  <FiGift className="text-white/70" aria-hidden />
                  Referral reward tarixi
                </h3>
                <p className="text-white/50 text-sm mt-1">Jami: {(data?.referrals?.rewards || []).length}</p>

                <div className="mt-4 overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="text-white/50">
                        <th className="py-2 pr-4">Referred</th>
                        <th className="py-2 pr-4">Plan</th>
                        <th className="py-2 pr-4">Awarded</th>
                        <th className="py-2 pr-4">Qolgan</th>
                        <th className="py-2 pr-4">Expire</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(data?.referrals?.rewards || []).length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-3 text-white/40">
                            Rewardlar yo'q
                          </td>
                        </tr>
                      ) : (
                        (data?.referrals?.rewards || []).map((r) => (
                          <tr key={r.id} className="border-t border-white/10">
                            <td className="py-2 pr-4 text-white truncate max-w-[220px]">
                              <Link href={`/admin/users/${r.referred_user_id}`} className="hover:underline">
                                {r.referred_email || r.referred_user_id}
                              </Link>
                            </td>
                            <td className="py-2 pr-4 text-white/70">{r.plan}</td>
                            <td className="py-2 pr-4 text-white/70">{fmtTokens(r.tokens_awarded)}</td>
                            <td className="py-2 pr-4 text-white/70">{fmtTokens(r.tokens_remaining)}</td>
                            <td className="py-2 pr-4 text-white/70">{fmtDate(r.expires_at)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Recent usage */}
            <div className="bg-white/5 backdrop-blur-xl rounded-2xl p-6 border border-white/10">
              <h3 className="text-white font-bold flex items-center gap-2">
                <FiClock className="text-white/70" aria-hidden />
                So'nggi operatsiyalar (token_usage)
              </h3>

              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="text-white/50">
                      <th className="py-2 pr-4">Sana</th>
                      <th className="py-2 pr-4">Xizmat</th>
                      <th className="py-2 pr-4">Token</th>
                      <th className="py-2 pr-4">Model</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data?.usage?.recent || []).length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-3 text-white/40">
                          Operatsiyalar yo'q
                        </td>
                      </tr>
                    ) : (
                      (data?.usage?.recent || []).map((row) => (
                        <tr key={row.id} className="border-t border-white/10">
                          <td className="py-2 pr-4 text-white/70">{fmtDate(row.created_at)}</td>
                          <td className="py-2 pr-4 text-white">{labelServiceType(row.service_type)}</td>
                          <td className="py-2 pr-4 text-white/70">{fmtTokens(row.tokens_used)}</td>
                          <td className="py-2 pr-4 text-white/70 truncate max-w-[240px]">
                            {row.model_used || '-'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <p className="text-white/40 text-xs mt-4">
                Eslatma: prompt/model kabi ma'lumotlar backendda saqlansa ham, bu jadvalda faqat qisqa ko'rinish beriladi.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
