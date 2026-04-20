'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useLocale } from '@/context/LocaleContext';
import { setPreviewPublicCookie } from '@/components/MaintenancePage';

export function AdminMaintenanceBanner() {
  const { user } = useAuth();
  const { t } = useLocale();
  const router = useRouter();
  const [maintenance, setMaintenance] = useState(false);
  const [previewPublic, setPreviewPublic] = useState(false);

  useEffect(() => {
    fetch('/api/admin/maintenance')
      .then((r) => r.json())
      .then((data: { maintenance?: boolean }) => setMaintenance(data.maintenance === true))
      .catch(() => setMaintenance(false));
  }, []);

  useEffect(() => {
    if (typeof document !== 'undefined') {
      setPreviewPublic(document.cookie.includes('preview_public=1'));
    }
  }, []);

  const isAdmin = user?.role === 'SUPER_ADMIN';
  if (!maintenance || !isAdmin || previewPublic) return null;

  function handlePreviewAsPublic() {
    setPreviewPublicCookie(true);
    router.push('/');
    router.refresh();
  }

  return (
    <div className="bg-warning/20 border-b border-warning/50 text-warning-content px-4 py-2 flex flex-wrap items-center justify-center gap-2 text-sm">
      <span className="font-medium">{t('maintenanceBannerText')}</span>
      <button
        type="button"
        onClick={handlePreviewAsPublic}
        className="btn btn-sm btn-warning"
      >
        {t('maintenancePreviewButton')}
      </button>
    </div>
  );
}
