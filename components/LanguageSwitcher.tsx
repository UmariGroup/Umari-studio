'use client';

import { useLanguage } from '@/lib/LanguageContext';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

function stripLocalePrefix(pathname: string): string {
  const stripped = pathname.replace(/^\/(uz|ru)(?=\/|$)/, '');
  return stripped || '/';
}

export function LanguageSwitcher() {
  const { language, setLanguage } = useLanguage();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const effectivePathname = stripLocalePrefix(pathname);

  const switchTo = (lang: 'uz' | 'ru') => {
    setLanguage(lang);
    const base = effectivePathname === '/' ? `/${lang}` : `/${lang}${effectivePathname}`;
    const search = searchParams.toString();
    router.push(search ? `${base}?${search}` : base);
  };

  return (
    <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-1">
      <button
        onClick={() => switchTo('uz')}
        className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
          language === 'uz'
            ? 'bg-white text-slate-900 shadow-sm'
            : 'text-slate-600 hover:text-slate-900'
        }`}
      >
        O'z
      </button>
      <button
        onClick={() => switchTo('ru')}
        className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
          language === 'ru'
            ? 'bg-white text-slate-900 shadow-sm'
            : 'text-slate-600 hover:text-slate-900'
        }`}
      >
        Ru
      </button>
    </div>
  );
}
