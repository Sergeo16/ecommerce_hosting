'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { toast } from 'react-toastify';
import { useAuth } from '@/context/AuthContext';
import { AppLogo } from '@/components/AppLogo';
import { ThemeSwitcher } from '@/components/ThemeSwitcher';
import { LocaleSwitcher } from '@/components/LocaleSwitcher';
import { useLocale } from '@/context/LocaleContext';
import { formatNumberForLocale, formatCurrencyForDisplay } from '@/lib/currency';
import type { TranslationKey } from '@/lib/translations';

type Payout = {
  id: string;
  orderNumber: string;
  companyName: string;
  supplier?: { firstName: string; lastName: string; email: string };
  amount: number;
  status: string;
  createdAt: string;
};

const STATUS_KEYS: Record<string, string> = {
  APPROVED: 'payoutStatusAvailable',
  ON_HOLD: 'payoutStatusOnHold',
  PAID: 'payoutStatusPaid',
  CANCELLED: 'payoutStatusCancelled',
};

export default function AdminSupplierPayoutsPage() {
  const { user, token } = useAuth();
  const { t, locale } = useLocale();
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('');
  const [acting, setActing] = useState<string | null>(null);

  useEffect(() => {
    if (!token || user?.role !== 'SUPER_ADMIN') return;
    const params = new URLSearchParams();
    if (filterStatus) params.set('status', filterStatus);
    setLoading(true);
    fetch(`/api/admin/supplier-payouts?${params}`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((data) => setPayouts(Array.isArray(data) ? data : []))
      .catch(() => setPayouts([]))
      .finally(() => setLoading(false));
  }, [token, user?.role, filterStatus]);

  async function handleAction(id: string, action: 'release' | 'block' | 'reject') {
    if (!token) return;
    setActing(id);
    try {
      const res = await fetch(`/api/admin/supplier-payouts/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? t('loginError'));
        return;
      }
      toast.success(action === 'release' ? t('payoutReleased') : action === 'block' ? t('payoutBlocked') : t('payoutRejected'));
      setPayouts((prev) => prev.map((p) => (p.id === id ? { ...p, status: data.status } : p)));
    } finally {
      setActing(null);
    }
  }

  if (user?.role !== 'SUPER_ADMIN') {
    return (
      <div className="p-8">
        <p>{t('accessReservedAdmin')}</p>
        <Link href="/dashboard" className="btn btn-ghost mt-4">{t('back')}</Link>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 w-full max-w-full">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <AppLogo className="btn btn-ghost btn-sm text-base" />
          <Link href="/dashboard" className="btn btn-ghost btn-sm">← {t('dashboard')}</Link>
        </div>
        <div className="flex gap-1">
          <ThemeSwitcher />
          <LocaleSwitcher />
        </div>
      </div>
      <h1 className="text-2xl font-bold mb-6">{t('adminPayoutsTitle')}</h1>
      <p className="text-sm opacity-80 mb-4">
        {t('adminPayoutsDesc')}
      </p>
      <div className="flex flex-wrap gap-2 mb-4">
        <select
          className="select select-bordered select-sm"
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
        >
          <option value="">{t('allStatuses')}</option>
          <option value="APPROVED">{t('payoutStatusAvailable')}</option>
          <option value="ON_HOLD">{t('payoutStatusOnHold')}</option>
          <option value="PAID">{t('payoutStatusPaid')}</option>
          <option value="CANCELLED">{t('payoutStatusCancelled')}</option>
        </select>
      </div>
      {loading ? (
        <span className="loading loading-spinner" />
      ) : (
        <div className="overflow-x-auto">
          <table className="table table-zebra">
            <thead>
              <tr>
                <th>{t('orderColumn')}</th>
                <th>{t('supplierColumn')}</th>
                <th>{t('amountColumn')}</th>
                <th>{t('statusColumn')}</th>
                <th>{t('dateColumn')}</th>
                <th>{t('actions')}</th>
              </tr>
            </thead>
            <tbody>
              {payouts.map((p) => (
                <tr key={p.id}>
                  <td className="font-mono text-sm">{p.orderNumber ?? '—'}</td>
                  <td>
                    <div>{p.companyName ?? '—'}</div>
                    {p.supplier && <div className="text-xs opacity-70">{p.supplier.email}</div>}
                  </td>
                  <td>{formatNumberForLocale(p.amount, locale as 'fr' | 'en')} {formatCurrencyForDisplay('XOF')}</td>
                  <td>
                    <span className={`badge badge-sm ${p.status === 'APPROVED' ? 'badge-success' : p.status === 'ON_HOLD' ? 'badge-warning' : p.status === 'CANCELLED' ? 'badge-error' : 'badge-ghost'}`}>
                      {STATUS_KEYS[p.status] ? t(STATUS_KEYS[p.status] as TranslationKey) : p.status}
                    </span>
                  </td>
                  <td className="text-sm">{new Date(p.createdAt).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}</td>
                  <td>
                    {['APPROVED', 'ON_HOLD'].includes(p.status) && (
                      <div className="flex gap-1">
                        {p.status === 'ON_HOLD' && (
                          <button
                            type="button"
                            className="btn btn-xs btn-success"
                            disabled={!!acting}
                            onClick={() => handleAction(p.id, 'release')}
                          >
                            {t('releaseBtn')}
                          </button>
                        )}
                        {p.status === 'APPROVED' && (
                          <button
                            type="button"
                            className="btn btn-xs btn-warning"
                            disabled={!!acting}
                            onClick={() => handleAction(p.id, 'block')}
                          >
                            {t('blockBtn')}
                          </button>
                        )}
                        <button
                          type="button"
                          className="btn btn-xs btn-error"
                          disabled={!!acting}
                          onClick={() => handleAction(p.id, 'reject')}
                        >
                          {t('rejectBtn')}
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
