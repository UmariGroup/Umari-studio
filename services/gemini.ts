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
const GEMINI_IMAGE_FALLBACK_MODELS = String(process.env.GEMINI_IMAGE_FALLBACK_MODELS || '')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);

const GEMINI_RETRY_ATTEMPTS = Math.max(1, Number(process.env.GEMINI_RETRY_ATTEMPTS || 3));
const GEMINI_MAX_CONCURRENT = Math.max(1, Number(process.env.GEMINI_MAX_CONCURRENT || 2));

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

const MARKETPLACE_ANGLES = [
  "HERO: front-facing straight-on product shot, centered, full product visible, camera at product mid-height, 50mm look.",
  "CLOSE-UP: tight close-up / macro detail crop that fills the frame, shallow depth of field, texture/material focus.",
  "3/4 ANGLE: three-quarter view (about 30–45°), shows depth and sides, slight perspective, still centered.",
  "SIDE PROFILE: true side profile view (about 90°), silhouette and proportions, clean negative space.",
];

function buildMarketplaceImagePrompt(userPrompt: string, angle: string) {
  return `
Task: Generate a high-converting professional marketplace product image.

PRIMARY OBJECTIVE:
Create a realistic, commercially persuasive product photo suitable for a large ecommerce marketplace (Uzum / Amazon / Wildberries style).

CRITICAL PRODUCT IDENTITY RULES:
- Preserve the MAIN PRODUCT identity EXACTLY
- Do NOT redesign, restyle, or reinterpret the product
- Maintain accurate shape, proportions, materials, colors, branding, and details
- The product must look like the real physical item

STYLE TRANSFER RULES:
- Copy ONLY: lighting, background, composition, camera style
- IGNORE the object shown in style reference images

COMMERCIAL PHOTOGRAPHY REQUIREMENTS:
- Ultra-realistic product photography
- Clean ecommerce marketplace aesthetic
- Professional studio-grade lighting
- Sharp focus, crisp edges
- Realistic materials & textures
- Natural reflections & shadows
- No artistic distortion
- No surrealism / fantasy / illustration look
- No AI artifacts

MARKETPLACE OPTIMIZATION:
- Image must look trustworthy & premium
- Product must feel tangible & high-quality
- Suitable for product listing thumbnail
- Neutral commercial color balance

SALES & CONVERSION OPTIMIZATION:
- Increase buyer trust
- Increase perceived product quality
- Increase click-through rate
- Visually persuasive ecommerce presentation

CAMERA & FRAMING:
${angle}

FOLLOW STRICTLY:
- Treat CAMERA & FRAMING as the highest-priority viewpoint instruction.
- If any other text conflicts, CAMERA & FRAMING wins.
- For CLOSE-UP / MACRO: crop/zoom so the subject fills most of the frame.
- For SIDE PROFILE: true 90° side view (silhouette), not a 3/4 angle.

User Intent / Product Context:
${userPrompt}
`;
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

function extractHttpStatus(error: unknown): number | null {
  if (axios.isAxiosError(error)) {
    return error.response?.status ?? null;
  }
  if (!(error instanceof Error)) return null;

  const match = error.message.match(/\((\d{3})(?:\s|[)])?/);
  if (!match) return null;
  const status = Number(match[1]);
  return Number.isFinite(status) ? status : null;
}

function shouldTryNextImageModel(error: unknown): boolean {
  const status = extractHttpStatus(error);
  if (status && [404, 408, 429, 500, 502, 503, 504].includes(status)) return true;

  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return (
    message.includes('quota') ||
    message.includes('resource_exhausted') ||
    message.includes('too many requests') ||
    message.includes('model did not return an image') ||
    message.includes('no image returned')
  );
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

function coerceTextOnlyModel(model: string | undefined, fallback: string): string {
  const trimmed = String(model || '').trim();
  if (!trimmed) return fallback;

  const lower = trimmed.toLowerCase();
  // Guard against misconfiguration: image-only models will often return inline images and no text.
  if (lower.includes('flash-image') || lower.includes('-image') || lower.startsWith('imagen-')) {
    return fallback;
  }
  return trimmed;
}

function describeNoTextResponse(response: any): string {
  try {
    const finishReason = response?.candidates?.[0]?.finishReason || response?.candidates?.[0]?.finish_reason;
    const blockReason = response?.promptFeedback?.blockReason || response?.prompt_feedback?.block_reason;
    const safetyRatings = response?.promptFeedback?.safetyRatings || response?.prompt_feedback?.safety_ratings;
    const extras: string[] = [];
    if (finishReason) extras.push(`finishReason=${String(finishReason)}`);
    if (blockReason) extras.push(`blockReason=${String(blockReason)}`);
    if (Array.isArray(safetyRatings) && safetyRatings.length > 0) extras.push(`safetyRatings=${JSON.stringify(safetyRatings).slice(0, 500)}`);
    return extras.length ? ` (${extras.join(', ')})` : '';
  } catch {
    return '';
  }
}

function sanitizeInfografikaText(value: unknown): string {
  let s = String(value ?? '').trim();
  if (!s) return '';

  // Remove common markdown / formatting artifacts that degrade the final design.
  s = s.replace(/\*\*([^*]+)\*\*/g, '$1');
  s = s.replace(/__([^_]+)__/g, '$1');
  s = s.replace(/[`#*_~]/g, '');
  s = s.replace(/[!！]+/g, '');
  s = s.replace(/\s+/g, ' ').trim();
  return s;
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

export async function generateMarketplacePromptFromImages(
  productImages: string[],
  options?: { model?: string; mode?: 'basic' | 'pro' | 'ultra'; outputCount?: number }
): Promise<string> {
  const images = Array.isArray(productImages) ? productImages.filter(Boolean).slice(0, 3) : [];
  if (images.length === 0) {
    throw new Error('At least one product image is required.');
  }

  const model = (options?.model || GEMINI_TEXT_MODEL).trim();
  const mode = (options?.mode || 'pro').toString().toLowerCase();
  const outputCount = Math.max(1, Math.min(6, Number(options?.outputCount || 3)));

  const systemInstruction =
    'You are an expert ecommerce prompt engineer. Return ONLY one final English image-generation prompt. No markdown, no bullets, no JSON, no explanations.';

  const parts: any[] = [
    {
      text:
        `Create one professional marketplace image prompt based on uploaded product photos.\n` +
        `Mode: ${mode}. Planned output images: ${outputCount}.\n` +
        `Requirements: preserve product identity, shape, logo, material, and colors exactly; clean ecommerce composition; realistic studio lighting; brand-safe; no people unless requested.\n` +
        `The prompt must be practical and ready to paste into image generation.`,
    },
  ];

  for (const img of images) {
    const inlinePart = toInlineDataPart(img);
    if (inlinePart) parts.push(inlinePart);
  }

  const body: any = {
    contents: [{ role: 'user', parts }],
    systemInstruction: { parts: [{ text: systemInstruction }] },
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 350,
      topP: 0.9,
    },
  };

  const response = await geminiGenerateContent(model, body);
  const prompt = extractText(response).trim();
  if (!prompt) {
    throw new Error('Model did not return prompt text.');
  }

  return prompt;
}

function extractDualPrompt(text: string): { en: string; uz: string } | null {
  const raw = String(text || '').trim();
  if (!raw) return null;

  const enMatch = raw.match(/\bEN\s*[:\-]\s*([\s\S]*?)(?=\n\s*UZ\s*[:\-]|$)/i);
  const uzMatch = raw.match(/\bUZ\s*[:\-]\s*([\s\S]*?)(?=\n\s*EN\s*[:\-]|$)/i);

  const en = enMatch?.[1]?.trim() || '';
  const uz = uzMatch?.[1]?.trim() || '';
  if (!en || !uz) return null;

  return { en, uz };
}

function sanitizePromptText(text: string): string {
  const trimmed = String(text || '').trim();
  if (!trimmed) return '';
  return trimmed.replace(/^"+|"+$/g, '').trim();
}

export async function generateMarketplacePromptBundleFromImages(
  productImages: string[],
  options?: {
    model?: string;
    mode?: 'basic' | 'pro' | 'ultra';
    outputCount?: number;
    premiumQuality?: boolean;
    styleAllowed?: boolean;
  }
): Promise<{ promptEn: string; promptUz: string }> {
  const images = Array.isArray(productImages) ? productImages.filter(Boolean).slice(0, 4) : [];
  if (images.length === 0) {
    throw new Error('At least one product image is required.');
  }

  const model = (options?.model || GEMINI_TEXT_MODEL).trim();
  const mode = (options?.mode || 'pro').toString().toLowerCase();
  const outputCount = Math.max(1, Math.min(6, Number(options?.outputCount || 3)));
  const premiumQuality = Boolean(options?.premiumQuality);
  const styleAllowed = Boolean(options?.styleAllowed);

  const systemInstruction =
    'You are an expert ecommerce prompt engineer for marketplace product images. ' +
    'Return ONLY two lines in this exact format: ' +
    'EN: <one English prompt>\nUZ: <one Uzbek prompt>. ' +
    'Each prompt must be ONE single line (no newline characters inside the prompt). ' +
    'No markdown, no bullets, no JSON, no extra commentary, no quotes.';

  const wardrobeGuidance = styleAllowed
    ? ''
    :
      'If the product is apparel/footwear/bags/accessories, use an ADULT model to show scale and fit; keep face out of frame; ' +
      'neutral pose; modest, brand-safe styling. For footwear: on-feet with matching jeans/trousers. For clothing: correctly worn and well-fitted. ' +
      'If the product is NOT wearable, do NOT include people/hands.';

  const qualityGuidance = premiumQuality
    ?
      'Add premium editorial detail: softbox + fill + rim lighting, natural contact shadow, accurate color, crisp edges, micro-texture, ' +
      'realistic reflections, high dynamic range, ultra-clean background, no artifacts.'
    :
      'Keep the prompt concise but complete: clean background, studio lighting, sharp focus, realistic materials.';

  const parts: any[] = [
    {
      text:
        'Analyze the uploaded product photos and infer accurate product details (category, material, color, finish, shape, branding).\n' +
        `Create ONE copy-paste-ready prompt for generating a high-converting marketplace listing image. Mode: ${mode}. Planned output images: ${outputCount}.\n` +
        'Hard requirements (must follow):\n' +
        '- Preserve the REAL product identity exactly: shape/proportions, materials, color, logo/branding placement, key details.\n' +
        '- Studio commercial product photography; trustworthy ecommerce look; not illustration.\n' +
        '- Composition: centered hero shot, clean framing, subject dominant, suitable for thumbnail.\n' +
        '- Background: seamless pure white or very light neutral; minimal props only if needed for realism (do not add extra products).\n' +
        '- Lighting: soft, even, professional; natural contact shadow; no harsh glare; accurate color.\n' +
        '- Quality: sharp focus, crisp edges, realistic texture, no AI artifacts.\n' +
        '- Output framing: 3:4 vertical (1080x1440).\n' +
        '- Absolutely NO text, watermarks, labels added by the model, collage, borders, UI elements, or extra logos.\n' +
        `${wardrobeGuidance}\n` +
        `${qualityGuidance}\n` +
        'Add a short negative/avoid clause inside the prompt (e.g., “avoid: text, watermark, extra items, distorted logo, extra fingers”).\n' +
        'Remember: return only EN: and UZ: lines.',
    },
  ];

  for (const img of images) {
    const inlinePart = toInlineDataPart(img);
    if (inlinePart) parts.push(inlinePart);
  }

  const body: any = {
    contents: [{ role: 'user', parts }],
    systemInstruction: { parts: [{ text: systemInstruction }] },
    generationConfig: {
      temperature: premiumQuality ? 0.25 : 0.3,
      maxOutputTokens: premiumQuality ? 550 : 350,
      topP: 0.9,
    },
  };

  const response = await geminiGenerateContent(model, body);
  const rawText = extractText(response).trim();
  if (!rawText) {
    throw new Error('Model did not return prompt text.');
  }

  const parsed = extractDualPrompt(rawText);
  if (parsed) {
    return { promptEn: sanitizePromptText(parsed.en), promptUz: sanitizePromptText(parsed.uz) };
  }

  const fallback = sanitizePromptText(rawText);
  return { promptEn: fallback, promptUz: fallback };
}

function safeJsonParse<T = any>(text: string): T | null {
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

function extractFirstJsonObject(text: string): string | null {
  const s = String(text || '');
  const firstBrace = s.indexOf('{');
  if (firstBrace < 0) return null;
  const lastBrace = s.lastIndexOf('}');
  if (lastBrace <= firstBrace) return null;
  return s.slice(firstBrace, lastBrace + 1);
}

export type InfografikaVariant = {
  id: string;
  strategy: 'CTR_BOOSTER' | 'TRUST_OPTIMIZER' | 'PREMIUM_PERCEPTION';
  title: string;
  headline: string;
  bullets: string[];
  features?: Array<{ text: string; icon: InfografikaIcon }>;
  badge?: string | null;
  layout: 'hero' | 'detail' | 'angled';
  scores: {
    ctrImpact: number;
    trustSignal: number;
    premiumScore: number;
    marketplaceSafe: number;
  };
};

export type InfografikaIcon =
  | 'wind'
  | 'cotton'
  | 'feather'
  | 'shield'
  | 'droplet'
  | 'thermo'
  | 'stretch'
  | 'run'
  | 'sparkles'
  | 'check'
  | 'tag'
  | 'leaf'
  | 'star'
  | 'box'
  | 'info';

export type InfografikaLanguage = 'uz_latn' | 'uz_cyrl' | 'ru';

function describeInfografikaLanguage(lang: InfografikaLanguage): string {
  switch (lang) {
    case 'uz_latn':
      return 'Uzbek (Latin script, O\u2018zbekcha lotin).';
    case 'uz_cyrl':
      return 'Uzbek (Cyrillic script, \u040e\u0437\u0431\u0435\u043a\u0447\u0430 \u043a\u0438\u0440\u0438\u043b\u043b).';
    case 'ru':
      return 'Russian (ru-RU).';
    default:
      return 'Uzbek (Latin script).';
  }
}

function normalizeUzApostrophes(s: string): string {
  return String(s || '')
    .replace(/o['’`]/gi, (m) => (m[0] === 'O' ? 'O\u2018' : 'o\u2018'))
    .replace(/g['’`]/gi, (m) => (m[0] === 'G' ? 'G\u2018' : 'g\u2018'))
    .replace(/[’`]/g, '\u2018');
}

function uzLatinToCyrl(input: string): string {
  const s0 = normalizeUzApostrophes(String(input || '')).trim();
  if (!s0) return '';

  const rules: Array<[RegExp, string]> = [
    [/O\u2018/g, '\u040e'],
    [/o\u2018/g, '\u045e'],
    [/G\u2018/g, '\u0492'],
    [/g\u2018/g, '\u0493'],

    [/Sh/g, '\u0428'],
    [/sh/g, '\u0448'],
    [/Ch/g, '\u0427'],
    [/ch/g, '\u0447'],
    [/Ng/g, '\u041d\u0433'],
    [/ng/g, '\u043d\u0433'],

    [/Ya/g, '\u042f'],
    [/ya/g, '\u044f'],
    [/Yo/g, '\u0401'],
    [/yo/g, '\u0451'],
    [/Yu/g, '\u042e'],
    [/yu/g, '\u044e'],
    [/Ye/g, '\u0415'],
    [/ye/g, '\u0435'],

    [/A/g, '\u0410'],
    [/a/g, '\u0430'],
    [/B/g, '\u0411'],
    [/b/g, '\u0431'],
    [/D/g, '\u0414'],
    [/d/g, '\u0434'],
    [/E/g, '\u0415'],
    [/e/g, '\u0435'],
    [/F/g, '\u0424'],
    [/f/g, '\u0444'],
    [/G/g, '\u0413'],
    [/g/g, '\u0433'],
    [/H/g, '\u04b2'],
    [/h/g, '\u04b3'],
    [/I/g, '\u0418'],
    [/i/g, '\u0438'],
    [/J/g, '\u0416'],
    [/j/g, '\u0436'],
    [/K/g, '\u041a'],
    [/k/g, '\u043a'],
    [/L/g, '\u041b'],
    [/l/g, '\u043b'],
    [/M/g, '\u041c'],
    [/m/g, '\u043c'],
    [/N/g, '\u041d'],
    [/n/g, '\u043d'],
    [/O/g, '\u041e'],
    [/o/g, '\u043e'],
    [/P/g, '\u041f'],
    [/p/g, '\u043f'],
    [/Q/g, '\u049a'],
    [/q/g, '\u049b'],
    [/R/g, '\u0420'],
    [/r/g, '\u0440'],
    [/S/g, '\u0421'],
    [/s/g, '\u0441'],
    [/T/g, '\u0422'],
    [/t/g, '\u0442'],
    [/U/g, '\u0423'],
    [/u/g, '\u0443'],
    [/V/g, '\u0412'],
    [/v/g, '\u0432'],
    [/X/g, '\u0425'],
    [/x/g, '\u0445'],
    [/Y/g, '\u0419'],
    [/y/g, '\u0439'],
    [/Z/g, '\u0417'],
    [/z/g, '\u0437'],

    [/["'`]/g, ''],
  ];

  let out = s0;
  for (const [re, rep] of rules) out = out.replace(re, rep);
  return out;
}

function translateVariantTextToLanguage(variant: InfografikaVariant, lang: InfografikaLanguage): InfografikaVariant {
  if (lang !== 'uz_cyrl') return variant;
  const mapText = (v: string) => uzLatinToCyrl(v);

  return {
    ...variant,
    title: mapText(variant.title),
    headline: mapText(variant.headline),
    bullets: Array.isArray(variant.bullets) ? variant.bullets.map(mapText) : [],
    badge: variant.badge ? mapText(String(variant.badge)) : variant.badge,
    features: Array.isArray(variant.features)
      ? variant.features.map((f) => ({ ...f, text: mapText(f.text) }))
      : variant.features,
  };
}

async function proofreadInfografikaVariantsText(
  variants: InfografikaVariant[],
  lang: InfografikaLanguage
): Promise<InfografikaVariant[]> {
  const proofModel = String(process.env.GEMINI_INFOGRAFIKA_PROOFREAD_MODEL || 'gemini-2.0-flash').trim();
  const model = coerceTextOnlyModel(proofModel, 'gemini-2.0-flash');
  const languageSpec = describeInfografikaLanguage(lang);

  const payload = {
    variants: variants.map((v) => ({
      id: v.id,
      title: v.title,
      headline: v.headline,
      badge: v.badge ?? null,
      bullets: v.bullets,
      features: Array.isArray(v.features) ? v.features.map((f) => ({ text: f.text, icon: f.icon })) : null,
    })),
  };

  const systemInstruction =
    'You are a strict orthography proofreader for ecommerce infographic copy. ' +
    `Language/script: ${languageSpec} ` +
    'Return ONLY valid JSON. Do NOT add new content. Do NOT translate. ' +
    'ONLY fix spelling/typos, missing letters, wrong apostrophes, and obvious orthography mistakes. ' +
    'Keep wording short. Keep meaning identical. No marketing slogans. No exclamation marks.';

  const userText =
    'Fix typos in this JSON. Rules:\n' +
    '- Keep id and icon fields unchanged\n' +
    '- Keep the same number of bullets and features\n' +
    '- Do not lengthen text; shorten if needed\n' +
    '- IMPORTANT: avoid truncated words (example: "mato" must not become "mat")\n' +
    'Return JSON with the exact same shape: {"variants":[...]}\n\n' +
    JSON.stringify(payload);

  try {
    const raw = await generateText(model, systemInstruction, userText);
    const jsonText = extractFirstJsonObject(raw) || raw;
    const parsed = safeJsonParse<{ variants?: any[] }>(jsonText);
    const items = Array.isArray(parsed?.variants) ? parsed!.variants! : null;
    if (!items) return variants;

    const byId = new Map<string, any>();
    for (const it of items) {
      const id = String(it?.id || '').trim();
      if (id) byId.set(id, it);
    }

    return variants.map((v) => {
      const it = byId.get(v.id);
      if (!it) return v;

      const title = sanitizeInfografikaText(it?.title);
      const headline = sanitizeInfografikaText(it?.headline);
      const badge = it?.badge == null ? null : sanitizeInfografikaText(it?.badge);

      const bullets = Array.isArray(it?.bullets)
        ? it.bullets.map((x: any) => sanitizeInfografikaText(x)).filter(Boolean).slice(0, 3)
        : v.bullets;

      const next: InfografikaVariant = {
        ...v,
        title: title || v.title,
        headline: headline || v.headline,
        badge: badge === '' ? null : badge ?? v.badge,
        bullets: bullets.length ? bullets : v.bullets,
      };

      if (Array.isArray(v.features)) {
        const features = Array.isArray(it?.features) ? it.features : null;
        if (features) {
          next.features = v.features.map((f, idx) => {
            const correctedText = sanitizeInfografikaText(features?.[idx]?.text);
            return { ...f, text: correctedText || f.text };
          });
        }
      }

      return next;
    });
  } catch {
    return variants;
  }
}

export async function generateInfografikaVariantsFromImage(
  productImage: string,
  options: {
    model?: string;
    variantCount: number;
    additionalInfo?: string;
    language?: InfografikaLanguage;
  }
): Promise<InfografikaVariant[]> {
  const safeFallbackModel = 'gemini-2.0-flash';
  const model = coerceTextOnlyModel((options.model || GEMINI_TEXT_MODEL).trim(), safeFallbackModel);
  const variantCount = Math.max(1, Math.min(3, Number(options.variantCount || 1)));
  const additionalInfo = String(options.additionalInfo || '').slice(0, 2500);

  const requestedLanguage = (options.language || 'uz_latn') as InfografikaLanguage;
  const generationLanguage: InfografikaLanguage = requestedLanguage === 'uz_cyrl' ? 'uz_latn' : requestedLanguage;
  const languageSpec = describeInfografikaLanguage(generationLanguage);

  const systemInstruction =
    'You are a conversion-first marketplace infographic strategist for ecommerce listings. ' +
    'You are NOT a beauty engine; you are a sales optimization engine. ' +
    `You MUST return ONLY valid JSON (no markdown). Language/script: ${languageSpec} ` +
    'TEXT HYGIENE: Never use markdown symbols like **, #, _, ` or bullet characters inside strings. Plain text only. ' +
    'NO AD LANGUAGE: Do NOT write CTA, imperatives, or hype (no "Zalda o\'zingni ko\'rsat", no "Buy now", no exclamation marks). ' +
    'NO PROMO WORDS: avoid words that imply an advertisement/poster: tanlov, promo, aksiya, chegirma, sale, skidka. ' +
    'SPELLING LOCK: zero typos allowed. Double-check every word for missing letters. Do not abbreviate words. ' +
    'If Uzbek Latin, use correct apostrophes (o\u2018, g\u2018) and never drop letters (example: mato must not be truncated). ' +
    'OUTPUT SCHEMA (strict): {"variants": Array<Variant>} where Variant has: ' +
    'id (string), strategy (CTR_BOOSTER|TRUST_OPTIMIZER|PREMIUM_PERCEPTION), title (short), ' +
    'headline (3–4 words, bold-impact), ' +
    'features (array of EXACTLY 3 objects: {text: short Uzbek USP, max 5 words; icon: one of [wind,cotton,feather,shield,droplet,thermo,stretch,run,sparkles,check,tag,leaf,star,box,info]}), ' +
    'badge (optional short, max 2–3 words), layout (hero|detail|angled), ' +
    'scores {ctrImpact 1-10, trustSignal 1-10, premiumScore 1-10, marketplaceSafe 1-10}. ' +
    '\n\nEXACT PROMPT ARCHITECTURE (for your reasoning, but output JSON only): ' +
    'TASK LAYER → create marketplace-ready product infographic. ' +
    'IDENTITY LOCK LAYER → preserve product identity EXACTLY (shape, color, logo, material). No redesign. ' +
    'MARKETPLACE RULES LAYER → clean ecommerce composition, no clutter, no excessive text, no artifacts. ' +
    'CONVERSION STRATEGY LAYER → CTR + trust. ' +
    'VISUAL PSYCHOLOGY LAYER → eye-flow: product → headline → USPs → badge. ' +
    'TEXT RULES LAYER → 1 headline + 3 USPs, no paragraphs, whitespace heavy. ' +
    'OUTPUT INTENT LAYER → variants must be different strategies, not color variations. ' +
    '\n\nVARIANT PSYCHOLOGY ENGINE (must follow): ' +
    'TRUST_OPTIMIZER → minimal, white background feel, premium catalog vibe, clean typography, NO aggressive badges. Purpose: conversion rate ↑. ' +
    'CTR_BOOSTER → scroll-stopping contrast hierarchy, attention anchor element, bold headline emphasis, subtle premium badge as anchor (NOT discount spam). Purpose: CTR ↑. ' +
    'PREMIUM_PERCEPTION → luxury brand presentation, elegant spacing, premium lighting feel, soft gradient feel (subtle), high-end perception. Badge only as brand accent or omit. Purpose: price perception ↑. ' +
    '\n\nBADGE INTELLIGENCE: badge must be subtle and marketplace-compliant. NEVER: huge red discount, flashing, clickbait, "100%". ' +
    '\n\nUSP PERSUASION SYSTEM: bullets must be buyer-value benefits (feature→benefit→emotion). Avoid pure specs-only bullets.';

  const inline = toInlineDataPart(productImage);
  if (!inline) {
    throw new Error('Invalid product image data URL.');
  }

  const userText =
    `TASK: Create ${variantCount} DIFFERENT infographic variants for the same product photo.\n` +
    `CRITICAL: Variant != color. Variant == different buyer psychology attack.\n` +
    `VARIANT STRATEGIES REQUIRED (use different ones): TRUST_OPTIMIZER, CTR_BOOSTER, PREMIUM_PERCEPTION.\n` +
    `RAKURS DIVERSIFIKATSIYASI: layouts must vary (hero vs detail zoom vs slight angled).\n` +
    `MARKETPLACE COMPLIANCE: keep text density low, whitespace 40%+, no paragraphs, safe claims.\n` +
    `LANGUAGE/SCRIPT: ${languageSpec}\n` +
    `NO MARKDOWN: Do not wrap words in **.\n` +
    `NO POSTER TEXT: Headline must NOT be a slogan/CTA and must NOT include '!'.\n` +
    `BADGE RULE: if you output a badge, keep it neutral (e.g., "Yuqori sifat", "100% paxta"), never promo words like "Tanlov".\n` +
    `USER PRODUCT INFO (optional but IMPORTANT if present):\n${additionalInfo || 'N/A'}\n` +
    `If user info exists, reflect it naturally in headline + USPs.\n` +
    `Return JSON only in the required schema.`;

  const body: any = {
    contents: [
      {
        role: 'user',
        parts: [{ text: userText }, inline],
      },
    ],
    systemInstruction: { parts: [{ text: systemInstruction }] },
    generationConfig: {
      temperature: 0.35,
      maxOutputTokens: 900,
      topP: 0.9,
    },
  };

  // First attempt with requested model.
  let response = await geminiGenerateContent(model, body);
  let raw = extractText(response).trim();

  // If the model returns no text (common with incompatible models or safety blocks), retry with a safe multimodal text model.
  if (!raw && model !== safeFallbackModel) {
    response = await geminiGenerateContent(safeFallbackModel, body);
    raw = extractText(response).trim();
  }

  if (!raw) {
    throw new Error(`Model did not return text.${describeNoTextResponse(response)}`);
  }

  const jsonText = extractFirstJsonObject(raw) || raw;
  const parsed = safeJsonParse<{ variants?: any[] }>(jsonText);
  const variantsRaw = Array.isArray(parsed?.variants) ? parsed!.variants! : [];

  const normalizeScore = (n: any) => {
    const v = Number(n);
    if (!Number.isFinite(v)) return 6;
    return Math.max(1, Math.min(10, Math.round(v)));
  };

  const normalizeIcon = (raw: any): InfografikaIcon => {
    const s = String(raw || '').trim().toLowerCase();
    const allowed: InfografikaIcon[] = [
      'wind',
      'cotton',
      'feather',
      'shield',
      'droplet',
      'thermo',
      'stretch',
      'run',
      'sparkles',
      'check',
      'tag',
      'leaf',
      'star',
      'box',
      'info',
    ];
    if ((allowed as string[]).includes(s)) return s as InfografikaIcon;
    return 'info';
  };

  const inferIconFromText = (text: string): InfografikaIcon => {
    const s = String(text || '').toLowerCase();
    if (/(havo|nafas|vent|o'tkazuvchan)/i.test(s)) return 'wind';
    if (/(paxta|cotton)/i.test(s)) return 'cotton';
    if (/(mayin|yumshoq|soft)/i.test(s)) return 'feather';
    if (/(mustahkam|bardosh|uzoq|xizmat|kafolat)/i.test(s)) return 'shield';
    if (/(nam|ter|quruq|dry|namlik)/i.test(s)) return 'droplet';
    if (/(issiq|sovuq|term|harorat)/i.test(s)) return 'thermo';
    if (/(cho'z|stretch|elast|moslashuvchan)/i.test(s)) return 'stretch';
    if (/(mashg'ulot|sport|run|fitness|yugur)/i.test(s)) return 'run';
    if (/(qulay|komfort|yoqimli)/i.test(s)) return 'sparkles';
    if (/(premium|yuqori|sifat)/i.test(s)) return 'star';
    return 'info';
  };

  const out: InfografikaVariant[] = variantsRaw
    .slice(0, variantCount)
    .map((v: any, idx: number) => {
      const strategy = String(v?.strategy || '') as InfografikaVariant['strategy'];
      const allowedStrategies: InfografikaVariant['strategy'][] = ['CTR_BOOSTER', 'TRUST_OPTIMIZER', 'PREMIUM_PERCEPTION'];
      const finalStrategy = allowedStrategies.includes(strategy) ? strategy : allowedStrategies[idx % allowedStrategies.length];

      const layout = String(v?.layout || '') as InfografikaVariant['layout'];
      const allowedLayouts: InfografikaVariant['layout'][] = ['hero', 'detail', 'angled'];
      const finalLayout = allowedLayouts.includes(layout) ? layout : allowedLayouts[idx % allowedLayouts.length];

      const featuresRaw = Array.isArray(v?.features) ? v.features : null;
      const normalizedFeatures: Array<{ text: string; icon: InfografikaIcon }> = [];
      if (featuresRaw) {
        for (const item of featuresRaw) {
          const text = sanitizeInfografikaText(item?.text);
          if (!text) continue;
          normalizedFeatures.push({ text, icon: normalizeIcon(item?.icon) });
          if (normalizedFeatures.length >= 3) break;
        }
      }

      const bulletsRaw = Array.isArray(v?.bullets)
        ? v.bullets.map((x: any) => sanitizeInfografikaText(x)).filter(Boolean)
        : [];

      // If features missing, infer from bullets. If bullets missing, backfill defaults.
      if (normalizedFeatures.length === 0) {
        const from = bulletsRaw.length ? bulletsRaw : ['Yuqori sifat', 'Qulay', 'Ishonchli'];
        for (const b of from) {
          normalizedFeatures.push({ text: b, icon: inferIconFromText(b) });
          if (normalizedFeatures.length >= 3) break;
        }
      }

      while (normalizedFeatures.length < 3) {
        const fallback = normalizedFeatures.length === 0 ? 'Yuqori sifat' : normalizedFeatures.length === 1 ? 'Qulay' : 'Ishonchli';
        normalizedFeatures.push({ text: fallback, icon: inferIconFromText(fallback) });
      }

      const fixedBullets = normalizedFeatures.map((f) => f.text).slice(0, 3);

      return {
        id: String(v?.id || `${finalStrategy.toLowerCase()}_${idx + 1}`),
        strategy: finalStrategy,
        title: sanitizeInfografikaText(v?.title) || (finalStrategy === 'CTR_BOOSTER' ? 'CTR Booster' : finalStrategy === 'TRUST_OPTIMIZER' ? 'Trust' : 'Premium'),
        headline: sanitizeInfografikaText(v?.headline) || 'Marketplace uchun',
        bullets: fixedBullets,
        features: normalizedFeatures.slice(0, 3),
        badge: v?.badge ? sanitizeInfografikaText(v.badge) : null,
        layout: finalLayout,
        scores: {
          ctrImpact: normalizeScore(v?.scores?.ctrImpact),
          trustSignal: normalizeScore(v?.scores?.trustSignal),
          premiumScore: normalizeScore(v?.scores?.premiumScore),
          marketplaceSafe: normalizeScore(v?.scores?.marketplaceSafe),
        },
      };
    });

  // Guarantee we return exactly variantCount variants.
  while (out.length < variantCount) {
    const idx = out.length;
    out.push({
      id: `variant_${idx + 1}`,
      strategy: idx === 0 ? 'CTR_BOOSTER' : idx === 1 ? 'TRUST_OPTIMIZER' : 'PREMIUM_PERCEPTION',
      title: idx === 0 ? 'CTR Booster' : idx === 1 ? 'Trust' : 'Premium',
      headline: 'Marketplace uchun',
      bullets: ['Yuqori sifat', 'Qulay', 'Ishonchli'],
      badge: null,
      layout: idx === 0 ? 'hero' : idx === 1 ? 'detail' : 'angled',
      scores: { ctrImpact: 7, trustSignal: 7, premiumScore: 7, marketplaceSafe: 8 },
    });
  }

  const normalized = out.slice(0, variantCount).map((v) => {
    if (generationLanguage !== 'uz_latn') return v;
    return {
      ...v,
      title: normalizeUzApostrophes(v.title),
      headline: normalizeUzApostrophes(v.headline),
      bullets: Array.isArray(v.bullets) ? v.bullets.map(normalizeUzApostrophes) : v.bullets,
      badge: v.badge ? normalizeUzApostrophes(String(v.badge)) : v.badge,
      features: Array.isArray(v.features)
        ? v.features.map((f) => ({ ...f, text: normalizeUzApostrophes(f.text) }))
        : v.features,
    };
  });

  const proofread = await proofreadInfografikaVariantsText(normalized, generationLanguage);
  if (requestedLanguage === 'uz_cyrl') {
    return proofread.map((v) => translateVariantTextToLanguage(v, 'uz_cyrl'));
  }
  return proofread;
}

export async function generateInfografikaImageFromVariant(
  productImage: string,
  variant: InfografikaVariant,
  options: { model?: string; fallbackModels?: string[]; aspectRatio?: string; language?: InfografikaLanguage }
): Promise<string> {
  const aspectRatio = options?.aspectRatio || '3:4';
  const primaryModel = String(options?.model || GEMINI_IMAGE_MODEL).trim();
  const planFallbacks = Array.isArray(options?.fallbackModels)
    ? options!.fallbackModels!.map((v) => String(v || '').trim()).filter(Boolean)
    : [];

  const modelCandidates = Array.from(new Set([primaryModel, ...planFallbacks, ...GEMINI_IMAGE_FALLBACK_MODELS].filter(Boolean)));
  if (modelCandidates.length === 0) throw new Error('Gemini image model is empty.');

  const headline = sanitizeInfografikaText(variant.headline).slice(0, 48);
  const badge = sanitizeInfografikaText(variant.badge || '').slice(0, 24);
  const bullets = (Array.isArray(variant.bullets) ? variant.bullets : [])
    .map((b) => sanitizeInfografikaText(b))
    .filter(Boolean)
    .slice(0, 3);

  const strategy = variant.strategy;
  const layout = variant.layout;

  const inferIconHint = (text: string): string => {
    const s = String(text || '').toLowerCase();
    if (/(havo|nafas|vent|o'tkazuvchan)/i.test(s)) return 'wind/airflow icon';
    if (/(paxta|cotton)/i.test(s)) return 'cotton/flower icon';
    if (/(mayin|yumshoq|soft)/i.test(s)) return 'feather/softness icon';
    if (/(mustahkam|bardosh|uzoq|xizmat)/i.test(s)) return 'shield/durability icon';
    if (/(yengil|engil|light)/i.test(s)) return 'feather/lightweight icon';
    if (/(issiq|sovuq|term|harorat)/i.test(s)) return 'thermometer/temperature icon';
    if (/(nam|ter|quruq|dry)/i.test(s)) return 'droplet/moisture icon';
    if (/(cho'z|stretch|elast)/i.test(s)) return 'stretch/arrows icon';
    if (/(oson|qulay|komfort|comfort)/i.test(s)) return 'sparkles/comfort icon';
    if (/(mashg'ulot|sport|run|fitness)/i.test(s)) return 'running/fitness icon';
    return 'simple minimal line icon';
  };

  const iconToHint = (icon: any, text: string): string => {
    const s = String(icon || '').toLowerCase();
    switch (s) {
      case 'wind':
        return 'wind/airflow icon';
      case 'cotton':
        return 'cotton/flower icon';
      case 'feather':
        return 'feather/softness icon';
      case 'shield':
        return 'shield/protection icon';
      case 'droplet':
        return 'droplet/moisture icon';
      case 'thermo':
        return 'thermometer/temperature icon';
      case 'stretch':
        return 'stretch/arrows icon';
      case 'run':
        return 'running/fitness icon';
      case 'sparkles':
        return 'sparkles/comfort icon';
      case 'check':
        return 'checkmark icon';
      case 'tag':
        return 'tag/label icon';
      case 'leaf':
        return 'leaf/natural icon';
      case 'star':
        return 'star/premium icon';
      case 'box':
        return 'box/package icon';
      case 'info':
        return 'info icon';
      default:
        return inferIconHint(text);
    }
  };

  const styleHint =
    strategy === 'CTR_BOOSTER'
      ? 'Style: structured marketplace infographic layout, slightly higher contrast for readability, but still catalog/UI-like. Use ONE accent color derived from the product.'
      : strategy === 'TRUST_OPTIMIZER'
        ? 'Style: clean, minimal, trust-building, catalog-like, calm colors, subtle frosted UI container, lots of whitespace, no aggressive badges.'
        : 'Style: premium luxury feel, elegant spacing, subtle gradient + vignette, refined typography, minimal elements, tasteful accent.';

  const layoutHint =
    layout === 'detail'
      ? 'Composition: slightly zoomed-in detail crop to show texture, keep product recognizable and centered.'
      : layout === 'angled'
        ? 'Composition: a subtle dynamic angle (very small), keep it realistic and not distorted.'
        : 'Composition: hero shot, centered product, crisp focus.';

  const features = Array.isArray((variant as any)?.features) ? (variant as any).features : null;
  const cardsSpec = (features && features.length ? features : bullets.map((b) => ({ text: b, icon: 'info' })))
    .slice(0, 3)
    .map((f: any, i: number) => {
      const text = sanitizeInfografikaText(f?.text || '').slice(0, 28);
      const iconHint = iconToHint(f?.icon, text);
      return `CARD_${i + 1}: icon=${iconHint}; text="${text}"`;
    })
    .join('\n');

  const prompt =
    `Task: Create a marketplace-ready PRODUCT INFOGRAPHIC (single image).\n` +
    `This MUST look like a structured marketplace infographic system layout (catalog/UI style).\n` +
    `It MUST NOT look like a banner, poster, or advertisement.\n` +
    `Output: EXACTLY 1080x1440 pixels (3:4).\n\n` +
    `CRITICAL PRODUCT IDENTITY LOCK:\n` +
    `- Preserve the product EXACTLY as in the provided photo (shape, colors, logo, material).\n` +
    `- Do NOT redesign, stylize, or change the product.\n\n` +
    `STRICT INFOGRAPHIC LAYOUT RULES (STRUCTURE LOCK):\n` +
    `- Product must remain the dominant visual mass (at least ~65% of attention).\n` +
    `- Text must be secondary and placed ONLY inside a structured UI-like container.\n` +
    `- Use ONE information module container (rounded rectangle) with subtle shadow and clean spacing.\n` +
    `- Inside the container: a small clean headline + 3 separate feature cards/pills with icons (UI components).\n` +
    `- No ribbons, no full-width top bars, no big promotional slabs, no huge headline overlays.\n` +
    `- No poster typography. No marketing hero poster vibe.\n\n` +
    `CRITICAL COLOR RULE:\n` +
    `- Automatically pick a harmonious palette from the product photo.\n` +
    `- Use ONE accent color derived from the product (or background) and apply it consistently to the feature cards and icons.\n\n` +
    `BACKGROUND:\n` +
    `- Clean catalog background (soft gradient + subtle vignette). Must match product colors. Avoid noisy textures.\n\n` +
    `TYPOGRAPHY (strict):\n` +
    `- Use ONE font family (Inter/SF Pro style).\n` +
    `- Use only 2 weights: Headline 700–800, cards 500–600.\n` +
    `- Headline must be small/clean (NOT a slogan), max ~26 chars.\n` +
    `- Each card text max ~22 chars.\n` +
    `- Crisp letters, no spelling mistakes, no random symbols. Uzbek apostrophes must render correctly (o‘, g‘).\n\n` +
    `ANTI-BANNER NEGATIVE CONSTRAINTS (must follow):\n` +
    `- Do NOT generate a banner.\n` +
    `- Do NOT generate a promotional poster.\n` +
    `- Do NOT generate advertising-style layout.\n` +
    `- Do NOT place large headline overlays outside the info container.\n\n` +
    (badge ? `Optional: a very small neutral badge pill INSIDE the info container only, text="${badge}". No promo words.\n\n` : '') +
    `${styleHint}\n` +
    `${layoutHint}\n\n` +
    `LANGUAGE/SCRIPT: ${describeInfografikaLanguage((options?.language || 'uz_latn') as InfografikaLanguage)}\n` +
    `TEXT RENDERING RULE: Render text EXACTLY as provided. Do NOT translate. Do NOT paraphrase.\n` +
    `TEXT TO RENDER (exact; no markdown, no exclamation):\n` +
    `HEADLINE: ${headline}\n` +
    `FEATURE CARDS (exact text + icon hint):\n` +
    `${cardsSpec}\n`;

  const inline = toInlineDataPart(productImage);
  if (!inline) throw new Error('Invalid product image data URL.');

  const body: any = {
    contents: [{ role: 'user', parts: [{ text: prompt }, inline] }],
    safetySettings: [
      { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_LOW_AND_ABOVE' },
      { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
    ],
    generationConfig: {
      imageConfig: { aspectRatio: normalizeAspectRatio(aspectRatio) },
    },
  };

  let lastError: unknown = null;
  for (let index = 0; index < modelCandidates.length; index++) {
    const model = modelCandidates[index];
    try {
      const response = await geminiGenerateContent(model, body);

      const blockReason = response?.promptFeedback?.blockReason;
      if (blockReason) throw new Error(`PROMPT_BLOCKED: ${blockReason}`);

      const dataUrl = extractFirstImageDataUrl(response);
      if (dataUrl) return dataUrl;

      lastError = new Error(`NO_IMAGE: ${model}`);
    } catch (error) {
      lastError = error;
      if (index < modelCandidates.length - 1 && shouldTryNextImageModel(error)) continue;
      throw error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error('No image returned.');
}

export async function generateMarketplaceImage(
  prompt: string,
  productImages: string[] = [],
  styleImages: string[] = [],
  aspectRatio: string = '3:4',
  options?: { model?: string; fallbackModels?: string[]; imageIndex?: number }
): Promise<string> {

  const promptSafety = checkImagePromptSafety(prompt);
  if (!promptSafety.allowed) {
    throw new Error('PROMPT_POLICY_BLOCKED');
  }

  const primaryModel = (options?.model || GEMINI_IMAGE_MODEL).trim();

  const planFallbacks = Array.isArray(options?.fallbackModels)
    ? options!.fallbackModels!.map((value) => String(value || '').trim()).filter(Boolean)
    : [];

  const modelCandidates = Array.from(
    new Set([primaryModel, ...planFallbacks, ...GEMINI_IMAGE_FALLBACK_MODELS].filter(Boolean))
  );

  if (modelCandidates.length === 0) {
    throw new Error('Gemini image model is empty.');
  }

  const parts: any[] = [];

  /* ✅ ANGLE CONTROL */
  const imageIndex = Number(options?.imageIndex || 0);
  const angle = MARKETPLACE_ANGLES[imageIndex % MARKETPLACE_ANGLES.length];

  const finalPrompt = buildMarketplaceImagePrompt(prompt, angle);

  parts.push({ text: finalPrompt });

  if (productImages.length > 0) {
    parts.push({ text: "\n[[MAIN PRODUCT IMAGES]]\n" });

    for (const img of productImages) {
      const inlinePart = toInlineDataPart(img);
      if (inlinePart) parts.push(inlinePart);
    }
  }

  if (styleImages.length > 0) {
    parts.push({
      text:
        "\n[[STYLE REFERENCE IMAGES - Copy ONLY lighting/background/composition. Ignore the object.]]\n",
    });

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

  let lastError: unknown = null;

  for (let index = 0; index < modelCandidates.length; index++) {
    const model = modelCandidates[index];

    try {
      const response = await geminiGenerateContent(model, body);

      const blockReason = response?.promptFeedback?.blockReason;
      if (blockReason) {
        throw new Error(`PROMPT_BLOCKED: ${blockReason}`);
      }

      const dataUrl = extractFirstImageDataUrl(response);
      if (dataUrl) {
        return dataUrl;
      }

      lastError = new Error(`NO_IMAGE: ${model}`);
    } catch (error) {
      lastError = error;

      if (index < modelCandidates.length - 1 && shouldTryNextImageModel(error)) {
        continue;
      }

      throw error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error('No image returned.');
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
---CAT---, ---NAME---, ---COUNTRY---, ---BRAND---, ---MODEL---, ---WARRANTY---, ---SHORT_DESC---, ---FULL_DESC---, ---SPECS---, ---PROPS---, ---INSTR---, ---SIZE---, ---COMP---, ---CARE---, ---SKU---, ---IKPU---`;

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
