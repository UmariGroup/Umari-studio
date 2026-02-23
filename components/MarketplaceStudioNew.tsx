'use client';

import Link from 'next/link';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import JSZip from 'jszip';
import { useToast } from './ToastProvider';
import { getTelegramSubscribeUrl } from '@/lib/telegram';
import { parseApiErrorResponse, toUzbekErrorMessage } from '@/lib/uzbek-errors';
import { FiZap, FiArrowLeft, FiStar } from 'react-icons/fi';
import { useLanguage } from '@/lib/LanguageContext';

// ============ TYPES ============
type ImageMode = 'basic' | 'pro' | 'ultra';
type SubscriptionPlan = 'free' | 'starter' | 'pro' | 'business_plus';

interface UserData {
  subscription_plan: SubscriptionPlan;
  tokens_remaining: number;
  tokens_total: number;
  role: string;
}

interface PlanConfig {
  maxProductImages: number;
  maxStyleImages: number;
  outputCountBasic: number;
  outputCountPro: number;
  outputCountUltra: number;
  basicTokenCost: number;
  proTokenCost: number;
  ultraTokenCost: number;
  basicModel: string;
  proModel: string | null;
  ultraModel: string | null;
}

type ImageBatchStatus = 'queued' | 'processing' | 'succeeded' | 'partial' | 'failed' | 'canceled';

interface ImageBatchItem {
  id: string;
  index: number;
  status: string;
  label: string | null;
  imageUrl: string | null;
  error: string | null;
}

// ============ PLAN CONFIGURATIONS ============
const PLAN_CONFIGS: Record<SubscriptionPlan, PlanConfig> = {
  free: {
    maxProductImages: 1,
    maxStyleImages: 0,
    outputCountBasic: 1,
    outputCountPro: 0,
    outputCountUltra: 0,
    basicTokenCost: 2,
    proTokenCost: 999,
    ultraTokenCost: 999,
    basicModel: 'gemini-2.5-flash-image',
    proModel: null,
    ultraModel: null,
  },
  starter: {
    maxProductImages: 3,
    maxStyleImages: 0,
    outputCountBasic: 2,
    outputCountPro: 2,
    outputCountUltra: 0,
    basicTokenCost: 2,
    proTokenCost: 7,
    ultraTokenCost: 999,
    basicModel: 'gemini-2.5-flash-image',
    proModel: 'nano-banana-pro-preview',
    ultraModel: null,
  },
  pro: {
    maxProductImages: 4,
    maxStyleImages: 0,
    outputCountBasic: 2,
    outputCountPro: 3,
    outputCountUltra: 0,
    basicTokenCost: 1.5,
    proTokenCost: 6,
    ultraTokenCost: 999,
    basicModel: 'gemini-2.5-flash-image',
    proModel: 'nano-banana-pro-preview',
    ultraModel: null,
  },
  business_plus: {
    maxProductImages: 5,
    maxStyleImages: 2,
    outputCountBasic: 3,
    outputCountPro: 4,
    outputCountUltra: 4,
    basicTokenCost: 1,
    proTokenCost: 5,
    ultraTokenCost: 15,
    basicModel: 'gemini-2.5-flash-image',
    proModel: 'nano-banana-pro-preview',
    ultraModel: 'gemini-3-pro-image-preview',
  },
};

const MarketplaceStudio: React.FC = () => {
  const toast = useToast();
  const { t, language } = useLanguage();

  const withLang = useCallback(
    (href: string) => {
      if (!href.startsWith('/')) return href;
      const stripped = href.replace(/^\/(uz|ru)(?=\/|$)/, '');
      return `/${language}${stripped || ''}`;
    },
    [language]
  );

  // User state
  const [user, setUser] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);

  // Image mode tab
  const [imageMode, setImageMode] = useState<ImageMode>('pro');
  const hasManuallySelectedMode = useRef(false);
  const ultraAutoPromptDoneRef = useRef(false);

  // Images
  const [productImages, setProductImages] = useState<(string | null)[]>([null]);
  const [styleImages, setStyleImages] = useState<(string | null)[]>([null]);
  const [generatedImages, setGeneratedImages] = useState<string[]>([]);

  // UI state
  const [generating, setGenerating] = useState(false);
  const [promptUz, setPromptUz] = useState('');
  const [promptEn, setPromptEn] = useState('');
  const [promptGenerating, setPromptGenerating] = useState(false);
  const lastAutoPromptImageRef = useRef<string | null>(null);
  const [batchId, setBatchId] = useState<string | null>(null);
  const [batchStatus, setBatchStatus] = useState<ImageBatchStatus | null>(null);
  const [batchItems, setBatchItems] = useState<ImageBatchItem[]>([]);
  const [queuePosition, setQueuePosition] = useState<number | null>(null);
  const [etaSeconds, setEtaSeconds] = useState<number | null>(null);
  const [parallelLimit, setParallelLimit] = useState<number | null>(null);
  const [progressPct, setProgressPct] = useState<number>(0);
  const [cooldownSeconds, setCooldownSeconds] = useState<number>(0);

  const MARKETPLACE_ASPECT_RATIO = '3:4' as const;
  const TARGET_W = 1080;
  const TARGET_H = 1440;

  const formatEta = (seconds: number | null): string => {
    if (typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds <= 0) return '...';

    if (seconds < 60) {
      return `~${Math.max(5, Math.round(seconds))} ${t('marketplaceNew.time.seconds', 'soniya')}`;
    }

    const minutes = Math.max(1, Math.round(seconds / 60));
    if (minutes < 60) {
      return `~${minutes} ${t('marketplaceNew.time.minutes', 'daqiqa')}`;
    }

    const hours = Math.floor(minutes / 60);
    const remainMinutes = minutes % 60;
    return remainMinutes > 0
      ? `~${hours} ${t('marketplaceNew.time.hours', 'soat')} ${remainMinutes} ${t('marketplaceNew.time.minutes', 'daqiqa')}`
      : `~${hours} ${t('marketplaceNew.time.hours', 'soat')}`;
  };

  const normalizeTo1080x1440 = useCallback(async (src: string): Promise<string> => {
    const toDataUrl = async (input: string): Promise<string> => {
      if (input.startsWith('data:image/')) return input;

      const res = await fetch(input);
      if (!res.ok) throw new Error(t('marketplaceNew.errors.imageDownloadFailed', 'Rasmni yuklab bo‘lmadi'));
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      try {
        return await new Promise<string>((resolve, reject) => {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => {
            try {
              const canvas = document.createElement('canvas');
              canvas.width = TARGET_W;
              canvas.height = TARGET_H;
              const ctx = canvas.getContext('2d');
              if (!ctx) throw new Error(t('marketplaceNew.errors.canvasContextMissing', 'Canvas context topilmadi'));

              const iw = img.naturalWidth || img.width;
              const ih = img.naturalHeight || img.height;
              if (!iw || !ih) throw new Error(t('marketplaceNew.errors.imageSizeUnknown', 'Rasm o‘lchami noma’lum'));

              // "cover" scale + center crop
              const scale = Math.max(TARGET_W / iw, TARGET_H / ih);
              const dw = iw * scale;
              const dh = ih * scale;
              const dx = (TARGET_W - dw) / 2;
              const dy = (TARGET_H - dh) / 2;

              ctx.clearRect(0, 0, TARGET_W, TARGET_H);
              ctx.drawImage(img, dx, dy, dw, dh);
              resolve(canvas.toDataURL('image/png'));
            } catch (e) {
              reject(e);
            }
          };
          img.onerror = () => reject(new Error(t('marketplaceNew.errors.imageReadFailed', 'Rasmni o‘qib bo‘lmadi')));
          img.src = blobUrl;
        });
      } finally {
        URL.revokeObjectURL(blobUrl);
      }
    };

    // If it's already a data URL, we can draw it directly.
    if (src.startsWith('data:image/')) {
      return await new Promise<string>((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          try {
            const canvas = document.createElement('canvas');
            canvas.width = TARGET_W;
            canvas.height = TARGET_H;
            const ctx = canvas.getContext('2d');
            if (!ctx) throw new Error(t('marketplaceNew.errors.canvasContextMissing', 'Canvas context topilmadi'));

            const iw = img.naturalWidth || img.width;
            const ih = img.naturalHeight || img.height;
            const scale = Math.max(TARGET_W / iw, TARGET_H / ih);
            const dw = iw * scale;
            const dh = ih * scale;
            const dx = (TARGET_W - dw) / 2;
            const dy = (TARGET_H - dh) / 2;

            ctx.clearRect(0, 0, TARGET_W, TARGET_H);
            ctx.drawImage(img, dx, dy, dw, dh);
            resolve(canvas.toDataURL('image/png'));
          } catch (e) {
            reject(e);
          }
        };
        img.onerror = () => reject(new Error(t('marketplaceNew.errors.imageReadFailed', 'Rasmni o‘qib bo‘lmadi')));
        img.src = src;
      });
    }

    // Same-origin public URL
    return await toDataUrl(src);
  }, []);

  const dataUrlToBlob = (dataUrl: string): Blob => {
    const parts = String(dataUrl || '').split(',');
    if (parts.length < 2) throw new Error('Invalid data URL');

    const meta = parts[0] || '';
    const base64 = parts.slice(1).join(',');
    const match = /^data:(.*?);base64$/i.exec(meta);
    const mime = match?.[1] || 'image/png';

    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new Blob([bytes], { type: mime });
  };

  const srcToBlob = async (src: string): Promise<Blob> => {
    if (src.startsWith('data:')) return dataUrlToBlob(src);
    const res = await fetch(src);
    if (!res.ok) throw new Error(t('marketplaceNew.errors.imageDownloadFailed', 'Rasmni yuklab bo‘lmadi'));
    return await res.blob();
  };

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  // Derived values
  const plan = user?.subscription_plan || 'free';
  const isAdmin = user?.role === 'admin';
  const config = PLAN_CONFIGS[plan];
  const proModeAvailable = Boolean(config.proModel);
  const ultraModeAvailable = Boolean(config.ultraModel);
  const styleMaxImages =
    imageMode === 'ultra' && ultraModeAvailable
      ? config.maxStyleImages
      : plan === 'business_plus' && imageMode === 'pro'
        ? 1
        : 0;
  const styleEnabled = styleMaxImages > 0;

  const tokensRemaining = isAdmin ? 999999 : (user?.tokens_remaining || 0);
  const currentTokenCost =
    imageMode === 'ultra'
      ? config.ultraTokenCost
      : imageMode === 'pro'
        ? config.proTokenCost
        : config.basicTokenCost;

  const currentOutputCount =
    imageMode === 'ultra'
      ? config.outputCountUltra
      : imageMode === 'pro'
        ? config.outputCountPro
        : config.outputCountBasic;
  const canGenerate = tokensRemaining >= currentTokenCost && plan !== 'free' && cooldownSeconds <= 0;

  // Default mode: Pro when available; otherwise Oddiy.
  // Note: initial config is `free` until `/api/auth/me` resolves.
  useEffect(() => {
    if (loading) return;

    // Always prevent invalid mode selection.
    if (imageMode === 'ultra' && !ultraModeAvailable) {
      setImageMode(proModeAvailable ? 'pro' : 'basic');
      return;
    }
    if (imageMode === 'pro' && !proModeAvailable) {
      setImageMode('basic');
      return;
    }

    // Only auto-select if user hasn't clicked the tabs.
    if (hasManuallySelectedMode.current) return;

    setImageMode(proModeAvailable ? 'pro' : 'basic');
  }, [loading, imageMode, proModeAvailable, ultraModeAvailable]);

  useEffect(() => {
    if (!styleEnabled) {
      setStyleImages([null]);
      return;
    }

    setStyleImages((prev) => {
      const trimmed = prev.slice(0, Math.max(1, styleMaxImages));
      return trimmed.length === 0 ? [null] : trimmed;
    });
  }, [styleEnabled, styleMaxImages]);

  const openSubscribe = (targetPlan: SubscriptionPlan) => {
    window.open(getTelegramSubscribeUrl(targetPlan), '_blank');
  };

  // Fetch user data
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await fetch('/api/auth/me');
        if (!res.ok) {
          window.location.href = withLang('/login');
          return;
        }
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

  // Cooldown timer (transparent plan limits)
  useEffect(() => {
    if (cooldownSeconds <= 0) return;
    const timer = setInterval(() => {
      setCooldownSeconds((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldownSeconds]);

  // Poll queued batch (progress + queue position + results)
  useEffect(() => {
    if (!batchId) return;

    let cancelled = false;
    let timer: NodeJS.Timeout | null = null;
    let inFlight = false;

    const poll = async () => {
      if (cancelled || inFlight) return;
      inFlight = true;

      let nextDelayMs = 2500;

      try {
        const res = await fetch(`/api/image-batches/${encodeURIComponent(batchId)}`);
        if (!res.ok) {
          nextDelayMs = 4000;
          return;
        }
        const data = await res.json();
        const batch = data?.batch;
        if (!batch || cancelled) {
          nextDelayMs = 4000;
          return;
        }

        setBatchStatus(batch.status || null);
        setQueuePosition(typeof batch.queue_position === 'number' ? batch.queue_position : null);
        setEtaSeconds(typeof batch.eta_seconds === 'number' ? batch.eta_seconds : null);
        setParallelLimit(typeof batch.parallel_limit === 'number' ? batch.parallel_limit : null);
        setProgressPct(typeof batch?.progress?.percent === 'number' ? batch.progress.percent : 0);

        nextDelayMs = batch.status === 'queued' ? 3000 : 1800;

        const items: ImageBatchItem[] = Array.isArray(batch.items)
          ? batch.items.map((it: any) => ({
            id: String(it?.id || ''),
            index: Number(it?.index || 0),
            status: String(it?.status || ''),
            label: it?.label ? String(it.label) : null,
            imageUrl: it?.imageUrl ? String(it.imageUrl) : null,
            error: it?.error ? String(it.error) : null,
          }))
          : [];

        setBatchItems(items);

        const succeededImages = items
          .filter((it) => it.status === 'succeeded' && it.imageUrl)
          .sort((a, b) => a.index - b.index)
          .map((it) => it.imageUrl as string);
        setGeneratedImages(succeededImages);

        if (typeof batch.tokens_remaining === 'number') {
          setUser((prev) => (prev ? { ...prev, tokens_remaining: batch.tokens_remaining } : prev));
        }

        if (
          batch.status === 'succeeded' ||
          batch.status === 'partial' ||
          batch.status === 'failed' ||
          batch.status === 'canceled'
        ) {
          setGenerating(false);

          if (batch.status === 'succeeded') toast.success('Rasm muvaffaqiyatli yaratildi!');
          else if (batch.status === 'partial') toast.info("Rasmlarning bir qismi yaratildi (qolganlari xatolik).");
          else if (batch.status === 'canceled') toast.info('Navbat bekor qilindi.');
          else toast.error(items.find((it) => it.error)?.error || 'Rasm yaratishda xatolik.');

          // Keep batchId so user can still see results; stop polling only.
          return;
        }
      } catch {
        nextDelayMs = 4000;
      } finally {
        inFlight = false;
        if (!cancelled) {
          timer = setTimeout(() => {
            void poll();
          }, nextDelayMs);
        }
      }
    };

    void poll();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [batchId, toast]);

  // File upload handler
  const handleUpload = useCallback(
    async (
      index: number,
      file: File,
      type: 'product' | 'style',
      setImages: React.Dispatch<React.SetStateAction<(string | null)[]>>
    ) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const base64 = e.target?.result as string;
        setImages((prev) => {
          const newArr = [...prev];
          newArr[index] = base64;
          return newArr;
        });
      };
      reader.readAsDataURL(file);
    },
    []
  );

  const handleUploadMany = useCallback(
  async (
    startIndex: number,
    files: File[],
    type: 'product' | 'style',
    setImages: React.Dispatch<React.SetStateAction<(string | null)[]>>,
    maxCount: number
  ) => {
    const toBase64 = (file: File) =>
      new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error('FileReader error'));
        reader.readAsDataURL(file);
      });

    const base64List = await Promise.all(files.map(toBase64));

    setImages((prev) => {
      const next = [...prev];

      // kerak bo‘lsa arrayni maxCount gacha kengaytirib olamiz
      while (next.length < maxCount) next.push(null);

      // startIndex dan boshlab joylashtiramiz
      base64List.forEach((b64, i) => {
        const pos = startIndex + i;
        if (pos < maxCount) next[pos] = b64;
      });

      return next.slice(0, maxCount);
    });
  },
  []
);


  // Add image slot
  const addImageSlot = useCallback(
    (type: 'product' | 'style') => {
      const maxCount = type === 'product' ? config.maxProductImages : styleMaxImages;
      const setImages = type === 'product' ? setProductImages : setStyleImages;
      const images = type === 'product' ? productImages : styleImages;

      if (images.length < maxCount) {
        setImages((prev) => [...prev, null]);
      }
    },
    [config, productImages, styleImages, styleMaxImages]
  );

  // Remove image
  const removeImage = useCallback(
    (index: number, type: 'product' | 'style') => {
      const setImages = type === 'product' ? setProductImages : setStyleImages;
      setImages((prev) => {
        const newArr = prev.filter((_, i) => i !== index);
        return newArr.length === 0 ? [null] : newArr;
      });
    },
    []
  );

  const handleGeneratePromptByImage = useCallback(
    async (options?: { auto?: boolean }) => {
      if (plan === 'free' && !isAdmin) {
        if (!options?.auto) {
          toast.error("Bu funksiya Starter va undan yuqori tariflarda mavjud.");
        }
        return false;
      }

      const validProductImages = productImages.filter((img): img is string => img !== null);
      if (validProductImages.length === 0) {
        if (!options?.auto) {
          toast.error(t('marketplaceNew.toasts.uploadAtLeastOneProductImage', 'Kamida bitta mahsulot rasmi yuklang!'));
        }
        return false;
      }

      if (!isAdmin && tokensRemaining < 1) {
        if (!options?.auto) {
          toast.error("Prompt yaratish uchun kamida 1 token kerak.");
        }
        return false;
      }

      setPromptGenerating(true);
      try {
        const response = await fetch('/api/generate-image-prompt', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            productImages: validProductImages.slice(0, config.maxProductImages),
            mode: imageMode,
          }),
        });

        if (!response.ok) {
          const parsed = await parseApiErrorResponse(response);
          const { title, message } = toUzbekErrorMessage(parsed);
          if (!options?.auto) {
            toast.error(message, title);
          }
          return false;
        }

        const data = await response.json();
        const generatedPromptUz =
          typeof data?.prompt_uz === 'string'
            ? data.prompt_uz.trim()
            : typeof data?.promptUz === 'string'
              ? data.promptUz.trim()
              : '';
        const generatedPromptEn =
          typeof data?.prompt_en === 'string'
            ? data.prompt_en.trim()
            : typeof data?.promptEn === 'string'
              ? data.promptEn.trim()
              : typeof data?.prompt === 'string'
                ? data.prompt.trim()
                : '';

        const fallbackPrompt = generatedPromptUz || generatedPromptEn;
        if (!fallbackPrompt) {
          if (!options?.auto) {
            toast.error("Prompt yaratib bo'lmadi.");
          }
          return false;
        }

        setPromptUz(generatedPromptUz || generatedPromptEn);
        setPromptEn(generatedPromptEn || generatedPromptUz);
        if (typeof data?.tokens_remaining === 'number') {
          setUser((prev) => (prev ? { ...prev, tokens_remaining: data.tokens_remaining } : prev));
        }

        if (!options?.auto) {
          toast.success("Rasmga mos prompt tayyorlandi (1 token).");
        }
        return true;
      } catch (error) {
        if (!options?.auto) {
          toast.error((error as Error).message || t('common.error', 'Xatolik'));
        }
        return false;
      } finally {
        setPromptGenerating(false);
      }
    },
    [config.maxProductImages, imageMode, isAdmin, plan, productImages, t, toast, tokensRemaining]
  );

  useEffect(() => {
    const validProductImages = productImages.filter((img): img is string => Boolean(img));
    const firstImage = validProductImages[0] || null;

    if (imageMode !== 'ultra' || !firstImage) {
      ultraAutoPromptDoneRef.current = false;
      lastAutoPromptImageRef.current = null;
      return;
    }

    if (promptUz.trim()) {
      ultraAutoPromptDoneRef.current = true;
      lastAutoPromptImageRef.current = firstImage;
      return;
    }

    if (lastAutoPromptImageRef.current === firstImage) return;

    lastAutoPromptImageRef.current = firstImage;
    ultraAutoPromptDoneRef.current = true;
    void handleGeneratePromptByImage({ auto: true });
  }, [handleGeneratePromptByImage, imageMode, productImages, promptUz]);

  // Generate images
  const handleGenerate = async () => {
    if (!canGenerate) {
      if (cooldownSeconds > 0) {
        const mm = String(Math.floor(cooldownSeconds / 60)).padStart(2, '0');
        const ss = String(cooldownSeconds % 60).padStart(2, '0');
        toast.info(t('marketplaceNew.toasts.nextGeneration', `Keyingi generatsiya: ${mm}:${ss}`).replace('{time}', `${mm}:${ss}`));
      } else {
        toast.error(t('marketplaceNew.toasts.notEnoughTokensOrNeedSubscription', 'Tokenlaringiz yetarli emas yoki obuna kerak!'));
      }
      return;
    }

    const validProductImages = productImages.filter((img): img is string => img !== null);
    if (validProductImages.length === 0) {
      toast.error(t('marketplaceNew.toasts.uploadAtLeastOneProductImage', 'Kamida bitta mahsulot rasmi yuklang!'));
      return;
    }

    if (!promptUz.trim()) {
      toast.error(t('marketplaceNew.toasts.enterPrompt', "So'rov matnini kiriting!"));
      return;
    }

    setGenerating(true);
    setBatchId(null);
    setBatchStatus('processing');
    setBatchItems([]);
    setQueuePosition(null);
    setEtaSeconds(null);
    setParallelLimit(null);
    setProgressPct(0);
    setGeneratedImages([]);

    try {
      const model =
        imageMode === 'ultra'
          ? config.ultraModel
          : imageMode === 'pro'
            ? config.proModel
            : config.basicModel;

      if (!model) {
        toast.error("Bu rejim sizning tarifingizda mavjud emas.");
        setGenerating(false);
        return;
      }

      const validStyleImages = styleEnabled
        ? styleImages.filter((img): img is string => img !== null).slice(0, styleMaxImages)
        : [];
      const promptForRequest = (promptEn && promptEn.trim()) ? promptEn.trim() : promptUz.trim();

      const response = await fetch('/api/generate-marketplace-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productImages: validProductImages,
          styleImages: validStyleImages,
          prompt: promptForRequest,
          aspectRatio: MARKETPLACE_ASPECT_RATIO,
          mode: imageMode,
          model,
        }),
      });

      if (!response.ok) {
        const parsed = await parseApiErrorResponse(response);
        const { title, message } = toUzbekErrorMessage(parsed);
        toast.error(message, title);

        if (typeof parsed.retryAfterSeconds === 'number' && parsed.retryAfterSeconds > 0) {
          setCooldownSeconds(parsed.retryAfterSeconds);
        }

        setGenerating(false);
        return;
      }

      const data = await response.json();

      const immediateImages = Array.isArray(data?.images)
        ? data.images.filter((img: unknown): img is string => typeof img === 'string' && img.length > 0)
        : [];
      const immediateItems: ImageBatchItem[] = Array.isArray(data?.items)
        ? data.items.map((it: any) => ({
          id: String(it?.id || ''),
          index: Number(it?.index || 0),
          status: String(it?.status || ''),
          label: it?.label ? String(it.label) : null,
          imageUrl: it?.imageUrl ? String(it.imageUrl) : null,
          error: it?.error ? String(it.error) : null,
        }))
        : [];

      if (immediateImages.length > 0 || data?.status === 'failed' || data?.status === 'partial' || data?.status === 'succeeded') {
        setGeneratedImages(immediateImages);
        setBatchItems(immediateItems);
        setBatchStatus(
          data?.status === 'failed' || data?.status === 'partial' || data?.status === 'succeeded'
            ? data.status
            : immediateImages.length > 0
              ? 'succeeded'
              : 'failed'
        );
        setProgressPct(100);
        setQueuePosition(null);
        setEtaSeconds(null);
        setParallelLimit(typeof data?.parallel_limit === 'number' ? data.parallel_limit : null);
        setGenerating(false);

        if (typeof data?.tokens_remaining === 'number') {
          setUser((prev) => (prev ? { ...prev, tokens_remaining: data.tokens_remaining } : prev));
        }

        if (data?.status === 'partial') {
          toast.info(t('marketplaceNew.toasts.partialSuccess', "Rasmlarning bir qismi yaratildi (qolganlari xatolik)."));
        } else if (immediateImages.length > 0) {
          toast.success(t('marketplaceNew.toasts.imageCreated', 'Rasm muvaffaqiyatli yaratildi!'));
        } else {
          toast.error(immediateItems.find((it) => it.error)?.error || t('marketplaceNew.toasts.imageCreateFailed', 'Rasm yaratishda xatolik.'));
        }
        return;
      }

      const newBatchId = typeof data?.batch_id === 'string' ? data.batch_id : '';
      if (!newBatchId) {
        toast.error(t('marketplaceNew.toasts.missingBatchId', 'Server batch id qaytarmadi.'));
        setGenerating(false);
        return;
      }

      setBatchId(newBatchId);
      setBatchStatus('queued');
      setQueuePosition(typeof data?.queue_position === 'number' ? data.queue_position : null);
      setEtaSeconds(typeof data?.eta_seconds === 'number' ? data.eta_seconds : null);
      setParallelLimit(typeof data?.parallel_limit === 'number' ? data.parallel_limit : null);

      if (typeof data?.tokens_remaining === 'number') {
        setUser((prev) => (prev ? { ...prev, tokens_remaining: data.tokens_remaining } : prev));
      }

      toast.info(t('marketplaceNew.toasts.queued', "So'rov navbatga qo'shildi. Navbat va progress ko'rsatiladi."));
    } catch (error) {
      toast.error((error as Error).message || t('common.error', 'Xatolik'));
      setGenerating(false);
    } finally {
      // generating is stopped by the poller when the batch finishes
    }
  };

  // Download image
  const downloadImage = async (src: string, index: number) => {
    const filename = `marketplace-image-${index + 1}-1080x1440.png`;
    try {
      const normalized = await normalizeTo1080x1440(src);
      const blob = await srcToBlob(normalized);
      downloadBlob(blob, filename);
    } catch {
      // Fallback: download the original source.
      const blob = await srcToBlob(src);
      downloadBlob(blob, filename);
    }
  };

  const downloadAllImagesZip = async () => {
    if (generatedImages.length === 0) return;
    try {
      toast.info(t('common.preparing', 'Tayyorlanmoqda...'));
      const zip = new JSZip();

      for (let i = 0; i < generatedImages.length; i++) {
        const src = generatedImages[i];
        let blob: Blob;
        try {
          const normalized = await normalizeTo1080x1440(src);
          blob = await srcToBlob(normalized);
        } catch {
          blob = await srcToBlob(src);
        }
        zip.file(`marketplace-image-${i + 1}-1080x1440.png`, blob);
      }

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      downloadBlob(zipBlob, 'marketplace-images.zip');
      toast.success(t('common.download', 'Yuklab olish'));
    } catch (e) {
      toast.error((e as Error).message || t('common.error', 'Xatolik'));
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-12 w-12 border-4 border-blue-500 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8 space-y-8">
      {/* Header with Token Info */}
      <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 rounded-3xl p-8 text-white shadow-2xl shadow-blue-200/30">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="flex items-center gap-5">
            <Link href={withLang('/dashboard')} className="p-4 bg-white/20 backdrop-blur-sm rounded-2xl hover:bg-white/30 transition text-white">
              <FiArrowLeft className="w-6 h-6" />
            </Link>
            <div className="p-4 bg-white/20 backdrop-blur-sm rounded-2xl">
              <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <h1 className="text-3xl font-black tracking-tight">{t('marketplaceNew.title', 'Market studiya')}</h1>
              <p className="text-white/80 text-sm mt-1">{t('marketplaceNew.subtitle', 'AI orqali professional mahsulot rasmlari yarating')}</p>
            </div>
          </div>

          {/* Token Display */}
          <div className="flex items-center gap-4">
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl px-6 py-4 border border-white/20">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-yellow-400/20 rounded-xl">
                  <svg className="w-6 h-6 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M10 18a8 8 0 100-16 8 8 0 000 16zm0-2a6 6 0 100-12 6 6 0 000 12z" />
                    <path d="M10 6a1 1 0 011 1v2h2a1 1 0 110 2h-2v2a1 1 0 11-2 0v-2H7a1 1 0 110-2h2V7a1 1 0 011-1z" />
                  </svg>
                </div>
                <div>
                  <p className="text-xs text-white/70">{t('marketplaceNew.tokens', 'Tokenlar')}</p>
                  <p className="text-xl font-bold">{isAdmin ? '∞' : tokensRemaining}</p>
                </div>
              </div>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl px-6 py-4 border border-white/20">
              <p className="text-xs text-white/70">{t('marketplaceNew.plan', 'Tarif')}</p>
              <p className="text-xl font-bold capitalize">{plan === 'business_plus' ? 'Business+' : plan}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Free Plan Warning */}
      {plan === 'free' && (
        <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-amber-100 rounded-xl">
              <svg className="w-6 h-6 text-amber-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div>
              <h3 className="font-bold text-amber-800">{t('marketplaceNew.premiumRequiredTitle', 'Premium obuna kerak!')}</h3>
              <p className="text-amber-700 text-sm">{t('marketplaceNew.premiumRequiredBody', "Market Studio dan foydalanish uchun Starter yoki undan yuqori obunaga o'ting.")}</p>
            </div>
            <button
              type="button"
              onClick={() => openSubscribe('starter')}
              className="ml-auto px-6 py-3 bg-amber-500 text-white rounded-xl font-semibold hover:bg-amber-600 transition-colors"
            >
              {t('marketplaceNew.getSubscription', 'Obuna olish')}
            </button>
          </div>
        </div>
      )}

      {/* Mode Tabs */}
      <div className="bg-white rounded-2xl border border-gray-200 p-2 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <button
            onClick={() => {
              hasManuallySelectedMode.current = true;
              setImageMode('basic');
            }}
            className={`py-4 px-6 rounded-xl font-semibold transition-all ${imageMode === 'basic'
              ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg'
              : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
              }`}
          >
            <div className="flex items-center justify-center gap-3">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <span>{t('marketplaceNew.basicMode', 'Oddiy')}</span>
              <span className={`px-2 py-0.5 rounded-full text-xs ${imageMode === 'basic' ? 'bg-white/20' : 'bg-emerald-100 text-emerald-700'}`}>
                {config.basicTokenCost} {t('marketplaceNew.tokenUnit', 'token')}
              </span>
            </div>
          </button>

          <button
            onClick={() => {
              hasManuallySelectedMode.current = true;
              setImageMode('pro');
            }}
            disabled={!proModeAvailable}
            className={`flex-1 py-4 px-6 rounded-xl font-semibold transition-all ${imageMode === 'pro'
              ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-lg'
              : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
              } ${!proModeAvailable ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <div className="flex items-center justify-center gap-3">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
              </svg>
              <span>Pro</span>
              <span className={`px-2 py-0.5 rounded-full text-xs ${imageMode === 'pro' ? 'bg-white/20' : 'bg-blue-100 text-blue-700'}`}>
                {!proModeAvailable
                  ? t('marketplaceNew.premiumBadge', 'Premium')
                  : `${config.proTokenCost} ${t('marketplaceNew.tokenUnit', 'token')}`}
              </span>
            </div>
          </button>

          <button
            onClick={() => {
              hasManuallySelectedMode.current = true;
              setImageMode('ultra');
            }}
            disabled={!ultraModeAvailable}
            className={`flex-1 py-4 px-6 rounded-xl font-semibold transition-all ${imageMode === 'ultra'
              ? 'bg-gradient-to-r from-fuchsia-600 to-indigo-600 text-white shadow-lg'
              : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
              } ${!ultraModeAvailable ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <div className="flex items-center justify-center gap-3">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.213 3.736a1 1 0 00.95.69h3.93c.969 0 1.371 1.24.588 1.81l-3.18 2.31a1 1 0 00-.364 1.118l1.214 3.736c.3.922-.755 1.688-1.54 1.118l-3.18-2.31a1 1 0 00-1.176 0l-3.18 2.31c-.784.57-1.838-.196-1.539-1.118l1.213-3.736a1 1 0 00-.364-1.118l-3.18-2.31c-.783-.57-.38-1.81.588-1.81h3.93a1 1 0 00.951-.69l1.213-3.736z" />
              </svg>
              <span>Ultra</span>
              <span className={`px-2 py-0.5 rounded-full text-xs ${imageMode === 'ultra' ? 'bg-white/20' : 'bg-fuchsia-100 text-fuchsia-700'}`}>
                {!ultraModeAvailable
                  ? t('marketplaceNew.premiumBadge', 'Premium')
                  : `${config.ultraTokenCost} ${t('marketplaceNew.tokenUnit', 'token')}`}
              </span>
            </div>
          </button>
        </div>
      </div>

      {imageMode === 'ultra' && ultraModeAvailable && (
        <div className="bg-violet-50 rounded-2xl p-4 border border-violet-200 text-sm text-violet-900">
          Ultra rejimida prompt mahsulot rasmlaridan avtomatik yaratiladi. Uslub rasmlari Ultra rejimida va Business+ Pro rejimida mavjud.
        </div>
      )}

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Input Section */}
        <div className="space-y-6">
          {/* Product Images */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-800">{t('marketplaceNew.productImages', 'Mahsulot rasmlari')}</h3>
              <span className="text-sm text-gray-500">{productImages.filter(Boolean).length}/{config.maxProductImages}</span>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {productImages.map((img, idx) => (
                <div key={idx} className="aspect-square relative">
                  {img ? (
                    <div className="relative w-full h-full">
                      <img src={img} alt="" className="w-full h-full object-cover rounded-xl" />
                      <button
                        onClick={() => removeImage(idx, 'product')}
                        className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center text-xs hover:bg-red-600"
                      >
                        ×
                      </button>
                    </div>
                  ) : (
                    <label className="w-full h-full border-2 border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors">
                      <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                      </svg>
                    <input
                      type="file"
                      multiple
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const files = e.target.files;
                        if (!files || files.length === 0) return;

                        handleUploadMany(idx, Array.from(files), 'product', setProductImages, config.maxProductImages);

                        // bir xil faylni qayta tanlasa ham change ishlashi uchun
                        e.currentTarget.value = '';
                      }}
                    />

                    </label>
                  )}
                </div>
              ))}
              {productImages.length < config.maxProductImages && (
                <button
                  onClick={() => addImageSlot('product')}
                  className="aspect-square border-2 border-dashed border-gray-300 rounded-xl flex items-center justify-center text-gray-400 hover:border-blue-400 hover:text-blue-400"
                >
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                </button>
              )}
            </div>
          </div>

          {/* Style Images */}
          {styleEnabled && (
            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-gray-800">{t('marketplaceNew.styleImagesOptional', 'Uslub rasmlari (ixtiyoriy)')}</h3>
                <span className="text-sm text-gray-500">{styleImages.filter(Boolean).length}/{styleMaxImages}</span>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {styleImages.map((img, idx) => (
                  <div key={idx} className="aspect-square relative">
                    {img ? (
                      <div className="relative w-full h-full">
                        <img src={img} alt="" className="w-full h-full object-cover rounded-xl" />
                        <button
                          onClick={() => removeImage(idx, 'style')}
                          className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center text-xs hover:bg-red-600"
                        >
                          ×
                        </button>
                      </div>
                    ) : (
                      <label className="w-full h-full border-2 border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-purple-400 hover:bg-purple-50 transition-colors">
                        <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                        </svg>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => e.target.files?.[0] && handleUpload(idx, e.target.files[0], 'style', setStyleImages)}
                        />
                      </label>
                    )}
                  </div>
                ))}
                {styleImages.length < styleMaxImages && (
                  <button
                    onClick={() => addImageSlot('style')}
                    className="aspect-square border-2 border-dashed border-gray-300 rounded-xl flex items-center justify-center text-gray-400 hover:border-purple-400 hover:text-purple-400"
                  >
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Prompt */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
            <h3 className="font-bold text-gray-800 mb-4">{t('marketplaceNew.promptTitle', "So'rov matni")}</h3>
            <div className="relative">
              <textarea
                value={promptUz}
                onChange={(e) => {
                  setPromptUz(e.target.value);
                  setPromptEn('');
                }}
                placeholder={t('marketplaceNew.promptPlaceholder', "Masalan: Mahsulotni oq fonda professional tarzda ko'rsating...")}
                className="w-full h-32 p-4 pr-24 border border-gray-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {imageMode !== 'ultra' && plan !== 'free' && (
                <button
                  type="button"
                  onClick={() => void handleGeneratePromptByImage()}
                  disabled={promptGenerating}
                  title="Rasmga qarab tayyor prompt generate qilish"
                  className="absolute right-3 bottom-3 inline-flex items-center gap-1 rounded-lg bg-blue-600 text-white px-3 py-2 text-xs font-semibold hover:bg-blue-700 disabled:opacity-60"
                >
                  <FiStar className="w-4 h-4" />
                  {promptGenerating ? '...' : '1 token'}
                </button>
              )}
            </div>
            {imageMode !== 'ultra' && plan !== 'free' && (
              <p className="mt-2 text-xs text-gray-500">
                Yulduzcha tugmasi rasmga qarab marketplace uchun tayyor prompt yaratadi (1 token).
              </p>
            )}
          </div>

          {/* Aspect Ratio */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
            <h3 className="font-bold text-gray-800 mb-2">{t('marketplaceNew.aspectRatio', 'Nisbat')}</h3>
            <p className="text-sm text-gray-600">
              {t('marketplaceNew.aspectRatioFixed', 'Marketplace uchun format doimiy:')} <strong>3:4 (1080×1440)</strong>
            </p>
          </div>

          {/* Generate Button */}
          <button
            onClick={handleGenerate}
            disabled={generating || !canGenerate}
            className={`w-full py-5 rounded-2xl font-bold text-lg transition-all ${generating || !canGenerate
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : 'bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:shadow-xl hover:scale-[1.02]'
              }`}
          >
            {generating ? (
              <div className="flex items-center justify-center gap-3">
                <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full" />
                <span>
                  {batchStatus === 'queued'
                    ? t('marketplaceNew.status.queuedLong', 'Navbatda...')
                    : t('marketplaceNew.status.generatingLong', 'Yaratilmoqda...')}
                  {batchStatus && batchStatus !== 'queued' ? ` (${progressPct}%)` : ''}
                </span>
              </div>
            ) : cooldownSeconds > 0 ? (
              <div className="flex items-center justify-center gap-3">
                <FiZap className="w-6 h-6" aria-hidden />
                <span>
                  {t('marketplaceNew.nextShort', 'Keyingi:')} {String(Math.floor(cooldownSeconds / 60)).padStart(2, '0')}:
                  {String(cooldownSeconds % 60).padStart(2, '0')}
                </span>
              </div>
            ) : (
              <div className="flex items-center justify-center gap-3">
                <FiZap className="w-6 h-6" aria-hidden />
                <span>{t('marketplaceNew.generateWithCost', `Yaratish (${currentTokenCost} token)`).replace('{cost}', String(currentTokenCost))}</span>
              </div>
            )}
          </button>

          {(generating || cooldownSeconds > 0) && (
            <div className="bg-gray-50 rounded-2xl border border-gray-200 p-4 text-sm text-gray-700">
              {cooldownSeconds > 0 && !generating && (
                <p>
                  {t('marketplaceNew.cooldown.planLimitPrefix', 'Tarif limiti: keyingi generatsiya')}{' '}
                  <strong>
                    {String(Math.floor(cooldownSeconds / 60)).padStart(2, '0')}:
                    {String(cooldownSeconds % 60).padStart(2, '0')}
                  </strong>{' '}
                  {t('marketplaceNew.cooldown.after', 'dan keyin.')}
                </p>
              )}

              {generating && batchStatus === 'queued' && (
                <div className="space-y-1">
                  <p className="font-semibold">{t('marketplaceNew.queue.youAreInQueue', 'Siz navbatdasiz')}</p>
                  <p>{t('marketplaceNew.queue.position', 'Navbat')}: {queuePosition ?? '...'}</p>
                  <p>
                    {t('marketplaceNew.queue.eta', 'Taxminiy vaqt')}: {' '}
                    {formatEta(etaSeconds)}
                  </p>
                  {typeof parallelLimit === 'number' && <p>{t('marketplaceNew.queue.parallelLimit', 'Parallel limit')}: {parallelLimit}</p>}
                </div>
              )}

              {generating && batchStatus && batchStatus !== 'queued' && (
                <div className="space-y-1">
                  <p className="font-semibold">{t('marketplaceNew.generating', 'Yaratilmoqda')}</p>
                  <p>{t('marketplaceNew.progress', 'Progress')}: {progressPct}%</p>
                  {typeof etaSeconds === 'number' && (
                    <p>
                      {t('marketplaceNew.queue.eta', 'Taxminiy vaqt')}: {formatEta(etaSeconds)}
                    </p>
                  )}
                  {typeof parallelLimit === 'number' && <p>{t('marketplaceNew.queue.parallelLimit', 'Parallel limit')}: {parallelLimit}</p>}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Output Section */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h3 className="font-bold text-gray-800">{t('marketplaceNew.generatedImages', 'Yaratilgan rasmlar')}</h3>
            {generatedImages.length > 0 && (
              <button
                type="button"
                onClick={() => void downloadAllImagesZip()}
                className="px-4 py-2 rounded-xl font-semibold bg-gray-900 text-white hover:bg-black"
              >
                Hammasini yuklab olish
              </button>
            )}
          </div>

          {batchItems.length > 0 && (
            <div className="mb-4">
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 to-purple-500"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-gray-600">
                {[...batchItems]
                  .sort((a, b) => a.index - b.index)
                  .map((it) => (
                    <div key={it.id} className="flex items-center justify-between gap-2">
                      <span className="truncate">{it.label || `Rasm ${it.index + 1}`}</span>
                      <span className="shrink-0">
                        {it.status === 'queued'
                          ? t('marketplaceNew.itemStatus.queued', 'navbatda')
                          : it.status === 'processing'
                            ? t('marketplaceNew.itemStatus.processing', 'ishlanmoqda')
                            : it.status === 'succeeded'
                              ? t('marketplaceNew.itemStatus.succeeded', 'tayyor')
                              : it.status === 'failed'
                                ? t('marketplaceNew.itemStatus.failed', 'xato')
                                : it.status}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {generatedImages.length > 0 ? (
            <div className="grid grid-cols-2 gap-4">
              {generatedImages.map((img, idx) => (
                <div key={idx} className="relative group">
                  <img src={img} alt="" className="w-full aspect-square object-cover rounded-xl" />
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl flex items-center justify-center">
                    <button
                      onClick={() => downloadImage(img, idx)}
                      className="px-4 py-2 bg-white text-gray-800 rounded-lg font-semibold hover:bg-gray-100"
                    >
                      {t('common.download', 'Yuklab olish')}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-64 text-gray-400">
              <svg className="w-16 h-16 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <p>{t('marketplaceNew.empty', "Rasmlar bu yerda ko'rinadi")}</p>
            </div>
          )}
        </div>
      </div>

      {/* Token Cost Info */}
      <div className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-2xl p-6 border border-gray-200">
        <h4 className="font-bold text-gray-700 mb-4 flex items-center gap-2">
          <svg className="w-5 h-5 text-amber-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
          {t('marketplaceNew.tokenPricingTitle', 'Token narxlari')} ({plan === 'business_plus' ? 'Business+' : plan} {t('marketplaceNew.planSuffix', 'tarif')})
        </h4>
        <div className={`grid grid-cols-2 ${ultraModeAvailable ? 'md:grid-cols-5' : 'md:grid-cols-4'} gap-4`}>
          <div className="bg-white p-4 rounded-xl border border-emerald-200">
            <p className="text-xs text-gray-500 mb-1">{t('marketplaceNew.pricing.basicImage', 'Oddiy rasm')}</p>
            <p className="text-2xl font-black text-emerald-600">{config.basicTokenCost}</p>
            <p className="text-xs text-gray-400">{t('marketplaceNew.pricing.perRequest', "token / so'rov")}</p>
          </div>
          <div className="bg-white p-4 rounded-xl border border-blue-200">
            <p className="text-xs text-gray-500 mb-1">{t('marketplaceNew.pricing.proImage', 'Pro rasm')}</p>
            <p className="text-2xl font-black text-blue-600">{config.proTokenCost}</p>
            <p className="text-xs text-gray-400">{t('marketplaceNew.pricing.perRequest', "token / so'rov")}</p>
          </div>
          {ultraModeAvailable && (
            <div className="bg-white p-4 rounded-xl border border-fuchsia-200">
              <p className="text-xs text-gray-500 mb-1">Ultra rasm</p>
              <p className="text-2xl font-black text-fuchsia-600">{config.ultraTokenCost}</p>
              <p className="text-xs text-gray-400">{t('marketplaceNew.pricing.perRequest', "token / so'rov")}</p>
            </div>
          )}
          <div className="bg-white p-4 rounded-xl border border-purple-200">
            <p className="text-xs text-gray-500 mb-1">{t('marketplaceNew.pricing.outputs', 'Chiqadigan rasmlar')}</p>
            <p className="text-2xl font-black text-purple-600">{currentOutputCount}</p>
            <p className="text-xs text-gray-400">{t('marketplaceNew.pricing.perGeneration', 'ta / generatsiya')}</p>
          </div>
          <div className="bg-white p-4 rounded-xl border border-amber-200">
            <p className="text-xs text-gray-500 mb-1">{t('marketplaceNew.pricing.tokensRemaining', 'Qolgan token')}</p>
            <p className="text-2xl font-black text-amber-600">{isAdmin ? '∞' : tokensRemaining}</p>
            <p className="text-xs text-gray-400">{t('marketplaceNew.tokenUnit', 'token')}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MarketplaceStudio;
