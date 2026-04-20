'use client';

import Link from 'next/link';
import { useCart } from '@/context/CartContext';
import { useLocale } from '@/context/LocaleContext';

export function CartLink() {
  const { itemCount } = useCart();
  const { t } = useLocale();
  return (
    <Link
      href="/cart"
      className="btn btn-ghost btn-sm btn-square indicator"
      aria-label={t('cart')}
    >
      {itemCount > 0 && <span className="indicator-item badge badge-primary badge-sm">{itemCount}</span>}
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    </Link>
  );
}
