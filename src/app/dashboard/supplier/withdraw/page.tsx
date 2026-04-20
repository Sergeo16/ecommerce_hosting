'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { AppLogo } from '@/components/AppLogo';
import { ThemeSwitcher } from '@/components/ThemeSwitcher';
import { LocaleSwitcher } from '@/components/LocaleSwitcher';
import { useLocale } from '@/context/LocaleContext';
import { formatNumberForLocale, formatCurrencyForDisplay } from '@/lib/currency';
import { withdrawalStatusToKey } from '@/lib/translations';

type WithdrawData = {
  balance: number;
  currency: string;
  frozen: boolean;
  pendingWithdrawals: Array<{ id: string; amount: number; status: string; createdAt: string }>;
};

export default function SupplierWithdrawPage() {
  const { user, token } = useAuth();
  const { t, locale } = useLocale();
  const [data, setData] = useState<WithdrawData | null>(null);
  const [loading, setLoading] = useState(true);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<'mobile_money' | 'bank'>('mobile_money');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const fetchData = useCallback(() => {
    if (!token || user?.role !== 'SUPPLIER') return;
    setLoading(true);
    fetch('/api/supplier/withdraw', { headers: { Authorization: `Bearer ${token}` } })
      .then(async (r) => {
        const text = await r.text();
        if (!r.ok) throw new Error(text || r.statusText);
        return text ? JSON.parse(text) : null;
      })
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [token, user?.role]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    const num = parseFloat(amount.replace(/\s/g, '').replace(',', '.'));
    if (!Number.isFinite(num) || num <= 0) {
      setError(t('invalidAmount') ?? 'Montant invalide');
      return;
    }
    if (data && num > data.balance) {
      setError(t('insufficientBalance') ?? 'Solde insuffisant');
      return;
    }
    if (data?.frozen) {
      setError(t('walletUnavailable') ?? 'Portefeuille indisponible');
      return;
    }
    setSubmitting(true);
    fetch('/api/supplier/withdraw', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ amount: num, method }),
    })
      .then(async (r) => {
        const text = await r.text();
        const json = text ? JSON.parse(text) : {};
        if (!r.ok) throw new Error(json.error ?? text ?? r.statusText);
        return json;
      })
      .then((res) => {
        setSuccess(res.message ?? t('withdrawRequestSent') ?? 'Demande enregistrée.');
        setAmount('');
        fetchData();
      })
      .catch((err) => setError(err.message ?? 'Erreur'))
      .finally(() => setSubmitting(false));
  };

  if (user?.role !== 'SUPPLIER') {
    return (
      <div className="p-8">
        <p>{t('accessReservedSupplier') ?? 'Accès réservé aux fournisseurs.'}</p>
        <Link href="/dashboard" className="btn btn-ghost mt-4">{t('back')}</Link>
      </div>
    );
  }

  const loc = (locale ?? 'fr') as 'fr' | 'en';
  const currencyLabel = data ? formatCurrencyForDisplay(data.currency) : 'F CFA';

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <AppLogo className="btn btn-ghost btn-sm text-base" />
          <Link href="/dashboard" className="btn btn-ghost btn-sm">← {t('dashboard')}</Link>
        </div>
        <div className="flex gap-1">
          <ThemeSwitcher />
          <LocaleSwitcher />
        </div>
      </div>
      <h1 className="text-2xl font-bold mb-6">{t('requestWithdrawal')}</h1>

      {loading ? (
        <span className="loading loading-spinner" />
      ) : (
        <div className="space-y-6 max-w-lg">
          {data && (
            <>
              <div className="card bg-base-100 shadow">
                <div className="card-body">
                  <h2 className="card-title text-lg">{t('availableBalance') ?? 'Solde disponible'}</h2>
                  <p className="text-2xl font-bold">
                    {formatNumberForLocale(data.balance, loc)} {currencyLabel}
                  </p>
                  {data.frozen && (
                    <p className="text-sm text-warning">{t('walletFrozen') ?? 'Portefeuille gelé. Contactez le support.'}</p>
                  )}
                </div>
              </div>

              <form onSubmit={handleSubmit} className="card bg-base-100 shadow">
                <div className="card-body">
                  <h2 className="card-title text-lg">{t('newWithdrawRequest') ?? 'Nouvelle demande'}</h2>
                  {error && <div className="alert alert-error">{error}</div>}
                  {success && <div className="alert alert-success">{success}</div>}
                  <div className="form-control">
                    <label className="label" htmlFor="amount">
                      <span className="label-text">{t('amount') ?? 'Montant'} ({currencyLabel})</span>
                    </label>
                    <input
                      id="amount"
                      type="text"
                      inputMode="decimal"
                      placeholder="0"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="input input-bordered"
                      disabled={data.frozen}
                    />
                  </div>
                  <div className="form-control">
                    <label className="label">
                      <span className="label-text">{t('method') ?? 'Méthode'}</span>
                    </label>
                    <select
                      value={method}
                      onChange={(e) => setMethod(e.target.value as 'mobile_money' | 'bank')}
                      className="select select-bordered"
                    >
                      <option value="mobile_money">Mobile Money</option>
                      <option value="bank">{t('bankTransfer') ?? 'Virement bancaire'}</option>
                    </select>
                  </div>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={submitting || data.frozen || data.balance <= 0}
                  >
                    {submitting ? '...' : t('requestWithdrawal')}
                  </button>
                </div>
              </form>

              {data.pendingWithdrawals.length > 0 && (
                <div className="card bg-base-100 shadow">
                  <div className="card-body">
                    <h2 className="card-title text-lg">{t('pendingWithdrawals') ?? 'Demandes en attente'}</h2>
                    <ul className="space-y-2">
                      {data.pendingWithdrawals.map((w) => (
                        <li key={w.id} className="flex justify-between items-center py-2 border-b border-base-300 last:border-0">
                          <span>{formatNumberForLocale(w.amount, loc)} {currencyLabel}</span>
                          <span className="badge badge-warning">{t(withdrawalStatusToKey(w.status))}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
