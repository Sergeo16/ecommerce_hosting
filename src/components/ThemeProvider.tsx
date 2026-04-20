'use client';

import { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'dark' | 'business' | 'corporate' | 'luxury' | 'cyberpunk';

const ThemeContext = createContext<{
  theme: Theme;
  setTheme: (t: Theme) => void;
} | null>(null);

const THEME_KEY = 'marketplace_theme';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('business');

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (typeof window === 'undefined') return;
      const saved = localStorage.getItem(THEME_KEY) as Theme | null;
      const allowed: Theme[] = ['dark', 'business', 'corporate', 'luxury', 'cyberpunk'];

      if (saved && allowed.includes(saved)) {
        if (cancelled) return;
        setThemeState(saved);
        document.documentElement.setAttribute('data-theme', saved);
        return;
      }

      // Aucun thème utilisateur : récupérer le thème global configuré par le Super Admin
      try {
        const res = await fetch('/api/config/theme', { cache: 'no-store' });
        const data = (await res.json().catch(() => ({}))) as { theme?: string };
        const globalTheme = (data.theme as Theme | undefined) && allowed.includes(data.theme as Theme) ? (data.theme as Theme) : 'business';
        if (cancelled) return;
        setThemeState(globalTheme);
        document.documentElement.setAttribute('data-theme', globalTheme);
      } catch {
        if (cancelled) return;
        document.documentElement.setAttribute('data-theme', 'business');
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const setTheme = (t: Theme) => {
    setThemeState(t);
    document.documentElement.setAttribute('data-theme', t);
    if (typeof window !== 'undefined') localStorage.setItem(THEME_KEY, t);
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
