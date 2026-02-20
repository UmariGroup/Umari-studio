'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Navbar } from '@/components/landing/Navbar';
import { ContactInfoModal } from '@/components/ContactInfoModal';
import Image from 'next/image';
import { useLanguage } from '@/lib/LanguageContext';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';

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
    <Link href={href} className="inline-flex flex flex-row items-center gap-3">
     <Image src="/favicon.ico" alt="Umari AI Logo" width={32} height={32} className="inline-block" />
      <span className="font-bold text-lg text-slate-900">Umari AI</span>

    </Link>
  );
}

export default function Header() {
  const router = useRouter();
  const pathname = usePathname();
  const { t, language } = useLanguage();
  const lang = getLangFromPathname(pathname) ?? 'uz';
  const prefix = `/${lang}`;
  const strippedPathname = stripLocalePrefix(pathname);
  const [user, setUser] = useState<User | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const planLabel = (plan: string): string => {
    const p = (plan || '').toString().trim().toLowerCase();
    if (p === 'starter') return t('plan.starter', 'Starter');
    if (p === 'pro') return t('plan.pro', 'Pro');
    if (p === 'business_plus' || p === 'business+') return t('plan.businessPlus', 'Business+');
    if (p === 'free') return t('plan.free', language === 'ru' ? 'Бесплатно' : 'Bepul');
    return plan;
  };

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
  const isActivePath = (targetPath: string): boolean =>
    strippedPathname === targetPath || strippedPathname.startsWith(`${targetPath}/`);

  // Admin routes have their own header.
  if (strippedPathname?.startsWith('/admin')) {
    return null;
  }

  if (isMarketing) {
    return <Navbar />;
  }

  if (isAuthenticated) {
    const navItems = [
      { href: `${prefix}/dashboard`, label: t('nav.dashboard', 'Boshqaruv'), active: isActivePath('/dashboard') },
      { href: `${prefix}/marketplace`, label: t('nav.marketplace', 'Market studiya'), active: isActivePath('/marketplace') },
      { href: `${prefix}/infografika`, label: t('nav.infografika', 'Infografika'), active: isActivePath('/infografika') },
      { href: `${prefix}/video-studio`, label: t('nav.videoStudio', 'Video studiya'), active: isActivePath('/video-studio') },
      { href: `${prefix}/copywriter`, label: t('nav.copywriter', 'Copywriter studiya'), active: isActivePath('/copywriter') },
    ];

    return (
      <>
        <header className="fixed left-0 right-0 top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
            <Logo href={prefix} />

          <nav className="hidden md:flex items-center gap-2 text-sm">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`px-3 py-2 rounded-lg transition ${
                  item.active
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-slate-700 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                {item.label}
              </Link>
            ))}
            {user?.role === 'admin' && (
              <Link
                href={`${prefix}/admin`}
                className={`px-3 py-2 rounded-lg transition ${
                  isActivePath('/admin')
                    ? 'bg-blue-100 text-blue-800'
                    : 'text-blue-700 hover:text-blue-900 hover:bg-blue-50'
                }`}
              >
                Admin
              </Link>
            )}
          </nav>

          <div className="hidden md:flex items-center gap-3">
            <LanguageSwitcher />
            <div className="px-3 py-2 rounded-lg border border-slate-200 text-xs text-slate-600">
              <span className="font-semibold text-slate-800">{planLabel(plan)}</span>
              <span className="mx-2">|</span>
              <span>
                {tokens} {t('common.token', language === 'ru' ? 'токен' : 'token')}
              </span>
            </div>
            <button
              onClick={handleLogout}
              className="px-4 py-2 rounded-lg border border-rose-200 text-rose-700 hover:bg-rose-50 text-sm font-semibold"
            >
              {t('common.logout', 'Chiqish')}
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
                <div className="py-2">
                  <LanguageSwitcher />
                </div>
                {navItems.map((item) => (
                  <Link
                    key={`mobile-${item.href}`}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`px-2 py-2 rounded ${
                      item.active ? 'bg-blue-50 text-blue-700' : 'hover:bg-slate-100'
                    }`}
                  >
                    {item.label}
                  </Link>
                ))}
                {user?.role === 'admin' && (
                  <Link
                    href={`${prefix}/admin`}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`px-2 py-2 rounded ${
                      isActivePath('/admin') ? 'bg-blue-100 text-blue-800' : 'text-blue-700 hover:bg-blue-50'
                    }`}
                  >
                    Admin
                  </Link>
                )}
                <button
                  onClick={handleLogout}
                  className="mt-2 px-3 py-2 rounded-lg border border-rose-200 text-rose-700 text-left"
                >
                  {t('common.logout', 'Chiqish')}
                </button>
              </div>
            </div>
          )}
        </header>
        <div className="h-16" />

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
          <LanguageSwitcher />
          <Link href={`${prefix}/#features`} className="hidden md:inline-flex px-3 py-2 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-100">
            {t('nav.features', 'Imkoniyatlar')}
          </Link>
          <Link href={`${prefix}/#examples`} className="hidden md:inline-flex px-3 py-2 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-100">
            {t('nav.examples', 'Namunalar')}
          </Link>
          <Link href={`${prefix}/#pricing`} className="hidden sm:inline-flex px-3 py-2 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-100">
            {t('nav.pricing', 'Narxlar')}
          </Link>
          <Link href={`${prefix}/#faq`} className="hidden md:inline-flex px-3 py-2 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-100">
            {t('nav.faq', 'Savol-javob')}
          </Link>
          <Link href={`${prefix}/login`} className="px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800">
            {t('nav.login', 'Kirish')}
          </Link>
        </div>
      </div>
    </header>
  );
}
