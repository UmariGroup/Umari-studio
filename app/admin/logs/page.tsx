'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import type { IconType } from 'react-icons';
import {
  FiActivity,
  FiArrowLeft,
  FiCheckCircle,
  FiClock,
  FiEdit2,
  FiFileText,
  FiFilter,
  FiKey,
  FiRefreshCw,
  FiSearch,
  FiUserMinus,
  FiUserPlus,
  FiXCircle,
} from 'react-icons/fi';

interface AdminLog {
  id: string;
  admin_id: string;
  admin_email?: string | null;
  action: string;
  target_user_id?: string | null;
  target_user_email?: string | null;
  changes: unknown;
  created_at: string;
}

function getActionMeta(action: string): { label: string; Icon: IconType; badgeClass: string } {
  switch (action) {
    case 'create_admin':
      return { label: "Admin qo'shildi", Icon: FiUserPlus, badgeClass: 'bg-emerald-500/10 text-emerald-200 border-emerald-500/20' };
    case 'delete_admin':
      return { label: "Admin o'chirildi", Icon: FiUserMinus, badgeClass: 'bg-red-500/10 text-red-200 border-red-500/20' };
    case 'password_change':
      return { label: "Parol o'zgartirildi", Icon: FiKey, badgeClass: 'bg-amber-500/10 text-amber-200 border-amber-500/20' };
    case 'user_update':
      return { label: 'Foydalanuvchi yangilandi', Icon: FiEdit2, badgeClass: 'bg-blue-500/10 text-blue-200 border-blue-500/20' };
    case 'ACTIVATE_SUBSCRIPTION':
      return { label: 'Obuna faollashtirildi', Icon: FiCheckCircle, badgeClass: 'bg-emerald-500/10 text-emerald-200 border-emerald-500/20' };
    case 'EXPIRE_SUBSCRIPTION':
      return { label: 'Obuna tugatildi', Icon: FiXCircle, badgeClass: 'bg-red-500/10 text-red-200 border-red-500/20' };
    default:
      return { label: action, Icon: FiActivity, badgeClass: 'bg-gray-500/10 text-gray-200 border-gray-500/20' };
  }
}

export default function AdminLogsPage() {
  const [logs, setLogs] = useState<AdminLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterAction, setFilterAction] = useState<string>('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchLogs();
  }, [filterAction]);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (filterAction !== 'all') params.set('action', filterAction);
      params.set('limit', '500');
      params.set('offset', '0');

      const response = await fetch(`/api/admin/logs?${params.toString()}`);
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(data?.error || "Loglarni yuklashda xatolik");
        return;
      }

      setLogs(Array.isArray(data?.data) ? data.data : []);
    } catch (err) {
      setError("Loglarni yuklashda xatolik");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const filteredLogs = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return logs;

    return logs.filter((log) => {
      const admin = (log.admin_email || log.admin_id || '').toLowerCase();
      const target = (log.target_user_email || log.target_user_id || '').toLowerCase();
      const action = (log.action || '').toLowerCase();
      return admin.includes(q) || target.includes(q) || action.includes(q);
    });
  }, [logs, search]);

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
              <h1 className="text-2xl font-black">Admin loglari</h1>
              <p className="text-white/50 text-sm">Admin harakatlari va audit tarixi</p>
            </div>
          </div>

          <button
            onClick={fetchLogs}
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
            <div className="flex items-center gap-3">
              <FiFileText aria-hidden className="text-white/70" />
              <h2 className="text-lg font-bold">Audit loglar</h2>
              <span className="text-white/50 text-sm">({loading ? '…' : filteredLogs.length})</span>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative">
                <FiSearch aria-hidden className="absolute left-3 top-1/2 -translate-y-1/2 text-white/50" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Qidirish (admin, target, action)"
                  className="w-full sm:w-[320px] pl-10 pr-4 py-2 rounded-xl bg-white/5 border border-white/10 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div className="relative">
                <FiFilter aria-hidden className="absolute left-3 top-1/2 -translate-y-1/2 text-white/50" />
                <select
                  value={filterAction}
                  onChange={(e) => setFilterAction(e.target.value)}
                  className="w-full sm:w-[260px] pl-10 pr-4 py-2 rounded-xl bg-white/5 border border-white/10 focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="all">Barchasi</option>
                  <option value="ACTIVATE_SUBSCRIPTION">Obuna faollashtirish</option>
                  <option value="EXPIRE_SUBSCRIPTION">Obunani tugatish</option>
                  <option value="user_update">Foydalanuvchini yangilash</option>
                  <option value="password_change">Parolni o‘zgartirish</option>
                  <option value="create_admin">Admin qo‘shish</option>
                  <option value="delete_admin">Admin o‘chirish</option>
                </select>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="p-6 text-white/60">Yuklanmoqda…</div>
          ) : filteredLogs.length === 0 ? (
            <div className="p-6 text-white/60">Loglar topilmadi.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-white/70">
                  <tr className="border-t border-white/10 bg-black/10">
                    <th className="text-left px-6 py-3">Harakat</th>
                    <th className="text-left px-6 py-3">Admin</th>
                    <th className="text-left px-6 py-3">Target</th>
                    <th className="text-left px-6 py-3">Vaqt</th>
                    <th className="text-right px-6 py-3">Tafsilot</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {filteredLogs.map((log) => {
                    const meta = getActionMeta(log.action);
                    const ActionIcon = meta.Icon;
                    return (
                      <tr key={log.id} className="hover:bg-white/5 align-top">
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold border ${meta.badgeClass}`}>
                            <ActionIcon aria-hidden className="opacity-90" />
                            <span>{meta.label}</span>
                          </span>
                          <div className="text-white/50 text-xs mt-2">{log.action}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-white">{log.admin_email || log.admin_id}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-white">{log.target_user_email || log.target_user_id || '—'}</div>
                        </td>
                        <td className="px-6 py-4 text-white/70">
                          <span className="inline-flex items-center gap-2">
                            <FiClock aria-hidden className="opacity-70" />
                            {new Date(log.created_at).toLocaleString('uz-UZ')}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <details className="inline-block text-left">
                            <summary className="cursor-pointer select-none text-purple-200 hover:text-purple-100 font-semibold">
                              Ko‘rish
                            </summary>
                            <div className="mt-2 p-3 bg-black/30 rounded-xl border border-white/10 text-xs whitespace-pre-wrap max-w-[520px]">
                              {JSON.stringify(log.changes, null, 2)}
                            </div>
                          </details>
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
