'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Footer as LandingFooter } from '@/components/landing/Footer';
import { useLanguage } from '@/lib/LanguageContext';

function stripLocalePrefix(pathname: string): string {
  const stripped = pathname.replace(/^\/(uz|ru)(?=\/|$)/, '');
  return stripped || '/';
}

export default function Footer() {
  const pathname = usePathname();
  const { t, language } = useLanguage();
  const prefix = language === 'ru' ? '/ru' : '/uz';
  const strippedPathname = stripLocalePrefix(pathname);

  const isMarketing =
    strippedPathname === '/' ||
    strippedPathname === '/features' ||
    strippedPathname === '/examples' ||
    strippedPathname === '/pricing' ||
    strippedPathname === '/faq' ||
    strippedPathname === '/login' ||
    strippedPathname === '/register';

  if (isMarketing) {
    return <LandingFooter />;
  }

  return (
    <footer className="bg-gray-900 text-white">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-4">
          <div className="col-span-1 md:col-span-2">
            <div className="mb-4 flex items-center">
              <div className="mr-3 flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-r from-purple-500 to-pink-500">
                <span className="text-lg font-bold text-white">U</span>
              </div>
              <span className="text-2xl font-bold">Umari AI</span>
            </div>
            <p className="mb-4 max-w-md text-gray-300">
              {t('footerApp.description')}
            </p>
          </div>

          <div>
            <h3 className="mb-4 text-lg font-semibold">{t('footerApp.quickLinks')}</h3>
            <ul className="space-y-2">
              <li><Link href={`${prefix}/marketplace`} className="text-gray-300 transition hover:text-white">{t('nav.marketplace')}</Link></li>
              <li><Link href={`${prefix}/video-studio`} className="text-gray-300 transition hover:text-white">{t('nav.videoStudio')}</Link></li>
              <li><Link href={`${prefix}/copywriter`} className="text-gray-300 transition hover:text-white">{t('nav.copywriter')}</Link></li>
              <li><Link href={`${prefix}/analytics`} className="text-gray-300 transition hover:text-white">{t('footerApp.analytics')}</Link></li>
              <li><Link href={`${prefix}/chat`} className="text-gray-300 transition hover:text-white">{t('nav.chat')}</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="mb-4 text-lg font-semibold">{t('footerApp.help')}</h3>
            <ul className="space-y-2">
              <li><Link href={`${prefix}/pricing`} className="text-gray-300 transition hover:text-white">{t('nav.pricing')}</Link></li>
              <li><a href="#" className="text-gray-300 transition hover:text-white">{t('footerApp.guide')}</a></li>
              <li><Link href={`${prefix}/faq`} className="text-gray-300 transition hover:text-white">{t('nav.faq')}</Link></li>
              <li><a href="#" className="text-gray-300 transition hover:text-white">{t('footerApp.contact')}</a></li>
              <li><a href="#" className="text-gray-300 transition hover:text-white">{t('footerApp.helpCenter')}</a></li>
            </ul>
          </div>
        </div>

        <div className="mt-8 border-t border-gray-800 pt-8">
          <div className="flex flex-col items-center justify-between md:flex-row">
            <div className="text-sm text-gray-400">
              &copy; {new Date().getFullYear()} Umari AI. {t('footer.allRights')}
            </div>
            <div className="mt-4 flex space-x-6 md:mt-0">
              <Link href={`${prefix}/privacy`} className="text-sm text-gray-400 transition hover:text-white">{t('footer.privacy')}</Link>
              <Link href={`${prefix}/terms`} className="text-sm text-gray-400 transition hover:text-white">{t('footer.terms')}</Link>
              <a href="#" className="text-sm text-gray-400 transition hover:text-white">{t('footerApp.cookies')}</a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
