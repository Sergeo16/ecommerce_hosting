'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'react-toastify';
import { useAuth } from '@/context/AuthContext';
import { AppLogo } from '@/components/AppLogo';
import { ThemeSwitcher } from '@/components/ThemeSwitcher';
import { LocaleSwitcher } from '@/components/LocaleSwitcher';
import { useLocale } from '@/context/LocaleContext';

type LinkTarget = 'catalog' | 'category' | 'product';

type AffiliateLink = {
  id: string;
  slug: string;
  referralCode: string;
  trackingLink?: string;
  clickCount: number;
  conversionCount: number;
  createdAt: string;
  product?: { name: string; slug: string };
  categorySlug?: string | null;
};

type Category = { id: string; name: string; slug: string };

export default function AffiliateLinksPage() {
  const { user, token, isLoading: authLoading } = useAuth();
  const { t } = useLocale();
  const router = useRouter();
  const [links, setLinks] = useState<AffiliateLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [targetType, setTargetType] = useState<LinkTarget>('catalog');
  const [categories, setCategories] = useState<Category[]>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadLinks = useCallback(() => {
    if (!token || user?.role !== 'AFFILIATE') {
      setLoading(false);
      return;
    }
    fetch('/api/affiliate/links', { headers: { Authorization: `Bearer ${token}` } })
      .then(async (r) => {
        const text = await r.text();
        if (!r.ok) throw new Error(text || r.statusText);
        return text ? JSON.parse(text) : [];
      })
      .then(setLinks)
      .catch(() => setLinks([]))
      .finally(() => setLoading(false));
  }, [token, user?.role]);

  useEffect(() => {
    setLoading(true);
    loadLinks();
  }, [loadLinks]);

  useEffect(() => {
    fetch('/api/categories')
      .then((r) => r.json())
      .then((data) => setCategories(Array.isArray(data) ? data : []))
      .catch(() => setCategories([]));
  }, []);

  const handleCopyLink = (url: string) => {
    navigator.clipboard.writeText(url).then(() => toast.success(t('linkCopied'))).catch(() => toast.error('Erreur'));
  };

  const handleCreateCatalogLink = async () => {
    if (!token || creating) return;
    setCreating(true);
    try {
      const res = await fetch('/api/affiliate/links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ productId: null, categorySlug: null }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? 'Erreur');
      toast.success('Lien créé.');
      setModalOpen(false);
      setTargetType('catalog');
      loadLinks();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setCreating(false);
    }
  };

  const handleGoToCatalog = () => {
    setModalOpen(false);
    if (targetType === 'category') {
      router.push('/catalog?affiliate_create=category');
    } else if (targetType === 'product') {
      router.push('/catalog?affiliate_create=product');
    }
  };

  const getLinkLabel = (link: AffiliateLink) => {
    if (link.product?.name) return link.product.name;
    if (link.categorySlug) {
      const cat = categories.find((c) => c.slug === link.categorySlug);
      return cat?.name ?? link.categorySlug;
    }
    return t('affiliateLinkTargetCatalog');
  };

  const handleDeleteLink = async (linkId: string) => {
    if (!confirm(t('confirmDeleteAffiliateLink'))) return;
    if (!token) return;
    setDeletingId(linkId);
    try {
      const res = await fetch(`/api/affiliate/links/${linkId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        toast.success('Lien supprimé.');
        loadLinks();
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error ?? 'Erreur');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setDeletingId(null);
    }
  };

  if (authLoading) return <div className="p-8">{t('loading')}</div>;
  if (user?.role !== 'AFFILIATE') {
    return (
      <div className="p-8">
        <p>{t('accessReservedAffiliate')}</p>
        <Link href="/dashboard" className="btn btn-ghost mt-4">{t('back')}</Link>
      </div>
    );
  }

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
      <h1 className="text-2xl font-bold mb-6">{t('myAffiliateLinks')}</h1>

      <div className="alert alert-info mb-6">
        <div>
          <h3 className="font-bold">{t('affiliateLinksHowTo')}</h3>
          <ol className="list-decimal list-inside mt-2 space-y-1 text-sm">
            <li>{t('affiliateLinksStep1')}</li>
            <li>{t('affiliateLinksStep2')}</li>
            <li>{t('affiliateLinksStep3')}</li>
          </ol>
          <p className="mt-2 text-sm opacity-90">{t('affiliateLinksTip')}</p>
        </div>
      </div>

      {loading ? (
        <span className="loading loading-spinner" />
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setModalOpen(true)}
              disabled={creating}
            >
              {creating ? t('loading') : t('createAffiliateLink')}
            </button>
          </div>
          {links.length === 0 ? (
            <p className="opacity-70">Aucun lien. Cliquez sur « {t('createAffiliateLink')} » pour en créer un.</p>
          ) : (
            links.map((link) => {
              const url = link.trackingLink ?? `${typeof window !== 'undefined' ? window.location.origin : ''}/catalog?ref=${link.referralCode}`;
              return (
                <div key={link.id} className="card bg-base-100 shadow">
                  <div className="card-body">
                    <div className="flex flex-wrap items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="badge badge-ghost badge-sm mb-1">{getLinkLabel(link)}</p>
                        <p className="font-mono text-sm break-all">{url}</p>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <button
                          type="button"
                          className="btn btn-sm btn-ghost"
                          onClick={() => handleCopyLink(url)}
                          title={t('copyLink')}
                        >
                          {t('copyLink')}
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm btn-error btn-ghost"
                          onClick={() => handleDeleteLink(link.id)}
                          disabled={deletingId === link.id}
                          title={t('deleteLink')}
                        >
                          {deletingId === link.id ? '...' : t('deleteLink')}
                        </button>
                      </div>
                    </div>
                    <p className="text-sm opacity-70">
                      {t('affiliateLinkCreatedAt')} {new Date(link.createdAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
                      {' · '}Clics: {link.clickCount} — Conversions: {link.conversionCount}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {modalOpen && (
        <dialog open className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg">{t('createAffiliateLink')}</h3>
            <p className="text-sm opacity-80 mt-1">{t('affiliateLinkChooseTarget')}</p>
            <div className="mt-4 space-y-4">
              <div className="flex flex-col gap-3">
                <label className="flex items-start gap-2 cursor-pointer p-3 rounded-lg border border-base-300 hover:bg-base-200/50">
                  <input
                    type="radio"
                    name="target"
                    className="radio radio-sm mt-0.5"
                    checked={targetType === 'catalog'}
                    onChange={() => setTargetType('catalog')}
                  />
                  <div>
                    <span className="font-medium">{t('affiliateLinkTargetCatalog')}</span>
                    <p className="text-sm opacity-80 mt-0.5">{t('affiliateLinkCatalogDesc')}</p>
                  </div>
                </label>
                <label className="flex items-start gap-2 cursor-pointer p-3 rounded-lg border border-base-300 hover:bg-base-200/50">
                  <input
                    type="radio"
                    name="target"
                    className="radio radio-sm mt-0.5"
                    checked={targetType === 'category'}
                    onChange={() => setTargetType('category')}
                  />
                  <div>
                    <span className="font-medium">{t('affiliateLinkTargetCategory')}</span>
                    <p className="text-sm opacity-80 mt-0.5">{t('affiliateLinkCategoryDesc')}</p>
                  </div>
                </label>
                <label className="flex items-start gap-2 cursor-pointer p-3 rounded-lg border border-base-300 hover:bg-base-200/50">
                  <input
                    type="radio"
                    name="target"
                    className="radio radio-sm mt-0.5"
                    checked={targetType === 'product'}
                    onChange={() => setTargetType('product')}
                  />
                  <div>
                    <span className="font-medium">{t('affiliateLinkTargetProduct')}</span>
                    <p className="text-sm opacity-80 mt-0.5">{t('affiliateLinkProductDesc')}</p>
                  </div>
                </label>
              </div>
            </div>
            <div className="modal-action">
              <button type="button" className="btn btn-ghost" onClick={() => setModalOpen(false)}>
                Annuler
              </button>
              {targetType === 'catalog' ? (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleCreateCatalogLink}
                  disabled={creating}
                >
                  {creating ? t('loading') : t('createAffiliateLink')}
                </button>
              ) : (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleGoToCatalog}
                >
                  {t('affiliateLinkGoToCatalog')}
                </button>
              )}
            </div>
          </div>
          <form method="dialog" className="modal-backdrop">
            <button type="button" onClick={() => setModalOpen(false)}>fermer</button>
          </form>
        </dialog>
      )}
    </div>
  );
}
