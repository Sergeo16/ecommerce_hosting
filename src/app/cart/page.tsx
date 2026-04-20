'use client';

import { useCart } from '@/context/CartContext';
import { useLocale } from '@/context/LocaleContext';
import Link from 'next/link';
import { AppLogo } from '@/components/AppLogo';
import { CartLink } from '@/components/CartLink';
import { ThemeSwitcher } from '@/components/ThemeSwitcher';
import { LocaleSwitcher } from '@/components/LocaleSwitcher';
import { formatCurrencyForDisplay, formatNumberForLocale } from '@/lib/currency';

export default function CartPage() {
  const { items, updateQuantity, removeItem, clearCart, itemCount, backupForCheckout } = useCart();
  const { t, locale } = useLocale();

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-base-200 flex flex-col">
        <header className="navbar bg-base-100 border-b border-base-300 px-2 sm:px-4 min-h-12 sm:min-h-14 py-1 gap-1 flex-nowrap overflow-x-hidden w-full max-w-full">
          <div className="navbar-start shrink-0 min-w-0">
            <AppLogo className="btn btn-ghost btn-sm px-1 truncate max-w-[130px] sm:max-w-none" />
          </div>
          <div className="navbar-end shrink-0 flex-nowrap gap-1">
            <CartLink />
            <ThemeSwitcher />
            <LocaleSwitcher />
          </div>
        </header>
        <main className="container mx-auto p-4 sm:p-6 max-w-full min-w-0 flex-1 flex flex-col items-center justify-center">
          <div className="card bg-base-100 shadow-xl max-w-md w-full">
            <div className="card-body text-center">
              <span className="text-6xl opacity-50" aria-hidden>🛒</span>
              <h1 className="text-xl font-bold">{t('cartEmpty')}</h1>
              <p className="text-base-content/70">{t('cartEmptyDesc')}</p>
              <Link href="/catalog" className="btn btn-primary mt-4">{t('catalog')}</Link>
            </div>
          </div>
        </main>
      </div>
    );
  }

  const subtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const firstCurrency = formatCurrencyForDisplay(items[0]?.currency ?? 'XOF');

  return (
    <div className="min-h-screen bg-base-200 flex flex-col">
      <header className="navbar bg-base-100 border-b border-base-300 px-2 sm:px-4 min-h-12 sm:min-h-14 py-1 gap-1 flex-nowrap overflow-x-hidden w-full max-w-full">
        <div className="navbar-start shrink-0 min-w-0">
          <AppLogo className="btn btn-ghost btn-sm px-1 truncate max-w-[130px] sm:max-w-none" />
        </div>
        <div className="navbar-end shrink-0 flex-nowrap gap-1">
          <CartLink />
          <ThemeSwitcher />
          <LocaleSwitcher />
        </div>
      </header>
      <main className="container mx-auto p-4 sm:p-6 max-w-full min-w-0 flex-1 max-w-2xl">
        <h1 className="text-2xl font-bold mb-4">{t('cartTitle')} ({itemCount})</h1>
        <div className="card bg-base-100 shadow-xl mb-6">
          <div className="card-body p-0 divide-y divide-base-300">
            {items.map((item) => (
              <div key={item.productId} className="flex gap-3 sm:gap-4 p-4">
                <div className="flex-1 min-w-0">
                  <Link href={item.slug ? `/p/${item.slug}?id=${item.productId}` : `/catalog`} className="font-semibold break-words hover:link">
                    {item.name}
                  </Link>
                  <p className="text-primary font-bold text-sm mt-0.5">
                    {formatNumberForLocale(item.price, locale)} {formatCurrencyForDisplay(item.currency ?? 'XOF')}
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    <div className="join">
                      <button
                        type="button"
                        className="btn btn-xs btn-outline join-item"
                        onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                        aria-label="-"
                      >
                        −
                      </button>
                      <input
                        type="number"
                        min={0}
                        max={999}
                        className="input input-bordered input-xs join-item w-14 text-center"
                        value={item.quantity}
                        onChange={(e) => updateQuantity(item.productId, Math.max(0, Math.min(999, parseInt(e.target.value, 10) || 0)))}
                      />
                      <button
                        type="button"
                        className="btn btn-xs btn-outline join-item"
                        onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                        aria-label="+"
                      >
                        +
                      </button>
                    </div>
                    <button
                      type="button"
                      className="btn btn-ghost btn-xs text-error"
                      onClick={() => removeItem(item.productId)}
                      aria-label={t('cartRemove')}
                    >
                      {t('cartRemove')}
                    </button>
                  </div>
                </div>
                <p className="font-bold shrink-0 text-right">
                  {formatNumberForLocale(item.price * item.quantity, locale)} {formatCurrencyForDisplay(item.currency ?? 'XOF')}
                </p>
              </div>
            ))}
          </div>
          <div className="card-body border-t border-base-300 pt-4">
            <div className="flex justify-between items-center">
              <span className="font-semibold">{t('total')}:</span>
              <span className="font-bold text-primary">{formatNumberForLocale(subtotal, locale)} {firstCurrency}</span>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn btn-outline btn-error" onClick={clearCart}>
            {t('cartEmptyButton')}
          </button>
          <Link href="/catalog" className="btn btn-outline">{t('catalog')}</Link>
          <Link href="/checkout" className="btn btn-primary flex-1" onClick={backupForCheckout}>{t('checkout')}</Link>
        </div>
      </main>
    </div>
  );
}
