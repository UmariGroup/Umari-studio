/**
 * Admin Layout
 * Protected layout for all admin routes
 */

'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FiLogOut, FiShield } from 'react-icons/fi';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [isVerified, setIsVerified] = useState(false);

  useEffect(() => {
    // Verify user is logged in and is admin
    const verifyAdmin = async () => {
      try {
        const response = await fetch('/api/auth/me');
        const data = await response.json();

        if (!response.ok || data.user?.role !== 'admin') {
          router.push('/login');
          return;
        }

        setIsVerified(true);
      } catch (error) {
        router.push('/login');
      }
    };

    verifyAdmin();
  }, [router]);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } finally {
      router.push('/');
    }
  };

  if (!isVerified) {
    return (
      <div className="min-h-[50vh] grid place-items-center text-sm text-slate-500">
        Yuklanmoqda...
      </div>
    );
  }

  return (
    <>
      <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-blue-600 to-violet-600 text-white">
              <FiShield className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">Umari Admin</p>
              <p className="text-xs text-slate-500">Boshqaruv markazi</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link href="/admin" className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">
              Boshqaruv
            </Link>
            <Link href="/admin/statistics" className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">
              Statistika
            </Link>
            <Link href="/admin/tokens" className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">
              Token qo'shish
            </Link>
            <Link href="/admin/inactive-users" className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">
              Inaktiv userlar
            </Link>
            <Link href="/admin/amocrm" className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">
              amoCRM
            </Link>
            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-2 rounded-lg border border-rose-200 px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50"
            >
              <FiLogOut className="h-4 w-4" /> Chiqish
            </button>
          </div>
        </div>
      </header>

      {children}
    </>
  );
}
