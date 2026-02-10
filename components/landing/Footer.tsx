import Link from 'next/link';
import { Container } from '@/components/ui/Container';
import { Github, Twitter, Instagram, Youtube } from 'lucide-react';
import { FaTelegram } from 'react-icons/fa';

export function Footer() {
  return (
    <footer className="border-t border-slate-800 bg-slate-900 py-12 text-slate-300">
      <Container>
        <div className="mb-12 grid grid-cols-1 gap-12 md:grid-cols-4">
          <div className="col-span-1 md:col-span-1">
            <Link href="/" className="text-2xl font-bold tracking-tight text-white">
              Umari<span className="text-blue-500">.ai</span>
            </Link>
            <p className="mt-4 text-sm leading-relaxed text-slate-400">
              Zamonaviy e-commerce brendlari uchun AI kontent studiya. Listinglarni tezroq va sifatliroq tayyorlang.
            </p>
          </div>

          <div>
            <h4 className="mb-4 font-semibold text-white">Mahsulot</h4>
            <ul className="space-y-2 text-sm">
              <li><Link href="/#features" className="transition-colors hover:text-white">Imkoniyatlar</Link></li>
              <li><Link href="/#examples" className="transition-colors hover:text-white">Namunalar</Link></li>
              <li><Link href="/#pricing" className="transition-colors hover:text-white">Narxlar</Link></li>
              <li><Link href="/#faq" className="transition-colors hover:text-white">Savol-javob</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="mb-4 font-semibold text-white">Kompaniya</h4>
            <ul className="space-y-2 text-sm">
              <li><Link href="/about" className="transition-colors hover:text-white">Biz haqimizda</Link></li>
              <li><Link href="/blog" className="transition-colors hover:text-white">Blog</Link></li>
              <li><Link href="/careers" className="transition-colors hover:text-white">Vakansiyalar</Link></li>
              <li><Link href="/legal" className="transition-colors hover:text-white">Huquqiy</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="mb-4 font-semibold text-white">Ijtimoiy tarmoqlar</h4>
            <div className="flex gap-4">
              <Link href="https://t.me/UmariAI" className="transition-colors hover:text-white"><FaTelegram className="h-5 w-5" /></Link>
              <Link href="#" className="transition-colors hover:text-white"><Youtube className="h-5 w-5" /></Link>
              <Link href="#" className="transition-colors hover:text-white"><Instagram className="h-5 w-5" /></Link>
            </div>
          </div>
        </div>

        <div className="flex flex-col items-center justify-between gap-4 border-t border-slate-800 pt-8 text-xs text-slate-500 md:flex-row">
          <p>&copy; {new Date().getFullYear()} Umari AI. Barcha huquqlar himoyalangan.</p>
          <div className="flex gap-6">
            <Link href="/privacy" className="transition-colors hover:text-white">Maxfiylik siyosati</Link>
            <Link href="/terms" className="transition-colors hover:text-white">Foydalanish shartlari</Link>
          </div>
        </div>
      </Container>
    </footer>
  );
}
