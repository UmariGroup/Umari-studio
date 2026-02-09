'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from './ToastProvider';
import { loadGoogleIdentityScript } from '../lib/googleIdentity';

declare global {
  interface Window {
    google: any;
  }
}

export default function GoogleLoginButton({ onSuccess }: { onSuccess?: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const renderedRef = useRef(false);

  const handleCredentialResponse = async (response: any) => {
    setLoading(true);
    try {
      const res = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential: response.credential }),
      });

      const data = await res.json();

      if (data.success) {
        if (onSuccess) {
          onSuccess();
        }
        // Redirect based on role
        if (data.user.role === 'admin') {
          router.push('/admin');
        } else {
          router.push('/dashboard');
        }
      } else {
        throw new Error(data.error || 'Google orqali kirish amalga oshmadi');
      }
    } catch (error) {
      console.error('Google login error:', error);
      toast.error("Google orqali kirishda xatolik. Qayta urinib ko'ring.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    const el = containerRef.current;
    if (!el) return;

    if (!clientId) {
      toast.error('Google OAuth sozlanmagan: NEXT_PUBLIC_GOOGLE_CLIENT_ID yo\'q.');
      return;
    }

    if (renderedRef.current) return;

    let cancelled = false;
    loadGoogleIdentityScript()
      .then(() => {
        if (cancelled) return;
        if (!window.google?.accounts?.id) throw new Error('Google Identity Services mavjud emas');

        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: handleCredentialResponse,
        });

        // Ensure clean re-render in dev/strict mode.
        el.innerHTML = '';
        window.google.accounts.id.renderButton(el, {
          theme: 'outline',
          size: 'large',
          width: '100%',
          text: 'signin_with',
          locale: 'uz',
        });

        renderedRef.current = true;
      })
      .catch((err) => {
        console.error('Failed to init Google login:', err);
      });

    return () => {
      cancelled = true;
    };
  }, [toast]);

  return (
    <div className="w-full">
      <div ref={containerRef} className="w-full" />
      {loading && (
        <div className="text-center text-sm text-gray-600 mt-2">
          Google orqali kirish...
        </div>
      )}
    </div>
  );
}
