'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { AppLogo } from '@/components/AppLogo';
import { ThemeSwitcher } from '@/components/ThemeSwitcher';
import { LocaleSwitcher } from '@/components/LocaleSwitcher';
import { useLocale } from '@/context/LocaleContext';
import { AdminNotificationsBell } from '@/components/AdminNotificationsBell';
import { formatNumberForLocale } from '@/lib/currency';
import { roleToDisplayKey } from '@/lib/translations';

export default function DashboardPage() {
  const { user, token, isLoading, logout } = useAuth();
  const { t, locale } = useLocale();
  const [dashboard, setDashboard] = useState<Record<string, unknown> | null>(null);
  const [affiliateStats, setAffiliateStats] = useState<Record<string, unknown> | null>(null);
  const [courierStats, setCourierStats] = useState<Record<string, unknown> | null>(null);
  const [supplierStats, setSupplierStats] = useState<Record<string, unknown> | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!token || !user) return;
    if (user.role === 'SUPER_ADMIN') {
      fetch('/api/admin/dashboard', { headers: { Authorization: `Bearer ${token}` } })
        .then((r) => r.json())
        .then(setDashboard)
        .catch(() => setDashboard(null));
    }
    if (user.role === 'AFFILIATE') {
      fetch('/api/affiliate/stats', { headers: { Authorization: `Bearer ${token}` } })
        .then((r) => r.json())
        .then(setAffiliateStats)
        .catch(() => setAffiliateStats(null));
    }
    if (user.role === 'COURIER') {
      fetch('/api/courier/stats', { headers: { Authorization: `Bearer ${token}` } })
        .then((r) => r.json())
        .then(setCourierStats)
        .catch(() => setCourierStats(null));
    }
    if (user.role === 'SUPPLIER') {
      fetch('/api/supplier/stats', { headers: { Authorization: `Bearer ${token}` } })
        .then((r) => r.json())
        .then(setSupplierStats)
        .catch(() => setSupplierStats(null));
    }
  }, [token, user]);

  useEffect(() => {
    const fn = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false); };
    if (menuOpen) { document.addEventListener('click', fn); return () => document.removeEventListener('click', fn); }
  }, [menuOpen]);

  if (isLoading) return <div className="p-8">{t('loading')}</div>;
  if (!user) {
    return (
      <div className="p-8 text-center">
        <p>{t('connectToAccessDashboard')}</p>
        <Link href="/auth/login" className="btn btn-primary mt-4">{t('login')}</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-base-200">
      <header className="navbar bg-base-100 shadow-lg px-2 sm:px-4 min-h-12 sm:min-h-14 py-1 gap-1 sm:gap-2 flex-nowrap overflow-x-hidden w-full max-w-full">
        <div className="navbar-start shrink-0 min-w-0 max-w-[40%] sm:max-w-none">
          <AppLogo className="btn btn-ghost btn-sm sm:btn-ghost text-base sm:text-xl px-1 sm:px-2 truncate max-w-[120px] sm:max-w-[180px] md:max-w-none" />
        </div>
        <nav className="navbar-center flex-1 justify-center hidden md:flex flex-nowrap gap-2 lg:gap-4 min-w-0" aria-label="Navigation">
          <Link href="/catalog" className="link link-hover whitespace-nowrap">{t('catalog')}</Link>
          <Link href="/dashboard" className="link link-hover font-semibold whitespace-nowrap">{t('dashboard')}</Link>
        </nav>
        <div className="navbar-end shrink-0 flex-nowrap gap-1">
          {user?.role === 'SUPER_ADMIN' && token && (
            <AdminNotificationsBell token={token} />
          )}
          <div className="hidden md:flex items-center gap-1">
            <ThemeSwitcher />
            <LocaleSwitcher />
          </div>
          <span className="hidden lg:inline text-sm opacity-80 truncate max-w-[100px]">{user.firstName}</span>
          <button type="button" onClick={logout} className="btn btn-ghost btn-sm hidden md:inline-flex">{t('logout')}</button>
          <div className="md:hidden relative" ref={menuRef}>
            <button type="button" className="btn btn-ghost btn-sm btn-square" onClick={(e) => { e.stopPropagation(); setMenuOpen((o) => !o); }} aria-label="Menu">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                {menuOpen ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /> : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />}
              </svg>
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-full mt-1 w-52 rounded-lg shadow-xl bg-base-100 border border-base-300 py-2 z-50">
                <Link href="/catalog" className="block px-4 py-2 hover:bg-base-200" onClick={() => setMenuOpen(false)}>{t('catalog')}</Link>
                <Link href="/dashboard" className="block px-4 py-2 hover:bg-base-200 font-semibold" onClick={() => setMenuOpen(false)}>{t('dashboard')}</Link>
                <div className="border-t border-base-300 my-2" />
                <div className="px-4 py-2 flex flex-nowrap gap-2 items-center"><ThemeSwitcher /><LocaleSwitcher /></div>
                <div className="px-4 py-2 border-t border-base-300">
                  <span className="text-sm opacity-80">{user.firstName} ({t(roleToDisplayKey(user.role))})</span>
                </div>
                <button type="button" className="btn btn-ghost btn-sm w-full justify-start px-4" onClick={() => { setMenuOpen(false); logout(); }}>{t('logout')}</button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="container mx-auto p-6">
        <h1 className="text-2xl font-bold mb-6">{t('dashboardTitle')} — {t(roleToDisplayKey(user.role))}</h1>

        {user.role === 'SUPER_ADMIN' && dashboard && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <div className="stat bg-base-100 rounded-lg shadow">
              <div className="stat-title">{t('platformRevenue')}</div>
              <div className="stat-value text-primary">{formatNumberForLocale((dashboard.revenue as number) ?? 0, locale)}</div>
            </div>
            <div className="stat bg-base-100 rounded-lg shadow">
              <div className="stat-title">{t('platformCommissions')}</div>
              <div className="stat-value">{formatNumberForLocale((dashboard.platformCommissions as number) ?? 0, locale)}</div>
            </div>
            <div className="stat bg-base-100 rounded-lg shadow">
              <div className="stat-title">{t('pendingWithdrawals')}</div>
              <div className="stat-value">{formatNumberForLocale((dashboard.pendingWithdrawals as number) ?? 0, locale)}</div>
            </div>
            <div className="stat bg-base-100 rounded-lg shadow">
              <div className="stat-title">{t('deliveryRate')}</div>
              <div className="stat-value">{(dashboard.deliverySuccessRate as number)?.toFixed(1)}%</div>
            </div>
          </div>
        )}

        {user.role === 'AFFILIATE' && affiliateStats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <div className="stat bg-base-100 rounded-lg shadow">
              <div className="stat-title">{t('availableCommissions')}</div>
              <div className="stat-value text-primary">{formatNumberForLocale((affiliateStats.availableCommissions as number) ?? (affiliateStats.totalCommissions as number) ?? 0, locale)}</div>
              <div className="stat-desc">{t('availableCommissionsDesc')}</div>
            </div>
            <div className="stat bg-base-100 rounded-lg shadow">
              <div className="stat-title">{t('heldCommissions')}</div>
              <div className="stat-value">{formatNumberForLocale((affiliateStats.heldCommissions as number) ?? 0, locale)}</div>
              <div className="stat-desc">{t('heldCommissionsDesc')}</div>
            </div>
            <div className="stat bg-base-100 rounded-lg shadow">
              <div className="stat-title">{t('pending')}</div>
              <div className="stat-value">{formatNumberForLocale((affiliateStats.pendingCommissions as number) ?? 0, locale)}</div>
            </div>
            <div className="stat bg-base-100 rounded-lg shadow">
              <div className="stat-title">{t('ranking')}</div>
              <div className="stat-value">#{String((affiliateStats.ranking as number | string | undefined) ?? '')}</div>
            </div>
          </div>
        )}

        {user.role === 'COURIER' && courierStats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <div className="stat bg-base-100 rounded-lg shadow">
              <div className="stat-title">{t('availableCommissions')}</div>
              <div className="stat-value text-primary">{formatNumberForLocale((courierStats.availableCommissions as number) ?? 0, locale)}</div>
              <div className="stat-desc">{t('availableCommissionsDesc')}</div>
            </div>
            <div className="stat bg-base-100 rounded-lg shadow">
              <div className="stat-title">{t('heldCommissions')}</div>
              <div className="stat-value">{formatNumberForLocale((courierStats.heldCommissions as number) ?? 0, locale)}</div>
              <div className="stat-desc">{t('heldCommissionsDesc')}</div>
            </div>
            <div className="stat bg-base-100 rounded-lg shadow">
              <div className="stat-title">{t('pending')}</div>
              <div className="stat-value">{formatNumberForLocale((courierStats.pendingCommissions as number) ?? 0, locale)}</div>
            </div>
            <div className="stat bg-base-100 rounded-lg shadow">
              <div className="stat-title">{t('totalCommissions')}</div>
              <div className="stat-value">{formatNumberForLocale((courierStats.totalCommissions as number) ?? 0, locale)}</div>
            </div>
          </div>
        )}

        {user.role === 'SUPPLIER' && supplierStats && (
          <div className="mb-8 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="stat bg-base-100 rounded-lg shadow">
                <div className="stat-title">{t('availableEarnings') ?? 'Disponible'}</div>
                <div className="stat-value text-primary">{formatNumberForLocale((supplierStats.availableEarnings as number) ?? 0, locale)}</div>
                <div className="stat-desc">{t('availableCommissionsDesc')}</div>
              </div>
              <div className="stat bg-base-100 rounded-lg shadow">
                <div className="stat-title">{t('heldCommissions')}</div>
                <div className="stat-value">{formatNumberForLocale((supplierStats.heldEarnings as number) ?? 0, locale)}</div>
                <div className="stat-desc">{t('heldCommissionsDesc')}</div>
              </div>
              <div className="stat bg-base-100 rounded-lg shadow">
                <div className="stat-title">{t('totalEarnings') ?? 'Total'}</div>
                <div className="stat-value">{formatNumberForLocale((supplierStats.totalEarnings as number) ?? 0, locale)}</div>
              </div>
              <div className="stat bg-base-100 rounded-lg shadow">
                <div className="stat-title">{t('ordersDelivered') ?? 'Commandes livrées'}</div>
                <div className="stat-value">{(supplierStats.ordersCount as number) ?? 0}</div>
              </div>
            </div>
            {Array.isArray(supplierStats.salesEvolution) && (supplierStats.salesEvolution as { date: string; amount: number }[]).some((d) => d.amount > 0) && (
              <div className="card bg-base-100 shadow">
                <div className="card-body">
                  <h2 className="card-title text-lg">{t('salesEvolution') ?? 'Évolution des ventes (30 jours)'}</h2>
                  <div className="flex items-end gap-1 h-24 overflow-x-auto py-2">
                    {(supplierStats.salesEvolution as { date: string; amount: number }[]).map((d) => {
                      const max = Math.max(...(supplierStats.salesEvolution as { amount: number }[]).map((x) => x.amount), 1);
                      return (
                        <div key={d.date} className="flex flex-col items-center flex-1 min-w-0" title={`${d.date}: ${formatNumberForLocale(d.amount, locale)}`}>
                          <div className="w-full bg-primary/30 rounded-t transition-all h-full flex flex-col justify-end">
                            <div className="bg-primary rounded-t" style={{ height: `${(d.amount / max) * 100}%`, minHeight: d.amount > 0 ? '4px' : 0 }} />
                          </div>
                          <span className="text-[10px] truncate w-full text-center mt-1">{d.date.slice(8)}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="flex flex-wrap gap-4">
          {user.role === 'SUPER_ADMIN' && (
            <>
              <Link href="/dashboard/admin/settings" className="btn btn-outline">{t('globalSettings')}</Link>
              <Link href="/dashboard/admin/users" className="btn btn-outline">{t('users')}</Link>
              <Link href="/dashboard/admin/orders" className="btn btn-outline">{t('orders')}</Link>
              <Link href="/dashboard/admin/affiliates" className="btn btn-outline">{t('affiliates')}</Link>
              <Link href="/dashboard/admin/commissions" className="btn btn-outline">{t('commissions')}</Link>
              <Link href="/dashboard/admin/supplier-payouts" className="btn btn-outline">{t('adminPayoutsTitle')}</Link>
            </>
          )}
          {user.role === 'AFFILIATE' && (
            <>
              <Link href="/dashboard/affiliate/links" className="btn btn-primary">{t('myAffiliateLinks')}</Link>
              <Link href="/dashboard/affiliate/withdraw" className="btn btn-outline">{t('requestWithdrawal')}</Link>
            </>
          )}
          {(user.role === 'SUPPLIER' || user.role === 'AFFILIATE' || user.role === 'SUPER_ADMIN') && (
            <>
              <Link href="/dashboard/products" className="btn btn-primary">{t('myProducts')}</Link>
              <Link href="/dashboard/products/new" className="btn btn-outline">{t('publishProduct')}</Link>
            </>
          )}
          {user.role === 'SUPPLIER' && (
            <Link href="/dashboard/supplier/withdraw" className="btn btn-outline">{t('requestWithdrawal')}</Link>
          )}
          {user.role === 'COURIER' && (
            <>
              <Link href="/dashboard/courier/missions" className="btn btn-primary">{t('myMissions')}</Link>
              <Link href="/dashboard/courier/withdraw" className="btn btn-outline">{t('requestWithdrawal')}</Link>
            </>
          )}
          {(user.role === 'CLIENT' || user.role === 'AFFILIATE') && (
            <Link href="/catalog" className="btn btn-primary">{t('seeCatalog')}</Link>
          )}
        </div>
      </main>
    </div>
  );
}
