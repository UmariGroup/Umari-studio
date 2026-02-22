'use client';

import { useLanguage } from '@/lib/LanguageContext';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useToast } from '@/components/ToastProvider';
import { getTelegramSubscribeUrl } from '@/lib/telegram';
import { parseApiErrorResponse, toUzbekErrorMessage } from '@/lib/uzbek-errors';
import { Plus } from 'lucide-react';

type SubscriptionPlan = 'free' | 'starter' | 'pro' | 'business_plus';

type InfografikaVariant = {
  id: string;
  strategy: 'CTR_BOOSTER' | 'TRUST_OPTIMIZER' | 'PREMIUM_PERCEPTION';
  title: string;
  headline: string;
  bullets: string[];
  features?: Array<{ text: string; icon: string }>;
  badge?: string | null;
  layout: 'hero' | 'detail' | 'angled';
  scores: { ctrImpact: number; trustSignal: number; premiumScore: number; marketplaceSafe: number };
  image?: string | null;
  image_error?: string | null;
};

type UserData = {
  subscription_plan: SubscriptionPlan;
  tokens_remaining: number;
  tokens_total: number;
  role: string;
};

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = String(text || '').split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width <= maxWidth) {
      line = test;
    } else {
      if (line) lines.push(line);
      line = w;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [meta, base64] = dataUrl.split(',');
  const match = /^data:(.*?);base64$/.exec(meta);
  const mime = match?.[1] || 'image/png';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

function downloadDataUrl(dataUrl: string, filename: string) {
  const blob = dataUrlToBlob(dataUrl);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function fileToDataUrl(file: File): Promise<string> {
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Rasmni o‘qib bo‘lmadi'));
    reader.readAsDataURL(file);
  });
}

async function loadImage(src: string): Promise<HTMLImageElement> {
  return await new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Rasm yuklanmadi'));
    img.src = src;
  });
}

function drawRoundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function renderInfografika(
  baseImage: HTMLImageElement,
  variant: InfografikaVariant,
  opts: { w: number; h: number }
): string {
  const { w, h } = opts;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas context topilmadi');

  // Background (premium gets a subtle gradient feel)
  if (variant.strategy === 'PREMIUM_PERCEPTION') {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(1, '#f8fafc');
    ctx.fillStyle = g;
  } else {
    ctx.fillStyle = '#ffffff';
  }
  ctx.fillRect(0, 0, w, h);

  // Product image placement (different "rakurs" via crop/zoom/angle)
  const imgW = baseImage.naturalWidth || baseImage.width;
  const imgH = baseImage.naturalHeight || baseImage.height;

  let zoom = 1.05;
  let rotation = 0;
  let focusY = 0.52;
  if (variant.layout === 'hero') {
    zoom = 1.02;
    rotation = 0;
    focusY = 0.52;
  } else if (variant.layout === 'detail') {
    zoom = 1.35;
    rotation = 0;
    focusY = 0.48;
  } else {
    zoom = 1.12;
    rotation = 0.04; // slight angle
    focusY = 0.52;
  }

  const scale = Math.max((w / imgW) * zoom, (h / imgH) * zoom);
  const dw = imgW * scale;
  const dh = imgH * scale;
  const dx = (w - dw) / 2;
  const dy = (h - dh) * (focusY - 0.5);

  ctx.save();
  ctx.translate(w / 2, h / 2);
  ctx.rotate(rotation);
  ctx.translate(-w / 2, -h / 2);
  ctx.drawImage(baseImage, dx, dy, dw, dh);
  ctx.restore();

  const pad = 64;
  const panelW = w - pad * 2;

  const preset = (() => {
    if (variant.strategy === 'CTR_BOOSTER') {
      return {
        panelH: 460,
        panelOpacity: 0.94,
        headlineSize: 62,
        bulletSize: 36,
        badgeBg: '#2563eb',
        accent: '#2563eb',
        badgeTop: true,
        headlineColor: '#0b1220',
      };
    }
    if (variant.strategy === 'TRUST_OPTIMIZER') {
      return {
        panelH: 440,
        panelOpacity: 0.93,
        headlineSize: 58,
        bulletSize: 34,
        badgeBg: '#059669',
        accent: '#059669',
        badgeTop: false,
        headlineColor: '#0f172a',
      };
    }
    return {
      panelH: 390,
      panelOpacity: 0.9,
      headlineSize: 54,
      bulletSize: 32,
      badgeBg: '#111827',
      accent: '#111827',
      badgeTop: false,
      headlineColor: '#0f172a',
    };
  })();

  const panelH = preset.panelH;
  const panelX = pad;
  const panelY = h - pad - panelH;

  ctx.save();
  ctx.fillStyle = `rgba(255,255,255,${preset.panelOpacity})`;
  ctx.shadowColor = 'rgba(0,0,0,0.08)';
  ctx.shadowBlur = 18;
  ctx.shadowOffsetY = 8;
  drawRoundedRect(ctx, panelX, panelY, panelW, panelH, 34);
  ctx.fill();
  ctx.restore();

  // CTR scroll-stopper top ribbon
  if (preset.badgeTop && variant.strategy === 'CTR_BOOSTER') {
    ctx.save();
    ctx.fillStyle = preset.accent;
    drawRoundedRect(ctx, panelX, pad, panelW, 92, 34);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 36px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto';
    ctx.textBaseline = 'middle';
    const ribbonText = (variant.badge || 'TOP TANLOV').toString().toUpperCase();
    ctx.fillText(ribbonText.slice(0, 22), panelX + 36, pad + 46);
    ctx.restore();
  }

  // Badge (pill)
  const rawBadgeText = (variant.badge || '').trim();
  const badgeIsAggressive = /%|chegirma|aksiya|sale|skidka|promo|0%|bepul/i.test(rawBadgeText);
  const badgeText = badgeIsAggressive
    ? ''
    : variant.strategy === 'TRUST_OPTIMIZER'
      ? ''
      : variant.strategy === 'PREMIUM_PERCEPTION'
        ? ''
        : rawBadgeText.slice(0, 18);
  let cursorY = panelY + 42;
  const cursorX = panelX + 42;

  const showPillBadge = badgeText && !(preset.badgeTop && variant.strategy === 'CTR_BOOSTER');

  if (showPillBadge) {
    ctx.save();
    ctx.font = '700 30px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto';
    const bw = clamp(ctx.measureText(badgeText).width + 44, 180, panelW);
    const bh = 56;
    ctx.fillStyle = preset.badgeBg;
    drawRoundedRect(ctx, cursorX, cursorY, bw, bh, 999);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.textBaseline = 'middle';
    ctx.fillText(badgeText, cursorX + 22, cursorY + bh / 2 + 1);
    ctx.restore();
    cursorY += 78;
  }

  // Accent line for premium/trust (subtle)
  if (variant.strategy !== 'CTR_BOOSTER') {
    ctx.save();
    ctx.fillStyle = preset.accent;
    ctx.globalAlpha = variant.strategy === 'PREMIUM_PERCEPTION' ? 0.14 : 0.18;
    drawRoundedRect(ctx, panelX + 28, panelY + 22, panelW - 56, 8, 999);
    ctx.fill();
    ctx.restore();
  }

  // Headline
  ctx.save();
  ctx.fillStyle = preset.headlineColor;
  ctx.font = `900 ${preset.headlineSize}px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto`;
  const headline = String(variant.headline || '').trim();
  const headlineLines = wrapText(ctx, headline, panelW - 84).slice(0, 2);
  for (const line of headlineLines) {
    ctx.fillText(line, cursorX, cursorY);
    cursorY += preset.headlineSize + 10;
  }
  ctx.restore();

  // Bullets
  ctx.save();
  ctx.fillStyle = variant.strategy === 'PREMIUM_PERCEPTION' ? '#475569' : '#334155';
  ctx.font = `700 ${preset.bulletSize}px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto`;
  const bullets = Array.isArray(variant.bullets) ? variant.bullets.slice(0, 3) : [];
  for (const b of bullets) {
    const text = String(b || '').trim();
    if (!text) continue;
    const dot = variant.strategy === 'TRUST_OPTIMIZER' ? '✓' : '•';
    ctx.fillText(dot, cursorX, cursorY + 8);
    ctx.fillText(text, cursorX + 28, cursorY + 8);
    cursorY += preset.bulletSize + 20;
  }
  ctx.restore();

  // Small safety footer (optional, very subtle)
  ctx.save();
  ctx.fillStyle = 'rgba(15, 23, 42, 0.55)';
  ctx.font = '600 22px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto';
  ctx.fillText('Marketplace safe', panelX + panelW - 210, panelY + panelH - 26);
  ctx.restore();

  return canvas.toDataURL('image/png');
}

export default function InfografikaClient() {
  const { t } = useLanguage();
  const toast = useToast();

  const [user, setUser] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);

  const plan: SubscriptionPlan = (user?.subscription_plan || 'free') as SubscriptionPlan;
  const isAdmin = user?.role === 'admin';
  const tokensRemaining = isAdmin ? 999999 : Number(user?.tokens_remaining || 0);

  const variantLimit = useMemo(() => {
    if (isAdmin) return 3;
    if (plan === 'starter') return 1;
    if (plan === 'pro') return 2;
    if (plan === 'business_plus') return 3;
    return 0;
  }, [isAdmin, plan]);

  const descriptionCharLimit = useMemo(() => {
    if (isAdmin) return 150;
    if (plan === 'starter') return 80;
    if (plan === 'pro') return 120;
    if (plan === 'business_plus') return 150;
    return 0;
  }, [isAdmin, plan]);

  const productNameCharLimit = useMemo(() => {
    if (isAdmin) return 60;
    if (plan === 'starter') return 40;
    if (plan === 'pro') return 50;
    if (plan === 'business_plus') return 60;
    return 0;
  }, [isAdmin, plan]);

  const [image, setImage] = useState<string>('');
  const [productName, setProductName] = useState<string>('');
  const [productDescription, setProductDescription] = useState<string>('');
  const [generating, setGenerating] = useState(false);
  const [variants, setVariants] = useState<InfografikaVariant[]>([]);
  const [rendered, setRendered] = useState<Record<string, string>>({});

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const lastRenderedForImageRef = useRef<string>('');

  const openSubscribe = (targetPlan: SubscriptionPlan) => {
    window.open(getTelegramSubscribeUrl(targetPlan), '_blank');
  };

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await fetch('/api/auth/me');
        if (!res.ok) return;
        const data = await res.json();
        if (data.success && data.user) {
          setUser({
            subscription_plan: data.user.subscription_plan || 'free',
            tokens_remaining: data.user.tokens_remaining || 0,
            tokens_total: data.user.tokens_total || 0,
            role: data.user.role || 'user',
          });
        }
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    };
    fetchUser();
  }, []);

  const handlePickFile = useCallback(async (file: File | null) => {
    if (!file) return;
    try {
      const dataUrl = await fileToDataUrl(file);
      setImage(dataUrl);
      setVariants([]);
      setRendered({});
      lastRenderedForImageRef.current = '';
    } catch (e) {
      toast.error((e as Error).message || 'Xatolik');
    }
  }, [toast]);

  const handleGenerateVariants = useCallback(async () => {
    if (variantLimit <= 0) {
      toast.error("Bu funksiya Starter va undan yuqori tariflarda mavjud.");
      return;
    }
    if (!image) {
      toast.error('Avval mahsulot rasmini yuklang.');
      return;
    }

    setGenerating(true);
    try {
      const res = await fetch('/api/infografika/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image,
          productName: productName.trim(),
          productDescription: productDescription.trim(),
        }),
      });

      if (!res.ok) {
        const parsed = await parseApiErrorResponse(res);
        const { title, message } = toUzbekErrorMessage(parsed);
        toast.error(message, title);
        return;
      }

      const data = await res.json();
      const v = Array.isArray(data?.variants) ? (data.variants as InfografikaVariant[]) : [];
      if (!v.length) {
        toast.error('Variantlar yaratilmadi.');
        return;
      }

      setVariants(v.slice(0, variantLimit));
      toast.success('Variantlar tayyor. Endi tanlang va yuklab oling.');
    } catch (e) {
      toast.error((e as Error).message || 'Xatolik');
    } finally {
      setGenerating(false);
    }
  }, [image, productDescription, productName, toast, variantLimit]);

  useEffect(() => {
    const doRender = async () => {
      if (!image || variants.length === 0) return;

      // If server returned AI-rendered images for all variants, skip canvas rendering.
      const allHaveServerImages = variants.every((v) => typeof v.image === 'string' && v.image.startsWith('data:image/'));
      if (allHaveServerImages) {
        const next: Record<string, string> = {};
        for (const v of variants) {
          next[v.id] = String(v.image);
        }
        lastRenderedForImageRef.current = image;
        setRendered(next);
        return;
      }

      if (lastRenderedForImageRef.current === image) {
        // Re-render only if some variant missing
        const missing = variants.some((v) => !(v.image && String(v.image).startsWith('data:image/')) && !rendered[v.id]);
        if (!missing) return;
      }

      try {
        const img = await loadImage(image);
        const next: Record<string, string> = {};
        for (const v of variants) {
          if (v.image && String(v.image).startsWith('data:image/')) {
            next[v.id] = String(v.image);
          } else {
            next[v.id] = renderInfografika(img, v, { w: 1080, h: 1440 });
          }
        }
        lastRenderedForImageRef.current = image;
        setRendered(next);
      } catch (e) {
        toast.error((e as Error).message || 'Render xatoligi');
      }
    };

    void doRender();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [image, variants]);

  return (
    <div className="relative mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900">{t('infografikaPage.title', 'Infografika')}</h1>
        <p className="mt-2 text-sm text-slate-600">{t('infografikaPage.subtitle', 'Infografika generatori bo‘limi.')}</p>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-6 lg:flex-row">
          <div className="w-full lg:w-[420px]">
            <div className="rounded-2xl border border-slate-200 p-4">
              <p className="text-sm font-semibold text-slate-900">Mahsulot rasmlari</p>
              <p className="mt-1 text-xs text-slate-600">1 ta rasm yetarli. Variantlar rakurs (crop/zoom) va matnlarda farq qiladi.</p>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(e) => void handlePickFile(e.target.files?.[0] || null)}
              />

              {image ? (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="mt-4 w-full overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 text-left"
                  title="Rasmni almashtirish"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={image} alt="Mahsulot" className="h-auto w-full" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="mt-4 grid h-56 w-full place-items-center rounded-2xl border-2 border-dashed border-slate-300 bg-white text-slate-500 hover:border-slate-400"
                  title="Rasm yuklash"
                >
                  <div className="grid place-items-center gap-2">
                    <div className="grid h-14 w-14 place-items-center rounded-2xl border border-slate-200 bg-slate-50">
                      <Plus className="h-7 w-7" />
                    </div>
                    <span className="text-sm font-medium">Rasm yuklang</span>
                  </div>
                </button>
              )}
            </div>

            <div className="mt-4 rounded-2xl border border-slate-200 p-4">
              <p className="text-sm font-semibold text-slate-900">Mahsulot haqida (ixtiyoriy)</p>
              <p className="mt-1 text-xs text-slate-600">AI CTR/Trust/Premium matnlarini shunga qarab moslaydi.</p>

              <label className="mt-3 block">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-700">Mahsulot nomi (ixtiyoriy)</span>
                  <span className="text-xs text-slate-500">
                    {productName.length}/{productNameCharLimit || 0}
                  </span>
                </div>
                <input
                  value={productName}
                  onChange={(e) => setProductName(e.target.value.slice(0, Math.max(0, productNameCharLimit)))}
                  maxLength={productNameCharLimit || 0}
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-900 outline-none focus:border-blue-400"
                  placeholder="Masalan: Erkaklar krossovkasi"
                />
              </label>

              <div className="mt-4 flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700">Mahsulot tavsifi (ixtiyoriy)</span>
                <span className="text-xs text-slate-500">
                  {productDescription.length}/{descriptionCharLimit || 0}
                </span>
              </div>
              <textarea
                value={productDescription}
                onChange={(e) => setProductDescription(e.target.value.slice(0, Math.max(0, descriptionCharLimit)))}
                maxLength={descriptionCharLimit || 0}
                rows={4}
                className="mt-3 w-full rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-900 outline-none focus:border-blue-400"
                placeholder="Masalan: 100% paxta, 10 kun kafolat, tez yetkazib berish"
              />
            </div>

            <div className="mt-4 rounded-2xl border border-slate-200 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-900">Variantlar</p>
                  <p className="mt-1 text-xs text-slate-600">
                    Starter: 1 ta • Pro: 2 ta • Business+: 3 ta
                  </p>
                </div>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                  {loading ? '...' : variantLimit} ta
                </span>
              </div>

              {variantLimit <= 0 ? (
                <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                  Bu bo‘lim Starter va undan yuqori tariflarda.
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={() => openSubscribe('starter')}
                      className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
                    >
                      Starter olish
                    </button>
                    <button
                      onClick={() => openSubscribe('pro')}
                      className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                    >
                      Pro olish
                    </button>
                  </div>
                </div>
              ) : null}

              <button
                disabled={generating || variantLimit <= 0 || !image}
                onClick={() => void handleGenerateVariants()}
                className="mt-4 w-full rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:bg-black disabled:cursor-not-allowed disabled:opacity-60"
              >
                {generating ? 'Tayyorlayapman...' : 'Infografika variantlarini yaratish (20 token)'}
              </button>

              <p className="mt-3 text-xs text-slate-500">Token: {isAdmin ? '∞' : tokensRemaining.toFixed(2)}</p>
            </div>
          </div>

          <div className="flex-1">
            {variants.length === 0 ? (
              <div className="grid h-[520px] place-items-center rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
                <div>
                  <p className="text-lg font-bold text-slate-900">Variantlar shu yerda chiqadi</p>
                  <p className="mt-2 text-sm text-slate-600">
                    Strategiya asosida (CTR / Trust / Premium) 1–3 ta variant tayyorlaymiz.
                  </p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {variants.map((v) => {
                  const imgOut = rendered[v.id];
                  return (
                    <div key={v.id} className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
                      <div className="p-4">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-extrabold text-slate-900">{v.title}</p>
                          <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold text-slate-700">
                            CTR {v.scores?.ctrImpact ?? '-'} • Trust {v.scores?.trustSignal ?? '-'} • Premium {v.scores?.premiumScore ?? '-'} • Safe {v.scores?.marketplaceSafe ?? '-'}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-slate-600">{v.strategy.replaceAll('_', ' ')} • {v.layout}</p>
                      </div>

                      <div className="bg-slate-50">
                        {imgOut ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={imgOut} alt={v.title} className="h-auto w-full" />
                        ) : (
                          <div className="grid h-80 place-items-center text-sm text-slate-500">Render...</div>
                        )}
                      </div>

                      <div className="p-4">
                        <button
                          disabled={!imgOut}
                          onClick={() => imgOut && downloadDataUrl(imgOut, `infografika_${v.id}.png`)}
                          className="w-full rounded-2xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          PNG yuklab olish
                        </button>

                        {v.image_error ? (
                          <p className="mt-2 text-[11px] text-amber-700">
                            AI dizayn yaratishda xatolik bo‘ldi, canvas fallback ishlatildi.
                          </p>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
