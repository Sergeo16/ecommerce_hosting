'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { toast } from 'react-toastify';
import { useAuth } from '@/context/AuthContext';
import { AppLogo } from '@/components/AppLogo';
import { ThemeSwitcher } from '@/components/ThemeSwitcher';
import { LocaleSwitcher } from '@/components/LocaleSwitcher';
import { useLocale } from '@/context/LocaleContext';

type PaymentModes = {
  fullUpfront?: boolean;
  partialAdvance?: boolean;
  payOnDelivery?: boolean;
  minAdvancePercent?: number;
};

const THEME_OPTIONS = ['business', 'corporate', 'luxury', 'cyberpunk', 'dark'] as const;

export default function AdminSettingsPage() {
  const { user, token } = useAuth();
  const { t } = useLocale();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [fullUpfront, setFullUpfront] = useState(true);
  const [partialAdvance, setPartialAdvance] = useState(true);
  const [payOnDelivery, setPayOnDelivery] = useState(true);
  const [minAdvancePercent, setMinAdvancePercent] = useState(30);
  const [platformCommissionPercent, setPlatformCommissionPercent] = useState(5);
  const [affiliateDefaultType, setAffiliateDefaultType] = useState<'percent' | 'amount'>('percent');
  const [affiliateDefaultPercent, setAffiliateDefaultPercent] = useState(10);
  const [affiliateDefaultAmount, setAffiliateDefaultAmount] = useState(500);
  const [commissionsHoldForVerification, setCommissionsHoldForVerification] = useState(false);
  const [supplierPayoutsHoldForVerification, setSupplierPayoutsHoldForVerification] = useState(false);
  const [commissionDelayValue, setCommissionDelayValue] = useState(0);
  const [commissionDelayUnit, setCommissionDelayUnit] = useState<'seconds' | 'minutes' | 'hours' | 'days' | 'months'>('seconds');
  const [defaultTheme, setDefaultTheme] = useState('business');
  const [deliveryTrackingEnabled, setDeliveryTrackingEnabled] = useState(true);
  const [supplierIdentityVisible, setSupplierIdentityVisible] = useState(false);
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [allowedCurrencies, setAllowedCurrencies] = useState<string[]>(['XOF']);
  const [newCurrencyCode, setNewCurrencyCode] = useState('');

  const [notifPlatform, setNotifPlatform] = useState(true);
  const [notifEmail, setNotifEmail] = useState(false);
  const [notifWhatsApp, setNotifWhatsApp] = useState(false);
  const [notifEmailOverride, setNotifEmailOverride] = useState('');
  const [notifWhatsAppOverride, setNotifWhatsAppOverride] = useState('');
  const [deliveryFeeDefault, setDeliveryFeeDefault] = useState(2000);
  const [deliveryFeeSuppliers, setDeliveryFeeSuppliers] = useState<Record<string, number>>({});
  const [suppliers, setSuppliers] = useState<{ id: string; companyName: string }[]>([]);
  const [courierCommissionType, setCourierCommissionType] = useState<'percent' | 'amount'>('amount');
  const [courierCommissionValue, setCourierCommissionValue] = useState(500);
  const [courierCommissionSource, setCourierCommissionSource] = useState<'PRODUCT' | 'DELIVERY' | 'BOTH'>('DELIVERY');
  const [courierCommissionSplitProduct, setCourierCommissionSplitProduct] = useState(50);
  const [courierCommissionOverrides, setCourierCommissionOverrides] = useState<Record<string, { type: 'PERCENT' | 'AMOUNT'; value: number }>>({});
  const [couriers, setCouriers] = useState<{ id: string; label: string }[]>([]);

  useEffect(() => {
    if (!token || user?.role !== 'SUPER_ADMIN') return;
    Promise.all([
      fetch('/api/admin/settings', { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
      fetch('/api/admin/maintenance').then((r) => r.json()),
      fetch('/api/admin/suppliers', { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.ok ? r.json() : []),
      fetch('/api/admin/couriers', { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.ok ? r.json() : {}),
    ]).then(([data, maintenanceData, suppliersList, couriersResp]) => {
      const pm = (data.payment_modes as PaymentModes) ?? {};
      setFullUpfront(pm.fullUpfront ?? true);
      setPartialAdvance(pm.partialAdvance ?? true);
      setPayOnDelivery(pm.payOnDelivery ?? true);
      setMinAdvancePercent(typeof pm.minAdvancePercent === 'number' ? pm.minAdvancePercent : 30);
      const pct = data.platform_commission_percent ?? data.commission_rules;
      setPlatformCommissionPercent(
        typeof pct === 'number' ? pct : typeof pct === 'object' && pct && typeof (pct as { platformPercent?: number }).platformPercent === 'number'
          ? (pct as { platformPercent: number }).platformPercent
          : 5
      );
      setCommissionsHoldForVerification(data.commissions_hold_for_verification === true);
      setSupplierPayoutsHoldForVerification(data.supplier_payouts_hold_for_verification === true);
      const delay = data.commission_access_delay as { value?: number; unit?: string } | undefined;
      if (delay && typeof delay === 'object') {
        setCommissionDelayValue(typeof delay.value === 'number' && delay.value >= 0 ? delay.value : 0);
        const u = delay.unit as string;
        setCommissionDelayUnit(['seconds', 'minutes', 'hours', 'days', 'months'].includes(u) ? u as 'seconds' | 'minutes' | 'hours' | 'days' | 'months' : 'seconds');
      }
      const affDef = data.affiliate_default_commission as { type?: string; percent?: number; amount?: number; value?: number } | undefined;
      if (affDef && typeof affDef === 'object') {
        setAffiliateDefaultType(affDef.type === 'AMOUNT' ? 'amount' : 'percent');
        setAffiliateDefaultPercent(typeof affDef.percent === 'number' ? affDef.percent : typeof affDef.value === 'number' && affDef.type !== 'AMOUNT' ? affDef.value : 10);
        setAffiliateDefaultAmount(typeof affDef.amount === 'number' ? affDef.amount : typeof affDef.value === 'number' && affDef.type === 'AMOUNT' ? affDef.value : 500);
      }
      setDefaultTheme(typeof data.theme === 'string' ? data.theme : 'business');
      const tracking = data.delivery_tracking_enabled;
      setDeliveryTrackingEnabled(tracking === false ? false : true);
      const supplierId = data.supplier_identity_visible;
      setSupplierIdentityVisible(supplierId === true);
      setMaintenanceMode((maintenanceData as { maintenance?: boolean }).maintenance === true);
      const ch = data.admin_notification_channels as { platform?: boolean; email?: boolean; whatsapp?: boolean } | undefined;
      setNotifPlatform(ch?.platform !== false);
      setNotifEmail(ch?.email === true);
      setNotifWhatsApp(ch?.whatsapp === true);
      setNotifEmailOverride(typeof data.admin_notification_email === 'string' ? data.admin_notification_email : '');
      setNotifWhatsAppOverride(typeof data.admin_notification_whatsapp_phone === 'string' ? data.admin_notification_whatsapp_phone : '');
      const curList = data.allowed_currencies;
      if (Array.isArray(curList) && curList.length > 0) {
        const codes = curList.filter((c): c is string => typeof c === 'string' && c.trim().length > 0).map((c) => c.trim().toUpperCase());
        setAllowedCurrencies(codes.includes('XOF') ? codes : ['XOF', ...codes]);
      }
      const def = data.delivery_fee_default;
      setDeliveryFeeDefault(typeof def === 'number' && def >= 0 ? def : 2000);
      const sup = data.delivery_fee_suppliers;
      setDeliveryFeeSuppliers((typeof sup === 'object' && sup !== null ? sup : {}) as Record<string, number>);
      setSuppliers(Array.isArray(suppliersList) ? suppliersList : []);
      const cc = data.courier_commission as {
        default?: { type?: string; value?: number };
        source?: string;
        splitProductPercent?: number;
        overrides?: Record<string, { type?: string; value?: number }>;
      } | undefined;
      if (cc && typeof cc === 'object') {
        const def = cc.default;
        if (def && typeof def === 'object') {
          setCourierCommissionType(def.type === 'PERCENT' ? 'percent' : 'amount');
          setCourierCommissionValue(typeof def.value === 'number' && def.value >= 0 ? def.value : 500);
        }
        setCourierCommissionSource(['PRODUCT', 'DELIVERY', 'BOTH'].includes(cc.source ?? '') ? (cc.source as 'PRODUCT' | 'DELIVERY' | 'BOTH') : 'DELIVERY');
        setCourierCommissionSplitProduct(
          typeof cc.splitProductPercent === 'number' && cc.splitProductPercent >= 0 && cc.splitProductPercent <= 100 ? cc.splitProductPercent : 50
        );
        setCourierCommissionOverrides(
          cc.overrides && typeof cc.overrides === 'object'
            ? Object.fromEntries(
                Object.entries(cc.overrides)
                  .filter(([, v]) => v && typeof v === 'object' && typeof (v as { value?: number }).value === 'number')
                  .map(([k, v]) => [
                    k,
                    {
                      type: (v as { type?: string }).type === 'PERCENT' ? ('PERCENT' as const) : ('AMOUNT' as const),
                      value: (v as { value: number }).value,
                    },
                  ])
              )
            : {}
        );
      }
      const courierList = (couriersResp as { couriers?: Array<{ id: string; label: string }> })?.couriers ?? [];
      setCouriers(Array.isArray(courierList) ? courierList : []);
    })
    .catch(() => toast.error('Erreur lors du chargement.'))
    .finally(() => setLoading(false));
  }, [token, user?.role]);

  async function setMaintenance(enabled: boolean) {
    if (!token) return;
    const res = await fetch('/api/admin/maintenance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ enabled }),
    });
    if (res.ok) setMaintenanceMode(enabled);
  }

  async function putSetting(key: string, value: unknown) {
    if (!token) return;
    const res = await fetch('/api/admin/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ key, value }),
    });
    if (!res.ok) throw new Error('Save failed');
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await putSetting('payment_modes', {
        fullUpfront,
        partialAdvance,
        payOnDelivery,
        minAdvancePercent,
      });
      await putSetting('platform_commission_percent', platformCommissionPercent);
      await putSetting('commission_rules', {
        platformPercent: platformCommissionPercent,
        maxAffiliatePercent: 30,
        courierFixed: 1500,
      });
      await putSetting('affiliate_default_commission', {
        type: affiliateDefaultType === 'amount' ? 'AMOUNT' : 'PERCENT',
        percent: affiliateDefaultType === 'percent' ? affiliateDefaultPercent : undefined,
        amount: affiliateDefaultType === 'amount' ? affiliateDefaultAmount : undefined,
        value: affiliateDefaultType === 'percent' ? affiliateDefaultPercent : affiliateDefaultAmount,
      });
      await putSetting('commissions_hold_for_verification', commissionsHoldForVerification);
      await putSetting('supplier_payouts_hold_for_verification', supplierPayoutsHoldForVerification);
      await putSetting('commission_access_delay', {
        value: commissionDelayValue,
        unit: commissionDelayUnit,
      });
      await putSetting('theme', defaultTheme);
      await putSetting('delivery_tracking_enabled', deliveryTrackingEnabled);
      await putSetting('supplier_identity_visible', supplierIdentityVisible);
      await putSetting('admin_notification_channels', {
        platform: notifPlatform,
        email: notifEmail,
        whatsapp: notifWhatsApp,
      });
      await putSetting('admin_notification_email', notifEmailOverride.trim() || '');
      await putSetting('admin_notification_whatsapp_phone', notifWhatsAppOverride.trim() || '');
      await putSetting('allowed_currencies', allowedCurrencies.length > 0 ? allowedCurrencies : ['XOF']);
      await putSetting('delivery_fee_default', deliveryFeeDefault);
      await putSetting('delivery_fee_suppliers', deliveryFeeSuppliers);
      await putSetting('courier_commission', {
        default: {
          type: courierCommissionType === 'percent' ? 'PERCENT' : 'AMOUNT',
          value: courierCommissionValue,
        },
        source: courierCommissionSource,
        splitProductPercent: courierCommissionSplitProduct,
        overrides: courierCommissionOverrides,
      });
      toast.success(t('saved'));
    } catch {
      toast.error('Erreur lors de l\'enregistrement.');
    } finally {
      setSaving(false);
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
    <div className="p-4 sm:p-6 max-w-2xl">
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
      <h1 className="text-2xl font-bold mb-6">{t('globalSettings')}</h1>

      {loading ? (
        <span className="loading loading-spinner" />
      ) : (
        <form onSubmit={handleSave} className="space-y-6">
          <div className="bg-base-100 rounded-lg shadow p-4 sm:p-6">
            <h2 className="font-semibold text-lg mb-2">{t('allowedCurrencies')}</h2>
            <p className="text-sm opacity-80 mb-3">{t('allowedCurrenciesDesc')}</p>
            <ul className="list-disc list-inside space-y-1 mb-3">
              <li className="font-medium">{t('currencyXOFLabel')} <span className="text-xs opacity-70">(obligatoire)</span></li>
              {allowedCurrencies.filter((c) => c !== 'XOF').map((code) => (
                <li key={code} className="flex items-center gap-2 flex-wrap">
                  <span>{code}</span>
                  <button
                    type="button"
                    className="btn btn-ghost btn-xs text-error"
                    onClick={() => setAllowedCurrencies((prev) => prev.filter((x) => x !== code))}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap gap-2 items-center">
              <input
                type="text"
                className="input input-bordered input-sm w-28 uppercase"
                placeholder={t('currencyCodePlaceholder')}
                value={newCurrencyCode}
                onChange={(e) => setNewCurrencyCode(e.target.value.slice(0, 10).toUpperCase())}
                maxLength={10}
              />
              <button
                type="button"
                className="btn btn-sm btn-outline"
                onClick={() => {
                  const code = newCurrencyCode.trim().toUpperCase();
                  if (!code || code === 'XOF') return;
                  if (allowedCurrencies.includes(code)) return;
                  setAllowedCurrencies((prev) => [...(prev.includes('XOF') ? prev : ['XOF', ...prev]), code].filter((c, i, arr) => arr.indexOf(c) === i));
                  setNewCurrencyCode('');
                }}
              >
                {t('addCurrency')}
              </button>
            </div>
          </div>
          <div className="bg-base-100 rounded-lg shadow p-4 sm:p-6">
            <h2 className="font-semibold text-lg mb-2">{t('maintenanceMode')}</h2>
            <p className="text-sm opacity-80 mb-3">{t('maintenanceModeDesc')}</p>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                className="toggle toggle-primary"
                checked={maintenanceMode}
                onChange={(e) => setMaintenance(e.target.checked)}
              />
              <span>{maintenanceMode ? t('active') : t('suspended')}</span>
            </label>
          </div>
          <div className="bg-base-100 rounded-lg shadow p-4 sm:p-6">
            <h2 className="font-semibold text-lg mb-4">{t('paymentModes')}</h2>
            <div className="space-y-3">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  className="toggle toggle-primary"
                  checked={fullUpfront}
                  onChange={(e) => setFullUpfront(e.target.checked)}
                />
                <span>{t('fullUpfront')}</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  className="toggle toggle-primary"
                  checked={partialAdvance}
                  onChange={(e) => setPartialAdvance(e.target.checked)}
                />
                <span>{t('partialAdvance')}</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  className="toggle toggle-primary"
                  checked={payOnDelivery}
                  onChange={(e) => setPayOnDelivery(e.target.checked)}
                />
                <span>{t('payOnDelivery')}</span>
              </label>
              <div className="form-control">
                <label className="label">
                  <span className="label-text">{t('minAdvancePercent')}</span>
                </label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  className="input input-bordered w-24"
                  value={minAdvancePercent}
                  onChange={(e) => setMinAdvancePercent(Number(e.target.value) || 0)}
                />
              </div>
            </div>
          </div>

          <div className="bg-base-100 rounded-lg shadow p-4 sm:p-6">
            <div className="form-control">
              <label className="label">
                <span className="label-text">{t('platformCommissionPercent')}</span>
              </label>
              <input
                type="number"
                min={0}
                max={100}
                step={0.5}
                className="input input-bordered w-24"
                value={platformCommissionPercent}
                onChange={(e) => setPlatformCommissionPercent(Number(e.target.value) || 0)}
              />
            </div>
          </div>

          <div className="bg-base-100 rounded-lg shadow p-4 sm:p-6">
            <h2 className="font-semibold text-lg mb-2">{t('commissionsHoldForVerification')}</h2>
            <p className="text-sm opacity-80 mb-4">{t('commissionsHoldForVerificationDesc')}</p>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                className="toggle toggle-primary"
                checked={commissionsHoldForVerification}
                onChange={(e) => setCommissionsHoldForVerification(e.target.checked)}
              />
              <span>{commissionsHoldForVerification ? t('active') : t('suspended')}</span>
            </label>
          </div>

          <div className="bg-base-100 rounded-lg shadow p-4 sm:p-6">
            <h2 className="font-semibold text-lg mb-2">{t('supplierPayoutsHoldForVerification') ?? 'Bloquer les paiements fournisseurs'}</h2>
            <p className="text-sm opacity-80 mb-4">{t('supplierPayoutsHoldForVerificationDesc') ?? 'Si activé, les revenus fournisseurs seront en attente. L\'admin pourra les libérer après vérification.'}</p>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                className="toggle toggle-primary"
                checked={supplierPayoutsHoldForVerification}
                onChange={(e) => setSupplierPayoutsHoldForVerification(e.target.checked)}
              />
              <span>{supplierPayoutsHoldForVerification ? t('active') : t('suspended')}</span>
            </label>
          </div>

          <div className="bg-base-100 rounded-lg shadow p-4 sm:p-6">
            <h2 className="font-semibold text-lg mb-2">{t('commissionAccessDelay') ?? 'Délai d\'accès aux commissions'}</h2>
            <p className="text-sm opacity-80 mb-4">{t('commissionAccessDelayDesc') ?? 'Délai avant que les commissions approuvées soient accessibles aux affiliés et livreurs. 0 = immédiat.'}</p>
            <div className="flex flex-wrap gap-3 items-center">
              <input
                type="number"
                min={0}
                className="input input-bordered w-24"
                value={commissionDelayValue}
                onChange={(e) => setCommissionDelayValue(Math.max(0, Number(e.target.value) || 0))}
              />
              <select
                className="select select-bordered"
                value={commissionDelayUnit}
                onChange={(e) => setCommissionDelayUnit(e.target.value as 'seconds' | 'minutes' | 'hours' | 'days' | 'months')}
              >
                <option value="seconds">{t('commissionDelaySeconds') ?? 'Secondes'}</option>
                <option value="minutes">{t('commissionDelayMinutes') ?? 'Minutes'}</option>
                <option value="hours">{t('commissionDelayHours') ?? 'Heures'}</option>
                <option value="days">{t('commissionDelayDays') ?? 'Jours'}</option>
                <option value="months">{t('commissionDelayMonths') ?? 'Mois'}</option>
              </select>
            </div>
          </div>

          <div className="bg-base-100 rounded-lg shadow p-4 sm:p-6">
            <h2 className="font-semibold text-lg mb-2">{t('affiliateDefaultCommission')}</h2>
            <p className="text-sm opacity-80 mb-4">{t('affiliateDefaultCommissionDesc')}</p>
            <div className="flex flex-wrap gap-4 items-end">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="affiliateDefaultType"
                  className="radio radio-sm"
                  checked={affiliateDefaultType === 'percent'}
                  onChange={() => setAffiliateDefaultType('percent')}
                />
                <span>{t('affiliateCommissionPercent')}</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="affiliateDefaultType"
                  className="radio radio-sm"
                  checked={affiliateDefaultType === 'amount'}
                  onChange={() => setAffiliateDefaultType('amount')}
                />
                <span>{t('affiliateCommissionAmount')}</span>
              </label>
              {affiliateDefaultType === 'percent' ? (
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={0.5}
                  className="input input-bordered w-24"
                  value={affiliateDefaultPercent}
                  onChange={(e) => setAffiliateDefaultPercent(Math.max(0, Math.min(100, Number(e.target.value) || 0)))}
                />
              ) : (
                <input
                  type="number"
                  min={0}
                  step={100}
                  className="input input-bordered w-28"
                  value={affiliateDefaultAmount}
                  onChange={(e) => setAffiliateDefaultAmount(Math.max(0, Number(e.target.value) || 0))}
                />
              )}
            </div>
          </div>

          <div className="bg-base-100 rounded-lg shadow p-4 sm:p-6">
            <h2 className="font-semibold text-lg mb-2">{t('courierCommissionTitle')}</h2>
            <p className="text-sm opacity-80 mb-4">{t('courierCommissionDesc')}</p>
            <div className="space-y-4">
              <div>
                <h3 className="font-medium mb-2">{t('courierCommissionDefault')}</h3>
                <div className="flex flex-wrap gap-4 items-end">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="courierCommissionType"
                      className="radio radio-sm"
                      checked={courierCommissionType === 'amount'}
                      onChange={() => setCourierCommissionType('amount')}
                    />
                    <span>{t('courierCommissionFixed')}</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="courierCommissionType"
                      className="radio radio-sm"
                      checked={courierCommissionType === 'percent'}
                      onChange={() => setCourierCommissionType('percent')}
                    />
                    <span>{t('courierCommissionPercent')}</span>
                  </label>
                  {courierCommissionType === 'amount' ? (
                    <input
                      type="number"
                      min={0}
                      step={100}
                      className="input input-bordered w-28"
                      value={courierCommissionValue}
                      onChange={(e) => setCourierCommissionValue(Math.max(0, Number(e.target.value) || 0))}
                    />
                  ) : (
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step={0.5}
                      className="input input-bordered w-24"
                      value={courierCommissionValue}
                      onChange={(e) => setCourierCommissionValue(Math.max(0, Math.min(100, Number(e.target.value) || 0)))}
                    />
                  )}
                </div>
              </div>
              <div>
                <h3 className="font-medium mb-2">{t('courierCommissionSource')}</h3>
                <div className="flex flex-wrap gap-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="courierCommissionSource"
                      className="radio radio-sm"
                      checked={courierCommissionSource === 'PRODUCT'}
                      onChange={() => setCourierCommissionSource('PRODUCT')}
                    />
                    <span>{t('courierCommissionSourceProduct')}</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="courierCommissionSource"
                      className="radio radio-sm"
                      checked={courierCommissionSource === 'DELIVERY'}
                      onChange={() => setCourierCommissionSource('DELIVERY')}
                    />
                    <span>{t('courierCommissionSourceDelivery')}</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="courierCommissionSource"
                      className="radio radio-sm"
                      checked={courierCommissionSource === 'BOTH'}
                      onChange={() => setCourierCommissionSource('BOTH')}
                    />
                    <span>{t('courierCommissionSourceBoth')}</span>
                  </label>
                </div>
                {courierCommissionSource === 'BOTH' && (
                  <div className="form-control mt-3 max-w-xs">
                    <label className="label">
                      <span className="label-text">{t('courierCommissionSplitProduct')}</span>
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      className="input input-bordered w-24"
                      value={courierCommissionSplitProduct}
                      onChange={(e) => setCourierCommissionSplitProduct(Math.max(0, Math.min(100, Number(e.target.value) || 0)))}
                    />
                  </div>
                )}
              </div>
              {couriers.length > 0 && (
                <div>
                  <h3 className="font-medium mb-2">{t('courierCommissionOverrides')}</h3>
                  <p className="text-sm opacity-70 mb-2">
                    {t('courierCommissionOverrideDesc')}
                  </p>
                  <div className="overflow-x-auto">
                    <table className="table table-sm">
                      <thead>
                        <tr>
                          <th>{t('deliveryCourierLabel')}</th>
                          <th>{t('courierCommissionTypeCol')}</th>
                          <th>{t('amount')}</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {couriers.map((c) => {
                          const ov = courierCommissionOverrides[c.id];
                          return (
                            <tr key={c.id}>
                              <td>{c.label}</td>
                              <td>
                                <select
                                  className="select select-bordered select-sm w-32"
                                  value={ov?.type ?? ''}
                                  onChange={(e) => {
                                    const v = e.target.value;
                                    if (!v) {
                                      setCourierCommissionOverrides((prev) => {
                                        const next = { ...prev };
                                        delete next[c.id];
                                        return next;
                                      });
                                      return;
                                    }
                                    setCourierCommissionOverrides((prev) => ({
                                      ...prev,
                                      [c.id]: {
                                        type: v as 'PERCENT' | 'AMOUNT',
                                        value: prev[c.id]?.value ?? (v === 'PERCENT' ? 5 : 500),
                                      },
                                    }));
                                  }}
                                >
                                  <option value="">—</option>
                                  <option value="AMOUNT">{t('courierCommissionFixed')}</option>
                                  <option value="PERCENT">{t('courierCommissionPercent')}</option>
                                </select>
                              </td>
                              <td>
                                {ov && (
                                  <input
                                    type="number"
                                    min={0}
                                    step={ov.type === 'PERCENT' ? 0.5 : 100}
                                    max={ov.type === 'PERCENT' ? 100 : undefined}
                                    className="input input-bordered input-sm w-24"
                                    value={ov.value}
                                    onChange={(e) =>
                                      setCourierCommissionOverrides((prev) => ({
                                        ...prev,
                                        [c.id]: { ...prev[c.id]!, value: Math.max(0, Number(e.target.value) || 0) },
                                      }))
                                    }
                                  />
                                )}
                              </td>
                              <td>
                                {ov && (
                                  <button
                                    type="button"
                                    className="btn btn-ghost btn-xs text-error"
                                    onClick={() =>
                                      setCourierCommissionOverrides((prev) => {
                                        const next = { ...prev };
                                        delete next[c.id];
                                        return next;
                                      })
                                    }
                                  >
                                    ×
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="bg-base-100 rounded-lg shadow p-4 sm:p-6">
            <div className="form-control">
              <label className="label">
                <span className="label-text">{t('defaultTheme')}</span>
              </label>
              <select
                className="select select-bordered w-full max-w-xs"
                value={defaultTheme}
                onChange={(e) => setDefaultTheme(e.target.value)}
              >
                {THEME_OPTIONS.map((th) => (
                  <option key={th} value={th}>{th}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="bg-base-100 rounded-lg shadow p-4 sm:p-6">
            <h2 className="font-semibold text-lg mb-2">{t('deliveryTrackingEnabled')}</h2>
            <p className="text-sm opacity-80 mb-3">{t('deliveryTrackingEnabledDesc')}</p>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                className="toggle toggle-primary"
                checked={deliveryTrackingEnabled}
                onChange={(e) => setDeliveryTrackingEnabled(e.target.checked)}
              />
              <span>{deliveryTrackingEnabled ? t('active') : t('suspended')}</span>
            </label>
          </div>

          <div className="bg-base-100 rounded-lg shadow p-4 sm:p-6">
            <h2 className="font-semibold text-lg mb-2">{t('supplierIdentityVisible')}</h2>
            <p className="text-sm opacity-80 mb-3">{t('supplierIdentityVisibleDesc')}</p>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                className="toggle toggle-primary"
                checked={supplierIdentityVisible}
                onChange={(e) => setSupplierIdentityVisible(e.target.checked)}
              />
              <span>{supplierIdentityVisible ? t('active') : t('suspended')}</span>
            </label>
          </div>

          <div className="bg-base-100 rounded-lg shadow p-4 sm:p-6">
            <h2 className="font-semibold text-lg mb-2">{t('deliveryFeesTitle')}</h2>
            <p className="text-sm opacity-80 mb-4">{t('deliveryFeesDesc')}</p>
            <div className="space-y-4">
              <div className="form-control">
                <label className="label">
                  <span className="label-text">{t('deliveryFeeDefault')}</span>
                </label>
                <div className="flex flex-wrap gap-3 items-center">
                  <input
                    type="number"
                    min={0}
                    step={100}
                    className="input input-bordered w-28"
                    value={deliveryFeeDefault}
                    onChange={(e) => setDeliveryFeeDefault(Math.max(0, Number(e.target.value) || 0))}
                  />
                  <span className="text-sm">F CFA</span>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      className="checkbox checkbox-sm"
                      checked={deliveryFeeDefault === 0}
                      onChange={(e) => setDeliveryFeeDefault(e.target.checked ? 0 : 2000)}
                    />
                    <span className="text-sm">{t('deliveryFeeFree')}</span>
                  </label>
                </div>
              </div>
              {suppliers.length > 0 && (
                <div>
                  <h3 className="font-medium mb-2">{t('deliveryFeePerSupplier')}</h3>
                  <p className="text-sm opacity-70 mb-2">{t('deliveryFeePerSupplierDesc')}</p>
                  <div className="overflow-x-auto">
                    <table className="table table-sm">
                      <thead>
                        <tr>
                          <th>{t('companyName')}</th>
                          <th>{t('deliveryFeeOverride')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {suppliers.map((s) => (
                          <tr key={s.id}>
                            <td>{s.companyName}</td>
                            <td>
                              <input
                                type="number"
                                min={0}
                                step={100}
                                className="input input-bordered input-sm w-24"
                                placeholder="—"
                                value={deliveryFeeSuppliers[s.id] ?? ''}
                                onChange={(e) => {
                                  const v = e.target.value;
                                  setDeliveryFeeSuppliers((prev) => {
                                    const next = { ...prev };
                                    if (v === '' || v === null) delete next[s.id];
                                    else next[s.id] = Math.max(0, Number(v) || 0);
                                    return next;
                                  });
                                }}
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
          <div className="bg-base-100 rounded-lg shadow p-4 sm:p-6">
            <h2 className="font-semibold text-lg mb-2">{t('adminNotificationChannels')}</h2>
            <p className="text-sm opacity-80 mb-4">{t('adminNotificationChannelsDesc')}</p>
            <div className="space-y-3">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  className="toggle toggle-primary"
                  checked={notifPlatform}
                  onChange={(e) => setNotifPlatform(e.target.checked)}
                />
                <span>{t('adminNotificationPlatform')}</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  className="toggle toggle-primary"
                  checked={notifEmail}
                  onChange={(e) => setNotifEmail(e.target.checked)}
                />
                <span>{t('adminNotificationEmail')}</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  className="toggle toggle-primary"
                  checked={notifWhatsApp}
                  onChange={(e) => setNotifWhatsApp(e.target.checked)}
                />
                <span>{t('adminNotificationWhatsApp')}</span>
              </label>
            </div>
            <div className="mt-4 space-y-2">
              <input
                type="email"
                placeholder={t('adminNotificationEmailOverride')}
                className="input input-bordered w-full max-w-md"
                value={notifEmailOverride}
                onChange={(e) => setNotifEmailOverride(e.target.value)}
              />
              <input
                type="tel"
                placeholder={t('adminNotificationWhatsAppOverride')}
                className="input input-bordered w-full max-w-md"
                value={notifWhatsAppOverride}
                onChange={(e) => setNotifWhatsAppOverride(e.target.value)}
              />
            </div>
          </div>

          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? '...' : t('save')}
          </button>
        </form>
      )}
    </div>
  );
}
