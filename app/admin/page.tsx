'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { SUBSCRIPTION_PLANS, FREE_TRIAL_TOKENS } from '@/lib/subscription-plans';
import {
  FiBarChart2,
  FiCheck,
  FiCreditCard,
  FiDollarSign,
  FiFileText,
  FiLogOut,
  FiShield,
  FiUsers,
  FiClock,
  FiZap,
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

const QUICK_ACTIONS = [
  {
    href: '/admin/users',
    icon: <FiUsers className="w-8 h-8" />,
    title: 'Foydalanuvchilar',
    description: 'Barcha foydalanuvchilarni boshqarish',
    color: 'from-blue-500 to-indigo-600',
    badge: 'Asosiy',
  },
  {
    href: '/admin/admins',
    icon: <FiShield className="w-8 h-8" />,
    title: 'Admin boshqaruvi',
    description: "Administratorlar ro'yxati",
    color: 'from-purple-500 to-pink-600',
    badge: null,
  },
  {
    href: '/admin/subscriptions',
    icon: <FiCreditCard className="w-8 h-8" />,
    title: 'Obuna rejalari',
    description: "Tariflar sozlamalari",
    color: 'from-emerald-500 to-teal-600',
    badge: null,
  },
  {
    href: '/admin/logs',
    icon: <FiFileText className="w-8 h-8" />,
    title: 'Loglar',
    description: 'Admin harakatlari tarixi',
    color: 'from-gray-500 to-slate-600',
    badge: null,
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

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/admin/dashboard');
      const data = await response.json();
      if (data.success) {
        setStats(data.stats);
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Header */}
      <nav className="bg-white/5 backdrop-blur-xl border-b border-white/10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div className="p-2 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl">
              <FiShield className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-white">Admin Panel</h1>
              <p className="text-white/50 text-sm">Umari Studio boshqaruv markazi</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="px-4 py-2 bg-white/10 text-white rounded-xl hover:bg-white/20 transition-colors font-semibold">
              Dashboard
            </Link>
            <button
              onClick={handleLogout}
              className="px-4 py-2 bg-red-500/20 text-red-300 rounded-xl hover:bg-red-500/30 transition-colors font-semibold"
            >
              <span className="inline-flex items-center gap-2"><FiLogOut /> Chiqish</span>
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Total Users */}
          <div className="bg-white/5 backdrop-blur-xl rounded-2xl p-6 border border-white/10">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-500/20 rounded-xl">
                <FiUsers className="w-6 h-6 text-blue-400" />
              </div>
              <div>
                <p className="text-white/50 text-sm">Jami foydalanuvchilar</p>
                <p className="text-3xl font-black text-white">{loading ? '...' : stats.totalUsers}</p>
              </div>
            </div>
          </div>

          {/* Active Subscriptions */}
          <div className="bg-white/5 backdrop-blur-xl rounded-2xl p-6 border border-white/10">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-emerald-500/20 rounded-xl">
                <FiCheck className="w-6 h-6 text-emerald-400" />
              </div>
              <div>
                <p className="text-white/50 text-sm">Faol obunalar</p>
                <p className="text-3xl font-black text-emerald-400">{loading ? '...' : stats.activeSubscriptions}</p>
              </div>
            </div>
          </div>

          {/* Free Users */}
          <div className="bg-white/5 backdrop-blur-xl rounded-2xl p-6 border border-white/10">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-amber-500/20 rounded-xl">
                <FiClock className="w-6 h-6 text-amber-400" />
              </div>
              <div>
                <p className="text-white/50 text-sm">Free foydalanuvchilar</p>
                <p className="text-3xl font-black text-amber-400">{loading ? '...' : stats.freeUsers}</p>
              </div>
            </div>
          </div>

          {/* Total Revenue */}
          <div className="bg-white/5 backdrop-blur-xl rounded-2xl p-6 border border-white/10">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-purple-500/20 rounded-xl">
                <FiDollarSign className="w-6 h-6 text-purple-400" />
              </div>
              <div>
                <p className="text-white/50 text-sm">Jami daromad</p>
                <p className="text-3xl font-black text-purple-400">${loading ? '...' : stats.totalRevenue}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Subscription Breakdown */}
        <div className="bg-white/5 backdrop-blur-xl rounded-2xl p-6 border border-white/10">
          <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-3">
            <FiBarChart2 className="w-5 h-5 text-purple-400" />
            Tariflar bo'yicha taqsimot
          </h2>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            {/* Free */}
            <div className="bg-gray-500/10 rounded-xl p-4 border border-gray-500/20">
              <div className="flex items-center gap-2 mb-2">
                <FiZap className="text-xl text-gray-300" />
                <span className="font-bold text-gray-300">Free</span>
              </div>
              <p className="text-2xl font-black text-gray-400">{stats.freeUsers}</p>
              <p className="text-xs text-gray-500">{FREE_TRIAL_TOKENS} token sinov</p>
            </div>

            {/* Starter */}
            <div className="bg-emerald-500/10 rounded-xl p-4 border border-emerald-500/20">
              <div className="flex items-center gap-2 mb-2">
                <FiCreditCard className="text-xl text-emerald-300" />
                <span className="font-bold text-emerald-300">Starter</span>
              </div>
              <p className="text-2xl font-black text-emerald-400">{stats.starterUsers || 0}</p>
              <p className="text-xs text-emerald-500/70">$9/oy • {SUBSCRIPTION_PLANS.starter.monthlyTokens} token</p>
            </div>

            {/* Pro */}
            <div className="bg-blue-500/10 rounded-xl p-4 border border-blue-500/20">
              <div className="flex items-center gap-2 mb-2">
                <FiCreditCard className="text-xl text-blue-300" />
                <span className="font-bold text-blue-300">Pro</span>
              </div>
              <p className="text-2xl font-black text-blue-400">{stats.proUsers || 0}</p>
              <p className="text-xs text-blue-500/70">$19/oy • {SUBSCRIPTION_PLANS.pro.monthlyTokens} token</p>
            </div>

            {/* Business+ */}
            <div className="bg-purple-500/10 rounded-xl p-4 border border-purple-500/20">
              <div className="flex items-center gap-2 mb-2">
                <FiCreditCard className="text-xl text-purple-300" />
                <span className="font-bold text-purple-300">Business+</span>
              </div>
              <p className="text-2xl font-black text-purple-400">{stats.businessUsers || 0}</p>
              <p className="text-xs text-purple-500/70">$29/oy • {SUBSCRIPTION_PLANS.business_plus.monthlyTokens} token</p>
            </div>

            {/* Expired */}
            <div className="bg-red-500/10 rounded-xl p-4 border border-red-500/20">
              <div className="flex items-center gap-2 mb-2">
                <FiClock className="text-xl text-red-300" />
                <span className="font-bold text-red-300">Expired</span>
              </div>
              <p className="text-2xl font-black text-red-400">{stats.expiredUsers || 0}</p>
              <p className="text-xs text-red-500/70">Muddati tugagan</p>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div>
          <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-3">
            <FiZap className="w-5 h-5 text-purple-400" aria-hidden />
            Tez harakatlar
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {QUICK_ACTIONS.map((action) => (
              <Link
                key={action.href}
                href={action.href}
                className="group relative bg-white/5 backdrop-blur-xl rounded-2xl p-6 border border-white/10 hover:bg-white/10 transition-all hover:scale-[1.02] hover:shadow-xl"
              >
                {action.badge && (
                  <span className="absolute top-4 right-4 px-2 py-1 bg-purple-500 text-white text-xs font-bold rounded-lg">
                    {action.badge}
                  </span>
                )}
                <div className={`w-14 h-14 rounded-xl bg-gradient-to-r ${action.color} flex items-center justify-center text-white mb-4 group-hover:scale-110 transition-transform`}>
                  {action.icon}
                </div>
                <h3 className="text-lg font-bold text-white mb-1">{action.title}</h3>
                <p className="text-white/50 text-sm">{action.description}</p>
              </Link>
            ))}
          </div>
        </div>

        {/* Plan Info Card */}
        <div className="bg-gradient-to-r from-purple-500/20 to-pink-500/20 rounded-2xl p-6 border border-purple-500/20">
          <h2 className="text-lg font-bold text-white mb-4 inline-flex items-center gap-2">
            <FiFileText className="text-purple-300" /> Tariflar haqida qisqacha
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white/5 rounded-xl p-4">
              <h3 className="font-bold text-emerald-400 mb-2 inline-flex items-center gap-2">
                <FiCreditCard /> Starter — $9/oy
              </h3>
              <ul className="text-white/70 text-sm space-y-1">
                <li>• {SUBSCRIPTION_PLANS.starter.monthlyTokens} token / oy</li>
                <li>• Rasm: Basic + Pro</li>
                <li>• Video: Faqat Veo 3 Fast</li>
                <li>• Copywriter: gemini-2.0-flash</li>
              </ul>
            </div>
            <div className="bg-white/5 rounded-xl p-4">
              <h3 className="font-bold text-blue-400 mb-2 inline-flex items-center gap-2">
                <FiCreditCard /> Pro — $19/oy
              </h3>
              <ul className="text-white/70 text-sm space-y-1">
                <li>• {SUBSCRIPTION_PLANS.pro.monthlyTokens} token / oy</li>
                <li>• Rasm: Basic + Pro + Nano</li>
                <li>• Video: Veo 3 Fast + Pro</li>
                <li>• Copywriter: gemini-2.5-flash</li>
              </ul>
            </div>
            <div className="bg-white/5 rounded-xl p-4">
              <h3 className="font-bold text-purple-400 mb-2 inline-flex items-center gap-2">
                <FiCreditCard /> Business+ — $29/oy
              </h3>
              <ul className="text-white/70 text-sm space-y-1">
                <li>• {SUBSCRIPTION_PLANS.business_plus.monthlyTokens} token / oy</li>
                <li>• Barcha modellar</li>
                <li>• Video: + Premium Upscaler</li>
                <li>• Copywriter: gemini-2.5-pro</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
