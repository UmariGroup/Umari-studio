'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { FiArrowLeft, FiClock, FiRefreshCw, FiSearch, FiUsers } from 'react-icons/fi';

type InactiveUserRow = {
  id: string;
  user_id: string;
  email: string;
  first_name: string | null;
  subscription_plan: string;
  subscription_status: string;
  tokens_remaining: number;
  threshold_days: number;
  days_without_usage: number;
  purchase_started_at: string;
  last_token_usage_at: string | null;
  status: 'open' | 'resolved';
  first_detected_at: string;
  last_detected_at: string;
  resolved_at: string | null;
};

type ApiResponse = {
  success: boolean;
  data: InactiveUserRow[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
    has_prev: boolean;
    has_next: boolean;
  };
  summary: {
    open_by_threshold: Record<'3' | '7' | '10', number>;
    resolved_by_threshold: Record<'3' | '7' | '10', number>;
  };
  sync: {
    active: number;
    openedOrUpdated: number;
    resolved: number;
    refreshed_at: string;
  } | null;
  error?: string;
};

function formatDate(value: string | null | undefined): string {
  if (!value) return '-';
  try {
    return new Date(value).toLocaleString('uz-UZ');
  } catch {
    return '-';
  }
}

function prettyPlan(plan: string): string {
  if (plan === 'business_plus') return 'Business+';
  if (plan === 'free') return 'Bepul';
  return plan || 'Bepul';
}

export default function AdminInactiveUsersPage() {
  const [rows, setRows] = useState<InactiveUserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<'open' | 'resolved' | 'all'>('open');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [pagination, setPagination] = useState<ApiResponse['pagination'] | null>(null);
  const [summary, setSummary] = useState<ApiResponse['summary'] | null>(null);
  const [sync, setSync] = useState<ApiResponse['sync'] | null>(null);

  const openTotal = useMemo(() => {
    if (!summary) return 0;
    return Number(summary.open_by_threshold['3'] || 0) + Number(summary.open_by_threshold['7'] || 0) + Number(summary.open_by_threshold['10'] || 0);
  }, [summary]);

  const fetchData = async (forceRefresh = false) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('status', status);
      params.set('search', search);
      params.set('page', String(page));
      params.set('limit', String(limit));
      params.set('refresh', forceRefresh ? '1' : '0');

      const response = await fetch(`/api/admin/inactive-users?${params.toString()}`);
      const data = (await response.json()) as ApiResponse;
      if (!response.ok || !data?.success) {
        throw new Error(data?.error || "Ma'lumotni yuklab bo'lmadi");
      }

      setRows(Array.isArray(data.data) ? data.data : []);
      setPagination(data.pagination || null);
      setSummary(data.summary || null);
      setSync(data.sync || null);
    } catch (err: any) {
      setError(err?.message || "Ma'lumotni yuklab bo'lmadi");
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchData(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void fetchData(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, page, limit, search]);

  useEffect(() => {
    setPage(1);
  }, [status, limit, search]);

  return (
    <main className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <header className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/admin"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <FiArrowLeft /> Orqaga
            </Link>
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 text-white">
              <FiClock className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">Token ishlatmaslik nazorati</h1>
              <p className="text-sm text-slate-500">Sotib olgan, lekin 3/7/10 kun token ishlatmagan foydalanuvchilar</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void fetchData(true)}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
          >
            <FiRefreshCw className={loading ? 'animate-spin' : ''} />
            Yangilash
          </button>
        </div>
      </header>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard title="Faol (jami)" value={openTotal} tone="text-amber-700 border-amber-200 bg-amber-50" />
        <SummaryCard title="3 kun" value={summary?.open_by_threshold['3'] || 0} tone="text-blue-700 border-blue-200 bg-blue-50" />
        <SummaryCard title="7 kun" value={summary?.open_by_threshold['7'] || 0} tone="text-violet-700 border-violet-200 bg-violet-50" />
        <SummaryCard title="10 kun" value={summary?.open_by_threshold['10'] || 0} tone="text-rose-700 border-rose-200 bg-rose-50" />
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
          <label className="w-full lg:max-w-sm">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">Qidirish</span>
            <div className="flex items-center gap-2 rounded-xl border border-slate-300 px-3 py-2">
              <FiSearch className="text-slate-400" />
              <input
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    setSearch(searchInput.trim());
                  }
                }}
                placeholder="Email yoki ID"
                className="w-full bg-transparent text-sm outline-none"
              />
            </div>
          </label>

          <label>
            <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">Holat</span>
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value as any)}
              className="rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none"
            >
              <option value="open">Faol</option>
              <option value="resolved">Yopilgan</option>
              <option value="all">Barchasi</option>
            </select>
          </label>

          <label>
            <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">Sahifada</span>
            <select
              value={limit}
              onChange={(event) => setLimit(Number(event.target.value))}
              className="rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none"
            >
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </label>

          <button
            type="button"
            onClick={() => setSearch(searchInput.trim())}
            className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Qo'llash
          </button>
        </div>

        {sync?.refreshed_at && (
          <p className="mt-3 text-xs text-slate-500">
            Oxirgi kuzatuv: {formatDate(sync.refreshed_at)} | Faol: {sync.active} | Yangilandi: {sync.openedOrUpdated} | Yopildi: {sync.resolved}
          </p>
        )}
      </section>

      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        {error && <p className="border-b border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">Foydalanuvchi</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">Tarif</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">Ishlatmagan kun</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">Sotib olingan sana</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">Holati</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-500">Yuklanmoqda...</td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-500">Mos yozuv topilmadi</td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50/70">
                    <td className="px-4 py-3">
                      <Link href={`/admin/users/${row.user_id}`} className="font-semibold text-slate-900 hover:underline">
                        {row.first_name || row.email}
                      </Link>
                      <p className="text-xs text-slate-500">{row.email}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      <div className="font-semibold">{prettyPlan(row.subscription_plan)}</div>
                      <div className="text-xs text-slate-500">faol</div>
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-900">{row.days_without_usage} kun</td>
                    <td className="px-4 py-3 text-slate-600">{formatDate(row.purchase_started_at)}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                          row.status === 'open'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {row.status === 'open' ? 'faol' : 'yopilgan'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col gap-3 border-t border-slate-200 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="text-slate-600">
            Jami: <span className="font-semibold text-slate-900">{pagination?.total || 0}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              disabled={!pagination?.has_prev || loading}
              className="rounded-lg border border-slate-300 px-3 py-1.5 font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Oldingi
            </button>
            <span className="text-slate-600">
              {pagination?.page || 1} / {pagination?.pages || 1}
            </span>
            <button
              type="button"
              onClick={() => setPage((prev) => prev + 1)}
              disabled={!pagination?.has_next || loading}
              className="rounded-lg border border-slate-300 px-3 py-1.5 font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Keyingi
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}

function SummaryCard({
  title,
  value,
  tone,
}: {
  title: string;
  value: number;
  tone: string;
}) {
  return (
    <article className={`rounded-2xl border p-4 ${tone}`}>
      <p className="text-xs font-semibold uppercase tracking-wide">{title}</p>
      <p className="mt-1 text-2xl font-black">{value}</p>
      <div className="mt-2 inline-flex items-center gap-1 text-xs opacity-80">
        <FiUsers className="h-3.5 w-3.5" /> kuzatuvda
      </div>
    </article>
  );
}

