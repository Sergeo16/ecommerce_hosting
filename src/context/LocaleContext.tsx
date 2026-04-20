'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { translations, type Locale, type TranslationKey } from '@/lib/translations';

const LOCALE_KEY = 'marketplace_locale';

type LocaleContextType = {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: TranslationKey) => string;
};

const LocaleContext = createContext<LocaleContextType | null>(null);

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('fr');

  useEffect(() => {
    const saved = (typeof window !== 'undefined' && localStorage.getItem(LOCALE_KEY)) as Locale | null;
    if (saved === 'fr' || saved === 'en') {
      setLocaleState(saved);
    }
  }, []);

  useEffect(() => {
    if (typeof document !== 'undefined') document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = (l: Locale) => {
    setLocaleState(l);
    if (typeof window !== 'undefined') localStorage.setItem(LOCALE_KEY, l);
  };

  const t = (key: TranslationKey) => translations[locale][key] ?? key;

  return (
    <LocaleContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </LocaleContext.Provider>
  );
}

export function useLocale() {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error('useLocale must be used within LocaleProvider');
  return ctx;
}
