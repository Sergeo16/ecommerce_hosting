'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { toast } from 'react-toastify';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { AppLogo } from '@/components/AppLogo';
import { ThemeSwitcher } from '@/components/ThemeSwitcher';
import { LocaleSwitcher } from '@/components/LocaleSwitcher';
import { useLocale } from '@/context/LocaleContext';
import { sanitizeName, sanitizePhone, validatePhone, LIMITS } from '@/lib/validate-fields';
import { deliveryStatusToKey, orderStatusToKey, type TranslationKey } from '@/lib/translations';
import { formatCurrencyForDisplay, formatNumberForLocale } from '@/lib/currency';

type Order = {
  id: string;
  orderNumber: string;
  status: string;
  total: number;
  currency: string;
  createdAt: string;
  user?: { firstName: string; lastName: string; email: string };
  guestFirstName?: string | null;
  guestLastName?: string | null;
  guestEmail?: string | null;
  companyProfile?: { companyName: string };
  items?: { product: { name: string }; quantity: number }[];
  delivery?: { status: string; deliveredAt?: string | null; pickedUpAt?: string | null };
};

type OrderDetail = {
  id: string;
  orderNumber: string;
  status: string;
  total: number;
  currency: string;
  createdAt?: string;
  updatedAt?: string;
  shippingAddress: {
    address?: string;
    city?: string;
    phone?: string;
    lat?: number;
    lng?: number;
  };
  user?: { firstName: string; lastName: string; email: string; phone: string | null };
  guestFirstName?: string | null;
  guestLastName?: string | null;
  guestEmail?: string | null;
  companyProfile?: {
    companyName: string;
    address: string | null;
    city: string | null;
    addressLat: number | null;
    addressLng: number | null;
    user?: { firstName: string; lastName: string; email: string; phone: string | null };
  };
  items: { product: { name: string }; quantity: number }[];
  affiliateLinkId?: string | null;
  affiliateOverridePercent?: number | null;
  affiliateOverrideAmount?: number | null;
  affiliateLink?: { referralCode: string; commissionPercent?: number | null; commissionAmount?: number | null } | null;
  delivery?: {
    id: string;
    status: string;
    notes: string | null;
    courierDecisionAt: string | null;
    deliveredAt: string | null;
    pickedUpAt: string | null;
    createdAt?: string;
    updatedAt?: string;
    courier?: { firstName: string; lastName: string; phone: string | null };
    externalCourierName: string | null;
    externalCourierPhone: string | null;
  } | null;
};

type HistoryEvent = { at: string; labelKey: TranslationKey; detail?: string };

const COURIER_DECISION_STATUSES = ['COURIER_ACCEPTED', 'ON_HOLD', 'COURIER_REFUSED'];

type CourierOption = { id: string; label: string; email: string; phone: string | null };

export default function AdminOrdersPage() {
  const { user, token } = useAuth();
  const { t, locale } = useLocale();
  const searchParams = useSearchParams();
  const highlightId = searchParams.get('highlight');
  const [orders, setOrders] = useState<Order[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [deliveryModalOrderId, setDeliveryModalOrderId] = useState<string | null>(null);
  const [orderDetail, setOrderDetail] = useState<OrderDetail | null>(null);
  const [couriers, setCouriers] = useState<CourierOption[]>([]);
  const [assignMode, setAssignMode] = useState<'platform' | 'external'>('platform');
  const [selectedCourierId, setSelectedCourierId] = useState('');
  const [externalName, setExternalName] = useState('');
  const [externalPhone, setExternalPhone] = useState('');
  const [assignSubmitting, setAssignSubmitting] = useState(false);
  const [historyModalOrderId, setHistoryModalOrderId] = useState<string | null>(null);
  const [historyOrderDetail, setHistoryOrderDetail] = useState<OrderDetail | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [orderCommissionPercent, setOrderCommissionPercent] = useState<string>('');
  const [orderCommissionAmount, setOrderCommissionAmount] = useState<string>('');
  const [commissionSaving, setCommissionSaving] = useState(false);

  useEffect(() => {
    if (!token || user?.role !== 'SUPER_ADMIN') return;
    setLoading(true);
    fetch('/api/orders?limit=50', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((data) => {
        setOrders(data.orders ?? []);
        setTotal(data.total ?? 0);
      })
      .finally(() => setLoading(false));
  }, [token, user?.role]);

  const openDeliveryModal = useCallback(
    (orderId: string) => {
      setDeliveryModalOrderId(orderId);
      setOrderDetail(null);
      setCouriers([]);
      setAssignMode('platform');
      setSelectedCourierId('');
      setExternalName('');
      setExternalPhone('');
      setOrderCommissionPercent('');
      setOrderCommissionAmount('');
      if (!token) return;
      Promise.all([
        fetch(`/api/admin/orders/${orderId}`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
        fetch('/api/admin/couriers', { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
      ]).then(([orderData, couriersData]) => {
        setOrderDetail(orderData.error ? null : orderData);
        setCouriers(couriersData.couriers ?? []);
        if (couriersData.couriers?.length) setSelectedCourierId(couriersData.couriers[0].id);
        if (!orderData.error && orderData.affiliateOverridePercent != null) setOrderCommissionPercent(String(orderData.affiliateOverridePercent));
        if (!orderData.error && orderData.affiliateOverrideAmount != null) setOrderCommissionAmount(String(orderData.affiliateOverrideAmount));
      });
    },
    [token]
  );

  const closeDeliveryModal = useCallback(() => {
    setDeliveryModalOrderId(null);
    setOrderDetail(null);
  }, []);

  const openHistoryModal = useCallback(
    (orderId: string) => {
      setHistoryModalOrderId(orderId);
      setHistoryOrderDetail(null);
      setHistoryLoading(true);
      if (!token) return;
      fetch(`/api/admin/orders/${orderId}`, { headers: { Authorization: `Bearer ${token}` } })
        .then((r) => r.json())
        .then((data) => {
          setHistoryOrderDetail(data.error ? null : data);
        })
        .finally(() => setHistoryLoading(false));
    },
    [token]
  );

  const closeHistoryModal = useCallback(() => {
    setHistoryModalOrderId(null);
    setHistoryOrderDetail(null);
  }, []);

  function getHistoryEvents(detail: OrderDetail | null): HistoryEvent[] {
    if (!detail) return [];
    const events: HistoryEvent[] = [];
    if (detail.createdAt) events.push({ at: detail.createdAt, labelKey: 'historyOrderCreated' });
    if (detail.updatedAt && detail.createdAt && detail.updatedAt !== detail.createdAt) {
      events.push({ at: detail.updatedAt, labelKey: 'historyOrderUpdated' });
    }
    const d = detail.delivery;
    const courierLabel = d?.courier
      ? `${d.courier.firstName} ${d.courier.lastName}${d.courier.phone ? ` — ${d.courier.phone}` : ''}`
      : d?.externalCourierName
        ? `${d.externalCourierName} (contact externe)${d.externalCourierPhone ? ` — ${d.externalCourierPhone}` : ''}`
        : null;
    if (d?.createdAt) events.push({ at: d.createdAt, labelKey: 'historyDeliveryAssigned', detail: courierLabel ?? undefined });
    if (d?.courierDecisionAt) {
      const decisionLabel = d.status === 'COURIER_ACCEPTED' ? t('historyDecisionAccept') : d.status === 'COURIER_REFUSED' ? t('historyDecisionRefuse') : t('historyDecisionOnHold');
      events.push({ at: d.courierDecisionAt, labelKey: 'historyCourierDecision', detail: `${decisionLabel}${courierLabel ? ` — ${courierLabel}` : ''}${d.notes ? ` — ${d.notes}` : ''}` });
    }
    if (d?.pickedUpAt) events.push({ at: d.pickedUpAt, labelKey: 'historyPickedUp', detail: courierLabel ?? undefined });
    if (d?.deliveredAt) events.push({ at: d.deliveredAt, labelKey: 'historyDelivered', detail: courierLabel ?? undefined });
    if (d?.updatedAt && d.createdAt && d.updatedAt !== d.createdAt) {
      events.push({ at: d.updatedAt, labelKey: 'historyDeliveryUpdated' });
    }
    events.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
    return events;
  }

  const handleAssignDelivery = useCallback(async () => {
    if (!deliveryModalOrderId || !token) return;
    setAssignSubmitting(true);
    const body: { orderId: string; courierId?: string; externalCourierName?: string; externalCourierPhone?: string } = {
      orderId: deliveryModalOrderId,
    };
    if (assignMode === 'platform') {
      if (!selectedCourierId) {
        toast.error('Choisissez un livreur de la plateforme.');
        setAssignSubmitting(false);
        return;
      }
      body.courierId = selectedCourierId;
    } else {
      const name = sanitizeName(externalName, LIMITS.name);
      const phone = sanitizePhone(externalPhone);
      if (!name || !phone) {
        toast.error('Nom et téléphone du contact externe requis.');
        setAssignSubmitting(false);
        return;
      }
      const phoneCheck = validatePhone(phone);
      if (!phoneCheck.ok) {
        toast.error(phoneCheck.message ?? 'Téléphone invalide.');
        setAssignSubmitting(false);
        return;
      }
      body.externalCourierName = name;
      body.externalCourierPhone = phone;
    }
    try {
      const res = await fetch('/api/admin/deliveries/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? 'Erreur');
        return;
      }
      toast.success('Livraison assignée.');
      closeDeliveryModal();
    } finally {
      setAssignSubmitting(false);
    }
  }, [deliveryModalOrderId, token, assignMode, selectedCourierId, externalName, externalPhone, closeDeliveryModal]);

  const handleSaveCommissionOverride = useCallback(async () => {
    if (!deliveryModalOrderId || !token || !orderDetail?.affiliateLinkId) return;
    setCommissionSaving(true);
    try {
      const pct = orderCommissionPercent.trim() === '' ? null : parseFloat(orderCommissionPercent);
      const amt = orderCommissionAmount.trim() === '' ? null : parseFloat(orderCommissionAmount);
      const body = {
        affiliateOverridePercent: pct != null && !Number.isNaN(pct) && pct >= 0 && pct <= 100 ? pct : null,
        affiliateOverrideAmount: amt != null && !Number.isNaN(amt) && amt >= 0 ? amt : null,
      };
      const res = await fetch(`/api/admin/orders/${deliveryModalOrderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? 'Erreur');
        return;
      }
      toast.success('Commission enregistrée.');
      setOrderDetail((prev) => prev ? { ...prev, affiliateOverridePercent: pct ?? undefined, affiliateOverrideAmount: amt ?? undefined } : null);
    } finally {
      setCommissionSaving(false);
    }
  }, [deliveryModalOrderId, token, orderDetail, orderCommissionPercent, orderCommissionAmount]);

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
      <h1 className="text-2xl font-bold mb-6">Commandes</h1>
      {loading ? (
        <span className="loading loading-spinner" />
      ) : (
        <div className="overflow-x-auto -mx-2 sm:mx-0 w-full">
          <table className="table table-zebra w-full min-w-[640px]">
            <thead>
              <tr>
                <th className="bg-base-100">N°</th>
                <th>Client</th>
                <th>Fournisseur</th>
                <th>Total</th>
                <th>Statut</th>
                <th className="bg-base-100 min-w-[155px] shrink-0 border-l-2 border-r-2 border-base-content/40 px-3">Date</th>
                <th className="bg-base-100 min-w-[96px] shrink-0 text-right border-r-2 border-base-content/40 px-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr
                  key={o.id}
                  id={highlightId === o.id ? 'highlight' : undefined}
                  className={highlightId === o.id ? 'bg-primary/10' : ''}
                >
                  <td className="font-mono bg-base-100 sticky left-0 z-10 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)]">{o.orderNumber}</td>
                  <td>
                    {o.user
                      ? `${o.user.firstName} ${o.user.lastName}`
                      : [o.guestFirstName, o.guestLastName].filter(Boolean).join(' ') || o.guestEmail || 'Invité'}
                  </td>
                  <td>{o.companyProfile?.companyName ?? '-'}</td>
                  <td>{formatNumberForLocale(Number(o.total), locale)} {formatCurrencyForDisplay(o.currency)}</td>
                  <td>
                    {/* Un seul statut : livraison si elle existe (évolue avec la commande), sinon statut commande */}
                    {o.delivery ? (
                      <span className="badge badge-neutral" title={t(deliveryStatusToKey(o.delivery.status))}>
                        {t(deliveryStatusToKey(o.delivery.status))}
                      </span>
                    ) : (
                      <span className="badge badge-ghost">{t(orderStatusToKey(o.status))}</span>
                    )}
                  </td>
                  <td className="text-sm shrink-0 bg-base-100 border-l-2 border-r-2 border-base-content/40 px-3 whitespace-nowrap">
                    {new Date(o.createdAt).toLocaleDateString('fr-FR', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </td>
                  <td className="align-middle bg-base-100 shrink-0 border-r-2 border-base-content/40 px-3">
                    <div className="flex flex-row gap-2 justify-end items-center min-w-0">
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm btn-square"
                        onClick={() => openHistoryModal(o.id)}
                        title={t('orderHistory')}
                        aria-label={t('orderHistory')}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm btn-square"
                        onClick={() => openDeliveryModal(o.id)}
                        title={t('assignDelivery')}
                        aria-label={t('assignDelivery')}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1m8-1V6a1 1 0 00-1-1h-1M6 5v11m0 0h8m-8 0V5" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {!loading && orders.length === 0 && (
        <p className="text-center text-base-content/70">Aucune commande</p>
      )}

      {deliveryModalOrderId && (
        <dialog open className="modal modal-open">
          <div className="modal-box max-w-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="font-bold text-lg">{t('assignDelivery')}</h3>
            {!orderDetail ? (
              <span className="loading loading-spinner my-4" />
            ) : (
              <>
                <div className="text-sm space-y-2 my-4 p-3 bg-base-200 rounded-lg">
                  <p><strong>Commande :</strong> {orderDetail.orderNumber}</p>
                  <p><strong>Client :</strong> {orderDetail.user ? `${orderDetail.user.firstName} ${orderDetail.user.lastName}` : [orderDetail.guestFirstName, orderDetail.guestLastName].filter(Boolean).join(' ') || orderDetail.guestEmail || 'Invité'}
                    {orderDetail.user?.email || orderDetail.guestEmail ? ` — ${orderDetail.user?.email || orderDetail.guestEmail}` : ''}
                    {orderDetail.shippingAddress?.phone ? ` — Tél: ${String(orderDetail.shippingAddress.phone)}` : ''}
                  </p>
                  <p><strong>Adresse livraison (client) :</strong> {[orderDetail.shippingAddress?.address, orderDetail.shippingAddress?.city].filter(Boolean).join(', ') || '—'}
                    {(orderDetail.shippingAddress?.lat != null && orderDetail.shippingAddress?.lng != null) && (
                      <span> — GPS: {Number(orderDetail.shippingAddress.lat)}, {Number(orderDetail.shippingAddress.lng)}</span>
                    )}
                  </p>
                  <p><strong>Fournisseur :</strong> {orderDetail.companyProfile?.companyName ?? '-'}
                    {orderDetail.companyProfile?.address || orderDetail.companyProfile?.city ? ` — Adresse: ${[orderDetail.companyProfile?.address, orderDetail.companyProfile?.city].filter(Boolean).join(', ') || '—'}` : ''}
                    {orderDetail.companyProfile?.addressLat != null && orderDetail.companyProfile?.addressLng != null && (
                      <span> — GPS: {Number(orderDetail.companyProfile.addressLat)}, {Number(orderDetail.companyProfile.addressLng)}</span>
                    )}
                    {orderDetail.companyProfile?.user?.phone ? ` — Tél: ${orderDetail.companyProfile.user.phone}` : ''}
                    {orderDetail.companyProfile?.user?.email ? ` — ${orderDetail.companyProfile.user.email}` : ''}
                  </p>
                  <p><strong>Articles :</strong> {orderDetail.items?.map((i) => `${i.product.name} × ${i.quantity}`).join(', ') ?? '—'}</p>
                  <p><strong>Total :</strong> {formatNumberForLocale(Number(orderDetail.total), locale)} {formatCurrencyForDisplay(orderDetail.currency)}</p>
                  {orderDetail.affiliateLinkId && (
                    <div className="mt-2 p-2 rounded-lg bg-primary/5 border border-primary/20 space-y-2">
                      <p className="font-medium text-sm">{t('affiliateDefaultCommission')} (override)</p>
                      <p className="text-xs opacity-80">Lien : {orderDetail.affiliateLink?.referralCode ?? '—'}
                        {orderDetail.affiliateLink?.commissionPercent != null && ` · ${orderDetail.affiliateLink.commissionPercent}%`}
                        {orderDetail.affiliateLink?.commissionAmount != null && orderDetail.affiliateLink.commissionPercent == null && ` · ${formatNumberForLocale(Number(orderDetail.affiliateLink.commissionAmount), locale)} F`}
                      </p>
                      <div className="flex flex-wrap gap-2 items-center">
                        <input
                          type="number"
                          min={0}
                          max={100}
                          step={0.5}
                          placeholder="%"
                          className="input input-bordered input-sm w-20"
                          value={orderCommissionPercent}
                          onChange={(e) => setOrderCommissionPercent(e.target.value)}
                        />
                        <span className="text-sm opacity-70">ou</span>
                        <input
                          type="number"
                          min={0}
                          step={100}
                          placeholder="F CFA"
                          className="input input-bordered input-sm w-24"
                          value={orderCommissionAmount}
                          onChange={(e) => setOrderCommissionAmount(e.target.value)}
                        />
                        <button
                          type="button"
                          className="btn btn-sm btn-outline"
                          disabled={commissionSaving}
                          onClick={handleSaveCommissionOverride}
                        >
                          {commissionSaving ? t('loading') : t('save')}
                        </button>
                      </div>
                    </div>
                  )}
                  {orderDetail.delivery && (
                    <div className="mt-2 p-2 rounded-lg bg-base-200 space-y-1">
                      <p><strong>{t('deliveryStatusLabel')} :</strong> <span className="badge badge-neutral badge-sm">{t(deliveryStatusToKey(orderDetail.delivery.status))}</span></p>
                      {(orderDetail.delivery.courier || orderDetail.delivery.externalCourierName) && (
                        <p className="text-primary"><strong>{t('deliveryCourierLabel')} :</strong> {orderDetail.delivery.courier ? `${orderDetail.delivery.courier.firstName} ${orderDetail.delivery.courier.lastName}` : `${orderDetail.delivery.externalCourierName} (${orderDetail.delivery.externalCourierPhone})`}</p>
                      )}
                      {orderDetail.delivery.pickedUpAt && (
                        <p className="text-sm"><strong>{t('deliveryPickedUpAt')} :</strong> {new Date(orderDetail.delivery.pickedUpAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'medium' })}</p>
                      )}
                      {orderDetail.delivery.deliveredAt && (
                        <p className="text-sm text-success"><strong>{t('deliveryDeliveredAt')} :</strong> {new Date(orderDetail.delivery.deliveredAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'medium' })}</p>
                      )}
                      {COURIER_DECISION_STATUSES.includes(orderDetail.delivery.status) && orderDetail.delivery.courierDecisionAt && (
                        <p className="text-sm"><strong>{t('deliveryDecisionAt')} :</strong> {new Date(orderDetail.delivery.courierDecisionAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'medium' })}</p>
                      )}
                      {orderDetail.delivery.notes && (
                        <p className="text-sm mt-1"><strong>{t('deliveryReasonNote')} :</strong> {orderDetail.delivery.notes}</p>
                      )}
                    </div>
                  )}
                </div>
                <div className="divider" />
                <p className="font-medium mb-2">Choisir le livreur</p>
                <div className="flex flex-col gap-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="assignMode"
                      className="radio radio-sm"
                      checked={assignMode === 'platform'}
                      onChange={() => setAssignMode('platform')}
                    />
                    <span>Livreur de la plateforme</span>
                  </label>
                  {assignMode === 'platform' && (
                    <select
                      className="select select-bordered w-full max-w-md"
                      value={selectedCourierId}
                      onChange={(e) => setSelectedCourierId(e.target.value)}
                    >
                      {couriers.length === 0 ? (
                        <option value="">Aucun livreur enregistré</option>
                      ) : (
                        couriers.map((c) => (
                          <option key={c.id} value={c.id}>{c.label} {c.phone ? ` — ${c.phone}` : ''}</option>
                        ))
                      )}
                    </select>
                  )}
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="assignMode"
                      className="radio radio-sm"
                      checked={assignMode === 'external'}
                      onChange={() => setAssignMode('external')}
                    />
                    <span>Autre (contact externe)</span>
                  </label>
                  {assignMode === 'external' && (
                    <div className="flex flex-wrap gap-2">
                      <input
                        type="text"
                        placeholder="Nom du contact"
                        className="input input-bordered flex-1 min-w-[140px]"
                        value={externalName}
                        onChange={(e) => setExternalName(sanitizeName(e.target.value, LIMITS.name))}
                        maxLength={LIMITS.name}
                      />
                      <input
                        type="tel"
                        placeholder="Téléphone"
                        className="input input-bordered flex-1 min-w-[140px]"
                        value={externalPhone}
                        onChange={(e) => setExternalPhone(sanitizePhone(e.target.value))}
                        maxLength={LIMITS.phone}
                      />
                    </div>
                  )}
                </div>
              </>
            )}
            <div className="modal-action">
              <button type="button" className="btn btn-ghost" onClick={closeDeliveryModal}>Fermer</button>
              {orderDetail && (
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={assignSubmitting || (assignMode === 'platform' && !selectedCourierId) || (assignMode === 'external' && (!externalName.trim() || !externalPhone.trim()))}
                  onClick={handleAssignDelivery}
                >
                  {assignSubmitting ? t('loading') : t('assignDelivery')}
                </button>
              )}
            </div>
          </div>
          <form method="dialog" className="modal-backdrop">
            <button type="button" onClick={closeDeliveryModal}>fermer</button>
          </form>
        </dialog>
      )}

      {historyModalOrderId && (
        <dialog open className="modal modal-open">
          <div className="modal-box max-w-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="font-bold text-lg">{t('orderHistoryTitle')}</h3>
            {historyLoading ? (
              <span className="loading loading-spinner my-6" />
            ) : !historyOrderDetail ? (
              <p className="text-base-content/70 my-4">Impossible de charger l&apos;historique.</p>
            ) : (
              <>
                <p className="font-mono font-semibold text-sm mt-2 mb-3">{historyOrderDetail.orderNumber}</p>

                <div className="rounded-lg bg-base-200 p-3 mb-6 text-sm space-y-2">
                  <p><strong>{t('historyClient')} :</strong> {historyOrderDetail.user ? `${historyOrderDetail.user.firstName} ${historyOrderDetail.user.lastName}` : [historyOrderDetail.guestFirstName, historyOrderDetail.guestLastName].filter(Boolean).join(' ') || historyOrderDetail.guestEmail || '—'}
                    {historyOrderDetail.user?.email || historyOrderDetail.guestEmail ? ` — ${historyOrderDetail.user?.email || historyOrderDetail.guestEmail}` : ''}
                    {historyOrderDetail.shippingAddress?.phone ? ` — Tél: ${String(historyOrderDetail.shippingAddress.phone)}` : ''}
                  </p>
                  <p><strong>{t('historySupplier')} :</strong> {historyOrderDetail.companyProfile?.companyName ?? '—'}
                    {historyOrderDetail.companyProfile?.address || historyOrderDetail.companyProfile?.city ? ` — ${[historyOrderDetail.companyProfile?.address, historyOrderDetail.companyProfile?.city].filter(Boolean).join(', ')}` : ''}
                    {historyOrderDetail.companyProfile?.user?.phone ? ` — Tél: ${historyOrderDetail.companyProfile?.user.phone}` : ''}
                  </p>
                  <p><strong>{t('historyDeliveryAddress')} :</strong> {[historyOrderDetail.shippingAddress?.address, historyOrderDetail.shippingAddress?.city].filter(Boolean).join(', ') || '—'}
                    {historyOrderDetail.shippingAddress?.lat != null && historyOrderDetail.shippingAddress?.lng != null ? ` (GPS: ${Number(historyOrderDetail.shippingAddress.lat)}, ${Number(historyOrderDetail.shippingAddress.lng)})` : ''}
                  </p>
                  <p><strong>{t('historyItems')} :</strong> {historyOrderDetail.items?.map((i) => `${i.product.name} × ${i.quantity}`).join(', ') ?? '—'}</p>
                  <p><strong>{t('historyTotal')} :</strong> {formatNumberForLocale(Number(historyOrderDetail.total), locale)} {formatCurrencyForDisplay(historyOrderDetail.currency)}</p>
                  {historyOrderDetail.delivery && (historyOrderDetail.delivery.courier || historyOrderDetail.delivery.externalCourierName) && (
                    <p><strong>{t('historyCourier')} :</strong> <span className="text-primary">{historyOrderDetail.delivery.courier ? `${historyOrderDetail.delivery.courier.firstName} ${historyOrderDetail.delivery.courier.lastName}${historyOrderDetail.delivery.courier.phone ? ` — ${historyOrderDetail.delivery.courier.phone}` : ''}` : `${historyOrderDetail.delivery.externalCourierName} (contact externe)${historyOrderDetail.delivery.externalCourierPhone ? ` — ${historyOrderDetail.delivery.externalCourierPhone}` : ''}`}</span></p>
                  )}
                </div>

                <p className="font-medium text-sm mb-2">{t('historyMovements')}</p>
                <ul className="space-y-3 border-l-2 border-primary/30 pl-4 ml-2">
                  {getHistoryEvents(historyOrderDetail).map((evt, i) => (
                    <li key={i} className="relative before:absolute before:left-[-1.25rem] before:top-1.5 before:w-2 before:h-2 before:rounded-full before:bg-primary">
                      <p className="font-medium text-sm">{t(evt.labelKey)}</p>
                      {evt.detail && <p className="text-xs text-base-content/80 mt-1">{evt.detail}</p>}
                      <p className="text-xs opacity-70 mt-0.5">
                        {new Date(evt.at).toLocaleString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
                      </p>
                    </li>
                  ))}
                </ul>
                {getHistoryEvents(historyOrderDetail).length === 0 && (
                  <p className="text-base-content/70 text-sm">Aucun événement enregistré.</p>
                )}
              </>
            )}
            <div className="modal-action">
              <button type="button" className="btn btn-ghost" onClick={closeHistoryModal}>Fermer</button>
            </div>
          </div>
          <form method="dialog" className="modal-backdrop">
            <button type="button" onClick={closeHistoryModal}>fermer</button>
          </form>
        </dialog>
      )}
    </div>
  );
}
