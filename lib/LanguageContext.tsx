'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

type Language = 'uz' | 'ru';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string, defaultValue?: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const translations: Record<Language, Record<string, any>> = {
  uz: {},
  ru: {},
};

async function loadTranslations() {
  try {
    const [uzModule, ruModule] = await Promise.all([
      import('../locales/uz.json'),
      import('../locales/ru.json'),
    ]);
    translations.uz = (uzModule as any).default ?? (uzModule as any);
    translations.ru = (ruModule as any).default ?? (ruModule as any);
  } catch (error) {
    console.error('Failed to load translations:', error);
  }
}

function getLanguageFromPathname(pathname: string): Language | null {
  const match = pathname.match(/^\/(uz|ru)(\/|$)/);
  if (!match) return null;
  return match[1] as Language;
}

function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const value = document.cookie
    .split(';')
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${name}=`));
  if (!value) return null;
  return decodeURIComponent(value.split('=')[1] ?? '');
}

function setLanguageCookie(lang: Language) {
  if (typeof document === 'undefined') return;
  const maxAge = 60 * 60 * 24 * 365;
  document.cookie = `language=${encodeURIComponent(lang)}; Path=/; Max-Age=${maxAge}; SameSite=Lax`;
}

function getNestedValue(obj: any, path: string, defaultValue?: string): string {
  const keys = path.split('.');
  let value = obj;

  for (const key of keys) {
    if (value && typeof value === 'object' && key in value) {
      value = value[key];
    } else {
      return defaultValue || path;
    }
  }

  return typeof value === 'string' ? value : defaultValue || path;
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>('uz');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    // Load translations
    loadTranslations().finally(() => setLoaded(true));

    // Determine language priority:
    // 1) URL prefix (/uz, /ru)
    // 2) Cookie (language)
    // 3) localStorage
    try {
      const fromPath = getLanguageFromPathname(window.location.pathname);
      if (fromPath) {
        setLanguageState(fromPath);
        setLanguageCookie(fromPath);
        localStorage.setItem('language', fromPath);
        return;
      }

      const fromCookie = getCookie('language') as Language | null;
      if (fromCookie === 'uz' || fromCookie === 'ru') {
        setLanguageState(fromCookie);
        localStorage.setItem('language', fromCookie);
        return;
      }

      const saved = localStorage.getItem('language') as Language | null;
      if (saved === 'uz' || saved === 'ru') {
        setLanguageState(saved);
        setLanguageCookie(saved);
      }
    } catch {
      // storage/cookie might not be available
    }
  }, []);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    try {
      localStorage.setItem('language', lang);
      setLanguageCookie(lang);
    } catch {
      // localStorage might not be available
    }
  };

  const t = (key: string, defaultValue?: string): string => {
    return getNestedValue(translations[language], key, defaultValue);
  };

  return React.createElement(LanguageContext.Provider, { value: { language, setLanguage, t } }, children);
}

export function useLanguage(): LanguageContextType {
  const context = useContext(LanguageContext);
  
  // Return default values during static generation (build time)
  if (!context) {
    return {
      language: 'uz',
      setLanguage: () => {},
      t: (key: string, defaultValue?: string) => defaultValue || key,
    };
  }
  
  return context;
}
