'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { toast } from 'react-toastify';
import { useAuth } from '@/context/AuthContext';
import { AppLogo } from '@/components/AppLogo';
import { ThemeSwitcher } from '@/components/ThemeSwitcher';
import { LocaleSwitcher } from '@/components/LocaleSwitcher';
import { useLocale } from '@/context/LocaleContext';
import { formatNumberForLocale } from '@/lib/currency';

type AffiliateLink = {
  id: string;
  slug: string;
  referralCode: string;
  trackingLink: string;
  categorySlug?: string | null;
  commissionPercent?: number | null;
  commissionAmount?: number | null;
  clickCount: number;
  conversionCount: number;
  createdAt: string;
  user: { firstName: string; lastName: string; email: string };
  product?: { name: string; slug: string } | null;
};

export default function AdminAffiliatesPage() {
  const { user, token } = useAuth();
  const { t, locale } = useLocale();
  const [links, setLinks] = useState<AffiliateLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPercent, setEditPercent] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!token || user?.role !== 'SUPER_ADMIN') return;
    fetch('/api/affiliate/links', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((data) => setLinks(Array.isArray(data) ? data : []))
      .catch(() => setLinks([]))
      .finally(() => setLoading(false));
  }, [token, user?.role]);

  function startEdit(link: AffiliateLink) {
    setEditingId(link.id);
    setEditPercent(link.commissionPercent != null ? String(link.commissionPercent) : '');
    setEditAmount(link.commissionAmount != null ? String(link.commissionAmount) : '');
  }

  function cancelEdit() {
    setEditingId(null);
    setEditPercent('');
    setEditAmount('');
  }

  async function saveEdit() {
    if (!editingId || !token) return;
    setSaving(true);
    try {
      const pct = editPercent.trim() === '' ? null : parseFloat(editPercent);
      const amt = editAmount.trim() === '' ? null : parseFloat(editAmount);
      let commissionPercent: number | null = null;
      let commissionAmount: number | null = null;
      if (pct != null && !Number.isNaN(pct) && pct >= 0 && pct <= 100) commissionPercent = pct;
      else if (amt != null && !Number.isNaN(amt) && amt >= 0) commissionAmount = amt;
      const body = { commissionPercent, commissionAmount };
      const res = await fetch(`/api/affiliate/links/${editingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? 'Erreur');
        return;
      }
      toast.success(t('saved'));
      setLinks((prev) => prev.map((l) => (l.id === editingId ? { ...l, commissionPercent: data.commissionPercent ?? null, commissionAmount: data.commissionAmount ?? null } : l)));
      cancelEdit();
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
      <h1 className="text-2xl font-bold mb-6">Liens affiliés · Commission par affilié</h1>
      {loading ? (
        <span className="loading loading-spinner" />
      ) : (
        <div className="overflow-x-auto -mx-2 sm:mx-0 w-full">
          <table className="table table-zebra w-full min-w-[640px]">
            <thead>
              <tr>
                <th>Affilié</th>
                <th>Code / lien</th>
                <th>Cible</th>
                <th>{t('affiliateCommissionPercent')} / {t('affiliateCommissionAmount')}</th>
                <th>Conv.</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {links.map((link) => (
                <tr key={link.id}>
                  <td>
                    <span className="font-medium">{link.user.firstName} {link.user.lastName}</span>
                    <br />
                    <span className="text-sm opacity-80">{link.user.email}</span>
                  </td>
                  <td>
                    <code className="text-xs">{link.referralCode}</code>
                    <br />
                    <a href={link.trackingLink} target="_blank" rel="noopener noreferrer" className="link link-hover text-xs truncate max-w-[180px] block">
                      {link.trackingLink}
                    </a>
                  </td>
                  <td>
                    {link.product ? link.product.name : link.categorySlug ? `Cat: ${link.categorySlug}` : t('affiliateLinkTargetCatalog')}
                  </td>
                  <td>
                    {editingId === link.id ? (
                      <div className="flex flex-wrap gap-2 items-center">
                        <input
                          type="number"
                          min={0}
                          max={100}
                          step={0.5}
                          placeholder="%"
                          className="input input-bordered input-sm w-16"
                          value={editPercent}
                          onChange={(e) => setEditPercent(e.target.value)}
                        />
                        <input
                          type="number"
                          min={0}
                          step={100}
                          placeholder="F"
                          className="input input-bordered input-sm w-20"
                          value={editAmount}
                          onChange={(e) => setEditAmount(e.target.value)}
                        />
                      </div>
                    ) : (
                      <>
                        {link.commissionPercent != null && `${link.commissionPercent}%`}
                        {link.commissionAmount != null && link.commissionPercent == null && `${formatNumberForLocale(Number(link.commissionAmount), locale)} F`}
                        {link.commissionPercent == null && link.commissionAmount == null && '—'}
                      </>
                    )}
                  </td>
                  <td>{link.conversionCount}</td>
                  <td>
                    {editingId === link.id ? (
                      <div className="flex gap-1">
                        <button type="button" className="btn btn-sm btn-primary" disabled={saving} onClick={saveEdit}>
                          {saving ? t('loading') : t('save')}
                        </button>
                        <button type="button" className="btn btn-sm btn-ghost" onClick={cancelEdit}>
                          {t('cancel')}
                        </button>
                      </div>
                    ) : (
                      <button type="button" className="btn btn-sm btn-outline" onClick={() => startEdit(link)}>
                        Modifier
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {!loading && links.length === 0 && (
        <p className="text-center text-base-content/70">Aucun lien affilié.</p>
      )}
    </div>
  );
}
