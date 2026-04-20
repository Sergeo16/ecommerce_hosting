'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { MaintenancePage, getPreviewPublicCookie, setPreviewPublicCookie } from '@/components/MaintenancePage';

const AUTH_PATHS = ['/auth/login', '/auth/register'];

export function MaintenanceGate({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [maintenance, setMaintenance] = useState<boolean | null>(null);
  const [previewPublic, setPreviewPublic] = useState(false);

  useEffect(() => {
    fetch('/api/admin/maintenance')
      .then((r) => r.json())
      .then((data: { maintenance?: boolean }) => setMaintenance(data.maintenance === true))
      .catch(() => setMaintenance(false));
  }, []);

  useEffect(() => {
    setPreviewPublic(getPreviewPublicCookie());
  }, []);

  const isAuthPage = pathname != null && AUTH_PATHS.includes(pathname);
  const isAdmin = user?.role === 'SUPER_ADMIN';
  const isCatalogWithRef = pathname === '/catalog' && searchParams?.get('ref');
  const showMaintenancePage =
    maintenance === true && !isAuthPage && !isCatalogWithRef && (!isAdmin || previewPublic);

  const handleExitPreview = useCallback(() => {
    setPreviewPublicCookie(false);
    setPreviewPublic(false);
    router.push('/dashboard');
    router.refresh();
  }, [router]);

  if (maintenance === null || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <span className="loading loading-spinner loading-lg" />
      </div>
    );
  }

  if (showMaintenancePage) {
    return (
      <MaintenancePage
        isAdminPreview={isAdmin && previewPublic}
        onExitPreview={handleExitPreview}
      />
    );
  }

  return <>{children}</>;
}
