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

type Commission = {
  id: string;
  orderNumber: string;
  type: string;
  amount: number;
  status: string;
  user?: { firstName: string; lastName: string; email: string };
  createdAt: string;
};

const STATUS_LABEL: Record<string, string> = {
  PENDING: 'En attente',
  APPROVED: 'Disponible',
  ON_HOLD: 'Bloqué (vérification)',
  PAID: 'Payé',
  CANCELLED: 'Rejeté',
};

const TYPE_LABEL: Record<string, string> = {
  PLATFORM: 'Plateforme',
  AFFILIATE: 'Affilié',
  COURIER: 'Livreur',
};

export default function AdminCommissionsPage() {
  const { user, token } = useAuth();
  const { t, locale } = useLocale();
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [acting, setActing] = useState<string | null>(null);

  useEffect(() => {
    if (!token || user?.role !== 'SUPER_ADMIN') return;
    const params = new URLSearchParams();
    if (filterType) params.set('type', filterType);
    if (filterStatus) params.set('status', filterStatus);
    setLoading(true);
    fetch(`/api/admin/commissions?${params}`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((data) => setCommissions(Array.isArray(data) ? data : []))
      .catch(() => setCommissions([]))
      .finally(() => setLoading(false));
  }, [token, user?.role, filterType, filterStatus]);

  async function handleAction(id: string, action: 'release' | 'block' | 'reject') {
    if (!token) return;
    setActing(id);
    try {
      const res = await fetch(`/api/admin/commissions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? 'Erreur');
        return;
      }
      toast.success(action === 'release' ? 'Commission libérée' : action === 'block' ? 'Commission bloquée' : 'Commission rejetée');
      setCommissions((prev) => prev.map((c) => (c.id === id ? { ...c, status: data.status } : c)));
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
      <h1 className="text-2xl font-bold mb-6">Commissions · Gestion</h1>
      <p className="text-sm opacity-80 mb-4">
        Par défaut les commissions sont disponibles dès la livraison. Vous pouvez les bloquer pour vérification, puis les libérer ou rejeter.
      </p>
      <div className="flex flex-wrap gap-2 mb-4">
        <select
          className="select select-bordered select-sm"
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
        >
          <option value="">Tous les types</option>
          <option value="PLATFORM">{TYPE_LABEL.PLATFORM}</option>
          <option value="AFFILIATE">{TYPE_LABEL.AFFILIATE}</option>
          <option value="COURIER">{TYPE_LABEL.COURIER}</option>
        </select>
        <select
          className="select select-bordered select-sm"
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
        >
          <option value="">Tous les statuts</option>
          <option value="APPROVED">Disponible</option>
          <option value="ON_HOLD">Bloqué</option>
          <option value="PENDING">En attente</option>
          <option value="PAID">Payé</option>
          <option value="CANCELLED">Rejeté</option>
        </select>
      </div>
      {loading ? (
        <span className="loading loading-spinner" />
      ) : (
        <div className="overflow-x-auto">
          <table className="table table-zebra w-full">
            <thead>
              <tr>
                <th>Commande</th>
                <th>Type</th>
                <th>Bénéficiaire</th>
                <th>Montant</th>
                <th>Statut</th>
                <th>Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {commissions.map((c) => (
                <tr key={c.id}>
                  <td className="font-mono">{c.orderNumber}</td>
                  <td>{TYPE_LABEL[c.type] ?? c.type}</td>
                  <td>
                    {c.user ? `${c.user.firstName} ${c.user.lastName}` : '—'}
                    {c.user?.email && <br />}
                    {c.user?.email && <span className="text-xs opacity-80">{c.user.email}</span>}
                  </td>
                  <td>{formatNumberForLocale(c.amount, locale)} {formatCurrencyForDisplay('XOF')}</td>
                  <td>
                    <span className={`badge badge-sm ${c.status === 'APPROVED' ? 'badge-success' : c.status === 'ON_HOLD' ? 'badge-warning' : c.status === 'CANCELLED' ? 'badge-error' : 'badge-ghost'}`}>
                      {STATUS_LABEL[c.status] ?? c.status}
                    </span>
                  </td>
                  <td className="text-sm">{new Date(c.createdAt).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}</td>
                  <td>
                    {['APPROVED', 'ON_HOLD'].includes(c.status) && (
                      <div className="flex gap-1">
                        {c.status === 'ON_HOLD' && (
                          <button
                            type="button"
                            className="btn btn-xs btn-success"
                            disabled={!!acting}
                            onClick={() => handleAction(c.id, 'release')}
                          >
                            Libérer
                          </button>
                        )}
                        {c.status === 'APPROVED' && (
                          <button
                            type="button"
                            className="btn btn-xs btn-warning"
                            disabled={!!acting}
                            onClick={() => handleAction(c.id, 'block')}
                          >
                            Bloquer
                          </button>
                        )}
                        <button
                          type="button"
                          className="btn btn-xs btn-error"
                          disabled={!!acting}
                          onClick={() => handleAction(c.id, 'reject')}
                        >
                          Rejeter
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
      {!loading && commissions.length === 0 && (
        <p className="text-center text-base-content/70 mt-8">Aucune commission.</p>
      )}
    </div>
  );
}
