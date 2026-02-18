'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { FiArrowLeft, FiGift, FiSearch } from 'react-icons/fi';

type UserLite = {
  id: string;
  email: string;
  first_name?: string | null;
  role?: string;
  tokens_remaining?: number;
  tokens_total?: number;
};

export default function AdminTokensPage() {
  const [search, setSearch] = useState('');
  const [users, setUsers] = useState<UserLite[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserLite | null>(null);
  const [tokens, setTokens] = useState('50');
  const [reason, setReason] = useState('');
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const quickAmounts = [25, 50, 100, 250, 500];

  const runSearch = async () => {
    setError('');
    setSuccess('');
    setLoadingSearch(true);
    try {
      const q = search.trim();
      if (!q) {
        setUsers([]);
        return;
      }

      const res = await fetch(`/api/admin/users?search=${encodeURIComponent(q)}&limit=10`);
      const data = await res.json();
      if (!res.ok || !data?.success) {
        setError(data?.error || 'Qidiruvda xatolik');
        setUsers([]);
        return;
      }

      const list = Array.isArray(data.users) ? data.users : [];
      setUsers(list.filter((item: UserLite) => String(item.role || 'user') !== 'admin'));
    } catch {
      setError('Qidiruvda xatolik');
    } finally {
      setLoadingSearch(false);
    }
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    const amount = Number(tokens);
    if (!selectedUser?.id) {
      setError('Avval foydalanuvchini tanlang');
      return;
    }
    if (!Number.isFinite(amount) || !Number.isInteger(amount) || amount <= 0) {
      setError("Token miqdori 0 dan katta bo'lishi kerak");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/admin/tokens/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: selectedUser.id,
          tokens: amount,
          reason,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data?.success) {
        setError(data?.error || "Token qo'shishda xatolik");
        return;
      }

      setSuccess(
        `${data.user?.email} uchun +${data.transaction?.tokens_added} token qo'shildi. Yangi balans: ${data.user?.tokens_remaining}`
      );
      setSelectedUser({
        ...selectedUser,
        tokens_remaining: Number(data.user?.tokens_remaining ?? selectedUser.tokens_remaining ?? 0),
      });
      setReason('');
    } catch {
      setError("Token qo'shishda xatolik");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <header className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link
              href="/admin"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <FiArrowLeft /> Orqaga
            </Link>
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white">
              <FiGift className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">Token qo'shish</h1>
              <p className="text-sm text-slate-500">Admin qo'lda foydalanuvchi balansiga token qo'shadi</p>
            </div>
          </div>
          <Link
            href="/admin/logs"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Loglar
          </Link>
        </div>
      </header>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Email yoki ism bo'yicha qidiring"
            className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500"
          />
          <button
            onClick={runSearch}
            disabled={loadingSearch}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
          >
            <FiSearch /> {loadingSearch ? 'Qidirilmoqda...' : 'Qidirish'}
          </button>
        </div>

        {users.length > 0 && (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {users.map((user) => (
              <button
                key={user.id}
                type="button"
                onClick={() => setSelectedUser(user)}
                className={`rounded-xl border p-3 text-left transition ${
                  selectedUser?.id === user.id
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <p className="text-sm font-semibold text-slate-900">{user.email}</p>
                <p className="text-xs text-slate-500">
                  Joriy balans: {Number(user.tokens_remaining ?? user.tokens_total ?? 0)}
                </p>
              </button>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <form className="space-y-4" onSubmit={submit}>
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Tanlangan foydalanuvchi</label>
            <input
              value={selectedUser?.email || ''}
              readOnly
              placeholder="Qidiruvdan foydalanuvchini tanlang"
              className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-700"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Qo'shiladigan token</label>
              <input
                type="number"
                inputMode="numeric"
                step={1}
                min={1}
                max={1000000}
                value={tokens}
                onChange={(e) => setTokens(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500"
              />
              <div className="mt-2 flex flex-wrap gap-2">
                {quickAmounts.map((amount) => (
                  <button
                    key={amount}
                    type="button"
                    onClick={() => setTokens(String(amount))}
                    className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  >
                    +{amount}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Sabab (ixtiyoriy)</label>
              <input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                maxLength={300}
                placeholder="Masalan: kompensatsiya / bonus"
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {selectedUser?.id && Number.isFinite(Number(tokens)) && Number(tokens) > 0 && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              Yangi balans: {Number(selectedUser.tokens_remaining ?? 0) + Number(tokens)}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            <FiGift /> {submitting ? 'Saqlanmoqda...' : "Token qo'shish"}
          </button>
        </form>

        {error && <p className="mt-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}
        {success && <p className="mt-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</p>}
      </section>
    </main>
  );
}
