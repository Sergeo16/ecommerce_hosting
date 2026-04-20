'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ProductImage } from '@/components/ProductImage';
import { useAuth } from '@/context/AuthContext';
import { AppLogo } from '@/components/AppLogo';
import { ThemeSwitcher } from '@/components/ThemeSwitcher';
import { LocaleSwitcher } from '@/components/LocaleSwitcher';
import { useLocale } from '@/context/LocaleContext';
import { formatCurrencyForDisplay, formatNumberForLocale } from '@/lib/currency';

type Product = {
  id: string;
  name: string;
  slug: string;
  price: number;
  currency?: string;
  imageUrls: string[];
  mainImageIndex?: number;
  category?: { name: string; slug: string };
};

function ProductCard({
  product: p,
  token,
  t,
  locale,
  onDeleted,
}: {
  product: Product;
  token: string | null;
  t: (key: string) => string;
  locale: string;
  onDeleted: () => void;
}) {
  const [deleting, setDeleting] = useState(false);
  const mainIdx = p.mainImageIndex ?? 0;
  const img = p.imageUrls?.[mainIdx] ?? p.imageUrls?.[0];
  const imgSrc = img ? (typeof window !== 'undefined' ? (img.startsWith('http') ? img : `${window.location.origin}${img.startsWith('/') ? img : `/${img}`}`) : img) : '';

  async function handleDelete() {
    if (!confirm(t('confirmDeleteProduct'))) return;
    if (!token) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/supplier/products/${p.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) onDeleted();
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="card bg-base-100 shadow hover:shadow-lg transition-shadow">
      <Link href={`/p/${p.slug}?id=${p.id}`} className="block">
        <figure className="h-40 bg-base-300 relative">
          {imgSrc ? (
            <ProductImage src={imgSrc} alt={p.name} fill />
          ) : (
            <span className="text-4xl opacity-50">📦</span>
          )}
        </figure>
      </Link>
      <div className="card-body p-4">
        <h2 className="card-title text-sm line-clamp-2">{p.name}</h2>
        <p className="text-primary font-bold">{formatNumberForLocale(p.price ?? 0, (locale ?? 'fr') as 'fr' | 'en')} {formatCurrencyForDisplay(p.currency ?? 'XOF')}</p>
        <div className="card-actions justify-end gap-1 mt-2">
          <Link href={`/p/${p.slug}?id=${p.id}`} className="btn btn-ghost btn-sm">{t('viewProduct')}</Link>
          <Link href={`/dashboard/products/${p.id}/edit`} className="btn btn-outline btn-sm">{t('editProduct')}</Link>
          <button type="button" className="btn btn-error btn-sm" onClick={handleDelete} disabled={deleting}>
            {deleting ? '...' : t('deleteProduct')}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function MyProductsPage() {
  const { user, token } = useAuth();
  const { t, locale } = useLocale();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  const canPublish = user?.role === 'SUPPLIER' || user?.role === 'SUPER_ADMIN' || user?.role === 'AFFILIATE';

  useEffect(() => {
    if (!token || !canPublish) return;
    fetch('/api/supplier/products', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((list) => setProducts(Array.isArray(list) ? list : []))
      .finally(() => setLoading(false));
  }, [token, canPublish]);

  if (!user) {
    return (
      <div className="p-8">
        <p>{t('connectToAccessDashboard')}</p>
        <Link href="/auth/login" className="btn btn-primary mt-4">{t('login')}</Link>
      </div>
    );
  }
  if (!canPublish) {
    return (
      <div className="p-8">
        <p>Accès réservé aux fournisseurs, affiliés et administrateurs.</p>
        <Link href="/dashboard" className="btn btn-ghost mt-4">{t('back')}</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-base-200">
      <header className="navbar bg-base-100 shadow px-2 sm:px-4 min-h-12 py-1 gap-1 flex-nowrap overflow-x-hidden w-full max-w-full">
        <div className="navbar-start shrink-0 min-w-0 max-w-[80%] flex-nowrap gap-1">
          <AppLogo className="btn btn-ghost btn-sm px-1 truncate max-w-[120px] sm:max-w-none" />
          <Link href="/dashboard" className="btn btn-ghost btn-sm whitespace-nowrap shrink-0">← {t('dashboard')}</Link>
        </div>
        <div className="navbar-end shrink-0 flex-nowrap gap-1">
          <ThemeSwitcher />
          <LocaleSwitcher />
        </div>
      </header>
      <main className="container mx-auto p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <h1 className="text-2xl font-bold">{t('myProducts')}</h1>
          <Link href="/dashboard/products/new" className="btn btn-primary">{t('publishProduct')}</Link>
        </div>
        {loading ? (
          <span className="loading loading-spinner" />
        ) : products.length === 0 ? (
          <p className="opacity-70">Aucun produit. <Link href="/dashboard/products/new" className="link">{t('publishProduct')}</Link></p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {products.map((p) => (
              <ProductCard
                key={p.id}
                product={p}
                token={token}
                t={(key: string) => t(key as any)}
                locale={locale ?? 'fr'}
                onDeleted={() => setProducts((prev) => prev.filter((x) => x.id !== p.id))}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
