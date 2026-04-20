'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { ProductImage } from '@/components/ProductImage';
import { useSearchParams, useRouter } from 'next/navigation';
import { AppLogo } from '@/components/AppLogo';
import { ThemeSwitcher } from '@/components/ThemeSwitcher';
import { LocaleSwitcher } from '@/components/LocaleSwitcher';
import { useLocale } from '@/context/LocaleContext';
import { useCart } from '@/context/CartContext';
import { CartLink } from '@/components/CartLink';
import { formatCurrencyForDisplay, formatNumberForLocale } from '@/lib/currency';

/** URL absolue pour les images (uploads /api/...) afin qu’elles s’affichent correctement. */
function toAbsoluteMediaUrl(url: string): string {
  if (typeof window === 'undefined') return url;
  if (!url || url.startsWith('http://') || url.startsWith('https://')) return url;
  const path = url.startsWith('/') ? url : `/${url}`;
  return `${window.location.origin}${path}`;
}

/** Extrait l’ID vidéo YouTube depuis plusieurs formats (watch, youtu.be, shorts, embed). */
function getYoutubeVideoId(url: string): string | null {
  if (!url || typeof url !== 'string') return null;
  try {
    const u = new URL(url.trim());
    const host = u.hostname.replace(/^www\./, '').toLowerCase();

    // Ex: https://youtu.be/VIDEO_ID
    if (host === 'youtu.be') return u.pathname.slice(1).split('/')[0] || null;

    // Ex: https://www.youtube.com/watch?v=VIDEO_ID
    if (host.endsWith('youtube.com')) {
      const v = u.searchParams.get('v');
      if (v) return v;

      // Ex: https://www.youtube.com/shorts/VIDEO_ID
      const parts = u.pathname.split('/').filter(Boolean);
      if (parts[0] === 'shorts' && parts[1]) return parts[1];

      // Ex: https://www.youtube.com/embed/VIDEO_ID
      if (parts[0] === 'embed' && parts[1]) return parts[1];
    }
  } catch {
    return null;
  }
  return null;
}

type Product = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  currency?: string;
  imageUrls: string[];
  mainImageIndex?: number;
  videoUrls?: string[];
  companyProfile?: { companyName: string; slug: string };
  category?: { name: string };
};

export default function ProductPage({ params }: { params: { slug: string } }) {
  const { slug } = params;
  const searchParams = useSearchParams();
  const router = useRouter();
  const id = searchParams.get('id');
  const ref = searchParams.get('ref');
  const { t, locale } = useLocale();
  const { addItem } = useCart();
  const [product, setProduct] = useState<Product | null>(null);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    if (slug === 'catalog') {
      router.replace(ref ? `/catalog?ref=${ref}` : '/catalog');
      return;
    }
  }, [slug, ref, router]);

  useEffect(() => {
    if (!slug || slug === 'catalog') return;
    const url = id ? `/api/products/${id}` : `/api/products/slug/${slug}`;
    fetch(url)
      .then((r) => (r.ok ? r.json() : null))
      .then((p) => {
        if (p) setProduct(p);
      });
  }, [id, slug]);

  useEffect(() => {
    if (product?.imageUrls?.length) {
      const main = product.mainImageIndex ?? 0;
      setSelectedImageIndex(main >= 0 && main < product.imageUrls.length ? main : 0);
    }
  }, [product?.id, product?.imageUrls, product?.mainImageIndex]);

  useEffect(() => {
    const len = product?.imageUrls?.length ?? 0;
    if (len <= 1) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setSelectedImageIndex((i) => (i <= 0 ? len - 1 : i - 1));
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        setSelectedImageIndex((i) => (i >= len - 1 ? 0 : i + 1));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [product?.imageUrls?.length]);

  const images = useMemo(() => product?.imageUrls ?? [], [product?.imageUrls]);
  const imageUrlsAbs = useMemo(() => images.map((u) => toAbsoluteMediaUrl(u)), [images]);

  if (slug === 'catalog') return <div className="p-8 text-center text-base-content">{t('loading')}</div>;
  if (!product) return <div className="p-8 text-center text-base-content">{t('loading')}</div>;

  const videos = product.videoUrls ?? [];
  const mainIndex = product.mainImageIndex ?? 0;
  const displayIndex = selectedImageIndex >= 0 && selectedImageIndex < images.length ? selectedImageIndex : mainIndex;
  const mainImageUrl = images[displayIndex] ?? images[0];
  const mainImageUrlAbs = mainImageUrl ? toAbsoluteMediaUrl(mainImageUrl) : '';

  return (
    <div className="min-h-screen bg-base-200">
      <header className="navbar bg-base-100 border-b border-base-300 px-2 sm:px-4 min-h-12 sm:min-h-14 py-1 gap-1 sm:gap-2 flex-nowrap overflow-x-hidden w-full max-w-full">
        <div className="navbar-start shrink-0 min-w-0 max-w-[70%] sm:max-w-none flex-nowrap gap-1">
          <AppLogo className="btn btn-ghost btn-sm text-base text-base-content px-1 truncate max-w-[100px] sm:max-w-[140px] md:max-w-none" />
          <Link href="/catalog" className="btn btn-ghost btn-sm text-base-content whitespace-nowrap shrink-0">← {t('catalog')}</Link>
        </div>
        <div className="navbar-end shrink-0 flex-nowrap gap-1">
          <CartLink />
          <ThemeSwitcher />
          <LocaleSwitcher />
        </div>
      </header>
      <main className="container mx-auto p-4 sm:p-6 max-w-full min-w-0">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
          {/* Galerie : image principale avec défiler prev/next + miniatures */}
          <div className="space-y-3">
            <div className="relative">
              <figure className="bg-base-300 rounded-lg border border-base-300 aspect-square max-h-[400px] flex items-center justify-center overflow-hidden relative">
                {mainImageUrlAbs ? (
                  <ProductImage
                    src={mainImageUrlAbs}
                    alt={product.name}
                    fill
                    className="object-contain"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                      const fallback = (e.target as HTMLImageElement).nextElementSibling;
                      if (fallback) (fallback as HTMLElement).style.display = 'block';
                    }}
                  />
                ) : null}
                <span className="text-8xl opacity-50" style={{ display: mainImageUrlAbs ? 'none' : 'block' }} aria-hidden>📦</span>
              </figure>
              {images.length > 1 && (
                <>
                  <button
                    type="button"
                    className="absolute left-2 top-1/2 -translate-y-1/2 btn btn-circle btn-sm md:btn-md bg-base-100/90 hover:bg-base-100 shadow-md border border-base-300 opacity-90 hover:opacity-100 transition-opacity"
                    onClick={() => setSelectedImageIndex((i) => (i <= 0 ? images.length - 1 : i - 1))}
                    aria-label="Image précédente"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 md:h-6 md:w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    className="absolute right-2 top-1/2 -translate-y-1/2 btn btn-circle btn-sm md:btn-md bg-base-100/90 hover:bg-base-100 shadow-md border border-base-300 opacity-90 hover:opacity-100 transition-opacity"
                    onClick={() => setSelectedImageIndex((i) => (i >= images.length - 1 ? 0 : i + 1))}
                    aria-label="Image suivante"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 md:h-6 md:w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                  <span className="absolute bottom-2 left-1/2 -translate-x-1/2 px-2 py-1 rounded bg-base-100/90 border border-base-300 text-xs font-medium text-base-content">
                    {displayIndex + 1} / {images.length}
                  </span>
                </>
              )}
            </div>
            {images.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-2 scroll-smooth">
                {images.map((url, i) => (
                  <button
                    key={i}
                    type="button"
                    className={`flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 ${
                      i === displayIndex ? 'border-primary' : 'border-base-300'
                    }`}
                    onClick={() => setSelectedImageIndex(i)}
                  >
                    <ProductImage src={imageUrlsAbs[i] ?? url} alt="" width={64} height={64} className="object-cover w-full h-full" />
                  </button>
                ))}
              </div>
            )}
            {/* Vidéos : YouTube en iframe, sinon lecteur vidéo direct */}
            {videos.length > 0 && (
              <div className="space-y-4 pt-4 border-t border-base-300">
                <h3 className="font-semibold text-base-content">Vidéos</h3>
                {videos.map((url, i) => {
                  const ytId = getYoutubeVideoId(url);
                  if (ytId) {
                    const embedUrl = `https://www.youtube.com/embed/${ytId}`;
                    return (
                      <div key={i} className="rounded-lg overflow-hidden bg-base-300 aspect-video max-h-64">
                        <iframe
                          src={embedUrl}
                          title={`Vidéo ${i + 1}`}
                          className="w-full h-full"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                        />
                      </div>
                    );
                  }
                  const directUrl = toAbsoluteMediaUrl(url);
                  return (
                    <div key={i} className="rounded-lg overflow-hidden bg-base-300 aspect-video max-h-64">
                      <video src={directUrl} controls className="w-full h-full object-contain" playsInline />
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="border border-base-300 rounded-lg p-4 sm:p-6 bg-base-100">
            <h1 className="text-2xl sm:text-3xl font-bold break-words text-base-content">{product.name}</h1>
            {product.category && (
              <p className="badge badge-ghost mt-2 text-base-content">{product.category.name}</p>
            )}
            <p className="text-2xl text-primary font-bold mt-4">{formatNumberForLocale(product.price, locale)} {formatCurrencyForDisplay(product.currency ?? 'XOF')}</p>
            {product.description && (
              <div className="mt-4 text-base-content/80 prose prose-sm max-w-none">
                <p className="whitespace-pre-wrap break-words">{product.description}</p>
              </div>
            )}
            {product.companyProfile && (
              <p className="mt-2 text-sm text-base-content/80">{t('soldBy')} {product.companyProfile.companyName}</p>
            )}
            <div className="mt-6 flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-base-content">{t('quantity')}:</span>
                <div className="join">
                  <button
                    type="button"
                    className="btn btn-sm btn-outline join-item"
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    aria-label="-"
                  >
                    −
                  </button>
                  <input
                    type="number"
                    min={1}
                    max={999}
                    className="input input-bordered input-sm join-item w-16 text-center border-base-300 bg-base-100 text-base-content"
                    value={quantity}
                    onChange={(e) => setQuantity(Math.max(1, Math.min(999, parseInt(e.target.value, 10) || 1)))}
                  />
                  <button
                    type="button"
                    className="btn btn-sm btn-outline join-item"
                    onClick={() => setQuantity((q) => Math.min(999, q + 1))}
                    aria-label="+"
                  >
                    +
                  </button>
                </div>
              </div>
              <Link href={`/checkout?productId=${product.id}&qty=${quantity}`} className="btn btn-primary">
                {t('buy')}
              </Link>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() =>
                  addItem({
                    productId: product.id,
                    name: product.name,
                    price: product.price,
                    currency: product.currency ?? 'XOF',
                    quantity,
                    slug,
                    companyProfileId: (product as { companyProfileId?: string }).companyProfileId,
                  })
                }
              >
                {t('addToCart')}
              </button>
              <Link href="/catalog" className="btn btn-outline">{t('backToCatalog')}</Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
