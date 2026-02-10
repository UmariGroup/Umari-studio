'use client';

import { useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import GoogleLoginButton from '../../components/GoogleLoginButton';

export default function RegisterPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleRegister = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (formData.password !== formData.confirmPassword) {
      setError('Parollar mos kelmadi');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          first_name: formData.first_name,
          last_name: formData.last_name,
          email: formData.email,
          password: formData.password,
        }),
      });

      const data = await response.json();

      if (data.success) {
        router.push('/login?registered=true');
      } else {
        setError(data.message || "Ro'yxatdan o'tish amalga oshmadi");
      }
    } catch {
      setError('Xatolik yuz berdi. Qayta urinib ko\'ring.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white px-4 flex items-center justify-center">
      <div className="w-full max-w-md">
        <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-lg">
          <div className="mb-8 text-center">
            <div className="mb-4 flex items-center justify-center">
              <div className="mr-3 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600">
                <span className="text-2xl font-bold text-white">U</span>
              </div>
              <span className="text-2xl font-bold text-gray-900">Umari AI</span>
            </div>
            <h1 className="mb-2 text-2xl font-bold text-gray-900">Ro'yxatdan o'tish</h1>
            <p className="text-gray-600">AI studiya imkoniyatlarini ishga tushiring</p>
          </div>

          {error ? (
            <div className="mb-6 rounded-lg border border-red-500/50 bg-red-500/20 p-4">
              <p className="text-sm text-red-300">{error}</p>
            </div>
          ) : null}

          <div className="mb-6">
            <GoogleLoginButton />
          </div>

          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-600" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="bg-transparent px-2 text-gray-400">yoki email bilan</span>
            </div>
          </div>

          <form onSubmit={handleRegister} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">Ism</label>
                <input
                  type="text"
                  name="first_name"
                  value={formData.first_name}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:outline-none"
                  placeholder="Ism"
                  required
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">Familiya</label>
                <input
                  type="text"
                  name="last_name"
                  value={formData.last_name}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:outline-none"
                  placeholder="Familiya"
                  required
                />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Email</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                className="w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:outline-none"
                placeholder="email@manzil.com"
                required
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Parol</label>
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                className="w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:outline-none"
                placeholder="Yangi parol"
                required
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Parolni tasdiqlang</label>
              <input
                type="password"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                className="w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:outline-none"
                placeholder="Parolni qayta kiriting"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mt-6 w-full rounded-lg bg-blue-600 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? "Ro'yxatdan o'tkazilmoqda..." : "Ro'yxatdan o'tish"}
            </button>
          </form>

          <div className="mt-6 text-center text-gray-400">
            <p>
              Allaqachon akkauntingiz bormi?{' '}
              <Link href="/login" className="text-blue-600 hover:text-blue-700">
                Kirish
              </Link>
            </p>
          </div>

          <div className="mt-4 border-t border-white/20 pt-4">
            <p className="text-center text-xs text-gray-500">
              Ro'yxatdan o'tish orqali siz{' '}
              <a href="#" className="text-blue-600 hover:text-blue-700">Foydalanish shartlari</a>
              {' '}va{' '}
              <a href="#" className="text-blue-600 hover:text-blue-700">Maxfiylik siyosati</a>
              {' '}ga rozilik bildirasiz.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
