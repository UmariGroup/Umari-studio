import type { Metadata } from 'next';
import Link from 'next/link';
import { FAQ } from '@/components/landing/FAQ';

export const metadata: Metadata = {
  title: 'Savol-javob - Umari AI',
  description: 'Tariflar, tokenlar va foydalanish bo‘yicha ko‘p so‘raladigan savollar.',
  alternates: { canonical: '/faq' },
};

export default function FaqPage() {
  return (
    <main className="min-h-screen bg-white">
      <div className="mx-auto max-w-7xl px-4 pt-10 sm:px-6 lg:px-8">
        <Link href="/#faq" className="text-sm font-semibold text-blue-700 hover:text-blue-900">
          ← Bosh sahifadagi bo‘lim
        </Link>
      </div>
      <FAQ />
    </main>
  );
}
