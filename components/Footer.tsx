'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Footer as LandingFooter } from '@/components/landing/Footer';

export default function Footer() {
  const pathname = usePathname();

  if (pathname === '/') {
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
              AI asosidagi ijodiy studiya. Professional marketplace rasmlari, video ssenariylar,
              copywriting va analitika - hammasi bir joyda.
            </p>
          </div>

          <div>
            <h3 className="mb-4 text-lg font-semibold">Tezkor havolalar</h3>
            <ul className="space-y-2">
              <li><Link href="/marketplace" className="text-gray-300 transition hover:text-white">Market studiya</Link></li>
              <li><Link href="/video-studio" className="text-gray-300 transition hover:text-white">Video studiya</Link></li>
              <li><Link href="/copywriter" className="text-gray-300 transition hover:text-white">Copywriter studiya</Link></li>
              <li><Link href="/analytics" className="text-gray-300 transition hover:text-white">Analitika studiya</Link></li>
              <li><Link href="/chat" className="text-gray-300 transition hover:text-white">AI suhbat</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="mb-4 text-lg font-semibold">Yordam</h3>
            <ul className="space-y-2">
              <li><Link href="/pricing" className="text-gray-300 transition hover:text-white">Narxlar</Link></li>
              <li><a href="#" className="text-gray-300 transition hover:text-white">Qo'llanma</a></li>
              <li><a href="#" className="text-gray-300 transition hover:text-white">Savol-javob</a></li>
              <li><a href="#" className="text-gray-300 transition hover:text-white">Bog'lanish</a></li>
              <li><a href="#" className="text-gray-300 transition hover:text-white">Yordam markazi</a></li>
            </ul>
          </div>
        </div>

        <div className="mt-8 border-t border-gray-800 pt-8">
          <div className="flex flex-col items-center justify-between md:flex-row">
            <div className="text-sm text-gray-400">
              &copy; 2026 Umari AI. Barcha huquqlar himoyalangan.
            </div>
            <div className="mt-4 flex space-x-6 md:mt-0">
              <a href="#" className="text-sm text-gray-400 transition hover:text-white">Maxfiylik siyosati</a>
              <a href="#" className="text-sm text-gray-400 transition hover:text-white">Foydalanish shartlari</a>
              <a href="#" className="text-sm text-gray-400 transition hover:text-white">Cookie-fayllar</a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
