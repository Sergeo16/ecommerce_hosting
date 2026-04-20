'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { toast } from 'react-toastify';
import { useAuth } from '@/context/AuthContext';
import { AppLogo } from '@/components/AppLogo';
import { ThemeSwitcher } from '@/components/ThemeSwitcher';
import { LocaleSwitcher } from '@/components/LocaleSwitcher';
import { useLocale } from '@/context/LocaleContext';
import { deliveryStatusToKey } from '@/lib/translations';
import { formatCurrencyForDisplay, formatNumberForLocale } from '@/lib/currency';

type DeliveryAddressInput = string | { address?: string; city?: string; phone?: string; lat?: number; lng?: number } | null;

type Mission = {
  id: string;
  orderId: string;
  orderNumber: string;
  status: string;
  deliveryAddress: DeliveryAddressInput;
  commissionAmount: number | null;
  createdAt: string;
  pickedUpAt: string | null;
  deliveredAt: string | null;
  notes: string | null;
  customer?: { firstName: string; lastName: string; phone: string | null };
};

const CAN_DECIDE_STATUSES = ['ASSIGNED', 'ON_HOLD'];
const CAN_MARK_DELIVERED_STATUSES = ['COURIER_ACCEPTED', 'PICKED_UP', 'IN_TRANSIT'];
const TERMINAL_STATUSES = ['DELIVERED', 'FAILED', 'RETURNED'];

function formatDeliveryAddress(raw: DeliveryAddressInput): string {
  if (raw == null) return '';
  if (typeof raw === 'string') return raw;
  const parts = [
    raw.address,
    raw.city,
    raw.phone ? `Tél: ${raw.phone}` : '',
    raw.lat != null && raw.lng != null ? `GPS: ${raw.lat}, ${raw.lng}` : '',
  ].filter(Boolean);
  return parts.join(' — ');
}

export default function CourierMissionsPage() {
  const { user, token, isLoading } = useAuth();
  const { t, locale } = useLocale();
  const [missions, setMissions] = useState<Mission[]>([]);
  const [loading, setLoading] = useState(true);
  const [reasonByMissionId, setReasonByMissionId] = useState<Record<string, string>>({});
  const [submittingId, setSubmittingId] = useState<string | null>(null);

  const loadMissions = useCallback(() => {
    if (!token) return;
    return fetch('/api/courier/missions', { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => {
        if (!res.ok) throw new Error('Erreur');
        return res.json();
      })
      .then((data: Mission[]) => setMissions(Array.isArray(data) ? data : []))
      .catch((err) => toast.error(err instanceof Error ? err.message : 'Erreur'));
  }, [token]);

  useEffect(() => {
    if (!token || user?.role !== 'COURIER') {
      setLoading(false);
      return;
    }
    setLoading(true);
    fetch('/api/courier/missions', { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => {
        if (!res.ok) {
          if (res.status === 403) throw new Error(t('accessReservedCourier'));
          throw new Error('Erreur lors du chargement des missions.');
        }
        return res.json();
      })
      .then((data: Mission[]) => setMissions(Array.isArray(data) ? data : []))
      .catch((err) => toast.error(err instanceof Error ? err.message : 'Erreur'))
      .finally(() => setLoading(false));
  }, [token, user?.role, t]);

  async function handleDecision(missionId: string, status: 'COURIER_ACCEPTED' | 'ON_HOLD' | 'COURIER_REFUSED') {
    if (!token) return;
    setSubmittingId(missionId);
    const reason = reasonByMissionId[missionId]?.trim() || undefined;
    try {
      const res = await fetch(`/api/courier/missions/${missionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status, reason }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? t('courierDecisionError'));
        return;
      }
      toast.success(t('courierDecisionSuccess'));
      setReasonByMissionId((prev) => {
        const next = { ...prev };
        delete next[missionId];
        return next;
      });
      loadMissions();
    } catch {
      toast.error(t('courierDecisionError'));
    } finally {
      setSubmittingId(null);
    }
  }

  async function handleMarkDelivered(missionId: string) {
    if (!token) return;
    setSubmittingId(missionId);
    try {
      const res = await fetch(`/api/courier/missions/${missionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: 'DELIVERED' }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? 'Impossible de marquer comme livré.');
        return;
      }
      toast.success(t('deliveryMarkedDone'));
      loadMissions();
    } catch {
      toast.error('Erreur lors de la mise à jour.');
    } finally {
      setSubmittingId(null);
    }
  }

  if (isLoading || (user && user.role !== 'COURIER' && loading)) {
    return (
      <div className="min-h-screen bg-base-200 flex items-center justify-center p-8">
        <span className="loading loading-spinner text-primary" />
      </div>
    );
  }

  if (user?.role !== 'COURIER') {
    return (
      <div className="min-h-screen bg-base-200 p-8">
        <div className="max-w-lg mx-auto card bg-base-100 shadow-xl">
          <div className="card-body">
            <p className="text-base-content">{t('accessReservedCourier')}</p>
            <Link href="/dashboard" className="btn btn-primary mt-4">{t('back')}</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-base-200">
      <header className="navbar bg-base-100 shadow-lg px-2 sm:px-4 min-h-12 sm:min-h-14 py-1 gap-2 flex-nowrap">
        <div className="navbar-start flex items-center gap-2">
          <AppLogo className="btn btn-ghost btn-sm text-base px-1 truncate max-w-[120px] sm:max-w-[180px]" />
          <Link href="/dashboard" className="btn btn-ghost btn-sm">← {t('dashboard')}</Link>
        </div>
        <div className="navbar-end flex gap-1">
          <ThemeSwitcher />
          <LocaleSwitcher />
        </div>
      </header>

      <main className="p-4 sm:p-6 max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">{t('myMissions')}</h1>

        {loading ? (
          <div className="flex justify-center py-12">
            <span className="loading loading-spinner text-primary" />
          </div>
        ) : (
          <>
            {missions.length === 0 ? (
              <div className="card bg-base-100 shadow-xl">
                <div className="card-body items-center text-center py-12">
                  <p className="text-base-content/80 text-lg">{t('noMissionsYet')}</p>
                  <Link href="/dashboard" className="btn btn-primary mt-4">{t('back')}</Link>
                </div>
              </div>
            ) : missions.filter((m) => !TERMINAL_STATUSES.includes(m.status)).length > 0 ? (
              <ul className="space-y-4">
                {missions.filter((m) => !TERMINAL_STATUSES.includes(m.status)).map((m) => (
              <li key={m.id} className="card bg-base-100 shadow hover:shadow-md transition-shadow">
                <div className="card-body">
                  <div className="flex flex-wrap justify-between gap-2">
                    <span className="font-mono font-semibold">{m.orderNumber}</span>
                    <span className="badge badge-neutral">{t(deliveryStatusToKey(m.status))}</span>
                  </div>
                  {formatDeliveryAddress(m.deliveryAddress) && (
                    <p className="text-sm opacity-80"><strong>Adresse :</strong> {formatDeliveryAddress(m.deliveryAddress)}</p>
                  )}
                  {m.commissionAmount != null && (
                    <p className="text-sm text-primary">{t('commissionLabel')} : {formatNumberForLocale(m.commissionAmount, locale)} {formatCurrencyForDisplay('XOF')}</p>
                  )}
                  {m.customer && (
                    <p className="text-sm">Client : {m.customer.firstName} {m.customer.lastName}</p>
                  )}
                  <p className="text-xs opacity-60">
                    {t('createdOn')} {new Date(m.createdAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
                  </p>
                  {m.notes && (
                    <p className="text-xs opacity-70 mt-1">Note : {m.notes}</p>
                  )}
                  {CAN_DECIDE_STATUSES.includes(m.status) && (
                    <div className="mt-3 pt-3 border-t border-base-300 space-y-2">
                      <textarea
                        className="textarea textarea-bordered textarea-sm w-full min-h-[60px]"
                        placeholder={t('courierReasonOptional')}
                        value={reasonByMissionId[m.id] ?? ''}
                        onChange={(e) => setReasonByMissionId((prev) => ({ ...prev, [m.id]: e.target.value.slice(0, 2000) }))}
                        maxLength={2000}
                      />
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          className="btn btn-sm btn-success"
                          disabled={submittingId !== null}
                          onClick={() => handleDecision(m.id, 'COURIER_ACCEPTED')}
                        >
                          {submittingId === m.id ? (
                            <span className="loading loading-spinner loading-sm" />
                          ) : (
                            t('courierAccept')
                          )}
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm btn-warning"
                          disabled={submittingId !== null}
                          onClick={() => handleDecision(m.id, 'ON_HOLD')}
                        >
                          {submittingId === m.id ? null : t('courierOnHold')}
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm btn-error"
                          disabled={submittingId !== null}
                          onClick={() => handleDecision(m.id, 'COURIER_REFUSED')}
                        >
                          {submittingId === m.id ? null : t('courierRefuse')}
                        </button>
                      </div>
                    </div>
                  )}
                  {CAN_MARK_DELIVERED_STATUSES.includes(m.status) && (
                    <div className="mt-3 pt-3 border-t border-base-300">
                      <button
                        type="button"
                        className="btn btn-sm btn-primary"
                        disabled={submittingId !== null}
                        onClick={() => handleMarkDelivered(m.id)}
                      >
                        {submittingId === m.id ? (
                          <span className="loading loading-spinner loading-sm" />
                        ) : (
                          t('markAsDelivered')
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </li>
                ))}
              </ul>
            ) : null}

            {missions.length > 0 && missions.filter((m) => !TERMINAL_STATUSES.includes(m.status)).length === 0 && (
              <p className="text-base-content/70 mb-4">{t('noMissionInProgress')}</p>
            )}
          </>
        )}

        {!loading && missions.some((m) => TERMINAL_STATUSES.includes(m.status)) && (
          <section className="mt-10">
            <h2 className="text-xl font-bold mb-4">{t('deliveryHistory')}</h2>
            <ul className="space-y-3">
              {missions
                .filter((m) => TERMINAL_STATUSES.includes(m.status))
                .map((m) => (
                  <li key={m.id} className="card bg-base-100 shadow compact">
                    <div className="card-body py-3 px-4">
                      <div className="flex flex-wrap justify-between gap-2 items-center">
                        <span className="font-mono font-semibold">{m.orderNumber}</span>
                        <span className="badge badge-neutral">{t(deliveryStatusToKey(m.status))}</span>
                      </div>
                      {formatDeliveryAddress(m.deliveryAddress) && (
                        <p className="text-sm opacity-80 truncate" title={formatDeliveryAddress(m.deliveryAddress)}>
                          {formatDeliveryAddress(m.deliveryAddress)}
                        </p>
                      )}
                      <div className="flex flex-wrap gap-4 text-xs opacity-70">
                        <span>{t('createdOn')} {new Date(m.createdAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</span>
                        {m.deliveredAt && (
                          <span>{t('deliveredOn')} {new Date(m.deliveredAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</span>
                        )}
                        {m.commissionAmount != null && (
                          <span className="text-primary">{t('commissionLabel')} : {formatNumberForLocale(m.commissionAmount, locale)} {formatCurrencyForDisplay('XOF')}</span>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
            </ul>
          </section>
        )}
      </main>
    </div>
  );
}
