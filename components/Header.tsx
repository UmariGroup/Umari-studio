'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { planLabelUz } from '@/lib/uzbek-errors';

interface User {
  id: number;
  email: string;
  first_name: string;
  role: string;
  subscription_plan?: string;
  subscription_status?: string;
  subscription_expires_at?: string | null;
  tokens_remaining?: number;
  tokens_total?: number;
}

export default function Header() {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    fetchUser();
  }, []);

  const fetchUser = async () => {
    try {
      const response = await fetch('/api/auth/me');
      const data = await response.json();
      if (data.success) {
        setUser(data.user);
      }
    } catch (error) {
      console.error('Error fetching user:', error);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      setUser(null);
      router.push('/');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const isDashboard = pathname === '/dashboard';
  const isAdmin = user?.role === 'admin';
  const plan = (user?.subscription_plan || 'free') as string;
  const tokensRemaining = Number(user?.tokens_remaining || 0);
  const tokensTotal = Number(user?.tokens_total || 0);
  const tokenPercentage = tokensTotal > 0 ? Math.round((tokensRemaining / tokensTotal) * 100) : 0;
  const formatTokens = (n: number) => Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 });

  if (user && isDashboard) {
    return (
      <header className="bg-gradient-to-r from-purple-600 via-pink-600 to-rose-600 shadow-xl">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div className="flex items-center gap-5">
              <Link href="/dashboard" className="flex items-center gap-5">
                <div className="p-4 bg-white/20 backdrop-blur-sm rounded-2xl">
                  <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                  </svg>
                </div>
                <div>
                  <h1 className="text-3xl font-black text-white tracking-tight">Umari Studio</h1>
                  <p className="text-white/80 text-sm mt-1">Salom, {user?.first_name || user?.email}! 👋</p>
                </div>
              </Link>
            </div>

            <div className="flex flex-wrap items-center gap-4">
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl px-6 py-4 border border-white/20">
                <div className="flex items-center gap-4">
                  <div className="relative w-14 h-14">
                    <svg className="w-14 h-14 transform -rotate-90">
                      <circle cx="28" cy="28" r="24" stroke="rgba(255,255,255,0.2)" strokeWidth="4" fill="none" />
                      <circle
                        cx="28"
                        cy="28"
                        r="24"
                        stroke="#fcd34d"
                        strokeWidth="4"
                        fill="none"
                        strokeLinecap="round"
                        strokeDasharray={`${tokenPercentage * 1.5} 150`}
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-xs font-bold text-white">{tokenPercentage}%</span>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-white/60 uppercase tracking-wider font-medium">Qolgan Token</p>
                    <p className="text-2xl font-black text-white">{isAdmin ? '∞' : formatTokens(tokensRemaining)}</p>
                    <p className="text-xs text-white/50">/ {formatTokens(tokensTotal)} ta</p>
                  </div>
                </div>
              </div>

              <div className="bg-white/10 backdrop-blur-sm rounded-2xl px-6 py-4 border border-white/20">
                <p className="text-xs text-white/60 uppercase tracking-wider font-medium">Tarif</p>
                <p className="text-xl font-bold text-white capitalize">
                  {plan === 'business_plus' ? 'Business+' : planLabelUz(plan) || 'Free'}
                </p>
                {user?.subscription_expires_at && (
                  <p className="text-xs text-white/50 mt-1">
                    Muddati: {new Date(user.subscription_expires_at).toLocaleDateString('uz')}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-3">
                {isAdmin && (
                  <Link
                    href="/admin"
                    className="p-3 bg-white/10 hover:bg-white/20 rounded-xl transition-all"
                    title="Admin Panel"
                  >
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </Link>
                )}
                <button
                  onClick={handleLogout}
                  className="p-3 bg-white/10 hover:bg-red-500/50 rounded-xl transition-all"
                  title="Chiqish"
                >
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>
    );
  }

  return (
    <header className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <div className="flex items-center">
            <Link href="/" className="flex items-center">
              <div className="flex items-center">
                <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center mr-2">
                  <span className="text-white font-bold text-lg">U</span>
                </div>
                <span className="text-xl font-bold text-gray-900">Umari Studio</span>
              </div>
            </Link>
          </div>

          {/* Navigation - Desktop */}
          <nav className="hidden md:flex space-x-8">
            {user ? (
              <>
                <Link href="/dashboard" className="text-gray-700 hover:text-blue-600 px-3 py-2 rounded-md text-sm font-medium">
                  Dashboard
                </Link>
                <Link href="/marketplace" className="text-gray-700 hover:text-blue-600 px-3 py-2 rounded-md text-sm font-medium">
                  Marketplace
                </Link>
                <Link href="/video-studio" className="text-gray-700 hover:text-blue-600 px-3 py-2 rounded-md text-sm font-medium">
                  Video Studio
                </Link>
                <Link href="/copywriter" className="text-gray-700 hover:text-blue-600 px-3 py-2 rounded-md text-sm font-medium">
                  Copywriter
                </Link>
                <Link href="https://sellway.uz" target="_blank" rel="noopener noreferrer" className="text-gray-700 hover:text-blue-600 px-3 py-2 rounded-md text-sm font-medium">
                  Analytics
                </Link>
                {user.role === 'admin' && (
                  <Link href="/admin" className="text-blue-700 hover:text-blue-900 px-3 py-2 rounded-md text-sm font-medium">
                    Admin
                  </Link>
                )}
              </>
            ) : (
              <>
                <Link href="/pricing" className="text-gray-700 hover:text-blue-600 px-3 py-2 rounded-md text-sm font-medium">
                  Pricing
                </Link>
                <a href="#features" className="text-gray-700 hover:text-blue-600 px-3 py-2 rounded-md text-sm font-medium">
                  Features
                </a>
              </>
            )}
          </nav>

          {/* Right side */}
          <div className="flex items-center space-x-4">
            {user ? (
              <div className="flex items-center space-x-4">
                <span className="text-gray-700 text-sm">
                  Salom, {user.first_name || user.email}!
                </span>
                <button
                  onClick={handleLogout}
                  className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-md text-sm font-medium transition"
                >
                  Chiqish
                </button>
              </div>
            ) : (
              <div className="flex items-center space-x-3">
                <Link
                  href="/login"
                  className="text-gray-700 hover:text-blue-600 px-3 py-2 rounded-md text-sm font-medium"
                >
                  Kirish
                </Link>
                <Link
                  href="/register"
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium transition"
                >
                  Ro'yxatdan o'tish
                </Link>
              </div>
            )}

            {/* Mobile menu button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100"
            >
              <svg
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                {mobileMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <div className="md:hidden">
            <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3 border-t border-gray-200">
              {user ? (
                <>
                  <Link
                    href="/dashboard"
                    className="text-gray-700 hover:text-purple-600 block px-3 py-2 rounded-md text-base font-medium"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Dashboard
                  </Link>
                  <Link
                    href="/marketplace"
                    className="text-gray-700 hover:text-purple-600 block px-3 py-2 rounded-md text-base font-medium"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Marketplace
                  </Link>
                  <Link
                    href="/video-studio"
                    className="text-gray-700 hover:text-purple-600 block px-3 py-2 rounded-md text-base font-medium"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Video Studio
                  </Link>
                  <Link
                    href="/copywriter"
                    className="text-gray-700 hover:text-purple-600 block px-3 py-2 rounded-md text-base font-medium"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Copywriter
                  </Link>
                  <Link
                    href="https://sellway.uz"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-gray-700 hover:text-purple-600 block px-3 py-2 rounded-md text-base font-medium"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Analytics
                  </Link>
                  {user.role === 'admin' && (
                    <Link
                      href="/admin"
                      className="text-blue-700 hover:text-blue-900 block px-3 py-2 rounded-md text-base font-medium"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      Admin
                    </Link>
                  )}
                </>
              ) : (
                <>
                  <Link
                    href="/pricing"
                    className="text-gray-700 hover:text-blue-600 block px-3 py-2 rounded-md text-base font-medium"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Pricing
                  </Link>
                  <Link
                    href="/login"
                    className="text-gray-700 hover:text-blue-600 block px-3 py-2 rounded-md text-base font-medium"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Kirish
                  </Link>
                  <Link
                    href="/register"
                    className="bg-blue-600 text-white block px-3 py-2 rounded-md text-base font-medium"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Ro'yxatdan o'tish
                  </Link>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </header>
  );
}