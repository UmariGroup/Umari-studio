/**
 * Gemini API Service (Generative Language API)
 * Uses API key auth (no Vertex / service account).
 */

import axios from 'axios';
import { checkImagePromptSafety } from '@/lib/content-safety';

type ChatMessage = { role: string; content: string };

const GEMINI_API_KEY =
  process.env.GEMINI_API_KEY ||
  process.env.GOOGLE_API_KEY ||
  process.env.API_KEY ||
  '';

const GEMINI_TEXT_MODEL = process.env.GEMINI_TEXT_MODEL || 'gemini-2.0-flash';
const GEMINI_IMAGE_MODEL = process.env.GEMINI_IMAGE_MODEL || 'gemini-2.5-flash-image';

const GEMINI_RETRY_ATTEMPTS = Math.max(1, Number(process.env.GEMINI_RETRY_ATTEMPTS || 3));
const GEMINI_MAX_CONCURRENT = Math.max(1, Number(process.env.GEMINI_MAX_CONCURRENT || 4));

class Semaphore {
  private available: number;
  private queue: Array<() => void> = [];

  constructor(count: number) {
    this.available = count;
  }

  async acquire(): Promise<void> {
    if (this.available > 0) {
      this.available -= 1;
      return;
    }

    await new Promise<void>((resolve) => {
      this.queue.push(resolve);
    });
  }

  release(): void {
    const next = this.queue.shift();
    if (next) {
      next();
      return;
    }
    this.available += 1;
  }

  async use<T>(fn: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      return await fn();
    } finally {
      this.release();
    }
  }
}

const geminiSemaphore = new Semaphore(GEMINI_MAX_CONCURRENT);

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseRetryAfterMs(value: unknown): number | null {
  if (!value) return null;
  const raw = Array.isArray(value) ? value[0] : value;
  const s = String(raw).trim();
  const seconds = Number(s);
  if (Number.isFinite(seconds) && seconds > 0) return Math.min(60_000, Math.floor(seconds * 1000));
  return null;
}

function requireApiKey(): void {
  if (!GEMINI_API_KEY) {
    throw new Error(
      'Gemini API key is missing. Set GEMINI_API_KEY (or GOOGLE_API_KEY / API_KEY) in .env.local'
    );
  }
}

function assertGeminiModelName(model: string): void {
  const trimmed = (model || '').trim();
  if (!trimmed) {
    throw new Error('Gemini model is empty. Set GEMINI_TEXT_MODEL / GEMINI_IMAGE_MODEL in .env.local');
  }

  // Common misconfig: using Vertex/Imagen IDs with the Gemini API.
  // Validation removed to allow using new models if they become available or hybrid usage.
  /*
  if (trimmed.toLowerCase().startsWith('imagen-')) {
    throw new Error(
      `GEMINI_IMAGE_MODEL is set to '${trimmed}', which is a Vertex/Imagen model id. ` +
      `Gemini API requires Gemini image models like 'gemini-2.5-flash-image' or 'gemini-3-pro-image-preview'.`
    );
  }
  */
}

function normalizeAspectRatio(aspectRatio: string): string {
  const allowed = new Set([
    '1:1',
    '2:3',
    '3:2',
    '3:4',
    '4:3',
    '4:5',
    '5:4',
    '9:16',
    '16:9',
    '21:9',
  ]);
  return allowed.has(aspectRatio) ? aspectRatio : '1:1';
}

function parseDataUrl(dataUrl: string): { mimeType: string; data: string } | null {
  const match = /^data:([^;]+);base64,(.+)$/.exec(dataUrl);
  if (!match) return null;

  let mimeType = match[1];
  const data = match[2];

  // Normalize common variants.
  if (mimeType === 'image/jpg') mimeType = 'image/jpeg';

  return { mimeType, data };
}

function validateInlineImage(mimeType: string, base64: string): void {
  const allowed = new Set(['image/png', 'image/jpeg', 'image/webp']);
  if (!allowed.has(mimeType)) {
    throw new Error(
      `Unsupported image type '${mimeType}'. Please upload PNG/JPEG/WebP images (HEIC/HEIF/AVIF are not supported).`
    );
  }

  // Best-effort size check
  // Relaxed validation: 75KB is definitely fine. Only warn/block if > 9MB (API limit is usually ~10MB for some, 4MB for others).
  // Let's stick to a safe 9MB, but don't throw if small.
  const approxBytes = Math.floor((base64.length * 3) / 4);
  const maxBytesPerImage = 9 * 1024 * 1024;
  if (approxBytes > maxBytesPerImage) {
    throw new Error(
      `Image is too large. Please upload an image under 9MB.`
    );
  }
}

function toInlineDataPart(image: string): { inlineData: { mimeType: string; data: string } } | null {
  const parsed = parseDataUrl(image);
  if (!parsed) return null;
  validateInlineImage(parsed.mimeType, parsed.data);
  return { inlineData: { mimeType: parsed.mimeType, data: parsed.data } };
}

async function geminiGenerateContent(model: string, body: unknown): Promise<any> {
  requireApiKey();
  assertGeminiModelName(model);

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    model
  )}:generateContent`;

  return geminiSemaphore.use(async () => {
    let lastErr: unknown;

    for (let attempt = 1; attempt <= GEMINI_RETRY_ATTEMPTS; attempt++) {
      try {
        const res = await axios.post(url, body, {
          params: { key: GEMINI_API_KEY },
          timeout: 120_000,
        });

        return res.data;
      } catch (error: unknown) {
        lastErr = error;

        if (!axios.isAxiosError(error)) {
          throw error;
        }

        const status = error.response?.status;
        const retryable =
          status === 429 ||
          status === 500 ||
          status === 502 ||
          status === 503 ||
          status === 504;

        if (retryable && attempt < GEMINI_RETRY_ATTEMPTS) {
          const retryAfterMs = parseRetryAfterMs((error.response?.headers as any)?.['retry-after']);
          const expBackoffMs = Math.min(15_000, 750 * Math.pow(2, attempt - 1));
          const jitterMs = Math.floor(Math.random() * 250);
          const waitMs = Math.max(retryAfterMs || 0, expBackoffMs) + jitterMs;
          await sleep(waitMs);
          continue;
        }

        const statusText = error.response?.statusText;
        const data = error.response?.data;

        let details = '';
        try {
          details = typeof data === 'string' ? data : JSON.stringify(data);
        } catch {
          details = '';
        }
        if (details.length > 2500) details = details.slice(0, 2500) + '…';

        const suffix = details ? `\nGemini response: ${details}` : '';
        throw new Error(
          `Gemini API error${status ? ` (${status}${statusText ? ` ${statusText}` : ''})` : ''}: ${error.message}${suffix}`
        );
      }
    }

    throw lastErr;
  });
}

function extractText(response: any): string {
  if (!response) return '';
  if (typeof response.text === 'string') return response.text;

  const parts = response?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return '';

  return parts
    .map((p: any) => (typeof p?.text === 'string' ? p.text : ''))
    .filter(Boolean)
    .join('');
}

function extractFirstImageDataUrl(response: any): string | null {
  const parts = response?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return null;

  for (const part of parts) {
    const inlineData = part?.inlineData || part?.inline_data;
    const mimeType = inlineData?.mimeType || inlineData?.mime_type;
    const data = inlineData?.data;

    if (typeof mimeType === 'string' && typeof data === 'string' && mimeType.startsWith('image/')) {
      return `data:${mimeType};base64,${data}`;
    }
  }

  return null;
}

async function generateText(model: string, systemInstruction: string | null, userText: string): Promise<string> {
  const body: any = {
    contents: [
      {
        role: 'user',
        parts: [{ text: userText }],
      },
    ],
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 2500,
      topP: 0.95,
    },
  };

  if (systemInstruction) {
    body.systemInstruction = { parts: [{ text: systemInstruction }] };
  }

  const response = await geminiGenerateContent(model, body);
  return extractText(response).trim();
}

export async function enhancePrompt(prompt: string, options?: { model?: string }): Promise<string> {
  const model = (options?.model || GEMINI_TEXT_MODEL).trim();

  const systemInstruction =
    'You are an expert ecommerce prompt engineer. Return ONLY the final prompt text, in English. No quotes, no markdown, no extra commentary.';

  const userText =
    `Quyidagi qisqa mahsulot tavsifini professional marketplace promptiga aylantirib ber. ` +
    `Faqat prompt matnini ingliz tilida qaytar:\n\n${prompt}`;

  return generateText(model, systemInstruction, userText);
}

export async function generateMarketplaceImage(
  prompt: string,
  productImages: string[] = [],
  styleImages: string[] = [],
  aspectRatio: string = '1:1',
  options?: { model?: string }
): Promise<string> {
  const promptSafety = checkImagePromptSafety(prompt);
  if (!promptSafety.allowed) {
    throw new Error('PROMPT_POLICY_BLOCKED: 18+ yoki pornografik kontent taqiqlangan');
  }

  const model = (options?.model || GEMINI_IMAGE_MODEL).trim();
  const parts: any[] = [];

  // 1. Instructions
  const hasStyleImages = styleImages.length > 0;

  let finalPrompt = `Task: Generate a high-quality professional marketplace product image.\n`;
  finalPrompt += `Goal: Place the object described in 'Main Product' section into the context/style of 'Style Reference' section.\n`;
  finalPrompt += `CRITICAL: You MUST preserve the identity of the MAIN PRODUCT exactly. \n`;
  finalPrompt += `CRITICAL: Do NOT generate the object shown in the STYLE REFERENCE. Only copy the background, lighting, and composition/pose from the reference.\n`;
  finalPrompt += `User Prompt/Setting: ${prompt}.\n`;

  parts.push({ text: finalPrompt });

  // 2. Add Product Images with explicit label
  if (productImages.length > 0) {
    parts.push({ text: "\n[[MAIN PRODUCT IMAGES - The Object to Generate]]\n" });
    for (const img of productImages) {
      const inlinePart = toInlineDataPart(img);
      if (inlinePart) parts.push(inlinePart);
    }
  }

  // 3. Add Style Images with explicit label
  if (hasStyleImages) {
    parts.push({ text: "\n[[STYLE REFERENCE IMAGES - Copy only background/lighting/context/pose, IGNORE the object itself]]\n" });
    for (const img of styleImages) {
      const inlinePart = toInlineDataPart(img);
      if (inlinePart) parts.push(inlinePart);
    }
  }

  const body = {
    contents: [{ role: 'user', parts }],
    safetySettings: [
      { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_LOW_AND_ABOVE' },
      { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
    ],
    generationConfig: {
      imageConfig: {
        aspectRatio: normalizeAspectRatio(aspectRatio),
      },
    },
  };

  const response = await geminiGenerateContent(model, body);
  const blockReason = response?.promptFeedback?.blockReason;
  if (blockReason) {
    throw new Error(`PROMPT_POLICY_BLOCKED: Blocked by Gemini safety (${blockReason})`);
  }

  const dataUrl = extractFirstImageDataUrl(response);

  if (!dataUrl) {
    const finishReason = response?.candidates?.[0]?.finishReason;
    if (finishReason === 'NO_IMAGE') {
      throw new Error('Model did not return an image (NO_IMAGE). Try a different image model.');
    }
    throw new Error('No image returned from Gemini API.');
  }

  return dataUrl;
}

export async function* generateMarketplaceDescriptionStream(
  images: string[],
  marketplace: string = 'uzum',
  additionalInfo: string = '',
  options?: { model?: string; plan?: string }
): AsyncGenerator<string, void, unknown> {
  const plan = (options?.plan || '').toString().trim().toLowerCase();
  const model = (options?.model || GEMINI_TEXT_MODEL).trim();

  let planRules = '';
  if (plan === 'starter') {
    planRules = `
QO‘SHIMCHA TALABLAR (STARTER):
- Matn qisqa va sodda bo‘lsin (marketplace uchun tayyor).
- FULL_DESC: taxminan 600–900 belgi (UZ va RU alohida).
- SPECS: 6–8 ta band.
- PROPS: 6–8 ta band.
- VIDEO_REC: 1–2 ta qisqa g‘oya.`;
  } else if (plan === 'pro') {
    planRules = `
QO‘SHIMCHA TALABLAR (PRO):
- Matn to‘liq va SEO kuchli bo‘lsin.
- FULL_DESC: taxminan 1200–1800 belgi (UZ va RU alohida).
- SPECS: 10–12 ta band.
- PROPS: 8–12 ta band.
- VIDEO_REC: 3–5 ta g‘oya.`;
  } else if (plan === 'business_plus' || plan === 'business+') {
    planRules = `
QO‘SHIMCHA TALABLAR (BUSINESS+):
- Maksimal detal: agency/katalog darajasida yozing.
- NAME: 2 ta variant bering (1) Short (2) SEO (UZ va RU ichida ham).
- FULL_DESC: taxminan 2000–3500 belgi (UZ va RU alohida).
- SPECS: 15–20 ta band.
- PROPS: 8–12 ta band.
- VIDEO_REC: 4–6 ta g‘oya.`;
  }

  const systemInstruction = `Siz professional marketplace-copywriter va SEO mutaxassisiz.
Vazifa: Yuklangan rasmlar asosida ${marketplace} platformasi uchun 18 ta blokdan iborat kartani yaratish.

MUHIM QOIDALAR:
1. HAR BIR blokni ---KEY_NAME--- markeridan boshlang.
2. Har bir band ichida "UZ:" va "RU:" prefikslaridan foydalaning.
3. Toza matn: markdown (#, *, _) ishlatmang.
4. KAFOLAT: FAQAT "10 kun (ishlab chiqaruvchi nuqsonlari uchun)" deb yozing.
${planRules}

MARKERLAR:
---CAT---, ---NAME---, ---COUNTRY---, ---BRAND---, ---MODEL---, ---WARRANTY---, ---SHORT_DESC---, ---FULL_DESC---, ---PHOTOS_INFO---, ---VIDEO_REC---, ---SPECS---, ---PROPS---, ---INSTR---, ---SIZE---, ---COMP---, ---CARE---, ---SKU---, ---IKPU---`;

  const parts: any[] = [];
  for (const img of (images || []).slice(0, 3)) {
    const inlinePart = toInlineDataPart(img);
    if (inlinePart) parts.push(inlinePart);
  }

  parts.push({
    text:
      `Ushbu mahsulot uchun ${marketplace} standartida 18 banddan iborat professional kartani tayyorlang. ` +
      `Qo'shimcha ma'lumot: ${additionalInfo || "Yo'q"}`,
  });

  const body: any = {
    contents: [{ role: 'user', parts }],
    systemInstruction: { parts: [{ text: systemInstruction }] },
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: plan === 'business_plus' || plan === 'business+' ? 6500 : plan === 'pro' ? 5000 : 4000,
      topP: 0.95,
    },
  };

  const response = await geminiGenerateContent(model, body);
  const text = extractText(response).trim();
  yield text;
}

export async function generateVideoScript(
  topic: string,
  platform: string = 'youtube',
  duration: string = '1-3',
  tone: string = 'professional'
): Promise<string> {
  const systemInstruction =
    'You are a senior video script writer. Output a structured script with hook, body, CTA, and on-screen text suggestions. Keep it practical and audience-friendly.';

  const userText = `Topic: ${topic}\nPlatform: ${platform}\nDuration: ${duration} minutes\nTone: ${tone}`;
  return generateText(GEMINI_TEXT_MODEL, systemInstruction, userText);
}

export async function generateCopywriterContent(
  contentType: string,
  topic: string,
  tone: string = 'professional',
  length: string = 'medium',
  keywords: string[] = []
): Promise<string> {
  const systemInstruction =
    'You are a direct-response copywriter. Produce conversion-focused Uzbek copy. Avoid vague advice; write the actual copy.';

  const userText =
    `Content type: ${contentType}\n` +
    `Topic/product: ${topic}\n` +
    `Tone: ${tone}\nLength: ${length}\n` +
    `Keywords (if any): ${keywords.join(', ')}`;

  return generateText(GEMINI_TEXT_MODEL, systemInstruction, userText);
}

export async function analyzeMarketingMetrics(
  metrics: string,
  analysisType: string = 'marketing-metrics'
): Promise<string> {
  const systemInstruction =
    'You are a performance marketing analyst. Analyze the metrics and provide specific actions, calculations, and prioritized recommendations.';

  const userText = `Analysis type: ${analysisType}\n\nMetrics:\n${metrics}`;
  return generateText(GEMINI_TEXT_MODEL, systemInstruction, userText);
}

export async function chat(message: string, history: ChatMessage[] = []): Promise<string> {
  const systemInstruction =
    'You are Umari AI assistant. Reply in Uzbek by default. Be concise, practical, and helpful for ecommerce and content creation.';

  const contents: any[] = [];
  for (const h of history) {
    const role = h?.role === 'assistant' || h?.role === 'model' ? 'model' : 'user';
    const content = typeof h?.content === 'string' ? h.content : '';
    if (!content) continue;
    contents.push({ role, parts: [{ text: content }] });
  }

  contents.push({ role: 'user', parts: [{ text: message }] });

  const body: any = {
    contents,
    systemInstruction: { parts: [{ text: systemInstruction }] },
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 2500,
      topP: 0.95,
    },
  };

  const response = await geminiGenerateContent(GEMINI_TEXT_MODEL, body);
  return extractText(response) || '';
}
