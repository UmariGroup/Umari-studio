'use client';

import React, { useState, useEffect } from 'react';
import { useToast } from './ToastProvider';
import { parseApiErrorResponse, toUzbekErrorMessage } from '@/lib/uzbek-errors';

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

// ============ PLAN VIDEO CONFIGURATIONS ============
const getVideoModesForPlan = (plan: SubscriptionPlan): VideoModeConfig[] => {
  const configs: Record<SubscriptionPlan, VideoModeConfig[]> = {
    free: [],
    starter: [
      {
        id: 'basic',
        name: 'Oddiy Video',
        model: 'veo-3.0-fast-generate-001',
        duration: 5,
        tokenCost: 15,
        monthlyLimit: 10,
        description: 'Tez generatsiya - oddiy mahsulot videolari',
        features: ['5 soniya', 'Tez rendering', 'Asosiy animatsiya'],
        available: true,
      },
    ],
    pro: [
      {
        id: 'basic',
        name: 'Oddiy Video',
        model: 'veo-3.0-fast-generate-001',
        duration: 6,
        tokenCost: 25,
        monthlyLimit: 6,
        description: 'Tez va sifatli',
        features: ['6 soniya', 'Tez rendering'],
        available: true,
      },
      {
        id: 'pro',
        name: 'Pro Video',
        model: 'veo-3.0-generate-001',
        duration: 6,
        tokenCost: 35,
        monthlyLimit: 4,
        description: 'Yuqori sifat - reklama videolari',
        features: ['6 soniya', 'Yumshoq kamera', "Yaxshi yorug'lik"],
        available: true,
      },
    ],
    business_plus: [
      {
        id: 'basic',
        name: 'Oddiy Video',
        model: 'veo-3.0-fast-generate-001',
        duration: 5,
        tokenCost: 20,
        monthlyLimit: 10,
        description: 'Tez va arzon',
        features: ['5 soniya', 'Tez rendering'],
        available: true,
      },
      {
        id: 'pro',
        name: 'Pro Video',
        model: 'veo-3.0-generate-001',
        duration: 7,
        tokenCost: 30,
        monthlyLimit: 7,
        description: 'Yuqori sifat',
        features: ['7 soniya', 'Silliq kamera', 'Reklama uslubi'],
        available: true,
      },
      {
        id: 'premium',
        name: 'Premium Video',
        model: 'veo3_upsampler_video_generation',
        duration: 10,
        tokenCost: 45,
        monthlyLimit: 5,
        description: 'Eng yuqori sifat + Upscaler',
        features: ['10 soniya', 'Upscale qilingan', 'Studio sifati', 'Reels/Ads uchun'],
        available: true,
      },
    ],
  };

  return configs[plan] || [];
};

const VideoStudio: React.FC = () => {
  const toast = useToast();

  // User state
  const [user, setUser] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);

  // Video mode
  const [selectedMode, setSelectedMode] = useState<VideoMode>('basic');
  const [videoModes, setVideoModes] = useState<VideoModeConfig[]>([]);

  // Inputs
  const [sourceImages, setSourceImages] = useState<string[]>([]);
  const [prompt, setPrompt] = useState("Mahsulotni aylanib ko'rsatish, cinematic harakat");
  const [isPortrait, setIsPortrait] = useState(false);

  // Output
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(0);

  // Derived
  const plan = user?.subscription_plan || 'free';
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
          window.location.href = '/login';
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
          
          const modes = getVideoModesForPlan(userData.subscription_plan);
          setVideoModes(modes);
          if (modes.length > 0) {
            setSelectedMode(modes[0].id);
          }
        }
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    };
    fetchUser();
  }, []);

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
      toast.error('Iltimos, kamida bitta rasm yuklang.');
      return;
    }

    if (!canGenerate) {
      toast.error('Token yetarli emas yoki bu rejim tarifingizda mavjud emas.');
      return;
    }

    setGenerating(true);
    setVideoUrl(null);
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
        toast.success('Video muvaffaqiyatli yaratildi!');

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
        toast.error('Server video qaytarmadi.');
      }
    } catch (error) {
      clearInterval(progressInterval);
      toast.error((error as Error).message || 'Xatolik yuz berdi.');
    } finally {
      setGenerating(false);
    }
  };

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
            <svg className="w-10 h-10 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-4">Video Studiyosi</h2>
          <p className="text-gray-600 mb-6">
            Video yaratish uchun pullik obunaga a'zo bo'lishingiz kerak.
          </p>
          <a
            href="/pricing"
            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-600 text-white font-bold rounded-xl hover:shadow-lg transition-all"
          >
            Tariflarni ko'rish
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-8">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 via-pink-600 to-rose-600 rounded-3xl p-8 text-white shadow-2xl">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="flex items-center gap-5">
            <div className="p-4 bg-white/20 backdrop-blur-sm rounded-2xl">
              <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <h1 className="text-3xl font-black tracking-tight">Video Studio</h1>
              <p className="text-white/80 text-sm mt-1">Rasmlardan jonli video yarating (Veo AI)</p>
            </div>
          </div>

          {/* Token Display */}
          <div className="flex items-center gap-4">
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl px-6 py-4 border border-white/20">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-yellow-400/20 rounded-xl">
                  <svg className="w-6 h-6 text-yellow-300" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z" />
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.51-1.31c-.562-.649-1.413-1.076-2.353-1.253V5z" clipRule="evenodd" />
                  </svg>
                </div>
                <div>
                  <p className="text-xs text-white/60 uppercase tracking-wider font-medium">Qolgan Token</p>
                  <p className="text-2xl font-black">{isAdmin ? '∞' : tokensRemaining.toLocaleString()}</p>
                </div>
              </div>
            </div>

            <div className="bg-white/10 backdrop-blur-sm rounded-2xl px-6 py-4 border border-white/20">
              <p className="text-xs text-white/60 uppercase tracking-wider font-medium">Tarif</p>
              <p className="text-xl font-bold capitalize">{plan === 'business_plus' ? 'Business+' : plan}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Video Mode Tabs */}
      <div className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden">
        <div className="border-b border-gray-100">
          <div className="flex">
            {videoModes.map((mode, idx) => (
              <button
                key={mode.id}
                onClick={() => setSelectedMode(mode.id)}
                className={`flex-1 py-5 px-6 text-center transition-all relative ${
                  selectedMode === mode.id
                    ? mode.id === 'basic'
                      ? 'bg-gradient-to-r from-emerald-50 to-teal-50 text-emerald-700'
                      : mode.id === 'pro'
                        ? 'bg-gradient-to-r from-blue-50 to-indigo-50 text-blue-700'
                        : 'bg-gradient-to-r from-purple-50 to-pink-50 text-purple-700'
                    : 'text-gray-500 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center justify-center gap-3">
                  <div className={`p-2 rounded-xl ${
                    selectedMode === mode.id
                      ? mode.id === 'basic'
                        ? 'bg-emerald-100'
                        : mode.id === 'pro'
                          ? 'bg-blue-100'
                          : 'bg-purple-100'
                      : 'bg-gray-100'
                  }`}>
                    {mode.id === 'basic' && (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                    )}
                    {mode.id === 'pro' && (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                      </svg>
                    )}
                    {mode.id === 'premium' && (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                      </svg>
                    )}
                  </div>
                  <div className="text-left">
                    <p className="font-bold">{mode.name}</p>
                    <p className="text-xs opacity-70">{mode.duration} sek</p>
                  </div>
                  <div className={`ml-2 px-3 py-1 rounded-full text-sm font-bold ${
                    selectedMode === mode.id
                      ? mode.id === 'basic'
                        ? 'bg-emerald-200 text-emerald-800'
                        : mode.id === 'pro'
                          ? 'bg-blue-200 text-blue-800'
                          : 'bg-purple-200 text-purple-800'
                      : 'bg-gray-100 text-gray-600'
                  }`}>
                    {mode.tokenCost} token
                  </div>
                </div>
                {selectedMode === mode.id && (
                  <div className={`absolute bottom-0 left-0 right-0 h-1 ${
                    mode.id === 'basic'
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
          <div className={`px-8 py-4 ${
            currentConfig.id === 'basic'
              ? 'bg-gradient-to-r from-emerald-50 to-teal-50'
              : currentConfig.id === 'pro'
                ? 'bg-gradient-to-r from-blue-50 to-indigo-50'
                : 'bg-gradient-to-r from-purple-50 to-pink-50'
          } border-b`}>
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-4">
                <span className={`px-4 py-2 rounded-xl font-mono text-sm font-bold ${
                  currentConfig.id === 'basic'
                    ? 'bg-emerald-100 text-emerald-700'
                    : currentConfig.id === 'pro'
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-purple-100 text-purple-700'
                }`}>
                  🎬 {currentConfig.model}
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
                      <svg className="w-4 h-4 text-pink-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </span>
                    Asosiy rasmlar
                  </h3>
                  <span className="text-xs text-gray-500 bg-white px-3 py-1 rounded-full">
                    max {currentConfig?.id === 'premium' ? 4 : currentConfig?.id === 'pro' ? 3 : 2} ta
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
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12" />
                        </svg>
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
                      <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                      </svg>
                    </div>
                  )}
                </div>
              </div>

              {/* Prompt */}
              <div className="bg-gray-50 rounded-2xl p-6">
                <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                  <span className="p-1.5 bg-amber-100 rounded-lg">
                    <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                  </span>
                  Harakat tavsifi
                </h3>
                <input
                  type="text"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  maxLength={currentConfig?.id === 'premium' ? 150 : currentConfig?.id === 'pro' ? 120 : 60}
                  className="w-full p-4 bg-white rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
                  placeholder="Masalan: Mahsulotni 360° aylantirish, zoom effekti..."
                />
                <p className="text-xs text-gray-400 mt-2 text-right">
                  {prompt.length} / {currentConfig?.id === 'premium' ? 150 : currentConfig?.id === 'pro' ? 120 : 60}
                </p>
              </div>

              {/* Aspect Ratio & Generate */}
              <div className="flex gap-4">
                <div className="flex-1 bg-gray-50 rounded-2xl p-4">
                  <p className="text-xs text-gray-500 mb-3 font-medium">O'lcham</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setIsPortrait(false)}
                      className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all ${
                        !isPortrait
                          ? 'bg-purple-600 text-white'
                          : 'bg-white text-gray-500 border border-gray-200'
                      }`}
                    >
                      🖥️ 16:9
                    </button>
                    <button
                      onClick={() => setIsPortrait(true)}
                      className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all ${
                        isPortrait
                          ? 'bg-purple-600 text-white'
                          : 'bg-white text-gray-500 border border-gray-200'
                      }`}
                    >
                      📱 9:16
                    </button>
                  </div>
                </div>

                <button
                  onClick={handleGenerate}
                  disabled={generating || !canGenerate || sourceImages.length === 0}
                  className={`flex-[2] py-4 px-8 rounded-xl font-bold text-white flex items-center justify-center gap-3 transition-all ${
                    generating || !canGenerate || sourceImages.length === 0
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
                      Video yaratilmoqda...
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Video yaratish ({tokenCost} token)
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Right - Output */}
            <div className="bg-gray-900 rounded-2xl p-6 min-h-[400px] flex flex-col">
              <h3 className="font-bold text-white mb-4 flex items-center gap-2">
                <span className="p-1.5 bg-purple-500/20 rounded-lg">
                  <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </span>
                Natija
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
                    <p className="text-sm text-gray-400">Veo AI video yaratmoqda...</p>
                    <p className="text-xs text-gray-500">Bu bir necha daqiqa olishi mumkin</p>
                  </div>
                ) : videoUrl ? (
                  <video src={videoUrl} controls autoPlay loop className="w-full h-full object-contain" />
                ) : (
                  <div className="text-center text-gray-600">
                    <svg className="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    <p className="text-sm">Video kutilmoqda</p>
                  </div>
                )}
              </div>

              {videoUrl && (
                <a
                  href={videoUrl}
                  download="umari-video.mp4"
                  className="mt-4 w-full py-4 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:shadow-lg transition-all"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Yuklab olish
                </a>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Token Info */}
      <div className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-2xl p-6 border border-gray-200">
        <h4 className="font-bold text-gray-700 mb-4 flex items-center gap-2">
          <svg className="w-5 h-5 text-purple-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
          Video narxlari ({plan === 'business_plus' ? 'Business+' : plan} tarif)
        </h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {videoModes.map((mode) => (
            <div key={mode.id} className={`p-4 rounded-xl border ${
              mode.id === 'basic'
                ? 'bg-white border-emerald-200'
                : mode.id === 'pro'
                  ? 'bg-white border-blue-200'
                  : 'bg-white border-purple-200'
            }`}>
              <p className="text-xs text-gray-500 mb-1">{mode.name}</p>
              <p className={`text-2xl font-black ${
                mode.id === 'basic'
                  ? 'text-emerald-600'
                  : mode.id === 'pro'
                    ? 'text-blue-600'
                    : 'text-purple-600'
              }`}>{mode.tokenCost}</p>
              <p className="text-xs text-gray-400">token / {mode.duration} sek</p>
            </div>
          ))}
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

export default VideoStudio;
