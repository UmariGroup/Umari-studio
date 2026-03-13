'use client';

import { useEffect, useMemo, useState } from 'react';

type StatusResponse = {
  success: boolean;
  enabled: boolean;
  baseUrl: string;
  connected: boolean;
  expiresAt: string | null;
  error?: string;
};

export default function AdminAmoCrmPage() {
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [pipelines, setPipelines] = useState<any>(null);
  const [pipelinesLoading, setPipelinesLoading] = useState(false);
  const [testLeadLoading, setTestLeadLoading] = useState(false);
  const [testLeadResult, setTestLeadResult] = useState<any>(null);

  const [form, setForm] = useState({
    status_id: '',
    name: 'Test lead from Umari',
    email: '',
    phone: '',
  });

  const connectedLabel = useMemo(() => {
    if (!status) return '...';
    if (!status.enabled) return "O'chirilgan (AMOCRM_ENABLED=false)";
    return status.connected ? 'Ulangan' : 'Ulanmagan';
  }, [status]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch('/api/admin/amocrm/status');
        const data = (await res.json().catch(() => null)) as StatusResponse | null;
        if (!cancelled) setStatus(data);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleConnect = () => {
    window.location.href = '/api/admin/amocrm/oauth/start';
  };

  const loadPipelines = async () => {
    setPipelinesLoading(true);
    setPipelines(null);
    try {
      const res = await fetch('/api/admin/amocrm/pipelines');
      const data = await res.json().catch(() => null);
      setPipelines(data);
    } finally {
      setPipelinesLoading(false);
    }
  };

  const sendTestLead = async () => {
    setTestLeadLoading(true);
    setTestLeadResult(null);
    try {
      const res = await fetch('/api/admin/amocrm/test-lead', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          status_id: Number(form.status_id || 0),
          name: form.name,
          email: form.email,
          phone: form.phone,
        }),
      });
      const data = await res.json().catch(() => null);
      setTestLeadResult({ httpStatus: res.status, ...data });
    } finally {
      setTestLeadLoading(false);
    }
  };

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900">amoCRM</h1>
            <p className="text-sm text-slate-600">Auth • Setup • Debug</p>
          </div>
          <button
            onClick={handleConnect}
            className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
          >
            Ulanish (OAuth)
          </button>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <InfoRow label="Holat" value={loading ? 'Yuklanmoqda...' : connectedLabel} />
          <InfoRow label="Base URL" value={status?.baseUrl || '—'} />
          <InfoRow label="Token muddati" value={status?.expiresAt ? new Date(status.expiresAt).toLocaleString() : '—'} />
          <InfoRow label="Eslatma" value="Redirect URL amoCRM integratsiyada shu callback bo‘lishi kerak." />
        </div>

        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
          Callback URL: <span className="font-mono">/api/admin/amocrm/oauth/callback</span>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-bold text-slate-900">Debug: Pipelines/Statuslar</h2>
          <button
            onClick={loadPipelines}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
            disabled={pipelinesLoading}
          >
            {pipelinesLoading ? 'Yuklanmoqda...' : "Pipelines'ni olish"}
          </button>
        </div>
        <pre className="mt-4 max-h-[360px] overflow-auto rounded-2xl border border-slate-200 bg-slate-950 p-4 text-xs text-slate-100">
          {pipelines ? JSON.stringify(pipelines, null, 2) : '—'}
        </pre>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-base font-bold text-slate-900">Debug: Test lead yuborish</h2>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field
            label="status_id"
            value={form.status_id}
            onChange={(v) => setForm((s) => ({ ...s, status_id: v }))}
            placeholder="Masalan: 123456"
          />
          <Field
            label="name"
            value={form.name}
            onChange={(v) => setForm((s) => ({ ...s, name: v }))}
            placeholder="Lead nomi"
          />
          <Field
            label="email"
            value={form.email}
            onChange={(v) => setForm((s) => ({ ...s, email: v }))}
            placeholder="test@example.com"
          />
          <Field
            label="phone (ixtiyoriy)"
            value={form.phone}
            onChange={(v) => setForm((s) => ({ ...s, phone: v }))}
            placeholder="+998..."
          />
        </div>

        <div className="mt-4 flex items-center gap-3">
          <button
            onClick={sendTestLead}
            disabled={testLeadLoading}
            className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            {testLeadLoading ? 'Yuborilmoqda...' : 'Yuborish'}
          </button>
          <p className="text-sm text-slate-600">Agar `success=false` bo‘lsa, `raw` ni tekshiring.</p>
        </div>

        <pre className="mt-4 max-h-[360px] overflow-auto rounded-2xl border border-slate-200 bg-slate-950 p-4 text-xs text-slate-100">
          {testLeadResult ? JSON.stringify(testLeadResult, null, 2) : '—'}
        </pre>
      </section>
    </main>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-medium text-slate-900 break-words">{value}</p>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="space-y-1">
      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-300"
      />
    </label>
  );
}
