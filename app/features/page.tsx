import type { Metadata } from 'next';
import Link from 'next/link';
import { Features } from '@/components/landing/Features';

export const metadata: Metadata = {
  title: 'Imkoniyatlar - Umari AI',
  description: 'Umari AI imkoniyatlari: marketplace rasm, video va copywriter studiya.',
  alternates: { canonical: '/features' },
};

export default function FeaturesPage() {
  return (
    <main className="min-h-screen bg-white">
      <div className="mx-auto max-w-7xl px-4 pt-10 sm:px-6 lg:px-8">
        <Link href="/#features" className="text-sm font-semibold text-blue-700 hover:text-blue-900">
          ← Bosh sahifadagi bo‘lim
        </Link>
      </div>
      <Features />
    </main>
  );
}
