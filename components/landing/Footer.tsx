'use client';

import Link from 'next/link';
import { Container } from '@/components/ui/Container';
import { Instagram, Youtube } from 'lucide-react';
import { FaTelegram } from 'react-icons/fa';
import { useLanguage } from '@/lib/LanguageContext';

export default function Footer() {
  const { t, language } = useLanguage();
  const prefix = language === 'ru' ? '/ru' : '/uz';

  return (
    <footer className="border-t border-slate-800 bg-slate-900 py-12 text-slate-300">
      <Container>
        <div className="mb-12 grid grid-cols-1 gap-12 md:grid-cols-4">
          <div className="col-span-1 md:col-span-1">
            <Link href={prefix} className="text-2xl font-bold tracking-tight text-white">
             <Image src="/favicon.ico" alt="Umari AI Logo" width={40} height={40} className="inline-block mr-2" />
            </Link>
            <p className="mt-4 text-sm leading-relaxed text-slate-400">
              {t('footer.description')}
            </p>
          </div>

          <div>
            <h4 className="mb-4 font-semibold text-white">{t('footer.product')}</h4>
            <ul className="space-y-2 text-sm">
              <li><Link href={`${prefix}/#features`} className="transition-colors hover:text-white">{t('nav.features')}</Link></li>
              <li><Link href={`${prefix}/#examples`} className="transition-colors hover:text-white">{t('nav.examples')}</Link></li>
              <li><Link href={`${prefix}/#pricing`} className="transition-colors hover:text-white">{t('nav.pricing')}</Link></li>
              <li><Link href={`${prefix}/#faq`} className="transition-colors hover:text-white">{t('nav.faq')}</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="mb-4 font-semibold text-white">{t('footer.company')}</h4>
            <ul className="space-y-2 text-sm">
              <li><Link href={`${prefix}/about`} className="transition-colors hover:text-white">{t('footer.about')}</Link></li>
              <li><Link href={`${prefix}/blog`} className="transition-colors hover:text-white">{t('footer.blog')}</Link></li>
              <li><Link href={`${prefix}/careers`} className="transition-colors hover:text-white">{t('footer.careers')}</Link></li>
              <li><Link href={`${prefix}/legal`} className="transition-colors hover:text-white">{t('footer.legal')}</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="mb-4 font-semibold text-white">{t('footer.social')}</h4>
            <div className="flex gap-4">
              <Link href="https://t.me/UmariAI" className="transition-colors hover:text-white"><FaTelegram className="h-5 w-5" /></Link>
              <Link href="#" className="transition-colors hover:text-white"><Youtube className="h-5 w-5" /></Link>
              <Link href="#" className="transition-colors hover:text-white"><Instagram className="h-5 w-5" /></Link>
            </div>
          </div>
        </div>

        <div className="flex flex-col items-center justify-between gap-4 border-t border-slate-800 pt-8 text-xs text-slate-500 md:flex-row">
          <p>&copy; {new Date().getFullYear()} Umari AI. {t('footer.allRights')}</p>
          <div className="flex gap-6">
            <Link href={`${prefix}/privacy`} className="transition-colors hover:text-white">{t('footer.privacy')}</Link>
            <Link href={`${prefix}/terms`} className="transition-colors hover:text-white">{t('footer.terms')}</Link>
          </div>
        </div>
      </Container>
    </footer>
  );
}
