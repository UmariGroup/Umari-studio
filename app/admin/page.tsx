'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { SUBSCRIPTION_PLANS, FREE_TRIAL_TOKENS } from '@/lib/subscription-plans';

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
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    ),
    title: 'Foydalanuvchilar',
    description: 'Barcha foydalanuvchilarni boshqarish',
    color: 'from-blue-500 to-indigo-600',
    badge: 'Asosiy',
  },
  {
    href: '/admin/admins',
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    ),
    title: 'Admin boshqaruvi',
    description: "Administratorlar ro'yxati",
    color: 'from-purple-500 to-pink-600',
    badge: null,
  },
  {
    href: '/admin/subscriptions',
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
      </svg>
    ),
    title: 'Obuna rejalari',
    description: "Tariflar sozlamalari",
    color: 'from-emerald-500 to-teal-600',
    badge: null,
  },
  {
    href: '/admin/logs',
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
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
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
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
              Chiqish
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
                <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
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
                <svg className="w-6 h-6 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
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
                <svg className="w-6 h-6 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
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
                <svg className="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
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
            <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            Tariflar bo'yicha taqsimot
          </h2>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            {/* Free */}
            <div className="bg-gray-500/10 rounded-xl p-4 border border-gray-500/20">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xl">🆓</span>
                <span className="font-bold text-gray-300">Free</span>
              </div>
              <p className="text-2xl font-black text-gray-400">{stats.freeUsers}</p>
              <p className="text-xs text-gray-500">{FREE_TRIAL_TOKENS} token sinov</p>
            </div>

            {/* Starter */}
            <div className="bg-emerald-500/10 rounded-xl p-4 border border-emerald-500/20">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xl">🟢</span>
                <span className="font-bold text-emerald-300">Starter</span>
              </div>
              <p className="text-2xl font-black text-emerald-400">{stats.starterUsers || 0}</p>
              <p className="text-xs text-emerald-500/70">$9/oy • 100 token</p>
            </div>

            {/* Pro */}
            <div className="bg-blue-500/10 rounded-xl p-4 border border-blue-500/20">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xl">💎</span>
                <span className="font-bold text-blue-300">Pro</span>
              </div>
              <p className="text-2xl font-black text-blue-400">{stats.proUsers || 0}</p>
              <p className="text-xs text-blue-500/70">$19/oy • 250 token</p>
            </div>

            {/* Business+ */}
            <div className="bg-purple-500/10 rounded-xl p-4 border border-purple-500/20">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xl">🚀</span>
                <span className="font-bold text-purple-300">Business+</span>
              </div>
              <p className="text-2xl font-black text-purple-400">{stats.businessUsers || 0}</p>
              <p className="text-xs text-purple-500/70">$29/oy • 500 token</p>
            </div>

            {/* Expired */}
            <div className="bg-red-500/10 rounded-xl p-4 border border-red-500/20">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xl">⏰</span>
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
            <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
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
          <h2 className="text-lg font-bold text-white mb-4">📋 Tariflar haqida qisqacha</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white/5 rounded-xl p-4">
              <h3 className="font-bold text-emerald-400 mb-2">🟢 Starter — $9/oy</h3>
              <ul className="text-white/70 text-sm space-y-1">
                <li>• 100 token / oy</li>
                <li>• Rasm: Basic + Pro</li>
                <li>• Video: Faqat Veo 3 Fast</li>
                <li>• Copywriter: gemini-2.0-flash</li>
              </ul>
            </div>
            <div className="bg-white/5 rounded-xl p-4">
              <h3 className="font-bold text-blue-400 mb-2">💎 Pro — $19/oy</h3>
              <ul className="text-white/70 text-sm space-y-1">
                <li>• 250 token / oy</li>
                <li>• Rasm: Basic + Pro + Nano</li>
                <li>• Video: Veo 3 Fast + Pro</li>
                <li>• Copywriter: gemini-2.5-flash</li>
              </ul>
            </div>
            <div className="bg-white/5 rounded-xl p-4">
              <h3 className="font-bold text-purple-400 mb-2">🚀 Business+ — $29/oy</h3>
              <ul className="text-white/70 text-sm space-y-1">
                <li>• 500 token / oy</li>
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
