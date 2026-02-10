'use client';

import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { useToast } from './ToastProvider';
import { parseApiErrorResponse, toUzbekErrorMessage } from '@/lib/uzbek-errors';
import {
  FiArrowRight,
  FiArrowLeft,
  FiAward,
  FiDownload,
  FiEdit3,
  FiFilm,
  FiImage,
  FiInfo,
  FiMonitor,
  FiPlayCircle,
  FiPlus,
  FiSmartphone,
  FiStar,
  FiVideo,
  FiX,
  FiZap,
} from 'react-icons/fi';
import { FaCoins } from 'react-icons/fa';
import Link from 'next/link';
import { useLanguage } from '@/lib/LanguageContext';

// ============ TYPES ============
type VideoMode = 'basic' | 'pro' | 'premium';
type SubscriptionPlan = 'free' | 'starter' | 'pro' | 'business_plus';

interface UserData {
  subscription_plan: SubscriptionPlan;
  tokens_remaining: number;
  role: string;
}

interface VideoModeConfig {
  id: VideoMode;
  name: string;
  model: string;
  duration: number;
  tokenCost: number;
  monthlyLimit: number;
  description: string;
  features: string[];
  available: boolean;
}

const VIDEO_MODEL_LABELS: Record<string, string> = {
  'veo-3.0-fast-generate-001': 'Umari Flash Video',
  'veo-3.0-generate-001': 'Umari Pro Video',
  veo3_upsampler_video_generation: 'Umari AI Video',
};

const VideoStudio: React.FC = () => {
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

  const getVideoModelLabel = (modelId: string): string => VIDEO_MODEL_LABELS[modelId] || modelId;

  // User state
  const [user, setUser] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);

  const plan: SubscriptionPlan = user?.subscription_plan || 'free';

  // Video mode
  const [selectedMode, setSelectedMode] = useState<VideoMode>('basic');

  const videoModes = useMemo<VideoModeConfig[]>(() => {
    const secondsUnit = t('video.seconds', 'сек');

    const make = (cfg: Omit<VideoModeConfig, 'name' | 'description' | 'features'> & {
      nameKey: string;
      descKey: string;
      featureKeys: Array<string | { type: 'duration' } | { type: 'maxImages'; count: number } | { type: 'textLimit'; count: number } | { type: 'label'; key: string }>;
    }): VideoModeConfig => {
      const features = cfg.featureKeys.map((f) => {
        if (typeof f === 'string') return f;
        if (f.type === 'duration') return `${cfg.duration} ${secondsUnit}`;
        if (f.type === 'maxImages') return t('videoNew.features.maxImages', `Maks ${f.count} ta rasm`).replace('{count}', String(f.count));
        if (f.type === 'textLimit') return t('videoNew.features.textLimit', `Matn: ${f.count}`).replace('{count}', String(f.count));
        return t(f.key, f.key);
      });

      return {
        id: cfg.id,
        name: t(cfg.nameKey, cfg.nameKey),
        model: cfg.model,
        duration: cfg.duration,
        tokenCost: cfg.tokenCost,
        monthlyLimit: cfg.monthlyLimit,
        description: t(cfg.descKey, cfg.descKey),
        features,
        available: cfg.available,
      };
    };

    const configs: Record<SubscriptionPlan, VideoModeConfig[]> = {
      free: [],
      starter: [
        make({
          id: 'basic',
          nameKey: 'video.basicVideo',
          descKey: 'video.basicVideoDesc',
          model: 'veo-3.0-fast-generate-001',
          duration: 4,
          tokenCost: 15,
          monthlyLimit: 10,
          featureKeys: [{ type: 'duration' }, { type: 'label', key: 'video.fastRendering' }, { type: 'label', key: 'video.basicAnimation' }],
          available: true,
        }),
      ],
      pro: [
        make({
          id: 'basic',
          nameKey: 'video.basicVideo',
          descKey: 'videoNew.desc.fastQuality',
          model: 'veo-3.0-fast-generate-001',
          duration: 6,
          tokenCost: 25,
          monthlyLimit: 6,
          featureKeys: [{ type: 'duration' }, { type: 'label', key: 'video.fastRendering' }],
          available: true,
        }),
        make({
          id: 'pro',
          nameKey: 'video.proVideo',
          descKey: 'video.proVideoDesc',
          model: 'veo-3.0-generate-001',
          duration: 6,
          tokenCost: 35,
          monthlyLimit: 4,
          featureKeys: [{ type: 'duration' }, { type: 'label', key: 'video.smoothCamera' }, { type: 'label', key: 'video.goodLighting' }],
          available: true,
        }),
      ],
      business_plus: [
        make({
          id: 'basic',
          nameKey: 'video.basicVideo',
          descKey: 'videoNew.desc.fastCheap',
          model: 'veo-3.0-fast-generate-001',
          duration: 4,
          tokenCost: 20,
          monthlyLimit: 10,
          featureKeys: [{ type: 'duration' }, { type: 'label', key: 'video.fastRendering' }, { type: 'label', key: 'videoNew.features.twoImages' }, { type: 'textLimit', count: 80 }],
          available: true,
        }),
        make({
          id: 'pro',
          nameKey: 'video.proVideo',
          descKey: 'videoNew.desc.smoothAdStyle',
          model: 'veo-3.0-fast-generate-001',
          duration: 6,
          tokenCost: 30,
          monthlyLimit: 7,
          featureKeys: [{ type: 'duration' }, { type: 'label', key: 'videoNew.features.threeImages' }, { type: 'textLimit', count: 120 }, { type: 'label', key: 'videoNew.features.adStyle' }],
          available: true,
        }),
        make({
          id: 'premium',
          nameKey: 'video.premiumVideo',
          descKey: 'videoNew.desc.upscaleFlow',
          model: 'veo-3.0-fast-generate-001',
          duration: 8,
          tokenCost: 45,
          monthlyLimit: 5,
          featureKeys: [{ type: 'duration' }, { type: 'maxImages', count: 4 }, { type: 'textLimit', count: 150 }, { type: 'label', key: 'videoNew.features.backgroundUpscale' }],
          available: true,
        }),
      ],
    };

    return configs[plan] || [];
  }, [plan, t, language]);

  // Inputs
  const [sourceImages, setSourceImages] = useState<string[]>([]);
  const [prompt, setPrompt] = useState(() => t('videoNew.defaultPrompt', "Mahsulotni aylanib ko'rsatish, cinematic harakat"));
  const [isPortrait, setIsPortrait] = useState(false);

  // Output
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [upscaleJobId, setUpscaleJobId] = useState<string | null>(null);
  const [upscaling, setUpscaling] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(0);

  // Derived
  const isAdmin = user?.role === 'admin';
  const tokensRemaining = isAdmin ? 999999 : (user?.tokens_remaining || 0);
  const currentConfig = videoModes.find((m) => m.id === selectedMode);
  const tokenCost = currentConfig?.tokenCost || 0;
  const canGenerate = tokensRemaining >= tokenCost && currentConfig?.available;

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
          const userData: UserData = {
            subscription_plan: data.user.subscription_plan || 'free',
            tokens_remaining: data.user.tokens_remaining || 0,
            role: data.user.role || 'user',
          };
          setUser(userData);
        }
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    };
    fetchUser();
  }, [withLang]);

  useEffect(() => {
    if (videoModes.length === 0) return;
    if (!videoModes.some((m) => m.id === selectedMode)) {
      setSelectedMode(videoModes[0].id);
    }
  }, [videoModes, selectedMode]);

  // Image upload
  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const maxImages = currentConfig?.id === 'premium' ? 4 : currentConfig?.id === 'pro' ? 3 : 2;

    Array.from(files).slice(0, maxImages - sourceImages.length).forEach((file) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSourceImages((prev) => {
          if (prev.length >= maxImages) return prev;
          return [...prev, reader.result as string];
        });
      };
      reader.readAsDataURL(file);
    });
  };

  const removeImage = (idx: number) => {
    setSourceImages((prev) => prev.filter((_, i) => i !== idx));
  };

  // Generate video
  const handleGenerate = async () => {
    if (sourceImages.length === 0) {
      toast.error(t('videoNew.toasts.uploadAtLeastOneImage', 'Iltimos, kamida bitta rasm yuklang.'));
      return;
    }

    if (!canGenerate) {
      toast.error(t('videoNew.toasts.notEnoughTokensOrUnavailable', 'Token yetarli emas yoki bu rejim tarifingizda mavjud emas.'));
      return;
    }

    setGenerating(true);
    setVideoUrl(null);
    setUpscaleJobId(null);
    setUpscaling(false);
    setProgress(0);

    // Simulate progress
    const progressInterval = setInterval(() => {
      setProgress((prev) => Math.min(prev + 2, 90));
    }, 1000);

    try {
      const response = await fetch('/api/vertex/generate-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          images: sourceImages,
          model: currentConfig?.model,
          mode: selectedMode,
          aspectRatio: isPortrait ? '9:16' : '16:9',
        }),
      });

      clearInterval(progressInterval);
      setProgress(100);

      if (!response.ok) {
        const parsed = await parseApiErrorResponse(response);
        const { title, message } = toUzbekErrorMessage(parsed);
        toast.error(message, title);
        return;
      }

      const data = await response.json();
      if (data.videoUrl) {
        setVideoUrl(data.videoUrl);
        toast.success(t('videoNew.toasts.videoCreated', 'Video muvaffaqiyatli yaratildi!'));

        if (data.upscaleJobId) {
          setUpscaleJobId(data.upscaleJobId);
          setUpscaling(true);
          toast.info(t('videoNew.toasts.upscaleBackground', 'Business+ uchun upscale backgroundda ketayapti...'), t('videoNew.upscaleTitle', 'Upscale'));
        }

        // Refresh user data
        const userRes = await fetch('/api/auth/me');
        if (userRes.ok) {
          const userData = await userRes.json();
          if (userData.success && userData.user) {
            setUser((prev) =>
              prev ? { ...prev, tokens_remaining: userData.user.tokens_remaining } : null
            );
          }
        }
      } else {
        toast.error(t('videoNew.toasts.noVideoFromServer', 'Server video qaytarmadi.'));
      }
    } catch (error) {
      clearInterval(progressInterval);
      toast.error((error as Error).message || t('common.error', 'Xatolik'));
    } finally {
      setGenerating(false);
    }
  };

  // Poll upscale job (Business+)
  useEffect(() => {
    if (!upscaleJobId) return;

    let cancelled = false;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/video-jobs/${encodeURIComponent(upscaleJobId)}`);
        if (!res.ok) return;
        const payload = await res.json();
        const job = payload?.job;

        if (!job || cancelled) return;

        if (job.status === 'succeeded' && job.upscaledVideoUrl) {
          setVideoUrl(job.upscaledVideoUrl);
          setUpscaling(false);
          toast.success(t('videoNew.toasts.upscaleDone', 'Upscale tugadi! Video yaxshilandi.'), t('videoNew.upscaleTitle', 'Upscale'));
          clearInterval(interval);
        }

        if (job.status === 'failed') {
          setUpscaling(false);
          toast.error(job.error || t('videoNew.toasts.upscaleFailed', 'Upscale xatolik bilan tugadi.'), t('videoNew.upscaleTitle', 'Upscale'));
          clearInterval(interval);
        }
      } catch {
        // ignore
      }
    }, 5000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [upscaleJobId, toast]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-12 w-12 border-4 border-purple-500 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (videoModes.length === 0) {
    return (
      <div className="max-w-4xl mx-auto p-8">
        <div className="bg-gradient-to-r from-purple-100 to-pink-100 rounded-3xl p-12 text-center">
          <div className="w-20 h-20 bg-purple-200 rounded-full flex items-center justify-center mx-auto mb-6">
            <FiVideo className="w-10 h-10 text-purple-600" aria-hidden />
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-4">{t('videoNew.blockedTitle', 'Video studiya')}</h2>
          <p className="text-gray-600 mb-6">
            {t('videoNew.blockedBody', "Video yaratish uchun pullik obunaga a'zo bo'lishingiz kerak.")}
          </p>
          <a
            href={withLang('/pricing')}
            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-600 text-white font-bold rounded-xl hover:shadow-lg transition-all"
          >
            {t('videoNew.viewPlans', "Tariflarni ko'rish")}
            <FiArrowRight className="w-5 h-5" aria-hidden />
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8 space-y-8">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 rounded-3xl p-8 text-white shadow-2xl shadow-blue-200/30">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="flex items-center gap-5">
            <Link href={withLang('/dashboard')} className="p-4 bg-white/20 backdrop-blur-sm rounded-2xl hover:bg-white/30 transition text-white">
              <FiArrowLeft className="w-6 h-6" />
            </Link>
            <div className="p-4 bg-white/20 backdrop-blur-sm rounded-2xl">
              <FiVideo className="w-10 h-10" aria-hidden />
            </div>
            <div>
              <h1 className="text-3xl font-black tracking-tight">{t('video.title', 'Video studiya')}</h1>
              <p className="text-white/80 text-sm mt-1">{t('videoNew.subtitle', 'Rasmlardan jonli video yarating (Veo AI)')}</p>
            </div>
          </div>

          {/* Token Display */}
          <div className="flex items-center gap-4">
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl px-6 py-4 border border-white/20">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-yellow-400/20 rounded-xl">
                  <FaCoins className="w-6 h-6 text-yellow-300" aria-hidden />
                </div>
                <div>
                  <p className="text-xs text-white/60 uppercase tracking-wider font-medium">{t('videoNew.tokensRemaining', 'Qolgan token')}</p>
                  <p className="text-2xl font-black">{isAdmin ? '∞' : tokensRemaining.toLocaleString()}</p>
                </div>
              </div>
            </div>

            <div className="bg-white/10 backdrop-blur-sm rounded-2xl px-6 py-4 border border-white/20">
              <p className="text-xs text-white/60 uppercase tracking-wider font-medium">{t('videoNew.plan', 'Tarif')}</p>
              <p className="text-xl font-bold capitalize">{plan === 'business_plus' ? 'Business+' : plan}</p>
            </div>
          </div>
        </div>
      </div>

      {upscaling && (
        <div className="rounded-2xl border border-purple-200 bg-purple-50 px-4 py-3 text-purple-800">
          <div className="text-sm font-semibold">{t('videoNew.upscalingTitle', 'Upscale backgroundda ketayapti…')}</div>
          <div className="text-xs text-purple-700/80">{t('videoNew.upscalingBody', 'Tayyor bo‘lsa video avtomatik yangilanadi.')}</div>
        </div>
      )}

      {/* Video Mode Tabs */}
      <div className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden">
        <div className="border-b border-gray-100">
          <div className="flex">
            {videoModes.map((mode, idx) => (
              <button
                key={mode.id}
                onClick={() => setSelectedMode(mode.id)}
                className={`flex-1 py-5 px-6 text-center transition-all relative ${selectedMode === mode.id
                  ? mode.id === 'basic'
                    ? 'bg-gradient-to-r from-emerald-50 to-teal-50 text-emerald-700'
                    : mode.id === 'pro'
                      ? 'bg-gradient-to-r from-blue-50 to-indigo-50 text-blue-700'
                      : 'bg-gradient-to-r from-purple-50 to-pink-50 text-purple-700'
                  : 'text-gray-500 hover:bg-gray-50'
                  }`}
              >
                <div className="flex items-center justify-center gap-3">
                  <div className={`p-2 rounded-xl ${selectedMode === mode.id
                    ? mode.id === 'basic'
                      ? 'bg-emerald-100'
                      : mode.id === 'pro'
                        ? 'bg-blue-100'
                        : 'bg-purple-100'
                    : 'bg-gray-100'
                    }`}>
                    {mode.id === 'basic' && (
                      <FiZap className="w-5 h-5" aria-hidden />
                    )}
                    {mode.id === 'pro' && (
                      <FiStar className="w-5 h-5" aria-hidden />
                    )}
                    {mode.id === 'premium' && (
                      <FiAward className="w-5 h-5" aria-hidden />
                    )}
                  </div>
                  <div className="text-left">
                    <p className="font-bold">{mode.name}</p>
                    <p className="text-xs opacity-70">{mode.duration} {t('videoNew.secondsShort', 'sek')}</p>
                  </div>
                  <div className={`ml-2 px-3 py-1 rounded-full text-sm font-bold ${selectedMode === mode.id
                    ? mode.id === 'basic'
                      ? 'bg-emerald-200 text-emerald-800'
                      : mode.id === 'pro'
                        ? 'bg-blue-200 text-blue-800'
                        : 'bg-purple-200 text-purple-800'
                    : 'bg-gray-100 text-gray-600'
                    }`}>
                    {mode.tokenCost} {t('videoNew.tokenUnit', 'token')}
                  </div>
                </div>
                {selectedMode === mode.id && (
                  <div className={`absolute bottom-0 left-0 right-0 h-1 ${mode.id === 'basic'
                    ? 'bg-gradient-to-r from-emerald-400 to-teal-500'
                    : mode.id === 'pro'
                      ? 'bg-gradient-to-r from-blue-400 to-indigo-500'
                      : 'bg-gradient-to-r from-purple-400 to-pink-500'
                    }`}></div>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Mode Features */}
        {currentConfig && (
          <div className={`px-8 py-4 ${currentConfig.id === 'basic'
            ? 'bg-gradient-to-r from-emerald-50 to-teal-50'
            : currentConfig.id === 'pro'
              ? 'bg-gradient-to-r from-blue-50 to-indigo-50'
              : 'bg-gradient-to-r from-purple-50 to-pink-50'
            } border-b`}>
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-4">
                <span className={`px-4 py-2 rounded-xl font-mono text-sm font-bold ${currentConfig.id === 'basic'
                  ? 'bg-emerald-100 text-emerald-700'
                  : currentConfig.id === 'pro'
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-purple-100 text-purple-700'
                  } inline-flex items-center gap-2`}>
                  <FiFilm aria-hidden className="w-4 h-4" /> {getVideoModelLabel(currentConfig.model)}
                </span>
                <span className="text-sm text-gray-600">{currentConfig.description}</span>
              </div>
              <div className="flex gap-2">
                {currentConfig.features.map((f, i) => (
                  <span key={i} className="px-3 py-1 bg-white rounded-lg text-xs font-medium text-gray-600 border">
                    {f}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Main Content */}
        <div className="p-8">
          <div className="grid lg:grid-cols-2 gap-8">
            {/* Left - Inputs */}
            <div className="space-y-6">
              {/* Source Images */}
              <div className="bg-gray-50 rounded-2xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-gray-800 flex items-center gap-2">
                    <span className="p-1.5 bg-pink-100 rounded-lg">
                      <FiImage className="w-4 h-4 text-pink-600" aria-hidden />
                    </span>
                    {t('videoNew.sourceImages', 'Asosiy rasmlar')}
                  </h3>
                  <span className="text-xs text-gray-500 bg-white px-3 py-1 rounded-full">
                    {t('videoNew.maxShort', 'max')} {currentConfig?.id === 'premium' ? 4 : currentConfig?.id === 'pro' ? 3 : 2} {t('videoNew.piecesShort', 'ta')}
                  </span>
                </div>
                <div className="flex flex-wrap gap-3">
                  {sourceImages.map((img, idx) => (
                    <div key={idx} className="relative w-24 h-24 rounded-xl overflow-hidden group">
                      <img src={img} className="w-full h-full object-cover" alt="" />
                      <button
                        onClick={() => removeImage(idx)}
                        className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-1 shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <FiX className="w-3 h-3" aria-hidden />
                      </button>
                    </div>
                  ))}
                  {sourceImages.length < (currentConfig?.id === 'premium' ? 4 : currentConfig?.id === 'pro' ? 3 : 2) && (
                    <div className="relative w-24 h-24 rounded-xl border-2 border-dashed border-gray-300 flex items-center justify-center bg-white hover:border-pink-400 transition-all">
                      <input
                        type="file"
                        onChange={handleUpload}
                        className="absolute inset-0 opacity-0 cursor-pointer"
                        accept="image/*"
                        multiple
                      />
                      <FiPlus className="w-8 h-8 text-gray-400" aria-hidden />
                    </div>
                  )}
                </div>
              </div>

              {/* Prompt */}
              <div className="bg-gray-50 rounded-2xl p-6">
                <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                  <span className="p-1.5 bg-amber-100 rounded-lg">
                    <FiEdit3 className="w-4 h-4 text-amber-600" aria-hidden />
                  </span>
                  {t('videoNew.motionDescription', 'Harakat tavsifi')}
                </h3>
                <input
                  type="text"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  maxLength={currentConfig?.id === 'premium' ? 150 : currentConfig?.id === 'pro' ? 120 : 60}
                  className="w-full p-4 bg-white rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
                  placeholder={t('videoNew.motionPlaceholder', 'Masalan: Mahsulotni 360° aylantirish, zoom effekti...')}
                />
                <p className="text-xs text-gray-400 mt-2 text-right">
                  {prompt.length} / {currentConfig?.id === 'premium' ? 150 : currentConfig?.id === 'pro' ? 120 : 60}
                </p>
              </div>

              {/* Aspect Ratio & Generate */}
              <div className="flex gap-4">
                <div className="flex-1 bg-gray-50 rounded-2xl p-4">
                  <p className="text-xs text-gray-500 mb-3 font-medium">{t('videoNew.aspect', "O'lcham")}</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setIsPortrait(false)}
                      className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all ${!isPortrait
                        ? 'bg-purple-600 text-white'
                        : 'bg-white text-gray-500 border border-gray-200'
                        }`}
                    >
                      <span className="inline-flex items-center justify-center gap-2">
                        <FiMonitor aria-hidden className="w-4 h-4" />
                        <span>16:9</span>
                      </span>
                    </button>
                    <button
                      onClick={() => setIsPortrait(true)}
                      className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all ${isPortrait
                        ? 'bg-purple-600 text-white'
                        : 'bg-white text-gray-500 border border-gray-200'
                        }`}
                    >
                      <span className="inline-flex items-center justify-center gap-2">
                        <FiSmartphone aria-hidden className="w-4 h-4" />
                        <span>9:16</span>
                      </span>
                    </button>
                  </div>
                </div>

                <button
                  onClick={handleGenerate}
                  disabled={generating || !canGenerate || sourceImages.length === 0}
                  className={`flex-[2] py-4 px-8 rounded-xl font-bold text-white flex items-center justify-center gap-3 transition-all ${generating || !canGenerate || sourceImages.length === 0
                    ? 'bg-gray-300 cursor-not-allowed'
                    : currentConfig?.id === 'basic'
                      ? 'bg-gradient-to-r from-emerald-500 to-teal-600 hover:shadow-xl'
                      : currentConfig?.id === 'pro'
                        ? 'bg-gradient-to-r from-blue-500 to-indigo-600 hover:shadow-xl'
                        : 'bg-gradient-to-r from-purple-500 to-pink-600 hover:shadow-xl'
                    }`}
                >
                  {generating ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        {t('video.videoGenerating', 'Video yaratilmoqda...')}
                    </>
                  ) : (
                    <>
                      <FiPlayCircle className="w-5 h-5" aria-hidden />
                        {t('videoNew.generateWithCost', `Video yaratish (${tokenCost} token)`).replace('{cost}', String(tokenCost))}
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Right - Output */}
            <div className="bg-gray-900 rounded-2xl p-6 min-h-[400px] flex flex-col">
              <h3 className="font-bold text-white mb-4 flex items-center gap-2">
                <span className="p-1.5 bg-purple-500/20 rounded-lg">
                  <FiVideo className="w-4 h-4 text-purple-400" aria-hidden />
                </span>
                {t('videoNew.result', 'Natija')}
              </h3>

              <div className="flex-1 bg-black rounded-xl overflow-hidden flex items-center justify-center">
                {generating ? (
                  <div className="text-center space-y-4">
                    <div className="relative w-24 h-24">
                      <svg className="w-24 h-24 transform -rotate-90">
                        <circle
                          cx="48"
                          cy="48"
                          r="40"
                          stroke="#374151"
                          strokeWidth="8"
                          fill="none"
                        />
                        <circle
                          cx="48"
                          cy="48"
                          r="40"
                          stroke="url(#gradient)"
                          strokeWidth="8"
                          fill="none"
                          strokeLinecap="round"
                          strokeDasharray={`${progress * 2.51} 251`}
                        />
                        <defs>
                          <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor="#a855f7" />
                            <stop offset="100%" stopColor="#ec4899" />
                          </linearGradient>
                        </defs>
                      </svg>
                      <span className="absolute inset-0 flex items-center justify-center text-2xl font-black text-white">
                        {progress}%
                      </span>
                    </div>
                    <p className="text-sm text-gray-400">Umari AI video yaratmoqda...</p>
                    <p className="text-sm text-gray-400">{t('videoNew.generatingAI', 'Umari AI video yaratmoqda...')}</p>
                    <p className="text-xs text-gray-500">{t('videoNew.generatingMayTakeMinutes', 'Bu bir necha daqiqa olishi mumkin')}</p>
                  </div>
                ) : videoUrl ? (
                  <video src={videoUrl} controls autoPlay loop className="w-full h-full object-contain" />
                ) : (
                  <div className="text-center text-gray-600">
                    <FiVideo className="w-16 h-16 mx-auto mb-4 opacity-50" aria-hidden />
                    <p className="text-sm">{t('videoNew.waitingForVideo', 'Video kutilmoqda')}</p>
                  </div>
                )}
              </div>

              {videoUrl && (
                <a
                  href={videoUrl}
                  download="umari-video.mp4"
                  className="mt-4 w-full py-4 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:shadow-lg transition-all"
                >
                  <FiDownload className="w-5 h-5" aria-hidden />
                  {t('common.download', 'Yuklab olish')}
                </a>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Token Info */}
      <div className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-2xl p-6 border border-gray-200">
        <h4 className="font-bold text-gray-700 mb-4 flex items-center gap-2">
          <FiInfo className="w-5 h-5 text-purple-500" aria-hidden />
          {t('videoNew.pricingTitle', 'Video narxlari')} ({plan === 'business_plus' ? 'Business+' : plan} {t('videoNew.planSuffix', 'tarif')})
        </h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {videoModes.map((mode) => (
            <div key={mode.id} className={`p-4 rounded-xl border ${mode.id === 'basic'
              ? 'bg-white border-emerald-200'
              : mode.id === 'pro'
                ? 'bg-white border-blue-200'
                : 'bg-white border-purple-200'
              }`}>
              <p className="text-xs text-gray-500 mb-1">{mode.name}</p>
              <p className={`text-2xl font-black ${mode.id === 'basic'
                ? 'text-emerald-600'
                : mode.id === 'pro'
                  ? 'text-blue-600'
                  : 'text-purple-600'
                }`}>{mode.tokenCost}</p>
              <p className="text-xs text-gray-400">{t('videoNew.tokenPer', 'token /')} {mode.duration} {t('videoNew.secondsShort', 'sek')}</p>
            </div>
          ))}
          <div className="bg-white p-4 rounded-xl border border-amber-200">
            <p className="text-xs text-gray-500 mb-1">{t('videoNew.tokensRemaining', 'Qolgan token')}</p>
            <p className="text-2xl font-black text-amber-600">{isAdmin ? '∞' : tokensRemaining}</p>
            <p className="text-xs text-gray-400">{t('videoNew.tokenUnit', 'token')}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VideoStudio;
