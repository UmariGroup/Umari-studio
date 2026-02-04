'use client';

import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

export type ToastVariant = 'success' | 'error' | 'info';

export interface Toast {
  id: string;
  title?: string;
  message: string;
  variant: ToastVariant;
  durationMs: number;
}

interface ToastContextValue {
  push: (toast: Omit<Toast, 'id'>) => void;
  success: (message: string, title?: string) => void;
  error: (message: string, title?: string) => void;
  info: (message: string, title?: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

function createId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }
}

function variantClasses(variant: ToastVariant): { border: string; bg: string; title: string } {
  switch (variant) {
    case 'success':
      return { border: 'border-green-200', bg: 'bg-green-50', title: 'text-green-900' };
    case 'info':
      return { border: 'border-blue-200', bg: 'bg-blue-50', title: 'text-blue-900' };
    case 'error':
    default:
      return { border: 'border-red-200', bg: 'bg-red-50', title: 'text-red-900' };
  }
}

export default function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const remove = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (toast: Omit<Toast, 'id'>) => {
      const id = createId();
      const durationMs = Number.isFinite(toast.durationMs) ? toast.durationMs : 5000;
      const next: Toast = { id, ...toast, durationMs };

      setToasts((prev) => [...prev, next]);

      window.setTimeout(() => remove(id), durationMs);
    },
    [remove]
  );

  const value = useMemo<ToastContextValue>(() => {
    return {
      push,
      success: (message, title = 'Muvaffaqiyatli') => push({ variant: 'success', title, message, durationMs: 4000 }),
      error: (message, title = 'Xatolik') => push({ variant: 'error', title, message, durationMs: 7000 }),
      info: (message, title = 'Maʼlumot') => push({ variant: 'info', title, message, durationMs: 5000 }),
    };
  }, [push]);

  return (
    <ToastContext.Provider value={value}>
      {children}

      <div className="fixed top-4 right-4 z-[9999] w-[92vw] max-w-sm space-y-3">
        {toasts.map((t) => {
          const c = variantClasses(t.variant);
          return (
            <div
              key={t.id}
              className={`rounded-2xl border ${c.border} ${c.bg} shadow-lg backdrop-blur px-4 py-3`}
              role="status"
              aria-live="polite"
            >
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  {t.title && <div className={`text-sm font-extrabold ${c.title}`}>{t.title}</div>}
                  <div className="text-sm text-slate-700 whitespace-pre-wrap break-words">{t.message}</div>
                </div>
                <button
                  onClick={() => remove(t.id)}
                  className="text-slate-500 hover:text-slate-900 transition"
                  aria-label="Yopish"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M6 6l12 12M18 6L6 18"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                  </svg>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within <ToastProvider />');
  }
  return ctx;
}

