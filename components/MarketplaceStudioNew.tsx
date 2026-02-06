'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useToast } from './ToastProvider';
import { getTelegramSubscribeUrl } from '@/lib/telegram';
import { parseApiErrorResponse, toUzbekErrorMessage } from '@/lib/uzbek-errors';
import { FiZap } from 'react-icons/fi';

// ============ TYPES ============
type ImageMode = 'basic' | 'pro';
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
  outputCount: number;
  basicTokenCost: number;
  proTokenCost: number;
  basicModel: string;
  proModels: string[];
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
    outputCount: 1,
    basicTokenCost: 2,
    proTokenCost: 999,
    basicModel: 'gemini-2.5-flash-image',
    proModels: [],
  },
  starter: {
    maxProductImages: 3,
    maxStyleImages: 1,
    outputCount: 2,
    basicTokenCost: 2,
    proTokenCost: 7,
    basicModel: 'gemini-2.5-flash-image',
    proModels: ['gemini-3-pro-image-preview'],
  },
  pro: {
    maxProductImages: 4,
    maxStyleImages: 1,
    outputCount: 3,
    basicTokenCost: 1.5,
    proTokenCost: 6,
    basicModel: 'gemini-2.5-flash-image',
    proModels: ['gemini-3-pro-image-preview', 'nano-banana-pro-preview'],
  },
  business_plus: {
    maxProductImages: 5,
    maxStyleImages: 2,
    outputCount: 4,
    basicTokenCost: 1,
    proTokenCost: 5,
    basicModel: 'gemini-2.5-flash-image',
    proModels: ['gemini-3-pro-image-preview', 'nano-banana-pro-preview'],
  },
};

const MarketplaceStudio: React.FC = () => {
  const toast = useToast();
  
  // User state
  const [user, setUser] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Image mode tab
  const [imageMode, setImageMode] = useState<ImageMode>('basic');
  const [selectedProModel, setSelectedProModel] = useState<string>('gemini-3-pro-image-preview');
  
  // Images
  const [productImages, setProductImages] = useState<(string | null)[]>([null]);
  const [styleImages, setStyleImages] = useState<(string | null)[]>([null]);
  const [generatedImages, setGeneratedImages] = useState<string[]>([]);
  
  // UI state
  const [generating, setGenerating] = useState(false);
  const [prompt, setPrompt] = useState('');
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

  const normalizeTo1080x1440 = useCallback(async (src: string): Promise<string> => {
    const toDataUrl = async (input: string): Promise<string> => {
      if (input.startsWith('data:image/')) return input;

      const res = await fetch(input);
      if (!res.ok) throw new Error('Rasmni yuklab bo‘lmadi');
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
              if (!ctx) throw new Error('Canvas context topilmadi');

              const iw = img.naturalWidth || img.width;
              const ih = img.naturalHeight || img.height;
              if (!iw || !ih) throw new Error('Rasm o‘lchami noma’lum');

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
          img.onerror = () => reject(new Error('Rasmni o‘qib bo‘lmadi'));
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
            if (!ctx) throw new Error('Canvas context topilmadi');

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
        img.onerror = () => reject(new Error('Rasmni o‘qib bo‘lmadi'));
        img.src = src;
      });
    }

    // Same-origin public URL
    return await toDataUrl(src);
  }, []);

  // Derived values
  const plan = user?.subscription_plan || 'free';
  const isAdmin = user?.role === 'admin';
  const config = PLAN_CONFIGS[plan];
  const tokensRemaining = isAdmin ? 999999 : (user?.tokens_remaining || 0);
  const currentTokenCost = imageMode === 'basic' ? config.basicTokenCost : config.proTokenCost;
  const canGenerate = tokensRemaining >= currentTokenCost && plan !== 'free' && cooldownSeconds <= 0;

  const openSubscribe = (targetPlan: SubscriptionPlan) => {
    window.open(getTelegramSubscribeUrl(targetPlan), '_blank');
  };

  // Fetch user data
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await fetch('/api/auth/me');
        if (!res.ok) {
          window.location.href = '/login';
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
    let interval: NodeJS.Timeout | null = null;

    const poll = async () => {
      try {
        const res = await fetch(`/api/image-batches/${encodeURIComponent(batchId)}`);
        if (!res.ok) return;
        const data = await res.json();
        const batch = data?.batch;
        if (!batch || cancelled) return;

        setBatchStatus(batch.status || null);
        setQueuePosition(typeof batch.queue_position === 'number' ? batch.queue_position : null);
        setEtaSeconds(typeof batch.eta_seconds === 'number' ? batch.eta_seconds : null);
        setParallelLimit(typeof batch.parallel_limit === 'number' ? batch.parallel_limit : null);
        setProgressPct(typeof batch?.progress?.percent === 'number' ? batch.progress.percent : 0);

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
          if (interval) clearInterval(interval);
          interval = null;
          setGenerating(false);

          if (batch.status === 'succeeded') toast.success('Rasm muvaffaqiyatli yaratildi!');
          else if (batch.status === 'partial') toast.info("Rasmlarning bir qismi yaratildi (qolganlari xatolik).");
          else if (batch.status === 'canceled') toast.info('Navbat bekor qilindi.');
          else toast.error(items.find((it) => it.error)?.error || 'Rasm yaratishda xatolik.');

          // Keep batchId so user can still see results; stop polling only.
        }
      } catch {
        // ignore
      }
    };

    void poll();
    interval = setInterval(poll, 1500);

    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
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

  // Add image slot
  const addImageSlot = useCallback(
    (type: 'product' | 'style') => {
      const maxCount = type === 'product' ? config.maxProductImages : config.maxStyleImages;
      const setImages = type === 'product' ? setProductImages : setStyleImages;
      const images = type === 'product' ? productImages : styleImages;
      
      if (images.length < maxCount) {
        setImages((prev) => [...prev, null]);
      }
    },
    [config, productImages, styleImages]
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

  // Generate images
  const handleGenerate = async () => {
    if (!canGenerate) {
      if (cooldownSeconds > 0) {
        const mm = String(Math.floor(cooldownSeconds / 60)).padStart(2, '0');
        const ss = String(cooldownSeconds % 60).padStart(2, '0');
        toast.info(`Keyingi generatsiya: ${mm}:${ss}`);
      } else {
        toast.error('Tokenlaringiz yetarli emas yoki obuna kerak!');
      }
      return;
    }

    const validProductImages = productImages.filter((img): img is string => img !== null);
    if (validProductImages.length === 0) {
      toast.error('Kamida bitta mahsulot rasmi yuklang!');
      return;
    }

    if (!prompt.trim()) {
      toast.error('Prompt kiriting!');
      return;
    }

    setGenerating(true);
    setBatchId(null);
    setBatchStatus('queued');
    setBatchItems([]);
    setQueuePosition(null);
    setEtaSeconds(null);
    setParallelLimit(null);
    setProgressPct(0);
    setGeneratedImages([]);

    try {
      const model = imageMode === 'basic' ? config.basicModel : selectedProModel;

      const response = await fetch('/api/generate-marketplace-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productImages: validProductImages,
          styleImages: styleImages.filter((img): img is string => img !== null),
          prompt,
          aspectRatio: MARKETPLACE_ASPECT_RATIO,
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
      const newBatchId = typeof data?.batch_id === 'string' ? data.batch_id : '';
      if (!newBatchId) {
        toast.error('Server batch id qaytarmadi.');
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

      toast.info("So'rov navbatga qo'shildi. Navbat va progress ko'rsatiladi.");
    } catch (error) {
      toast.error((error as Error).message || 'Xatolik yuz berdi.');
      setGenerating(false);
    } finally {
      // generating is stopped by the poller when the batch finishes
    }
  };

  // Download image
  const downloadImage = async (base64: string, index: number) => {
    let finalDataUrl = base64;
    try {
      finalDataUrl = await normalizeTo1080x1440(base64);
    } catch {
      // ignore
    }
    const link = document.createElement('a');
    link.href = finalDataUrl;
    link.download = `marketplace-image-${index + 1}-1080x1440.png`;
    link.click();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-12 w-12 border-4 border-blue-500 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-8">
      {/* Header with Token Info */}
      <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 rounded-3xl p-8 text-white shadow-2xl">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="flex items-center gap-5">
            <div className="p-4 bg-white/20 backdrop-blur-sm rounded-2xl">
              <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <h1 className="text-3xl font-black tracking-tight">Market Studio</h1>
              <p className="text-white/80 text-sm mt-1">AI orqali professional mahsulot rasmlari yarating</p>
            </div>
          </div>

          {/* Token Display */}
          <div className="flex items-center gap-4">
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl px-6 py-4 border border-white/20">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-yellow-400/20 rounded-xl">
                  <svg className="w-6 h-6 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M10 18a8 8 0 100-16 8 8 0 000 16zm0-2a6 6 0 100-12 6 6 0 000 12z"/>
                    <path d="M10 6a1 1 0 011 1v2h2a1 1 0 110 2h-2v2a1 1 0 11-2 0v-2H7a1 1 0 110-2h2V7a1 1 0 011-1z"/>
                  </svg>
                </div>
                <div>
                  <p className="text-xs text-white/70">Tokenlar</p>
                  <p className="text-xl font-bold">{isAdmin ? '∞' : tokensRemaining}</p>
                </div>
              </div>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl px-6 py-4 border border-white/20">
              <p className="text-xs text-white/70">Tarif</p>
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
              <h3 className="font-bold text-amber-800">Premium obuna kerak!</h3>
              <p className="text-amber-700 text-sm">Marketplace Studio dan foydalanish uchun Starter yoki undan yuqori obunaga o'ting.</p>
            </div>
            <button
              type="button"
              onClick={() => openSubscribe('starter')}
              className="ml-auto px-6 py-3 bg-amber-500 text-white rounded-xl font-semibold hover:bg-amber-600 transition-colors"
            >
              Obuna olish
            </button>
          </div>
        </div>
      )}

      {/* Mode Tabs */}
      <div className="bg-white rounded-2xl border border-gray-200 p-2 shadow-sm">
        <div className="flex gap-2">
          <button
            onClick={() => setImageMode('basic')}
            className={`flex-1 py-4 px-6 rounded-xl font-semibold transition-all ${
              imageMode === 'basic'
                ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg'
                : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
            }`}
          >
            <div className="flex items-center justify-center gap-3">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <span>Oddiy</span>
              <span className={`px-2 py-0.5 rounded-full text-xs ${imageMode === 'basic' ? 'bg-white/20' : 'bg-emerald-100 text-emerald-700'}`}>
                {config.basicTokenCost} token
              </span>
            </div>
          </button>
          <button
            onClick={() => setImageMode('pro')}
            disabled={config.proModels.length === 0}
            className={`flex-1 py-4 px-6 rounded-xl font-semibold transition-all ${
              imageMode === 'pro'
                ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-lg'
                : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
            } ${config.proModels.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <div className="flex items-center justify-center gap-3">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
              </svg>
              <span>Pro</span>
              <span className={`px-2 py-0.5 rounded-full text-xs ${imageMode === 'pro' ? 'bg-white/20' : 'bg-blue-100 text-blue-700'}`}>
                {config.proModels.length === 0 ? 'Premium' : `${config.proTokenCost} token`}
              </span>
            </div>
          </button>
        </div>
      </div>

      {/* Pro Model Selection */}
      {imageMode === 'pro' && config.proModels.length > 1 && (
        <div className="bg-blue-50 rounded-2xl p-6 border border-blue-200">
          <h3 className="font-semibold text-blue-800 mb-4">Pro Model tanlang</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {config.proModels.map((model) => (
              <button
                key={model}
                onClick={() => setSelectedProModel(model)}
                className={`p-4 rounded-xl border-2 transition-all text-left ${
                  selectedProModel === model
                    ? 'border-blue-500 bg-blue-100'
                    : 'border-gray-200 bg-white hover:border-blue-300'
                }`}
              >
                <p className="font-semibold text-gray-800">{model}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Input Section */}
        <div className="space-y-6">
          {/* Product Images */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-800">Mahsulot rasmlari</h3>
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
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => e.target.files?.[0] && handleUpload(idx, e.target.files[0], 'product', setProductImages)}
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
          {config.maxStyleImages > 0 && (
            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-gray-800">Uslub rasmlari (ixtiyoriy)</h3>
                <span className="text-sm text-gray-500">{styleImages.filter(Boolean).length}/{config.maxStyleImages}</span>
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
                {styleImages.length < config.maxStyleImages && (
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
            <h3 className="font-bold text-gray-800 mb-4">Prompt</h3>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Masalan: Mahsulotni oq fonda professional tarzda ko'rsating..."
              className="w-full h-32 p-4 border border-gray-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Aspect Ratio */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
            <h3 className="font-bold text-gray-800 mb-2">Nisbat</h3>
            <p className="text-sm text-gray-600">
              Marketplace uchun format doimiy: <strong>3:4 (1080×1440)</strong>
            </p>
          </div>

          {/* Generate Button */}
          <button
            onClick={handleGenerate}
            disabled={generating || !canGenerate}
            className={`w-full py-5 rounded-2xl font-bold text-lg transition-all ${
              generating || !canGenerate
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:shadow-xl hover:scale-[1.02]'
            }`}
          >
            {generating ? (
              <div className="flex items-center justify-center gap-3">
                <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full" />
                <span>
                  {batchStatus === 'queued' ? "Navbatda..." : 'Yaratilmoqda...'}
                  {batchStatus && batchStatus !== 'queued' ? ` (${progressPct}%)` : ''}
                </span>
              </div>
            ) : cooldownSeconds > 0 ? (
              <div className="flex items-center justify-center gap-3">
                <FiZap className="w-6 h-6" aria-hidden />
                <span>
                  Keyingi: {String(Math.floor(cooldownSeconds / 60)).padStart(2, '0')}:
                  {String(cooldownSeconds % 60).padStart(2, '0')}
                </span>
              </div>
            ) : (
              <div className="flex items-center justify-center gap-3">
                <FiZap className="w-6 h-6" aria-hidden />
                <span>Yaratish ({currentTokenCost} token)</span>
              </div>
            )}
          </button>

          {(generating || cooldownSeconds > 0) && (
            <div className="bg-gray-50 rounded-2xl border border-gray-200 p-4 text-sm text-gray-700">
              {cooldownSeconds > 0 && !generating && (
                <p>
                  Tarif limiti: keyingi generatsiya{' '}
                  <strong>
                    {String(Math.floor(cooldownSeconds / 60)).padStart(2, '0')}:
                    {String(cooldownSeconds % 60).padStart(2, '0')}
                  </strong>{' '}
                  dan keyin.
                </p>
              )}

              {generating && batchStatus === 'queued' && (
                <div className="space-y-1">
                  <p className="font-semibold">Siz navbatdasiz</p>
                  <p>Navbat: {queuePosition ?? '...'}</p>
                  <p>
                    Taxminiy vaqt:{' '}
                    {typeof etaSeconds === 'number'
                      ? `~${Math.max(1, Math.round(etaSeconds / 60))} daqiqa`
                      : '...'}
                  </p>
                  {typeof parallelLimit === 'number' && <p>Parallel limit: {parallelLimit}</p>}
                </div>
              )}

              {generating && batchStatus && batchStatus !== 'queued' && (
                <div className="space-y-1">
                  <p className="font-semibold">Yaratilmoqda</p>
                  <p>Progress: {progressPct}%</p>
                  {typeof etaSeconds === 'number' && (
                    <p>
                      Taxminiy vaqt: ~{Math.max(1, Math.round(etaSeconds / 60))} daqiqa
                    </p>
                  )}
                  {typeof parallelLimit === 'number' && <p>Parallel limit: {parallelLimit}</p>}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Output Section */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
          <h3 className="font-bold text-gray-800 mb-4">Yaratilgan rasmlar</h3>

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
                          ? 'navbatda'
                          : it.status === 'processing'
                            ? 'ishlanmoqda'
                            : it.status === 'succeeded'
                              ? 'tayyor'
                              : it.status === 'failed'
                                ? 'xato'
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
                      Yuklab olish
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
              <p>Rasmlar bu yerda ko'rinadi</p>
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
          Token narxlari ({plan === 'business_plus' ? 'Business+' : plan} tarif)
        </h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-xl border border-emerald-200">
            <p className="text-xs text-gray-500 mb-1">Oddiy rasm</p>
            <p className="text-2xl font-black text-emerald-600">{config.basicTokenCost}</p>
            <p className="text-xs text-gray-400">token / so'rov</p>
          </div>
          <div className="bg-white p-4 rounded-xl border border-blue-200">
            <p className="text-xs text-gray-500 mb-1">Pro rasm</p>
            <p className="text-2xl font-black text-blue-600">{config.proTokenCost}</p>
            <p className="text-xs text-gray-400">token / so'rov</p>
          </div>
          <div className="bg-white p-4 rounded-xl border border-purple-200">
            <p className="text-xs text-gray-500 mb-1">Chiqadigan rasmlar</p>
            <p className="text-2xl font-black text-purple-600">{config.outputCount}</p>
            <p className="text-xs text-gray-400">ta / generatsiya</p>
          </div>
          <div className="bg-white p-4 rounded-xl border border-amber-200">
            <p className="text-xs text-gray-500 mb-1">Qolgan token</p>
            <p className="text-2xl font-black text-amber-600">{isAdmin ? '∞' : tokensRemaining}</p>
            <p className="text-xs text-gray-400">token</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MarketplaceStudio;
