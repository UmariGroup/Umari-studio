export interface ApiErrorBody {
  error?: string;
  code?: string;
  recommended_plan?: string | null;
}

export interface ParsedApiError {
  status: number;
  error: string;
  code?: string;
  recommendedPlan?: string | null;
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
    return {
      status,
      error: stripUpstreamDetails(error),
      code: typeof data?.code === 'string' ? data.code : undefined,
      recommendedPlan: (data as any)?.recommended_plan ?? null,
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
      message: "Serverda xatolik yuz berdi. Birozdan so'ng qayta urinib ko'ring.",
    };
  }

  if (err.status === 400) {
    return { title: "Noto'g'ri so'rov", message: err.error || "Ma'lumotlarni tekshirib, qayta urinib ko'ring." };
  }

  return { title: 'Xatolik', message: err.error || 'Nomaʼlum xatolik.' };
}

