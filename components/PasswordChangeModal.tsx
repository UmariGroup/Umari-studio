'use client';

import { useState } from 'react';
import { useLanguage } from '@/lib/LanguageContext';

export function PasswordChangeModal(props: {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { t } = useLanguage();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleClose = () => {
    setNewPassword('');
    setConfirmPassword('');
    setError(null);
    setSuccess(null);
    props.onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    // Validation
    if (!newPassword || !confirmPassword) {
      setError(t('auth.passwordRequired', 'Barcha maydonlar to\'ldirilishi kerak'));
      return;
    }

    if (newPassword.length < 6) {
      setError(t('auth.passwordTooShort', 'Parol kamida 6 belgi bo\'lishi kerak'));
      return;
    }

    if (newPassword !== confirmPassword) {
      setError(t('auth.passwordMismatch', 'Yangi parollar mos kelmadi'));
      return;
    }



    try {
      setLoading(true);
      const response = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          newPassword,
          confirmPassword,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(data?.error || t('auth.passwordChangeError', 'Parol o\'zgartirishda xatolik'));
        return;
      }

      setSuccess(t('auth.passwordChangeSuccess', 'Parol muvaffaqiyatli o\'zgartirildi'));
      setTimeout(() => {
        handleClose();
        props.onSuccess();
      }, 1500);
    } catch {
      setError(t('auth.passwordChangeError', 'Parol o\'zgartirishda xatolik'));
    } finally {
      setLoading(false);
    }
  };

  if (!props.open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-sm rounded-3xl border border-slate-200 bg-white p-6 shadow-lg">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-slate-900">
            {t("auth.changePassword", "Parolni o'zgartirish")}
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            {t("auth.changePasswordDesc", "Xavfli parolni kerak yangi parolni kiriting")}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* New Password */}
          <div>
            <label className="text-sm font-semibold text-slate-700">
              {t("auth.newPassword", "Yangi parol")}
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="mt-2 w-full rounded-lg border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm focus:border-blue-500 focus:bg-white focus:outline-none"
              placeholder={t("auth.enterNewPassword", "Yangi parolni kiriting")}
              disabled={loading}
            />
          </div>

          {/* Confirm Password */}
          <div>
            <label className="text-sm font-semibold text-slate-700">
              {t("auth.confirmPassword", "Parolni tasdiqlash")}
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="mt-2 w-full rounded-lg border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm focus:border-blue-500 focus:bg-white focus:outline-none"
              placeholder={t("auth.confirmPasswordPlaceholder", "Parolni tasdiqlash")}
              disabled={loading}
            />
          </div>

          {/* Error Message */}
          {error && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-3">
              <p className="text-sm text-rose-700">{error}</p>
            </div>
          )}

          {/* Success Message */}
          {success && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
              <p className="text-sm text-emerald-700">{success}</p>
            </div>
          )}

          {/* Buttons */}
          <div className="mt-6 flex gap-3">
            <button
              type="button"
              onClick={handleClose}
              disabled={loading}
              className="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-center font-semibold text-slate-900 hover:bg-slate-50 disabled:opacity-50"
            >
              {t("common.cancel", "Bekor qilish")}
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2.5 text-center font-semibold text-white hover:shadow-lg disabled:opacity-50"
            >
              {loading ? t("common.saving", "Saqlanmoqda...") : t("common.save", "Saqlash")}
            </button>
          </div>
        </form>

        {/* Close Button */}
        <button
          onClick={handleClose}
          className="absolute right-4 top-4 text-slate-400 hover:text-slate-600"
        >
          <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
