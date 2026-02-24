import { SubscriptionPlan, SUBSCRIPTION_PLANS, normalizeSubscriptionPlan } from './subscription-plans';

const DEFAULT_TELEGRAM_USERNAME = '@UmariAI_admin';

export function getTelegramUsername(): string {
  const configured = process.env.NEXT_PUBLIC_TELEGRAM_SUPPORT_USERNAME;
  const username = String(configured || DEFAULT_TELEGRAM_USERNAME).trim().replace(/^@/, '');
  return username || DEFAULT_TELEGRAM_USERNAME;
}

export function getSubscribeMessage(plan: SubscriptionPlan, durationMonths?: number | null): string {
  const label = SUBSCRIPTION_PLANS[plan]?.labelUz || SUBSCRIPTION_PLANS[plan]?.label || plan;

  const rawMonths = typeof durationMonths === 'number' ? durationMonths : null;
  const months = rawMonths && Number.isFinite(rawMonths) ? Math.max(1, Math.round(rawMonths)) : null;
  if (months) {
    return `Assalomu alaykum men Umari AI da ${months} oylik ${label} tarifini sotib olmoqchi edim`;
  }

  return `Assalomu alaykum men Umari AI da ${label} tarifini sotib olmoqchi edim`;
}

export function getTelegramSubscribeUrl(planInput: unknown, durationMonths?: number | null): string {
  const plan = normalizeSubscriptionPlan(planInput);
  const username = getTelegramUsername();
  const text = encodeURIComponent(getSubscribeMessage(plan, durationMonths));
  return `https://t.me/${username}?text=${text}`;
}
