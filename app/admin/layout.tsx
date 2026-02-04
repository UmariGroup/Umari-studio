/**
 * Admin Layout
 * Protected layout for all admin routes
 */

'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();

  useEffect(() => {
    // Verify user is logged in and is admin
    const verifyAdmin = async () => {
      try {
        const response = await fetch('/api/auth/me');
        const data = await response.json();

        if (!response.ok || data.user?.role !== 'admin') {
          router.push('/login');
        }
      } catch (error) {
        router.push('/login');
      }
    };

    verifyAdmin();
  }, [router]);

  return <>{children}</>;
}
