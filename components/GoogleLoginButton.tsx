'use client';

import React, { useEffect } from 'react';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useToast } from './ToastProvider';

declare global {
  interface Window {
    google: any;
  }
}

export default function GoogleLoginButton({ onSuccess }: { onSuccess?: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const [loading, setLoading] = useState(false);

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
        throw new Error(data.error || 'Google authentication failed');
      }
    } catch (error) {
      console.error('Google login error:', error);
      toast.error("Google orqali kirishda xatolik. Qayta urinib ko'ring.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (typeof window !== 'undefined' && window.google) {
      window.google.accounts.id.initialize({
        client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
        callback: handleCredentialResponse,
      });

      window.google.accounts.id.renderButton(
        document.getElementById('google-signin-button'),
        {
          theme: 'outline',
          size: 'large',
          width: '100%',
          text: 'signin_with',
          locale: 'en',
        }
      );
    }
  }, []);

  return (
    <>
      {/* Google Identity Services Script */}
      <script 
        src="https://accounts.google.com/gsi/client" 
        async 
        defer
      ></script>
      
      <div className="w-full">
        <div id="google-signin-button" className="w-full"></div>
        {loading && (
          <div className="text-center text-sm text-gray-600 mt-2">
            Google orqali kirish...
          </div>
        )}
      </div>
    </>
  );
}
