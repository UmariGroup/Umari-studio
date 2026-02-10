import type { Metadata } from 'next';
import Link from 'next/link';
import { ExamplesCarousel } from '@/components/landing/ExamplesCarousel';

export const metadata: Metadata = {
  title: 'Namunalar - Umari AI',
  description: 'Marketplace uchun yaratilgan rasm namunalarini ko‘ring.',
  alternates: { canonical: '/examples' },
};

export default function ExamplesPage() {
  return (
    <main className="min-h-screen bg-white">
      <div className="mx-auto max-w-7xl px-4 pt-10 sm:px-6 lg:px-8">
        <Link href="/#examples" className="text-sm font-semibold text-blue-700 hover:text-blue-900">
          ← Bosh sahifadagi bo‘lim
        </Link>
      </div>
      <ExamplesCarousel />
    </main>
  );
}
