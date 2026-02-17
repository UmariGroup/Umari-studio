'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { FiBarChart2, FiCalendar, FiClock, FiLayers, FiRefreshCw } from 'react-icons/fi';

type ModelSummaryRow = {
  model: string;
  requests: number;
  tokens: number;
};

type PeriodRow = {
  period: string;
  model: string;
  requests: number;
  tokens: number;
};

type ModelStatsResponse = {
  success: boolean;
  generated_at: string;
  totals: {
    total_requests: number;
    total_tokens: number;
    unique_models: number;
  };
  model_summary: ModelSummaryRow[];
  daily: PeriodRow[];
  weekly: PeriodRow[];
  monthly: PeriodRow[];
};

const EMPTY_STATS: ModelStatsResponse = {
  success: true,
  generated_at: '',
  totals: {
    total_requests: 0,
    total_tokens: 0,
    unique_models: 0,
  },
  model_summary: [],
  daily: [],
  weekly: [],
  monthly: [],
};

function formatNumber(value: number): string {
  return new Intl.NumberFormat('uz-UZ').format(value || 0);
}

function PeriodTable({
  title,
  rows,
  hint,
}: {
  title: string;
  rows: PeriodRow[];
  hint: string;
}) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-slate-900">{title}</h3>
          <p className="text-xs text-slate-500">{hint}</p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">Davr</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">Model</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">So'rov</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">Token</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-3 py-5 text-center text-slate-500">
                  Ma'lumot topilmadi
                </td>
              </tr>
            ) : (
              rows.map((row, idx) => (
                <tr key={`${title}-${row.period}-${row.model}-${idx}`} className="hover:bg-slate-50">
                  <td className="px-3 py-2 font-medium text-slate-700">{row.period}</td>
                  <td className="px-3 py-2 text-slate-900">{row.model}</td>
                  <td className="px-3 py-2 font-semibold text-blue-700">{formatNumber(row.requests)}</td>
                  <td className="px-3 py-2 font-semibold text-violet-700">{formatNumber(row.tokens)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default function AdminModelStatisticsPage() {
  const [stats, setStats] = useState<ModelStatsResponse>(EMPTY_STATS);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const loadStats = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/admin/model-stats', { cache: 'no-store' });
      const data = await response.json();

      if (!response.ok || !data?.success) {
        throw new Error(data?.error || "Statistika yuklanmadi");
      }

      setStats(data as ModelStatsResponse);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Statistika yuklanmadi";
      setError(message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void loadStats(false);
  }, []);

  const latestRows = useMemo(() => stats.model_summary.slice(0, 10), [stats.model_summary]);

  if (loading) {
    return (
      <div className="min-h-[50vh] grid place-items-center text-sm text-slate-500">
        Statistika yuklanmoqda...
      </div>
    );
  }

  return (
    <main className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <section className="rounded-3xl border border-slate-200 bg-gradient-to-r from-blue-600 to-violet-600 p-6 text-white shadow-lg">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="inline-flex items-center gap-2 text-2xl font-black">
              <FiBarChart2 /> Model statistikasi
            </h1>
            <p className="mt-1 text-sm text-blue-100">
              Kunlik, haftalik va oylik kesimda model bo'yicha so'rovlar
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/admin"
              className="rounded-lg border border-white/40 bg-white/10 px-3 py-2 text-sm font-semibold text-white hover:bg-white/20"
            >
              Admin panel
            </Link>
            <button
              onClick={() => void loadStats(true)}
              className="inline-flex items-center gap-2 rounded-lg border border-white/40 bg-white/10 px-3 py-2 text-sm font-semibold text-white hover:bg-white/20 disabled:opacity-70"
              disabled={refreshing}
            >
              <FiRefreshCw className={refreshing ? 'animate-spin' : ''} /> Yangilash
            </button>
          </div>
        </div>
      </section>

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>
      ) : null}

      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs text-slate-500">Jami so'rovlar</p>
          <p className="mt-1 text-3xl font-black text-blue-700">{formatNumber(stats.totals.total_requests)}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs text-slate-500">Jami token</p>
          <p className="mt-1 text-3xl font-black text-violet-700">{formatNumber(stats.totals.total_tokens)}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs text-slate-500">Noyob modelllar soni</p>
          <p className="mt-1 text-3xl font-black text-emerald-700">{formatNumber(stats.totals.unique_models)}</p>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 inline-flex items-center gap-2 text-base font-bold text-slate-900">
          <FiLayers className="text-blue-600" /> Eng ko'p ishlatilgan modellar
        </h2>

        <div className="space-y-3">
          {latestRows.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
              Hozircha ma'lumot yo'q
            </div>
          ) : (
            latestRows.map((row) => {
              const maxRequests = Math.max(1, latestRows[0]?.requests || 1);
              const width = Math.max(6, Math.round((row.requests / maxRequests) * 100));
              return (
                <div key={`summary-${row.model}`} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <p className="truncate text-sm font-semibold text-slate-900">{row.model}</p>
                    <p className="text-xs text-slate-500">
                      {formatNumber(row.requests)} so'rov • {formatNumber(row.tokens)} token
                    </p>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                    <div className="h-full rounded-full bg-gradient-to-r from-blue-600 to-violet-600" style={{ width: `${width}%` }} />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <PeriodTable title="Kunlik kesim" rows={stats.daily} hint="Oxirgi 30 kun • model bo'yicha" />
        <PeriodTable title="Haftalik kesim" rows={stats.weekly} hint="Oxirgi 12 hafta • model bo'yicha" />
        <PeriodTable title="Oylik kesim" rows={stats.monthly} hint="Oxirgi 12 oy • model bo'yicha" />
      </section>

      <p className="inline-flex items-center gap-2 text-xs text-slate-500">
        <FiCalendar />
        Yangilangan vaqt: {stats.generated_at ? new Date(stats.generated_at).toLocaleString('uz-UZ') : '-'}
        <FiClock className="ml-2" />
        Manba: token_usage jadvali
      </p>
    </main>
  );
}
