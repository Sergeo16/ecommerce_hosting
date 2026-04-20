'use client';

import { useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';

/** Redirige /catalog/affiliate_create-category et /catalog/affiliate_create-product vers la bonne URL. */
export default function CatalogSlugRedirect() {
  const params = useParams();
  const router = useRouter();
  const slug = params?.slug as string | undefined;

  useEffect(() => {
    if (slug === 'affiliate_create-category') {
      router.replace('/catalog?affiliate_create=category');
    } else if (slug === 'affiliate_create-product') {
      router.replace('/catalog?affiliate_create=product');
    } else {
      router.replace('/catalog');
    }
  }, [slug, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-base-200">
      <span className="loading loading-spinner loading-lg" />
    </div>
  );
}
