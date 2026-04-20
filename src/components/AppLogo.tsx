'use client';

import Link from 'next/link';
import { useLocale } from '@/context/LocaleContext';

type AppLogoProps = {
  className?: string;
};

export function AppLogo({ className = 'btn btn-ghost text-xl' }: AppLogoProps) {
  const { t } = useLocale();
  return (
    <Link href="/" className={`whitespace-nowrap inline-flex items-center gap-1 ${className}`} aria-label={t('appName')}>
      {/* Icône bâtiment supermarché, même couleur que le panier (text-primary) pour cohérence */}
      <span aria-hidden className="text-primary">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          className="w-5 h-5 sm:w-6 sm:h-6"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M2 7 4.84 2.6a1 1 0 0 1 .86-.6H18.3a1 1 0 0 1 .86.6L22 7" />
          <path d="M2 7v12a1 1 0 0 0 1 1h18a1 1 0 0 0 1-1V7" />
          <path d="M2 7h20" />
        </svg>
      </span>
      {/* Texte "Centre Commercial ..." : masqué sur très petit écran pour éviter le chevauchement */}
      <span className="hidden sm:inline">
        {t('appName')}
      </span>
    </Link>
  );
}
