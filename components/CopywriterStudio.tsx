'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { FiArrowLeft, FiDownload, FiStar } from 'react-icons/fi';
import { useToast } from './ToastProvider';
import { getTelegramSubscribeUrl } from '@/lib/telegram';
import { useLanguage } from '@/lib/LanguageContext';
import {
  SUBSCRIPTION_PLANS,
  type SubscriptionPlan,
} from '@/lib/subscription-plans';

// ============ CONSTANTS ============
const MARKETPLACES = ['Uzum Market', 'ANAMARKET', 'Yandex', 'Ozon', 'WB'];

const FIELD_ORDER = [
  'CAT',
  'NAME',
  'COUNTRY',
  'BRAND',
  'MODEL',
  'WARRANTY',
  'SHORT_DESC',
  'FULL_DESC',
  'PHOTOS_INFO',
  'VIDEO_REC',
  'SPECS',
  'PROPS',
  'INSTR',
  'SIZE',
  'COMP',
  'CARE',
  'SKU',
  'IKPU',
] as const;

const FIELD_LABEL_KEYS: Record<(typeof FIELD_ORDER)[number], string> = {
  CAT: 'copywriter.category1',
  NAME: 'copywriter.category2',
  COUNTRY: 'copywriter.category3',
  BRAND: 'copywriter.category4',
  MODEL: 'copywriter.category5',
  WARRANTY: 'copywriter.category6',
  SHORT_DESC: 'copywriter.category7',
  FULL_DESC: 'copywriter.category8',
  PHOTOS_INFO: 'copywriter.category9',
  VIDEO_REC: 'copywriter.category10',
  SPECS: 'copywriter.category11',
  PROPS: 'copywriter.category12',
  INSTR: 'copywriter.category13',
  SIZE: 'copywriter.category14',
  COMP: 'copywriter.category15',
  CARE: 'copywriter.category16',
  SKU: 'copywriter.category17',
  IKPU: 'copywriter.category18',
};

// ============ TOKEN COSTS ============
const COPYWRITER_TOKEN_COSTS: Record<SubscriptionPlan, number> = {
  free: 999,
  starter: 3,
  pro: 2,
  business_plus: 1,
};

// ============ TYPES ============
interface UserData {
  subscription_plan: SubscriptionPlan;
  tokens_remaining: number;
  role: string;
}

// ============ COMPONENT ============
const CopywriterStudio: React.FC = () => {
  const toast = useToast();
  const { t, language } = useLanguage();

  const withLang = (href: string) => {
    if (!href.startsWith('/')) return href;
    const stripped = href.replace(/^\/(uz|ru)(?=\/|$)/, '');
    return `/${language}${stripped || ''}`;
  };

  // User state
  const [user, setUser] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);

  // Form state
  const [selectedMarketplace, setSelectedMarketplace] = useState(MARKETPLACES[0]);
  const [images, setImages] = useState<(string | null)[]>([]);
  const [categoryRef, setCategoryRef] = useState('');
  const [imagePromptUz, setImagePromptUz] = useState('');
  const [imagePromptEn, setImagePromptEn] = useState('');
  const [promptGenerating, setPromptGenerating] = useState(false);
  const [results, setResults] = useState<Record<string, string>>({});
  const [generating, setGenerating] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(10);
  const accumulatedText = useRef('');

  const imageSlotLabels = [
    t('copywriter.frontImage', 'Old'),
    t('copywriter.backImage', 'Orqa'),
    t('copywriter.additionalImage', "Qo'shimcha"),
  ];

  // Derived values
  const plan = user?.subscription_plan || 'free';
  const isAdmin = user?.role === 'admin';
  const planConfig = SUBSCRIPTION_PLANS[plan];
  const tokensRemaining = isAdmin ? 999999 : (user?.tokens_remaining || 0);
  const tokenCost = COPYWRITER_TOKEN_COSTS[plan];
  const canGenerate = (isAdmin || tokensRemaining >= tokenCost) && planConfig.copywriter.maxBlocks > 0;

  const maxImages = isAdmin ? 3 : (plan === 'business_plus' ? 3 : plan === 'pro' ? 2 : 1);
  const uploadedCount = images.filter(Boolean).length;
  const effectiveImages = images.slice(0, maxImages);

  const canUsePromptAssist = isAdmin || plan !== 'free';

  // Fetch user
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await fetch('/api/auth/me');
        if (!res.ok) {
          setLoading(false);
          return;
        }
        const data = await res.json();
        if (data.success && data.user) {
          setUser({
            subscription_plan: data.user.subscription_plan || 'free',
            tokens_remaining: data.user.tokens_remaining || 0,
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

  // Countdown timer
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (generating) {
      timer = setInterval(() => setCountdown((prev) => (prev > 1 ? prev - 1 : 1)), 1000);
    } else {
      setCountdown(10);
    }
    return () => clearInterval(timer);
  }, [generating]);

  // Initialize image slots
  useEffect(() => {
    setImages((prev) => {
      const next = prev.slice(0, maxImages);
      while (next.length < maxImages) next.push(null);
      return next;
    });
  }, [maxImages]);

  // Handlers
  const handleUpload = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setImages((prev) => {
        const next = prev.slice(0, maxImages);
        while (next.length < maxImages) next.push(null);
        next[index] = reader.result as string;
        return next;
      });
    };
    reader.readAsDataURL(file);
  };

  const removeImage = (index: number) => {
    setImages((prev) => {
      const next = prev.slice(0, maxImages);
      while (next.length < maxImages) next.push(null);
      next[index] = null;
      return next;
    });
  };

  const parseIncremental = (text: string) => {
    const data: Record<string, string> = {};
    const keys = FIELD_ORDER as unknown as string[];
    keys.forEach((key, index) => {
      const nextKey = keys[index + 1];
      const regex = new RegExp(`---${key}---([\\s\\S]*?)(?=---${nextKey}---|$)`);
      const match = text.match(regex);
      if (match) {
        data[key] = match[1].trim();
      }
    });
    return data;
  };

  const handleGenerate = async () => {
    if (!canGenerate) {
      toast.error(t('copywriterNew.toasts.notEnoughTokensOrNeedSubscription', 'Tokenlaringiz yetarli emas yoki obuna kerak!'));
      return;
    }

    const activeImages = effectiveImages.filter(Boolean) as string[];
    if (activeImages.length === 0) {
      toast.error(t('copywriterNew.toasts.uploadImage', 'Iltimos, rasm yuklang.'));
      return;
    }

    setGenerating(true);
    setResults({});
    accumulatedText.current = '';

    try {
      const response = await fetch('/api/vertex/marketplace-description', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          images: activeImages,
          marketplace: selectedMarketplace,
          additionalInfo: categoryRef,
          tokenCost,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Xatolik yuz berdi');
      }

      const reader = response.body?.getReader();
      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = new TextDecoder().decode(value);
          if (chunk) {
            accumulatedText.current += chunk;
            setResults(parseIncremental(accumulatedText.current));
          }
        }
      }

      // Update tokens
      if (user && !isAdmin) {
        setUser({
          ...user,
          tokens_remaining: Math.max(0, user.tokens_remaining - tokenCost),
        });
      }

      toast.success(t('copywriterNew.toasts.generated', "Ma'lumotlar muvaffaqiyatli yaratildi!"));
    } catch (error) {
      toast.error((error as Error).message || t('common.error', 'Xatolik'));
    } finally {
      setGenerating(false);
    }
  };

  const extractLangText = (text: string, lang: 'UZ' | 'RU') => {
    if (!text) return '';
    if (lang === 'UZ') {
      const match = text.match(/UZ:\s*([\s\S]*?)(?=\n\s*RU:|$)/i);
      return (match?.[1] || '').trim();
    }
    const match = text.match(/RU:\s*([\s\S]*?)$/i);
    return (match?.[1] || '').trim();
  };

  const cleanLangText = (text: string, lang: 'UZ' | 'RU', key?: string) => {
    const langText = extractLangText(text, lang);
    if (!langText) return '';
    if (key === 'FULL_DESC') return langText;
    return langText.replace(/[*#_~]/g, '').trim();
  };

  const renderTextWithBold = (text: string) => {
    const lines = text.split('\n');
    return lines.map((line, lineIndex) => {
      const trimmed = line.trim();
      if (!trimmed) {
        return <div key={`blank-${lineIndex}`} className="h-2" />;
      }

      const segments = trimmed.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
      return (
        <p key={`line-${lineIndex}`} className="text-sm leading-relaxed">
          {segments.map((segment, segmentIndex) => {
            const boldMatch = segment.match(/^\*\*([\s\S]+)\*\*$/);
            if (boldMatch) {
              return (
                <strong key={`seg-${lineIndex}-${segmentIndex}`} className="font-semibold">
                  {boldMatch[1]}
                </strong>
              );
            }

            return <React.Fragment key={`seg-${lineIndex}-${segmentIndex}`}>{segment}</React.Fragment>;
          })}
        </p>
      );
    });
  };

  const copyToClipboard = (text: string, key: string, lang?: 'UZ' | 'RU') => {
    let final = text;
    if (lang) {
      final = cleanLangText(text, lang, key);
    } else {
      final = text.replace(/UZ:|RU:/gi, '').trim().split('\n')[0];
    }
    if (!final) return;
    navigator.clipboard.writeText(final);
    setCopiedKey(lang ? `${key}-${lang}` : key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const copyPlain = (text: string, key: string) => {
    const final = String(text || '').trim();
    if (!final) return;
    navigator.clipboard.writeText(final);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleGenerateImagePromptByImages = async () => {
    if (!canUsePromptAssist) {
      toast.error("Bu funksiya Starter va undan yuqori tariflarda mavjud.");
      return;
    }

    const activeImages = effectiveImages.filter(Boolean) as string[];
    if (activeImages.length === 0) {
      toast.error(t('copywriterNew.toasts.uploadImage', 'Iltimos, rasm yuklang.'));
      return;
    }

    setPromptGenerating(true);
    try {
      const mode = isAdmin || plan === 'business_plus' ? 'ultra' : 'pro';
      const res = await fetch('/api/generate-image-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productImages: activeImages, mode }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || 'Prompt yaratishda xatolik');
      }

      const uz = String(data?.prompt_uz || '').trim();
      const en = String(data?.prompt_en || data?.prompt || '').trim();
      setImagePromptUz(uz || en);
      setImagePromptEn(en || uz);

      if (user && !isAdmin && typeof data?.tokens_remaining === 'number') {
        setUser({
          ...user,
          tokens_remaining: Number(data.tokens_remaining || 0),
        });
      }

      toast.success(t('copywriterNew.toasts.generated', "Ma'lumotlar muvaffaqiyatli yaratildi!"));
    } catch (e) {
      toast.error((e as Error).message || t('common.error', 'Xatolik'));
    } finally {
      setPromptGenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-12 w-12 border-4 border-orange-500 border-t-transparent rounded-full" />
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
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </div>
            <div>
              <h1 className="text-3xl font-black tracking-tight">{t('copywriter.title', 'Copywriter studiya')}</h1>
              <p className="text-white/80 text-sm mt-1">{t('copywriterNew.subtitle', 'AI yordamida marketplace uchun kontentlar yarating')}</p>
            </div>
          </div>

          {/* Token Display */}
          <div className="flex items-center gap-4">
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl px-6 py-4 border border-white/20">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-yellow-400/30 rounded-xl">
                  <svg className="w-6 h-6 text-yellow-200" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M10 18a8 8 0 100-16 8 8 0 000 16zm0-2a6 6 0 100-12 6 6 0 000 12z" />
                    <path d="M10 6a1 1 0 011 1v2h2a1 1 0 110 2h-2v2a1 1 0 11-2 0v-2H7a1 1 0 110-2h2V7a1 1 0 011-1z" />
                  </svg>
                </div>
                <div>
                  <p className="text-xs text-white/70">Tokenlar</p>
                  <p className="text-xl font-bold">{isAdmin ? '∞' : tokensRemaining}</p>
                </div>
              </div>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl px-6 py-4 border border-white/20">
              <p className="text-xs text-white/70">{t('copywriterNew.plan', 'Tarif')}</p>
              <p className="text-xl font-bold capitalize">{plan === 'business_plus' ? 'Business+' : plan}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Plan Warning */}
      {planConfig.copywriter.maxBlocks === 0 && (
        <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-amber-100 rounded-xl">
              <svg className="w-6 h-6 text-amber-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div>
              <h3 className="font-bold text-amber-800">{t('copywriterNew.premiumRequiredTitle', 'Premium obuna kerak!')}</h3>
              <p className="text-amber-700 text-sm">{t('copywriterNew.premiumRequiredBody', "Copywriter studiyadan foydalanish uchun Starter yoki undan yuqori obunaga o'ting.")}</p>
            </div>
            <button
              type="button"
              onClick={() => window.open(getTelegramSubscribeUrl('starter'), '_blank')}
              className="ml-auto px-6 py-3 bg-amber-500 text-white rounded-xl font-semibold hover:bg-amber-600 transition-colors"
            >
              {t('copywriterNew.getSubscription', 'Obuna olish')}
            </button>
          </div>
        </div>
      )}

      {/* Marketplace Selection */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h3 className="font-bold text-gray-800 mb-2">{t('copywriter.selectMarketplace', 'Marketplace tanlang')}</h3>
            <div className="flex flex-wrap gap-2">
              {MARKETPLACES.map((mp) => (
                <button
                  key={mp}
                  onClick={() => setSelectedMarketplace(mp)}
                  className={`px-5 py-3 rounded-xl text-sm font-semibold transition-all ${selectedMarketplace === mp
                    ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-lg scale-105'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                >
                  {mp}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-3 bg-orange-50 px-5 py-3 rounded-xl border border-orange-200">
            <FiDownload className="w-5 h-5 text-orange-600" aria-hidden />
            <span className="text-sm font-semibold text-orange-700">{t('copywriterNew.exportExcel', 'Excelga yuklash')}</span>
            <p className="text-xs text-black/70">{t('common.comingSoon', 'Tez kunda')}</p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid lg:grid-cols-12 gap-8">
        {/* Left Panel - Input */}
        <div className="lg:col-span-4 space-y-6">
          {/* Images */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-gray-800">{t('copywriter.photos', 'Rasmlar')}</h3>
              <span className="px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-sm font-semibold">
                {uploadedCount}/{maxImages}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {effectiveImages.map((img, idx) => {
                const label = imageSlotLabels[idx] || `${t('copywriterNew.image', 'Rasm')} ${idx + 1}`;
                return (
                  <div key={idx} className="space-y-2">
                    <p className="text-xs font-semibold text-gray-500 px-1">{label}</p>
                    <div className="relative aspect-square rounded-xl overflow-hidden shadow-md group bg-gray-50 border-2 border-dashed border-gray-200">
                      {img ? (
                        <>
                          <img src={img} className="w-full h-full object-cover" alt={label} />
                          <button
                            onClick={() => removeImage(idx)}
                            className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </>
                      ) : (
                        <label className="w-full h-full flex items-center justify-center hover:bg-orange-50 transition-colors cursor-pointer">
                          <input
                            type="file"
                            onChange={(e) => handleUpload(idx, e)}
                            accept="image/*"
                            className="hidden"
                          />
                          <svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                          </svg>
                        </label>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Additional Info */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
            <h3 className="font-bold text-gray-800 mb-4">{t('copywriterNew.additionalInfo', "Qo'shimcha ma'lumot")}</h3>
            <textarea
              value={categoryRef}
              onChange={(e) => setCategoryRef(e.target.value)}
              placeholder={t('copywriterNew.additionalInfoPlaceholder', "Mahsulot haqida ma'lumot, kategoriya yoki maxsus ko'rsatmalar...")}
              className="w-full p-4 bg-gray-50 rounded-xl text-sm border border-gray-200 h-32 resize-none outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all"
            />
          </div>

          {/* Image Prompt Assistant */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <h3 className="font-bold text-gray-800">{t('copywriterNew.imagePromptTitle', 'Rasm yaratish prompti')}</h3>
                <p className="text-xs text-gray-500 mt-1">
                  {t('copywriterNew.imagePromptHint', '⭐ bosib, rasmga qarab tayyor prompt oling (EN rasm generatsiya uchun).')}
                </p>
              </div>

              <button
                type="button"
                onClick={handleGenerateImagePromptByImages}
                disabled={promptGenerating || !canUsePromptAssist}
                className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-all ${
                  promptGenerating
                    ? 'bg-gray-200 text-gray-600 cursor-not-allowed'
                    : canUsePromptAssist
                      ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white hover:shadow-md'
                      : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                }`}
                title={canUsePromptAssist ? 'Rasmga qarab prompt yozish (1 token)' : 'Starter va undan yuqori tarif kerak'}
              >
                <FiStar className="w-4 h-4" aria-hidden />
                <span>{promptGenerating ? '...' : '1 token'}</span>
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-gray-500">UZ</p>
                  <button
                    type="button"
                    onClick={() => copyPlain(imagePromptUz, 'image-prompt-uz')}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                      copiedKey === 'image-prompt-uz' ? 'bg-green-500 text-white' : 'bg-orange-100 text-orange-700 hover:bg-orange-200'
                    }`}
                    disabled={!imagePromptUz}
                  >
                    {copiedKey === 'image-prompt-uz' ? t('common.copied', 'Nusxalandi!') : t('common.copy', 'Nusxa')}
                  </button>
                </div>
                <textarea
                  value={imagePromptUz}
                  onChange={(e) => setImagePromptUz(e.target.value)}
                  placeholder={t('copywriterNew.imagePromptPlaceholderUz', 'UZ prompt (izoh uchun)')}
                  className="mt-2 w-full p-3 bg-gray-50 rounded-xl text-sm border border-gray-200 h-24 resize-none outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all"
                />
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-gray-500">EN</p>
                  <button
                    type="button"
                    onClick={() => copyPlain(imagePromptEn, 'image-prompt-en')}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                      copiedKey === 'image-prompt-en' ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                    disabled={!imagePromptEn}
                  >
                    {copiedKey === 'image-prompt-en' ? t('common.copied', 'Nusxalandi!') : t('common.copy', 'Nusxa')}
                  </button>
                </div>
                <textarea
                  value={imagePromptEn}
                  onChange={(e) => setImagePromptEn(e.target.value)}
                  placeholder={t('copywriterNew.imagePromptPlaceholderEn', 'EN prompt (rasm generatsiya uchun)')}
                  className="mt-2 w-full p-3 bg-gray-50 rounded-xl text-sm border border-gray-200 h-28 resize-none outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all"
                />
              </div>

              <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 text-[12px] text-gray-600">
                {t('copywriterNew.imagePromptTips', 'Tavsiya: EN promptni Marketplace Studio / rasm generatoriga qo‘ying. UZ prompt — mazmunni tekshirish uchun.')}
              </div>
            </div>
          </div>

          {/* Token Cost Info */}
          <div className="bg-gradient-to-r from-orange-50 to-amber-50 rounded-2xl p-4 border border-orange-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-100 rounded-lg">
                  <svg className="w-5 h-5 text-orange-600" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M10 18a8 8 0 100-16 8 8 0 000 16zm0-2a6 6 0 100-12 6 6 0 000 12z" />
                  </svg>
                </div>
                <div>
                  <p className="text-xs text-gray-500">{t('copywriterNew.tokenCost', 'Token sarfi')}</p>
                  <p className="text-lg font-bold text-orange-600">{tokenCost} {t('copywriterNew.tokenUnit', 'token')}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-500">{t('copywriterNew.blocks', '18 blok kontent')}</p>
                <p className="text-xs text-gray-400">{t('copywriterNew.languages', 'UZ + RU tillarida')}</p>
              </div>
            </div>
          </div>

          {/* Generate Button */}
          <button
            onClick={handleGenerate}
            disabled={generating || !canGenerate}
            className={`w-full py-5 rounded-2xl font-bold text-lg transition-all ${generating || !canGenerate
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : 'bg-gradient-to-r from-orange-500 to-amber-500 text-white hover:shadow-xl hover:scale-[1.02]'
              }`}
          >
            {generating ? (
              <div className="flex items-center justify-center gap-3">
                <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full" />
                  <span>{t('copywriterNew.generatingWithCountdown', `Generatsiya... (${countdown}s)`).replace('{seconds}', String(countdown))}</span>
              </div>
            ) : (
              <div className="flex items-center justify-center gap-3">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                  <span>{t('copywriterNew.generate', "Ma'lumotlarni yaratish")}</span>
              </div>
            )}
          </button>
        </div>

        {/* Right Panel - Results */}
        <div className="lg:col-span-8">
          {Object.keys(results).length > 0 ? (
            <div className="space-y-4">
              {FIELD_ORDER
                .filter((k) => k !== 'SKU' && k !== 'IKPU')
                .map(
                  (key) =>
                    results[key] && (
                      <div
                        key={key}
                        className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm transition-all hover:shadow-md"
                      >
                        <div className="flex justify-between items-center mb-4">
                          <h4 className="text-sm font-bold text-gray-700">{t(FIELD_LABEL_KEYS[key], key)}</h4>
                          <div className="flex gap-2">
                            <button
                              onClick={() => copyToClipboard(results[key], key, 'UZ')}
                              className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${copiedKey === `${key}-UZ`
                                ? 'bg-green-500 text-white'
                                : 'bg-orange-100 text-orange-700 hover:bg-orange-200'
                                }`}
                            >
                              {copiedKey === `${key}-UZ` ? t('common.copied', 'Nusxalandi!') : t('copywriterNew.copyUz', 'UZ nusxa')}
                            </button>
                            <button
                              onClick={() => copyToClipboard(results[key], key, 'RU')}
                              className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${copiedKey === `${key}-RU`
                                ? 'bg-green-500 text-white'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                }`}
                            >
                              {copiedKey === `${key}-RU` ? t('common.copied', 'Скопировано!') : t('copywriterNew.copyRu', 'RU копия')}
                            </button>
                          </div>
                        </div>
                        <div className="space-y-3">
                          <div className="p-4 bg-orange-50 rounded-xl border border-orange-100">
                            <p className="text-xs font-semibold text-orange-600 mb-1">🇺🇿 {t('copywriterNew.uzbek', "O'zbekcha")}</p>
                            {key === 'FULL_DESC' ? (
                              <div className="text-gray-700">{renderTextWithBold(cleanLangText(results[key], 'UZ', key))}</div>
                            ) : (
                              <p className="text-sm text-gray-700 leading-relaxed">{cleanLangText(results[key], 'UZ', key)}</p>
                            )}
                          </div>
                          <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                            <p className="text-xs font-semibold text-gray-500 mb-1">🇷🇺 {t('copywriterNew.russian', 'Русский')}</p>
                            {key === 'FULL_DESC' ? (
                              <div className="text-gray-600 italic">{renderTextWithBold(cleanLangText(results[key], 'RU', key))}</div>
                            ) : (
                              <p className="text-sm text-gray-600 leading-relaxed italic">{cleanLangText(results[key], 'RU', key)}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                )}

              {/* Technical Fields */}
              {(results['SKU'] || results['IKPU']) && (
                <div className="mt-8 pt-8 border-t-2 border-dashed border-gray-200">
                  <h3 className="text-lg font-bold text-gray-800 mb-4">{t('copywriterNew.technicalInfo', "Texnik ma'lumotlar")}</h3>
                  <div className="grid md:grid-cols-2 gap-4">
                    {['SKU', 'IKPU'].map(
                      (key) =>
                        results[key] && (
                          <div
                            key={key}
                            className="bg-gradient-to-br from-gray-900 to-gray-800 p-6 rounded-2xl text-white shadow-xl"
                          >
                            <div className="flex justify-between items-start mb-4">
                              <div>
                                <span className="text-xs font-bold text-gray-400 uppercase">{t(FIELD_LABEL_KEYS[key as 'SKU' | 'IKPU'], key)}</span>
                                <p className="text-xs text-gray-500 mt-1 max-w-[200px]">
                                  {key === 'SKU'
                                    ? t('copywriter.uniqueIdentifier', '')
                                    : t('copywriter.singleClassifier', '')}
                                </p>
                              </div>
                              <button
                                onClick={() => copyToClipboard(results[key], key)}
                                className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${copiedKey === key
                                  ? 'bg-green-500 text-white'
                                  : 'bg-white/10 text-white hover:bg-white/20'
                                  }`}
                              >
                                {copiedKey === key ? '✓' : t('common.copy', 'Nusxa')}
                              </button>
                            </div>
                            <p className="text-2xl font-mono font-bold text-orange-400 break-all">
                              {results[key].replace(/UZ:|RU:/gi, '').trim().split('\n')[0]}
                            </p>
                          </div>
                        )
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white p-16 rounded-3xl shadow-sm border border-gray-200 flex flex-col items-center justify-center text-center h-full min-h-[400px]">
              <div className="w-20 h-20 bg-orange-100 rounded-full flex items-center justify-center mb-6">
                <svg className="w-10 h-10 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-700 mb-2">{t('copywriterNew.emptyTitle', 'Kontent yaratishni boshlang')}</h3>
              <p className="text-gray-500 max-w-sm">{t('copywriterNew.emptyBody', 'Rasm yuklang va "Ma\'lumotlarni yaratish" tugmasini bosing. AI 18 ta blokda UZ va RU tillarida kontent yaratadi.')}</p>
            </div>
          )}
        </div>
      </div>

      {/* Token Cost Summary */}
      <div className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-2xl p-6 border border-gray-200">
        <h4 className="font-bold text-gray-700 mb-4 flex items-center gap-2">
          <svg className="w-5 h-5 text-amber-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
          {t('copywriterNew.pricingTitle', 'Copywriter token narxlari')}
        </h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-xl border border-gray-200">
            <p className="text-xs text-gray-500 mb-1">Starter</p>
            <p className="text-2xl font-black text-emerald-600">3</p>
            <p className="text-xs text-gray-400">{t('copywriterNew.tokenPerGeneration', 'token / generatsiya')}</p>
          </div>
          <div className="bg-white p-4 rounded-xl border border-blue-200">
            <p className="text-xs text-gray-500 mb-1">Pro</p>
            <p className="text-2xl font-black text-blue-600">2</p>
            <p className="text-xs text-gray-400">{t('copywriterNew.tokenPerGeneration', 'token / generatsiya')}</p>
          </div>
          <div className="bg-white p-4 rounded-xl border border-purple-200">
            <p className="text-xs text-gray-500 mb-1">Business+</p>
            <p className="text-2xl font-black text-purple-600">1</p>
            <p className="text-xs text-gray-400">{t('copywriterNew.tokenPerGeneration', 'token / generatsiya')}</p>
          </div>
          <div className="bg-white p-4 rounded-xl border border-amber-200">
            <p className="text-xs text-gray-500 mb-1">{t('copywriterNew.yourBalance', 'Sizning balansingiz')}</p>
            <p className="text-2xl font-black text-amber-600">{isAdmin ? '∞' : tokensRemaining}</p>
            <p className="text-xs text-gray-400">{t('copywriterNew.tokenUnit', 'token')}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CopywriterStudio;
