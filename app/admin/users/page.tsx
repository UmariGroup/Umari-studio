'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useToast } from '@/components/ToastProvider';
import { FREE_TRIAL_TOKENS, SUBSCRIPTION_PLANS } from '@/lib/subscription-plans';
import type { IconType } from 'react-icons';
import {
  FiAlertTriangle,
  FiArrowLeft,
  FiCheckCircle,
  FiChevronDown,
  FiInfo,
  FiPackage,
  FiSearch,
  FiStar,
} from 'react-icons/fi';
import { FaRocket } from 'react-icons/fa';

interface User {
  id: string;
  email: string;
  first_name: string;
  last_name?: string;
  role: string;
  subscription_status: string;
  subscription_plan: string;
  tokens_remaining: number;
  subscription_expires_at?: string | null;
  created_at: string;
}

type PlanId = 'starter' | 'pro' | 'business_plus';

type PlanOption = {
  id: PlanId;
  label: string;
  tokens: number;
  price: number;
  color: string;
  Icon: IconType;
};

const PLAN_OPTIONS: PlanOption[] = [
  {
    id: 'starter',
    label: 'Starter',
    tokens: SUBSCRIPTION_PLANS.starter.monthlyTokens,
    price: SUBSCRIPTION_PLANS.starter.monthlyPriceUsd,
    color: 'emerald',
    Icon: FiPackage,
  },
  {
    id: 'pro',
    label: 'Pro',
    tokens: SUBSCRIPTION_PLANS.pro.monthlyTokens,
    price: SUBSCRIPTION_PLANS.pro.monthlyPriceUsd,
    color: 'blue',
    Icon: FiStar,
  },
  {
    id: 'business_plus',
    label: 'Business+',
    tokens: SUBSCRIPTION_PLANS.business_plus.monthlyTokens,
    price: SUBSCRIPTION_PLANS.business_plus.monthlyPriceUsd,
    color: 'purple',
    Icon: FaRocket,
  },
];

function normalizePlan(plan: unknown): PlanId {
  const raw = String(plan || '').trim().toLowerCase().replace(/\s+/g, '_');
  if (raw === 'business+' || raw === 'business_plus') return 'business_plus';
  if (raw === 'pro' || raw === 'professional') return 'pro';
  return 'starter';
}

function getPlanColor(plan: string): string {
  if (plan === 'business_plus') return 'purple';
  if (plan === 'pro') return 'blue';
  if (plan === 'starter') return 'emerald';
  return 'gray';
}

function getStatusColor(status: string): string {
  if (status === 'active') return 'emerald';
  if (status === 'expired') return 'red';
  return 'gray';
}

export default function AdminUsersPage() {
  const toast = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [filterSubscription, setFilterSubscription] = useState('');
  const [selectedPlans, setSelectedPlans] = useState<Record<string, string>>({});
  const [activatingUser, setActivatingUser] = useState<string | null>(null);

  useEffect(() => {
    fetchUsers();
  }, [search, filterRole, filterSubscription]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (filterRole) params.append('role', filterRole);
      if (filterSubscription) params.append('subscription', filterSubscription);
      params.append('limit', '100');

      const response = await fetch(`/api/admin/users?${params}`);
      const data = await response.json();

      if (data.success) {
        setUsers(data.users);
        const nextSelected: Record<string, string> = {};
        for (const u of data.users as User[]) {
          nextSelected[u.id] = normalizePlan(u.subscription_plan);
        }
        setSelectedPlans(nextSelected);
      }
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };

  const activatePlan = async (userId: string) => {
    try {
      setActivatingUser(userId);
      const plan = selectedPlans[userId] || 'starter';
      const response = await fetch('/api/admin/subscriptions/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, plan }),
      });

      const data = await response.json();
      if (!response.ok || !data?.success) {
        throw new Error(data?.error || 'Obunani faollashtirib bo\'lmadi');
      }

      setUsers(users.map((u) => (u.id === userId ? { ...u, ...data.user } : u)));
      toast.success(`${plan.toUpperCase()} tarif faollashtirildi (1 oy)`);
    } catch (error) {
      toast.error((error as Error).message || 'Xatolik yuz berdi.');
    } finally {
      setActivatingUser(null);
    }
  };

  const expireUser = async (userId: string) => {
    try {
      setActivatingUser(userId);
      const response = await fetch('/api/admin/subscriptions/expire', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId }),
      });

      const data = await response.json();
      if (!response.ok || !data?.success) {
        throw new Error(data?.error || 'Obunani tugatib bo\'lmadi');
      }

      setUsers(users.map((u) => (u.id === userId ? { ...u, ...data.user } : u)));
      toast.success('Obuna tugatildi, tokenlar 0 qilindi');
    } catch (error) {
      toast.error((error as Error).message || 'Xatolik yuz berdi.');
    } finally {
      setActivatingUser(null);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Header */}
      <nav className="bg-white/5 backdrop-blur-xl border-b border-white/10 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Link href="/admin" className="p-2 bg-white/10 rounded-xl hover:bg-white/20 transition-colors">
              <FiArrowLeft className="w-5 h-5 text-white" aria-hidden />
            </Link>
            <div>
              <h1 className="text-xl font-bold text-white">Foydalanuvchilar boshqaruvi</h1>
              <p className="text-white/50 text-sm">{users.length} ta foydalanuvchi</p>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        {/* Filters */}
        <div className="bg-white/5 backdrop-blur-xl rounded-2xl p-6 border border-white/10">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative">
              <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30" aria-hidden />
              <input
                type="text"
                placeholder="Email yoki ism qidirish..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <select
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value)}
              className="px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="" className="bg-slate-800">Barcha rollar</option>
              <option value="user" className="bg-slate-800">Foydalanuvchi</option>
              <option value="admin" className="bg-slate-800">Admin</option>
            </select>
            <select
              value={filterSubscription}
              onChange={(e) => setFilterSubscription(e.target.value)}
              className="px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="" className="bg-slate-800">Barcha statuslar</option>
              <option value="free" className="bg-slate-800">Bepul</option>
              <option value="active" className="bg-slate-800">Faol</option>
              <option value="expired" className="bg-slate-800">Tugagan</option>
            </select>
            <button
              onClick={() => {
                setSearch('');
                setFilterRole('');
                setFilterSubscription('');
              }}
              className="px-4 py-3 bg-white/10 text-white rounded-xl hover:bg-white/20 transition-colors font-semibold"
            >
              Tozalash
            </button>
          </div>
        </div>

        {/* Users List */}
        <div className="space-y-4">
          {loading ? (
            <div className="bg-white/5 backdrop-blur-xl rounded-2xl p-12 border border-white/10 text-center">
              <div className="animate-spin w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full mx-auto"></div>
              <p className="text-white/50 mt-4">Yuklanmoqda...</p>
            </div>
          ) : users.length === 0 ? (
            <div className="bg-white/5 backdrop-blur-xl rounded-2xl p-12 border border-white/10 text-center">
              <p className="text-white/50">Foydalanuvchilar topilmadi</p>
            </div>
          ) : (
            users.map((user) => {
              const planColor = getPlanColor(user.subscription_plan);
              const statusColor = getStatusColor(user.subscription_status);
              const isProcessing = activatingUser === user.id;
              const currentPlanOption = PLAN_OPTIONS.find((p) => p.id === selectedPlans[user.id]);

              return (
                <div
                  key={user.id}
                  className={`bg-white/5 backdrop-blur-xl rounded-2xl p-6 border border-white/10 hover:bg-white/[0.07] transition-all ${
                    isProcessing ? 'opacity-50 pointer-events-none' : ''
                  }`}
                >
                  <div className="flex flex-col lg:flex-row lg:items-center gap-6">
                    {/* User Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold">
                          {(user.first_name?.[0] || user.email[0]).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-semibold text-white truncate">
                            {[user.first_name, user.last_name].filter(Boolean).join(' ') || 'Noma\'lum'}
                          </h3>
                          <p className="text-white/50 text-sm truncate">{user.email}</p>
                        </div>
                        {user.role === 'admin' && (
                          <span className="px-2 py-1 bg-purple-500/20 text-purple-300 rounded-lg text-xs font-bold">
                            ADMIN
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Current Status */}
                    <div className="flex items-center gap-4 flex-wrap">
                      <div className="text-center">
                        <p className="text-white/40 text-xs mb-1">Hozirgi tarif</p>
                        <span className={`px-3 py-1 rounded-lg text-sm font-bold ${
                          planColor === 'purple' ? 'bg-purple-500/20 text-purple-300' :
                          planColor === 'blue' ? 'bg-blue-500/20 text-blue-300' :
                          planColor === 'emerald' ? 'bg-emerald-500/20 text-emerald-300' :
                          'bg-gray-500/20 text-gray-300'
                        }`}>
                          {user.subscription_plan === 'business_plus' ? 'Business+' : user.subscription_plan === 'free' ? 'Bepul' : (user.subscription_plan || 'Bepul')}
                        </span>
                      </div>
                      <div className="text-center">
                        <p className="text-white/40 text-xs mb-1">Holat</p>
                        <span className={`px-3 py-1 rounded-lg text-sm font-bold ${
                          statusColor === 'emerald' ? 'bg-emerald-500/20 text-emerald-300' :
                          statusColor === 'red' ? 'bg-red-500/20 text-red-300' :
                          'bg-gray-500/20 text-gray-300'
                        }`}>
                          {user.subscription_status === 'active' ? 'Faol' : user.subscription_status === 'expired' ? 'Tugagan' : user.subscription_status}
                        </span>
                      </div>
                      <div className="text-center">
                        <p className="text-white/40 text-xs mb-1">Tokenlar</p>
                        <span className="text-white font-bold">{Number(user.tokens_remaining || 0).toFixed(1)}</span>
                      </div>
                      <div className="text-center">
                        <p className="text-white/40 text-xs mb-1">Muddat</p>
                        <span className="text-white/70 text-sm">
                          {user.subscription_expires_at
                            ? new Date(user.subscription_expires_at).toLocaleDateString('uz-UZ')
                            : '-'}
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    {user.role !== 'admin' && (
                      <div className="flex items-center gap-3 lg:ml-4">
                        {/* Plan Selection */}
                        <div className="relative">
                          <select
                            value={selectedPlans[user.id] || 'starter'}
                            onChange={(e) => setSelectedPlans((prev) => ({ ...prev, [user.id]: e.target.value }))}
                            className="appearance-none pl-10 pr-8 py-3 bg-white/10 border border-white/20 rounded-xl text-white font-semibold focus:outline-none focus:ring-2 focus:ring-purple-500 cursor-pointer"
                          >
                            {PLAN_OPTIONS.map((p) => (
                              <option key={p.id} value={p.id} className="bg-slate-800">
                                {p.label} — ${p.price} • {p.tokens} token
                              </option>
                            ))}
                          </select>
                          {(() => {
                            const CurrentIcon = currentPlanOption?.Icon ?? FiPackage;
                            return (
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/70">
                                <CurrentIcon className="w-5 h-5" aria-hidden />
                              </span>
                            );
                          })()}
                          <FiChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/50" aria-hidden />
                        </div>

                        {/* Activate Button */}
                        <button
                          onClick={() => activatePlan(user.id)}
                          disabled={isProcessing}
                          className="px-5 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl font-semibold hover:shadow-lg hover:shadow-emerald-500/30 transition-all disabled:opacity-50"
                        >
                          {isProcessing ? (
                            <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full" />
                          ) : (
                            'Faollashtirish'
                          )}
                        </button>

                        {/* Expire Button */}
                        {user.subscription_status === 'active' && (
                          <button
                            onClick={() => expireUser(user.id)}
                            disabled={isProcessing}
                            className="px-5 py-3 bg-red-500/20 text-red-300 rounded-xl font-semibold hover:bg-red-500/30 transition-all disabled:opacity-50"
                          >
                            Tugatish
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Info Card */}
        <div className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 rounded-2xl p-6 border border-purple-500/20">
          <h3 className="font-bold text-white mb-4 flex items-center gap-2">
            <FiInfo className="w-5 h-5 text-purple-400" aria-hidden />
            Tarif belgilash bo'yicha
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-white/70 text-sm">
            <div className="space-y-2">
              <p className="flex gap-2">
                <FiCheckCircle className="w-5 h-5 text-emerald-300 mt-0.5 flex-shrink-0" aria-hidden />
                <span>Tarifni tanlang va <strong className="text-white">Faollashtirish</strong> tugmasini bosing</span>
              </p>
              <p className="flex gap-2">
                <FiCheckCircle className="w-5 h-5 text-emerald-300 mt-0.5 flex-shrink-0" aria-hidden />
                <span>Tarif 1 oyga faollashadi va tokenlar yangilanadi</span>
              </p>
              <p className="flex gap-2">
                <FiCheckCircle className="w-5 h-5 text-emerald-300 mt-0.5 flex-shrink-0" aria-hidden />
                <span>Bepul foydalanuvchiga {FREE_TRIAL_TOKENS} token sinov beriladi</span>
              </p>
            </div>
            <div className="space-y-2">
              <p className="flex gap-2">
                <FiAlertTriangle className="w-5 h-5 text-yellow-300 mt-0.5 flex-shrink-0" aria-hidden />
                <span><strong className="text-white">Tugatish</strong> - obunani to'xtatadi va tokenlarni 0 qiladi</span>
              </p>
              <p className="flex gap-2">
                <FiAlertTriangle className="w-5 h-5 text-yellow-300 mt-0.5 flex-shrink-0" aria-hidden />
                <span>Muddat tugagan, lekin token qolgan bo'lsa - tokenlar yo'qoladi</span>
              </p>
              <p className="flex gap-2">
                <FiAlertTriangle className="w-5 h-5 text-yellow-300 mt-0.5 flex-shrink-0" aria-hidden />
                <span>Admin foydalanuvchilarni o'zgartirish mumkin emas</span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
