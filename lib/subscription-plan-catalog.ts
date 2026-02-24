import { normalizeSubscriptionPlan, type SubscriptionPlan } from '@/lib/subscription-plans';

export type DbSubscriptionPlanRow = {
  id: string;
  name: string;
  duration_months: number;
  price: number;
  discount_percent?: number | null;
  tokens_included: number;
  features: unknown;
  description: string | null;
  is_active?: boolean;
};

export function planSlugFromDbName(name: unknown): SubscriptionPlan | null {
  const slug = normalizeSubscriptionPlan(name);
  if (slug === 'free') return null;
  return slug;
}

export function durationLabelUz(durationMonths: number): string {
  const m = Number(durationMonths) || 1;
  if (m === 12) return '1 yil';
  if (m === 1) return '1 oy';
  return `${m} oy`;
}

export function safeDiscountPercent(value: unknown): number {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, n));
}

/**
 * Price in DB is treated as the current (charged) price.
 * Old price is derived from discount_percent: old = price / (1 - d).
 */
export function computeOldPrice(currentPrice: number, discountPercent: unknown): number | null {
  const price = Number(currentPrice);
  const d = safeDiscountPercent(discountPercent);
  if (!Number.isFinite(price) || price <= 0) return null;
  if (d <= 0 || d >= 100) return null;
  const old = price / (1 - d / 100);
  return Number.isFinite(old) ? old : null;
}

export function featuresToList(features: unknown): string[] {
  if (!features) return [];
  if (Array.isArray(features)) return features.map(String).filter(Boolean);
  if (typeof features === 'string') {
    try {
      const parsed = JSON.parse(features);
      if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean);
    } catch {
      return features
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean);
    }
  }
  return [];
}

export function pickPlanForDuration(
  rows: DbSubscriptionPlanRow[],
  slug: SubscriptionPlan,
  durationMonths: number
): DbSubscriptionPlanRow | null {
  const list = rows
    .map((p) => ({ row: p, s: planSlugFromDbName(p.name) }))
    .filter((p) => p.s === slug)
    .map((p) => p.row);

  if (list.length === 0) return null;

  const exact = list.find((p) => Number(p.duration_months) === Number(durationMonths));
  if (exact) return exact;

  // Fallback priority: 1 month, then smallest duration.
  const monthly = list.find((p) => Number(p.duration_months) === 1);
  if (monthly) return monthly;

  const sorted = [...list].sort((a, b) => Number(a.duration_months) - Number(b.duration_months));
  return sorted[0] || null;
}

export function availableDurations(rows: DbSubscriptionPlanRow[]): number[] {
  const set = new Set<number>();
  for (const r of rows) {
    const m = Number(r.duration_months);
    if (Number.isFinite(m) && m > 0) set.add(m);
  }
  const preferred = [1, 3, 6, 12];
  const fromDb = Array.from(set);
  const ordered = [...preferred.filter((m) => set.has(m)), ...fromDb.filter((m) => !preferred.includes(m))];
  return ordered.length > 0 ? ordered : [1];
}
