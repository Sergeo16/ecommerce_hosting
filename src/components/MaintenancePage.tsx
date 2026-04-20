'use client';

import Link from 'next/link';
import { AppLogo } from '@/components/AppLogo';
import { useLocale } from '@/context/LocaleContext';

const PREVIEW_COOKIE = 'preview_public';
const PREVIEW_MAX_AGE = 60 * 60 * 24; // 24h

export function getPreviewPublicCookie(): boolean {
  if (typeof document === 'undefined') return false;
  return document.cookie.includes(`${PREVIEW_COOKIE}=1`);
}

export function setPreviewPublicCookie(on: boolean) {
  if (typeof document === 'undefined') return;
  if (on) {
    document.cookie = `${PREVIEW_COOKIE}=1; path=/; max-age=${PREVIEW_MAX_AGE}; SameSite=Lax`;
  } else {
    document.cookie = `${PREVIEW_COOKIE}=; path=/; max-age=0`;
  }
}

type MaintenancePageProps = {
  isAdminPreview?: boolean;
  onExitPreview?: () => void;
};

export function MaintenancePage({ isAdminPreview, onExitPreview }: MaintenancePageProps) {
  const { t } = useLocale();
  return (
    <div className="min-h-screen bg-base-200 flex flex-col items-center justify-center p-6 text-center">
      <AppLogo className="btn btn-ghost text-xl mb-6" />
      <h1 className="text-2xl sm:text-3xl font-bold mb-2">{t('maintenanceTitle')}</h1>
      <p className="text-base-content/80 max-w-md mb-8">{t('maintenanceMessage')}</p>
      {isAdminPreview && onExitPreview && (
        <div className="flex flex-col gap-3">
          <p className="text-sm badge badge-ghost">{t('maintenancePreviewMode')}</p>
          <button type="button" onClick={onExitPreview} className="btn btn-primary">
            {t('maintenanceExitPreview')}
          </button>
        </div>
      )}
    </div>
  );
}
