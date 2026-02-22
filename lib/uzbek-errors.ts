export interface ApiErrorBody {
  error?: string;
  code?: string;
  recommended_plan?: string | null;
  retry_after_seconds?: number;
  next_available_at?: string;
  limit?: number;
  window_seconds?: number;
  daily_limit?: number;
  used_today?: number;
  reset_at?: string;
  parallel_limit?: number;
}

export interface ParsedApiError {
  status: number;
  error: string;
  code?: string;
  recommendedPlan?: string | null;
  retryAfterSeconds?: number | null;
  nextAvailableAt?: string | null;
  limit?: number | null;
  windowSeconds?: number | null;
  dailyLimit?: number | null;
  usedToday?: number | null;
  resetAt?: string | null;
  parallelLimit?: number | null;
}

function stripUpstreamDetails(message: string): string {
  if (!message) return '';
  const cut1 = message.split('\nVertex response:')[0];
  const cut2 = cut1.split('\nGemini response:')[0];
  return cut2.length > 450 ? cut2.slice(0, 450) + '…' : cut2;
}

export function planLabelUz(plan: string | null | undefined): string | null {
  if (!plan) return null;
  const p = plan.toString().trim().toLowerCase();
  if (p === 'starter') return 'Starter';
  if (p === 'pro') return 'Pro';
  if (p === 'business_plus' || p === 'business+') return 'Business+';
  return plan.toString();
}

export async function parseApiErrorResponse(res: Response): Promise<ParsedApiError> {
  const status = res.status || 0;

  try {
    const data = (await res.json()) as ApiErrorBody;
    const error = typeof data?.error === 'string' ? data.error : `HTTP ${status}`;
    const retryAfterSecondsRaw = (data as any)?.retry_after_seconds;
    const retryAfterSeconds =
      typeof retryAfterSecondsRaw === 'number' && Number.isFinite(retryAfterSecondsRaw) && retryAfterSecondsRaw > 0
        ? Math.floor(retryAfterSecondsRaw)
        : null;

    const limitRaw = (data as any)?.limit;
    const limit = typeof limitRaw === 'number' && Number.isFinite(limitRaw) ? limitRaw : null;

    const windowSecondsRaw = (data as any)?.window_seconds;
    const windowSeconds =
      typeof windowSecondsRaw === 'number' && Number.isFinite(windowSecondsRaw) ? windowSecondsRaw : null;

    const dailyLimitRaw = (data as any)?.daily_limit;
    const dailyLimit = typeof dailyLimitRaw === 'number' && Number.isFinite(dailyLimitRaw) ? dailyLimitRaw : null;

    const usedTodayRaw = (data as any)?.used_today;
    const usedToday = typeof usedTodayRaw === 'number' && Number.isFinite(usedTodayRaw) ? usedTodayRaw : null;

    const parallelLimitRaw = (data as any)?.parallel_limit;
    const parallelLimit =
      typeof parallelLimitRaw === 'number' && Number.isFinite(parallelLimitRaw) ? parallelLimitRaw : null;

    return {
      status,
      error: stripUpstreamDetails(error),
      code: typeof data?.code === 'string' ? data.code : undefined,
      recommendedPlan: (data as any)?.recommended_plan ?? null,
      retryAfterSeconds,
      nextAvailableAt: typeof (data as any)?.next_available_at === 'string' ? (data as any).next_available_at : null,
      limit,
      windowSeconds,
      dailyLimit,
      usedToday,
      resetAt: typeof (data as any)?.reset_at === 'string' ? (data as any).reset_at : null,
      parallelLimit,
    };
  } catch {
    try {
      const text = await res.text();
      return { status, error: stripUpstreamDetails(text || `HTTP ${status}`) };
    } catch {
      return { status, error: `HTTP ${status}` };
    }
  }
}

export function toUzbekErrorMessage(err: ParsedApiError): { title: string; message: string } {
  const recommended = planLabelUz(err.recommendedPlan);

  const addRecommendation = (base: string) =>
    recommended ? `${base}\n\nTavsiya: ${recommended} tarif.` : base;

  const formatMmSs = (seconds: number): string => {
    const s = Math.max(0, Math.floor(seconds));
    const mm = String(Math.floor(s / 60)).padStart(2, '0');
    const ss = String(s % 60).padStart(2, '0');
    return `${mm}:${ss}`;
  };

  if (err.code === 'UNAUTHORIZED' || err.status === 401) {
    return { title: 'Kirish kerak', message: "Avval tizimga kiring." };
  }

  if (err.code === 'SUBSCRIPTION_EXPIRED') {
    return { title: 'Obuna tugagan', message: addRecommendation("Oylik tarifingiz muddati tugagan. Tarifni qayta faollashtiring.") };
  }

  if (err.code === 'INSUFFICIENT_TOKENS' || err.status === 402) {
    return {
      title: 'Token tugadi',
      message: addRecommendation("Tokenlaringiz yetarli emas. Rejani yangilang yoki yuqori tarifga o'ting."),
    };
  }

  if (err.code === 'PLAN_RESTRICTED') {
    return {
      title: 'Tarif cheklovi',
      message: addRecommendation(err.error || "Bu amal sizning tarifingizda mavjud emas."),
    };
  }

  if (err.code === 'DAILY_LIMIT' && typeof err.retryAfterSeconds === 'number') {
    const limit = typeof err.dailyLimit === 'number' ? err.dailyLimit : null;
    const used = typeof err.usedToday === 'number' ? err.usedToday : null;

    const base =
      limit && used !== null
        ? `Kunlik limit: ${limit} ta. Bugun ishlatilgan: ${used} ta.`
        : "Kunlik limit tugadi.";

    return {
      title: 'Kunlik limit',
      message: `${base}\n\nKeyingi limit: ${formatMmSs(err.retryAfterSeconds)} dan keyin.`,
    };
  }

  if (err.code === 'RATE_LIMIT' && typeof err.retryAfterSeconds === 'number') {
    const limit = typeof err.limit === 'number' ? err.limit : null;
    const windowSec = typeof err.windowSeconds === 'number' ? err.windowSeconds : null;
    const windowMin = windowSec ? Math.max(1, Math.round(windowSec / 60)) : null;

    const base =
      limit && windowMin
        ? `Tarif limiti: ${limit} ta / ${windowMin} minut.`
        : "Tarif limiti: juda tez so'rov yuborildi.";

    return {
      title: 'Kutish kerak',
      message: `${base}\n\nKeyingi generatsiya: ${formatMmSs(err.retryAfterSeconds)} dan keyin.`,
    };
  }

  if (err.status === 429 || (err.error && err.error.includes('429'))) {
    return {
      title: "Juda ko'p so'rov",
      message: "Serverga juda ko'p so'rov yuborildi (429). Biroz kuting va qayta urinib ko'ring.",
    };
  }

  if (err.status === 503 || err.status === 504) {
    return {
      title: 'Xizmat vaqtincha yo‘q',
      message: "Xizmat vaqtincha mavjud emas. Birozdan so'ng qayta urinib ko'ring.",
    };
  }

  if (err.status >= 500) {
    return {
      title: 'Server xatosi',
      message: "Birozdan so'ng qayta urinib ko'ring.",
    };
  }

  if (err.status === 400) {
    return { title: "Noto'g'ri so'rov", message: err.error || "Ma'lumotlarni tekshirib, qayta urinib ko'ring." };
  }

  return { title: 'Xatolik', message: err.error || 'Nomaʼlum xatolik.' };
}
