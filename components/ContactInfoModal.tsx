'use client';

import { useMemo, useState } from 'react';
import { FiPhone, FiSend } from 'react-icons/fi';
import { FaTelegramPlane } from 'react-icons/fa';
import { useLanguage } from '@/lib/LanguageContext';

type TabKey = 'phone' | 'telegram';

export function ContactInfoModal(props: {
  open: boolean;
  initialPhone?: string | null;
  initialTelegramUsername?: string | null;
  onSaved: (updated: { phone?: string | null; telegram_username?: string | null }) => void;
}) {
  const { t } = useLanguage();
  const [tab, setTab] = useState<TabKey>('phone');
  const [phoneDigits, setPhoneDigits] = useState(() => {
    const raw = (props.initialPhone || '').toString().trim();
    if (!raw) return '';
    const digits = raw.replace(/\D/g, '');
    if (digits.length === 12 && digits.startsWith('998')) return digits.slice(3);
    return digits;
  });
  const [telegramUsername, setTelegramUsername] = useState((props.initialTelegramUsername || '').toString());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const normalizedTelegram = useMemo(() => {
    const t = telegramUsername.trim();
    if (!t) return '';
    return t.startsWith('@') ? t.slice(1) : t;
  }, [telegramUsername]);

  const normalizedPhone = useMemo(() => {
    const digits = phoneDigits.trim().replace(/\D/g, '');
    if (!digits) return '';
    if (digits.length === 9) return `+998${digits}`;
    if (digits.length === 12 && digits.startsWith('998')) return `+${digits}`;
    return '';
  }, [phoneDigits]);

  const phoneIsValid = useMemo(() => {
    const digits = phoneDigits.trim().replace(/\D/g, '');
    if (!digits) return true;
    if (digits.length === 9) return true;
    if (digits.length === 12 && digits.startsWith('998')) return true;
    return false;
  }, [phoneDigits]);

  const telegramIsValid = useMemo(() => {
    if (!normalizedTelegram) return true;
    return /^[a-zA-Z0-9_]{5,32}$/.test(normalizedTelegram);
  }, [normalizedTelegram]);

  const canSave = useMemo(() => {
    return Boolean(phoneDigits.trim() || normalizedTelegram);
  }, [phoneDigits, normalizedTelegram]);

  const save = async () => {
    setError(null);
    if (!canSave) {
      setError(t('auth.phoneRequired', 'Kamida telefon yoki Telegram talab qilinadi'));
      return;
    }

    if (phoneDigits.trim() && !phoneIsValid) {
      setError(t('auth.phoneInvalid', 'Telefon raqam formati noto‘g‘ri. Masalan: +998901234567'));
      return;
    }

    if (normalizedTelegram && !telegramIsValid) {
      setError(t('auth.telegramInvalid', 'Telegram username noto‘g‘ri. Faqat harf/raqam/_ va uzunligi 5-32 bo‘lsin.'));
      return;
    }

    try {
      setSaving(true);
      const res = await fetch('/api/user/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: normalizedPhone,
          telegram_username: normalizedTelegram,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || t('auth.saveError', 'Saqlashda xatolik'));
        return;
      }

      props.onSaved({
        phone: data?.user?.phone ?? (normalizedPhone || null),
        telegram_username: data?.user?.telegram_username ?? (normalizedTelegram || null),
      });
    } catch {
      setError(t('auth.saveError', 'Saqlashda xatolik'));
    } finally {
      setSaving(false);
    }
  };

  if (!props.open) return null;

  return (
    <div className="fixed inset-0 z-[60]">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

      <div className="absolute inset-0 grid place-items-center p-4">
        <div className="w-full max-w-xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
          <div className="p-6 sm:p-7">
            <h2 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900">
              {t('auth.contactInfo', "Aloqa ma'lumotlari")}
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              {t(
                'auth.contactInfoDescription',
                "Siz bilan aloqa qilish va qo'llab-quvvatlash uchun telefon raqami yoki Telegram username kerak."
              )}
            </p>

            <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-2">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setTab('phone')}
                  className={
                    tab === 'phone'
                      ? 'flex items-center justify-center gap-2 rounded-xl bg-white px-3 py-2 text-sm font-semibold text-slate-900 shadow-sm'
                      : 'flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-slate-600 hover:text-slate-900'
                  }
                >
                  <FiPhone className="h-4 w-4 text-emerald-600" /> {t('auth.phoneTab', 'Telefon')}
                </button>
                <button
                  type="button"
                  onClick={() => setTab('telegram')}
                  className={
                    tab === 'telegram'
                      ? 'flex items-center justify-center gap-2 rounded-xl bg-white px-3 py-2 text-sm font-semibold text-slate-900 shadow-sm'
                      : 'flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-slate-600 hover:text-slate-900'
                  }
                >
                  <FaTelegramPlane className="h-4 w-4 text-blue-600" /> {t('auth.telegramTab', 'Telegram')}
                </button>
              </div>
            </div>

            <div className="mt-5">
              <p className="text-sm font-semibold text-slate-900">{t('auth.preferredContact', "Siz bilan qaysi tarmoq orqali bog'lanishimiz qulay?")}</p>

              <div className="mt-3">
                {tab === 'phone' ? (
                  <div>
                    <label className="block text-sm font-medium text-slate-700">{t('auth.phone', 'Telefon')}</label>
                    <div className="mt-2 flex items-center gap-2">
                      <span className="rounded-xl border border-slate-200 bg-emerald-50 px-3 py-3 text-sm font-semibold text-emerald-700">+998</span>
                      <input
                        value={phoneDigits}
                        onChange={(e) => {
                          const digits = (e.target.value || '').replace(/\D/g, '');
                          // If user pasted full number like +998901234567, keep last 9 digits
                          if (digits.length === 12 && digits.startsWith('998')) {
                            setPhoneDigits(digits.slice(3));
                            return;
                          }
                          setPhoneDigits(digits.slice(0, 9));
                        }}
                        inputMode="numeric"
                        pattern="[0-9]*"
                        autoComplete="tel"
                        placeholder="901234567"
                        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                    <p className="mt-2 text-xs text-slate-500">{t('auth.contactInfoHelp', "9 ta raqam kiriting. Telefon yoki Telegram username dan bittasi yetarli.")}</p>
                  </div>
                ) : (
                  <div>
                    <label className="block text-sm font-medium text-slate-700">{t('auth.telegramUsername', 'Telegram username')}</label>
                    <div className="mt-2 flex items-center gap-2">
                      <span className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-600">@</span>
                      <input
                        value={telegramUsername}
                        onChange={(e) => setTelegramUsername(e.target.value)}
                        placeholder="username"
                        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <p className="mt-2 text-xs text-slate-500">{t('auth.contactInfoHelp', "Telefon yoki Telegram username dan bittasi yetarli.")}</p>
                  </div>
                )}
              </div>

              {error && (
                <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {error}
                </div>
              )}

              <div className="mt-6 flex items-center justify-end">
                <button
                  type="button"
                  onClick={save}
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
                >
                    <FiSend className="h-4 w-4" /> {saving ? t('common.saving', 'Saqlanmoqda…') : t('common.save', 'Saqlash')}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
