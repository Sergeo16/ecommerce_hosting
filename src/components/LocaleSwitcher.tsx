'use client';

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useLocale } from '@/context/LocaleContext';
import type { Locale } from '@/lib/translations';

const LOCALES: { value: Locale; label: string }[] = [
  { value: 'fr', label: 'Français' },
  { value: 'en', label: 'English' },
];

export function LocaleSwitcher({ className = '' }: { className?: string }) {
  const { locale, setLocale, t } = useLocale();
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const ref = useRef<HTMLDivElement>(null);

  const DROPDOWN_WIDTH = 160; // w-40

  useEffect(() => {
    if (open && ref.current) {
      const rect = ref.current.getBoundingClientRect();
      const left = Math.max(8, Math.min(rect.left, window.innerWidth - DROPDOWN_WIDTH - 8));
      setPosition({ top: rect.bottom + 4, left });
    }
  }, [open]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (ref.current && !ref.current.contains(target) && !document.getElementById('locale-dropdown-portal')?.contains(target)) setOpen(false);
    }
    if (open) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [open]);

  const dropdown = open && typeof document !== 'undefined' && createPortal(
    <ul
      id="locale-dropdown-portal"
      className="fixed z-[200] p-2 shadow-xl bg-base-100 border border-base-300 rounded-box w-40 menu"
      role="menu"
      style={{ top: position.top, left: position.left }}
    >
      {LOCALES.map(({ value, label }) => (
        <li key={value} role="none">
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setLocale(value);
              setOpen(false);
            }}
            className={locale === value ? 'active' : ''}
          >
            {label}
          </button>
        </li>
      ))}
    </ul>,
    document.body
  );

  return (
    <>
      <div className={`relative ${className}`} ref={ref}>
        <button
          type="button"
          className="btn btn-ghost btn-sm gap-1 px-2 sm:px-3 min-w-0 shrink-0"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-haspopup="true"
          aria-label={t('language')}
        >
          <span className="opacity-70 shrink-0" aria-hidden>🌐</span>
          <span className="hidden lg:inline">{t('language')}</span>
          <span className="text-xs uppercase opacity-80 shrink-0">{locale}</span>
        </button>
      </div>
      {dropdown}
    </>
  );
}
