'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { FiArrowLeft, FiRefreshCw, FiSearch, FiZap, FiClock } from 'react-icons/fi';

type AiRequestRow = {
  id: string;
  created_at: string;
  service_type: string;
  provider: string;
  model: string | null;
  plan: string | null;
  mode: string | null;
  prompt_words: number;
  prompt_chars: number;
  input_product_images: number;
  input_style_images: number;
  output_images: number;
  total_tokens: number | null;
  user_email: string;
  batch_id: string | null;
  meta: unknown;
};

export default function AdminAiRequestsPage() {
  const [rows, setRows] = useState<AiRequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const fetchRows = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/ai-requests?limit=500&offset=0');
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Yuklashda xatolik');
      setRows(Array.isArray(data?.data) ? data.data : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Yuklashda xatolik');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchRows();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => {
      const model = String(r.model || '').toLowerCase();
      const email = String(r.user_email || '').toLowerCase();
      const provider = String(r.provider || '').toLowerCase();
      const service = String(r.service_type || '').toLowerCase();
      const plan = String(r.plan || '').toLowerCase();
      const mode = String(r.mode || '').toLowerCase();
      return (
        model.includes(q) ||
        email.includes(q) ||
        provider.includes(q) ||
        service.includes(q) ||
        plan.includes(q) ||
        mode.includes(q)
      );
    });
  }, [rows, search]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white">
      <nav className="bg-white/5 backdrop-blur-xl border-b border-white/10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/admin"
              className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 rounded-xl hover:bg-white/20 transition"
            >
              <FiArrowLeft aria-hidden /> Admin
            </Link>
            <div>
              <h1 className="text-2xl font-black inline-flex items-center gap-2">
                <FiZap aria-hidden className="opacity-90" /> AI so'rovlar (token)
              </h1>
              <p className="text-white/50 text-sm">Model, input/output rasm va tokenlar bo'yicha tarix</p>
            </div>
          </div>

          <button
            onClick={fetchRows}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 rounded-xl hover:bg-white/20 transition font-semibold"
          >
            <FiRefreshCw aria-hidden /> Yangilash
          </button>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-200 rounded-xl px-4 py-3">
            {error}
          </div>
        )}

        <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 overflow-hidden">
          <div className="p-6 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="text-white/80 text-sm">{loading ? 'Yuklanmoqda…' : `${filtered.length} ta yozuv`}</div>

            <div className="relative">
              <FiSearch aria-hidden className="absolute left-3 top-1/2 -translate-y-1/2 text-white/50" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Qidirish (model, user, plan, mode)"
                className="w-full sm:w-[360px] pl-10 pr-4 py-2 rounded-xl bg-white/5 border border-white/10 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
          </div>

          {loading ? (
            <div className="p-6 text-white/60">Yuklanmoqda…</div>
          ) : filtered.length === 0 ? (
            <div className="p-6 text-white/60">Ma'lumot topilmadi.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-white/70">
                  <tr className="border-t border-white/10 bg-black/10">
                    <th className="text-left px-6 py-3">Vaqt</th>
                    <th className="text-left px-6 py-3">User</th>
                    <th className="text-left px-6 py-3">Service</th>
                    <th className="text-left px-6 py-3">Model</th>
                    <th className="text-left px-6 py-3">Input</th>
                    <th className="text-left px-6 py-3">Prompt</th>
                    <th className="text-left px-6 py-3">Output</th>
                    <th className="text-right px-6 py-3">Token</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {filtered.map((r) => {
                    const inputTotal = Number(r.input_product_images || 0) + Number(r.input_style_images || 0);
                    return (
                      <tr key={r.id} className="hover:bg-white/5 align-top">
                        <td className="px-6 py-4 text-white/70 whitespace-nowrap">
                          <span className="inline-flex items-center gap-2">
                            <FiClock aria-hidden className="opacity-70" />
                            {new Date(r.created_at).toLocaleString('uz-UZ')}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-white">{r.user_email}</div>
                          <div className="text-white/50 text-xs">{r.plan || '—'} / {r.mode || '—'}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-white">{r.service_type}</div>
                          <div className="text-white/50 text-xs">{r.provider}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-white">{r.model || '—'}</div>
                          {r.batch_id ? <div className="text-white/40 text-xs">batch: {String(r.batch_id).slice(0, 8)}…</div> : null}
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-white">{inputTotal} ta</div>
                          <div className="text-white/50 text-xs">prod: {r.input_product_images} • style: {r.input_style_images}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-white">{r.prompt_words} so'z</div>
                          <div className="text-white/50 text-xs">{r.prompt_chars} belgi</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-white">{r.output_images} rasm</div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="text-white font-semibold">{typeof r.total_tokens === 'number' ? r.total_tokens : '—'}</div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
