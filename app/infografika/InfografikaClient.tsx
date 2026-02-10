'use client';

import { useLanguage } from '@/lib/LanguageContext';

export default function InfografikaClient() {
  const { t } = useLanguage();

  return (
    <div className="relative mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900">{t('infografikaPage.title', 'Infografika')}</h1>
        <p className="mt-2 text-sm text-slate-600">{t('infografikaPage.subtitle', 'Infografika generatori bo‘limi.')}</p>
      </div>

      <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="pointer-events-none select-none opacity-60 blur-sm">
          <div className="p-8 sm:p-10">
            <div className="h-10 w-56 rounded-xl bg-slate-100" />
            <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="h-48 rounded-2xl bg-slate-100" />
              <div className="h-48 rounded-2xl bg-slate-100" />
              <div className="h-48 rounded-2xl bg-slate-100" />
              <div className="h-48 rounded-2xl bg-slate-100" />
            </div>
            <div className="mt-6 h-12 rounded-2xl bg-slate-100" />
          </div>
        </div>

        <div className="absolute inset-0 grid place-items-center p-6">
          <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white/80 p-8 text-center shadow-lg backdrop-blur">
            <p className="text-3xl font-black tracking-tight text-slate-900">{t('infografikaPage.comingSoonTitle', 'Tez kunda')}</p>
            <p className="mt-2 text-sm text-slate-600">{t('infografikaPage.comingSoonBody', "Bu bo‘lim ustida ishlayapmiz. Tez orada ishga tushadi.")}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
