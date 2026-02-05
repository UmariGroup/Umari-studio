'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  FiArrowLeft,
  FiCheck,
  FiEdit2,
  FiEye,
  FiEyeOff,
  FiPlus,
  FiSave,
  FiX,
} from 'react-icons/fi';

type Plan = {
  id: string;
  name: string;
  duration_months: number;
  price: number;
  tokens_included: number;
  features: unknown;
  description: string | null;
  is_active?: boolean;
};

function featuresToText(features: unknown): string {
  if (!features) return '';
  if (Array.isArray(features)) return features.map(String).join('\n');
  if (typeof features === 'string') {
    try {
      const parsed = JSON.parse(features);
      if (Array.isArray(parsed)) return parsed.map(String).join('\n');
    } catch {
      return features;
    }
  }
  return '';
}

function textToFeatures(text: string): string[] {
  return text
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
}

export default function SubscriptionPlansAdminPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Plan | null>(null);

  const [formName, setFormName] = useState('');
  const [formDuration, setFormDuration] = useState(1);
  const [formPrice, setFormPrice] = useState(9);
  const [formTokens, setFormTokens] = useState(150);
  const [formDescription, setFormDescription] = useState('');
  const [formFeaturesText, setFormFeaturesText] = useState('');

  useEffect(() => {
    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/subscriptions/plans?all=1');
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || 'Failed to fetch plans');
      setPlans(data.plans || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to fetch plans');
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => {
    setEditing(null);
    setFormName('');
    setFormDuration(1);
    setFormPrice(9);
    setFormTokens(150);
    setFormDescription('');
    setFormFeaturesText('');
    setShowForm(true);
  };

  const openEdit = (plan: Plan) => {
    setEditing(plan);
    setFormName(plan.name || '');
    setFormDuration(Number(plan.duration_months) || 1);
    setFormPrice(Number(plan.price) || 0);
    setFormTokens(Number(plan.tokens_included) || 0);
    setFormDescription(plan.description || '');
    setFormFeaturesText(featuresToText(plan.features));
    setShowForm(true);
  };

  const save = async () => {
    setError(null);
    try {
      if (!formName.trim()) throw new Error('Name required');
      if (!formDuration || formDuration < 0) throw new Error('Duration invalid');
      if (formPrice < 0) throw new Error('Price invalid');
      if (!formTokens || formTokens < 0) throw new Error('Tokens invalid');

      const payload = {
        name: formName.trim(),
        duration_months: Number(formDuration),
        price: Number(formPrice),
        tokens_included: Number(formTokens),
        description: formDescription.trim(),
        features: textToFeatures(formFeaturesText),
      };

      const res = await fetch('/api/subscriptions/plans', {
        method: editing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editing ? { id: editing.id, ...payload } : payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Save failed');

      setShowForm(false);
      setEditing(null);
      await fetchPlans();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    }
  };

  const setActive = async (plan: Plan, active: boolean) => {
    setError(null);
    try {
      const res = await fetch('/api/subscriptions/plans', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: plan.id, is_active: active }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Update failed');
      await fetchPlans();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Update failed');
    }
  };

  const sortedPlans = useMemo(() => {
    const copy = [...plans];
    copy.sort((a, b) => Number(a.price) - Number(b.price));
    return copy;
  }, [plans]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white">
      <nav className="bg-white/5 backdrop-blur-xl border-b border-white/10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/admin"
              className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 rounded-xl hover:bg-white/20 transition"
            >
              <FiArrowLeft /> Admin
            </Link>
            <div>
              <h1 className="text-2xl font-black">Tariflar (DB)</h1>
              <p className="text-white/50 text-sm">Pricing page shu jadvaldan oladi</p>
            </div>
          </div>

          <button
            onClick={openCreate}
            className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl font-semibold hover:from-purple-600 hover:to-pink-600"
          >
            <FiPlus /> Yangi tarif
          </button>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {error && (
          <div className="mb-6 bg-red-500/10 border border-red-500/20 text-red-200 rounded-xl px-4 py-3">
            {error}
          </div>
        )}

        <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 overflow-hidden">
          <div className="p-6 flex items-center justify-between">
            <h2 className="text-lg font-bold">Tariflar ro'yxati</h2>
            <button
              onClick={fetchPlans}
              className="px-4 py-2 bg-white/10 rounded-xl hover:bg-white/20 transition font-semibold"
            >
              Yangilash
            </button>
          </div>

          {loading ? (
            <div className="p-6 text-white/60">Yuklanmoqda...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-white/70">
                  <tr className="border-t border-white/10 bg-black/10">
                    <th className="text-left px-6 py-3">Nomi</th>
                    <th className="text-left px-6 py-3">Narx</th>
                    <th className="text-left px-6 py-3">Token</th>
                    <th className="text-left px-6 py-3">Muddat</th>
                    <th className="text-left px-6 py-3">Holat</th>
                    <th className="text-right px-6 py-3">Amallar</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {sortedPlans.map((plan) => {
                    const active = plan.is_active !== false;
                    return (
                      <tr key={plan.id} className="hover:bg-white/5">
                        <td className="px-6 py-4">
                          <div className="font-semibold text-white">{plan.name}</div>
                          <div className="text-white/50 text-xs">{plan.description || '—'}</div>
                        </td>
                        <td className="px-6 py-4">${Number(plan.price).toFixed(2)}</td>
                        <td className="px-6 py-4">{plan.tokens_included}</td>
                        <td className="px-6 py-4">{plan.duration_months} oy</td>
                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold border ${
                              active
                                ? 'bg-emerald-500/10 text-emerald-200 border-emerald-500/20'
                                : 'bg-gray-500/10 text-gray-300 border-gray-500/20'
                            }`}
                          >
                            <FiCheck className="opacity-80" />
                            {active ? 'Active' : 'Disabled'}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => openEdit(plan)}
                              className="inline-flex items-center gap-2 px-3 py-2 bg-white/10 rounded-xl hover:bg-white/20 transition"
                            >
                              <FiEdit2 /> Tahrirlash
                            </button>

                            {active ? (
                              <button
                                onClick={() => setActive(plan, false)}
                                className="inline-flex items-center gap-2 px-3 py-2 bg-red-500/20 text-red-200 rounded-xl hover:bg-red-500/30 transition"
                              >
                                <FiEyeOff /> O'chirish
                              </button>
                            ) : (
                              <button
                                onClick={() => setActive(plan, true)}
                                className="inline-flex items-center gap-2 px-3 py-2 bg-emerald-500/20 text-emerald-200 rounded-xl hover:bg-emerald-500/30 transition"
                              >
                                <FiEye /> Yoqish
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {showForm && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="w-full max-w-2xl bg-slate-950 border border-white/10 rounded-2xl overflow-hidden">
              <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
                <h3 className="font-bold text-lg">{editing ? 'Tarifni tahrirlash' : 'Yangi tarif qo\'shish'}</h3>
                <button
                  onClick={() => {
                    setShowForm(false);
                    setEditing(null);
                  }}
                  className="p-2 hover:bg-white/10 rounded-xl transition"
                  aria-label="Close"
                >
                  <FiX />
                </button>
              </div>

              <div className="p-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-white/60">Nomi</label>
                    <input
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      className="mt-1 w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 focus:outline-none focus:ring-2 focus:ring-purple-500"
                      placeholder="Starter / Pro / Business+"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-white/60">Muddat (oy)</label>
                    <input
                      type="number"
                      value={formDuration}
                      onChange={(e) => setFormDuration(Number(e.target.value))}
                      className="mt-1 w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-white/60">Narx ($)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formPrice}
                      onChange={(e) => setFormPrice(Number(e.target.value))}
                      className="mt-1 w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-white/60">Token</label>
                    <input
                      type="number"
                      value={formTokens}
                      onChange={(e) => setFormTokens(Number(e.target.value))}
                      className="mt-1 w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs text-white/60">Description</label>
                  <input
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    className="mt-1 w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="Tez va arzon boshlash uchun"
                  />
                </div>

                <div>
                  <label className="text-xs text-white/60">Features (har qatorda bitta)</label>
                  <textarea
                    value={formFeaturesText}
                    onChange={(e) => setFormFeaturesText(e.target.value)}
                    className="mt-1 w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 focus:outline-none focus:ring-2 focus:ring-purple-500 min-h-[140px]"
                    placeholder="150 token/oy\nImage: Basic+Pro\nVideo: Veo 3 Fast"
                  />
                </div>
              </div>

              <div className="px-6 py-4 border-t border-white/10 flex items-center justify-end gap-2">
                <button
                  onClick={() => {
                    setShowForm(false);
                    setEditing(null);
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 rounded-xl hover:bg-white/20 transition font-semibold"
                >
                  <FiX /> Bekor
                </button>
                <button
                  onClick={save}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl hover:from-purple-600 hover:to-pink-600 transition font-semibold"
                >
                  <FiSave /> Saqlash
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
