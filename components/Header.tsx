'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { planLabelUz } from '@/lib/uzbek-errors';
import { Navbar } from '@/components/landing/Navbar';
import { ContactInfoModal } from '@/components/ContactInfoModal';

type Language = 'uz' | 'ru';

function getLangFromPathname(pathname: string): Language | null {
  const match = pathname.match(/^\/(uz|ru)(\/|$)/);
  if (!match) return null;
  return match[1] as Language;
}

function stripLocalePrefix(pathname: string): string {
  const stripped = pathname.replace(/^\/(uz|ru)(?=\/|$)/, '');
  return stripped || '/';
}

interface User {
  id: number;
  email: string;
  first_name: string;
  role: string;
  subscription_plan?: string;
  tokens_remaining?: number;
  phone?: string | null;
  telegram_username?: string | null;
}

function Logo({ href }: { href: string }) {
  return (
    <Link href={href} className="inline-flex items-center gap-3">
      <span className="h-9 w-9 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 text-white font-black text-lg grid place-items-center">
        U
      </span>
      <span className="text-lg sm:text-xl font-black tracking-tight text-slate-900">Umari AI</span>
    </Link>
  );
}

export default function Header() {
  const router = useRouter();
  const pathname = usePathname();
  const lang = getLangFromPathname(pathname) ?? 'uz';
  const prefix = `/${lang}`;
  const strippedPathname = stripLocalePrefix(pathname);
  const [user, setUser] = useState<User | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const response = await fetch('/api/auth/me');
        const data = await response.json();
        if (data?.success) setUser(data.user || null);
        else setUser(null);
      } catch {
        setUser(null);
      }
    };

    void fetchUser();
  }, [pathname]);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      setUser(null);
      router.push(prefix);
    } catch {
      // ignore
    }
  };

  const isMarketing =
    strippedPathname === '/' ||
    strippedPathname === '/features' ||
    strippedPathname === '/examples' ||
    strippedPathname === '/pricing' ||
    strippedPathname === '/faq' ||
    strippedPathname === '/login' ||
    strippedPathname === '/register';

  const isAuthenticated = Boolean(user);
  const plan = (user?.subscription_plan || 'free').toString();
  const tokens = Number(user?.tokens_remaining || 0);
  const needsContactInfo =
    Boolean(user) &&
    user?.role !== 'admin' &&
    !String(user?.phone || '').trim() &&
    !String(user?.telegram_username || '').trim();

  // Admin routes have their own header.
  if (strippedPathname?.startsWith('/admin')) {
    return null;
  }

  if (isMarketing) {
    return <Navbar />;
  }

  if (isAuthenticated) {
    return (
      <>
        <header className="border-b border-slate-200 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
            <Logo href={prefix} />

          <nav className="hidden md:flex items-center gap-2 text-sm">
            <Link href={`${prefix}/dashboard`} className="px-3 py-2 rounded-lg text-slate-700 hover:text-slate-900 hover:bg-slate-100">
              Boshqaruv
            </Link>
            <Link href={`${prefix}/marketplace`} className="px-3 py-2 rounded-lg text-slate-700 hover:text-slate-900 hover:bg-slate-100">
              Market studiya
            </Link>
            <Link href={`${prefix}/infografika`} className="px-3 py-2 rounded-lg text-slate-700 hover:text-slate-900 hover:bg-slate-100">
              Infografika
            </Link>
            <Link href={`${prefix}/video-studio`} className="px-3 py-2 rounded-lg text-slate-700 hover:text-slate-900 hover:bg-slate-100">
              Video studiya
            </Link>
            <Link href={`${prefix}/copywriter`} className="px-3 py-2 rounded-lg text-slate-700 hover:text-slate-900 hover:bg-slate-100">
              Copywriter studiya
            </Link>
            {user?.role === 'admin' && (
              <Link href={`${prefix}/admin`} className="px-3 py-2 rounded-lg text-blue-700 hover:text-blue-900 hover:bg-blue-50">
                Admin
              </Link>
            )}
          </nav>

          <div className="hidden md:flex items-center gap-3">
            <div className="px-3 py-2 rounded-lg border border-slate-200 text-xs text-slate-600">
              <span className="font-semibold text-slate-800">{planLabelUz(plan)}</span>
              <span className="mx-2">|</span>
              <span>{tokens} token</span>
            </div>
            <button
              onClick={handleLogout}
              className="px-4 py-2 rounded-lg border border-rose-200 text-rose-700 hover:bg-rose-50 text-sm font-semibold"
            >
              Chiqish
            </button>
          </div>

          <button
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            className="md:hidden p-2 rounded-lg border border-slate-200 text-slate-700"
            aria-label="Menyuni ochish/yopish"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {mobileMenuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
          </div>

          {mobileMenuOpen && (
            <div className="md:hidden border-t border-slate-200 bg-white">
              <div className="px-4 py-3 flex flex-col gap-2 text-sm">
                <Link href={`${prefix}/dashboard`} onClick={() => setMobileMenuOpen(false)} className="px-2 py-2 rounded hover:bg-slate-100">Boshqaruv</Link>
                <Link href={`${prefix}/marketplace`} onClick={() => setMobileMenuOpen(false)} className="px-2 py-2 rounded hover:bg-slate-100">Market studiya</Link>
                <Link href={`${prefix}/infografika`} onClick={() => setMobileMenuOpen(false)} className="px-2 py-2 rounded hover:bg-slate-100">Infografika</Link>
                <Link href={`${prefix}/video-studio`} onClick={() => setMobileMenuOpen(false)} className="px-2 py-2 rounded hover:bg-slate-100">Video studiya</Link>
                <Link href={`${prefix}/copywriter`} onClick={() => setMobileMenuOpen(false)} className="px-2 py-2 rounded hover:bg-slate-100">Copywriter studiya</Link>
                {user?.role === 'admin' && (
                  <Link href={`${prefix}/admin`} onClick={() => setMobileMenuOpen(false)} className="px-2 py-2 rounded text-blue-700 hover:bg-blue-50">Admin</Link>
                )}
                <button
                  onClick={handleLogout}
                  className="mt-2 px-3 py-2 rounded-lg border border-rose-200 text-rose-700 text-left"
                >
                  Chiqish
                </button>
              </div>
            </div>
          )}
        </header>

        <ContactInfoModal
          open={needsContactInfo}
          initialPhone={user?.phone ?? null}
          initialTelegramUsername={user?.telegram_username ?? null}
          onSaved={(updated) => {
            setUser((prev) => (prev ? { ...prev, ...updated } : prev));
          }}
        />
      </>
    );
  }

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <Logo href={prefix} />
        <div className="flex items-center gap-3">
          <Link href={`${prefix}/#features`} className="hidden md:inline-flex px-3 py-2 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-100">
            Imkoniyatlar
          </Link>
          <Link href={`${prefix}/#examples`} className="hidden md:inline-flex px-3 py-2 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-100">
            Namunalar
          </Link>
          <Link href={`${prefix}/#pricing`} className="hidden sm:inline-flex px-3 py-2 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-100">
            Narxlar
          </Link>
          <Link href={`${prefix}/#faq`} className="hidden md:inline-flex px-3 py-2 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-100">
            Savol-javob
          </Link>
          <Link href={`${prefix}/login`} className="px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800">
            Kirish
          </Link>
        </div>
      </div>
    </header>
  );
}
