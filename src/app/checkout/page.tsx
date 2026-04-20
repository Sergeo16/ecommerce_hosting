'use client';

import { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { toast } from 'react-toastify';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { AppLogo } from '@/components/AppLogo';
import { ThemeSwitcher } from '@/components/ThemeSwitcher';
import { LocaleSwitcher } from '@/components/LocaleSwitcher';
import { CartLink } from '@/components/CartLink';
import { useCart } from '@/context/CartContext';
import { useLocale } from '@/context/LocaleContext';
import { usePaymentRules, type PaymentRules } from '@/hooks/usePaymentRules';
import {
  CANONICAL_CURRENCY,
  PAYMENT_ACCEPTED_CURRENCIES,
  formatCurrencyForDisplay,
  formatNumberForLocale,
  isPaymentAcceptedCurrency,
  convertToXOF,
} from '@/lib/currency';
import { useShippingFee } from '@/hooks/useShippingFee';
import { getAffiliateRef, clearAffiliateRef } from '@/components/AffiliateRefTracker';

type ProductInfo = { id: string; name: string; price: number; currency: string; companyProfileId?: string };
type PaymentMode = 'FULL_UPFRONT' | 'PARTIAL_ADVANCE' | 'PAY_ON_DELIVERY';

function CheckoutContent() {
  const searchParams = useSearchParams();
  const { user, token } = useAuth();
  const { t, locale } = useLocale();
  const { items: cartItems, clearCart, isReady: cartReady, reloadFromStorage, restoreFromCheckoutBackup, backupForCheckout } = useCart();
  const productId = searchParams.get('productId');
  const qtyFromUrl = Math.max(1, Math.min(999, parseInt(searchParams.get('qty') ?? '1', 10)));

  const fromCart = !productId && cartItems.length > 0;
  const [product, setProduct] = useState<ProductInfo | null>(null);
  const [quantity, setQuantity] = useState(qtyFromUrl);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [orderNumber, setOrderNumber] = useState<string | null>(null);

  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [phone, setPhone] = useState('');
  const [locationCoords, setLocationCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('FULL_UPFRONT');
  const [rulesOverride, setRulesOverride] = useState<PaymentRules | null>(null);
  /** Utilisateur accepte de payer en devise acceptée (XOF) après conversion quand la devise du produit ne l'est pas. */
  const [conversionAccepted, setConversionAccepted] = useState(false);
  /** Config paiement (KKiaPay / FedaPay activés ou non). */
  const [paymentConfig, setPaymentConfig] = useState<{
    kkiapayEnabled: boolean;
    fedapayEnabled: boolean;
    fedapayPublicKey?: string;
    fedapayEnvironment?: 'sandbox' | 'live';
  } | null>(null);
  /** Choix du prestataire de paiement (si plusieurs disponibles). */
  const [paymentGateway, setPaymentGateway] = useState<'KKIAPAY' | 'FEDAPAY' | null>(null);

  const firstProductId = productId ?? cartItems[0]?.productId;
  const companyId = fromCart ? cartItems[0]?.companyProfileId : product?.companyProfileId;
  const productCurrency = fromCart ? (cartItems[0]?.currency ?? CANONICAL_CURRENCY) : (product?.currency ?? CANONICAL_CURRENCY);
  const paymentRules = usePaymentRules(firstProductId ? { productId: firstProductId } : undefined);
  const shippingFee = useShippingFee(companyId ? { companyId, currency: productCurrency } : undefined);

  useEffect(() => {
    const curr = fromCart ? (cartItems[0]?.currency ?? CANONICAL_CURRENCY) : (product?.currency ?? CANONICAL_CURRENCY);
    const requiresPayment = paymentMode === 'FULL_UPFRONT' || paymentMode === 'PARTIAL_ADVANCE';
    if (!requiresPayment || isPaymentAcceptedCurrency(curr)) {
      setConversionAccepted(false);
    }
  }, [product, paymentMode, fromCart, cartItems]);

  useEffect(() => {
    if (orderNumber) return;
    if (!productId && cartItems.length === 0 && cartReady) {
      const restored = restoreFromCheckoutBackup();
      if (!restored) reloadFromStorage();
    }
  }, [orderNumber, productId, cartItems.length, cartReady, reloadFromStorage, restoreFromCheckoutBackup]);

  // Sauvegarder le panier en backup à l’arrivée sur le checkout (si panier non vide) pour pouvoir restaurer en cas de remount
  useEffect(() => {
    if (!orderNumber && !productId && cartItems.length > 0) backupForCheckout();
  }, [orderNumber, productId, cartItems.length, backupForCheckout]);

  useEffect(() => {
    fetch('/api/config/payment')
      .then((r) => (r.ok ? r.json() : null))
      .then((c) => {
        if (!c) return;
        const cfg = {
          kkiapayEnabled: !!c.kkiapayEnabled,
          fedapayEnabled: !!c.fedapayEnabled,
          fedapayPublicKey: c.fedapayPublicKey as string | undefined,
          fedapayEnvironment: c.fedapayEnvironment as 'sandbox' | 'live' | undefined,
        };
        setPaymentConfig(cfg);
        if (!paymentGateway) {
          if (cfg.fedapayEnabled) setPaymentGateway('FEDAPAY');
          else if (cfg.kkiapayEnabled) setPaymentGateway('KKIAPAY');
        }
      });
  }, [paymentGateway]);

  useEffect(() => {
    if (orderNumber) clearCart();
  }, [orderNumber, clearCart]);

  useEffect(() => {
    if (fromCart) {
      setProduct(null);
      setLoading(false);
      return;
    }
    if (!productId) {
      setLoading(false);
      return;
    }
    fetch(`/api/products/${productId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((p) =>
        p && setProduct({
          id: p.id,
          name: p.name,
          price: Number(p.price),
          currency: String(p.currency ?? CANONICAL_CURRENCY).trim().toUpperCase(),
          companyProfileId: p.companyProfileId,
        })
      )
      .finally(() => setLoading(false));
  }, [productId, fromCart, reloadFromStorage]);

  useEffect(() => {
    if (!paymentRules) return;
    setRulesOverride(paymentRules);
    const available: PaymentMode[] = [];
    if (paymentRules.fullUpfront) available.push('FULL_UPFRONT');
    if (paymentRules.partialAdvance) available.push('PARTIAL_ADVANCE');
    if (paymentRules.payOnDelivery) available.push('PAY_ON_DELIVERY');
    if (available.length === 0) {
      setPaymentMode('FULL_UPFRONT');
      return;
    }
    setPaymentMode((prev) => (available.includes(prev) ? prev : available[0]));
  }, [paymentRules]);

  const isGuest = !user;

  // Pré-remplir le téléphone uniquement si l'utilisateur en a fourni un à l'inscription (pas de placeholder type seed).
  const placeholderPhone = '+22997000000';
  useEffect(() => {
    if (!user || !token) return;
    if (phone.trim()) return;

    let cancelled = false;

    (async () => {
      try {
        const res = await fetch('/api/auth/me', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        if (!res.ok) return;
        const data = await res.json();
        const fromProfile = (data?.phone ?? '').toString().trim();
        const isRealPhone = fromProfile && fromProfile !== placeholderPhone;
        if (!cancelled && isRealPhone && !phone.trim()) {
          setPhone(fromProfile.slice(0, 20));
        }
      } catch {
        // en cas d'erreur, on n'empêche pas l'utilisateur de saisir son téléphone manuellement
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user, token, phone]);

  const handleQuantityChange = (value: number) => {
    const q = Math.max(1, Math.min(999, value));
    setQuantity(q);
  };

  async function handleUseMyLocation() {
    if (!navigator.geolocation) {
      setLocationError(t('locationError'));
      return;
    }
    setLocationError(null);
    setLocationLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        setLocationCoords({ lat, lng });
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
            { headers: { 'Accept-Language': 'fr,en', 'User-Agent': 'AfricaMarketplace-Checkout/1.0' } }
          );
          const data = await res.json();
          if (data?.address) {
            const a = data.address;
            const parts = [a.road, a.house_number, a.street, a.village, a.town, a.city, a.state].filter(Boolean);
            setAddress(parts.slice(0, 3).join(', ') || data.display_name?.slice(0, 300) || '');
            setCity([a.city, a.town, a.village, a.municipality, a.state].find(Boolean) || '');
          }
          setLocationError(null);
        } catch {
          setAddress(`${lat.toFixed(6)}, ${lng.toFixed(6)}`);
          setLocationError(null);
        }
        setLocationLoading(false);
      },
      (err) => {
        setLocationLoading(false);
        setLocationError(err.code === 1 ? t('locationDenied') : t('locationError'));
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const items = fromCart
      ? cartItems.map((i) => ({ productId: i.productId, quantity: i.quantity }))
      : productId && product ? [{ productId, quantity }] : [];
    if (items.length === 0) {
      restoreFromCheckoutBackup();
      reloadFromStorage();
      toast.error(t('cartEmptyDesc'));
      return;
    }
    const curr = fromCart ? (cartItems[0]?.currency ?? CANONICAL_CURRENCY) : (product?.currency ?? CANONICAL_CURRENCY);
    const requiresPayment = paymentMode === 'FULL_UPFRONT' || paymentMode === 'PARTIAL_ADVANCE';
    const needsConversion =
      requiresPayment && !isPaymentAcceptedCurrency(curr);
    if (needsConversion && !conversionAccepted) {
      toast.error(t('acceptConversion').replace('{currency}', formatCurrencyForDisplay(PAYMENT_ACCEPTED_CURRENCIES[0] ?? 'XOF')));
      return;
    }
    const ship: Record<string, unknown> = {
      address: address.trim(),
      city: city.trim(),
      phone: phone.trim() || undefined,
    };
    if (locationCoords) {
      ship.lat = locationCoords.lat;
      ship.lng = locationCoords.lng;
    }
    if (!ship.address || !ship.city) {
      toast.error(t('addressCityRequired'));
      return;
    }
    if (isGuest) {
      const em = email.trim();
      if (!em || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) {
        toast.error(t('emailInvalid'));
        return;
      }
    }
    setSubmitting(true);
    try {
      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const body: Record<string, unknown> = {
        items,
        shippingAddress: ship,
        paymentMode,
        currency: needsConversion ? CANONICAL_CURRENCY : curr,
      };
      if (paymentMode === 'PARTIAL_ADVANCE') {
        body.advancePercent = (rulesOverride?.minAdvancePercent ?? 30);
      }
      if (needsConversion) {
        const cartSubtotal = fromCart ? cartItems.reduce((s, i) => s + i.price * i.quantity, 0) : product!.price * quantity;
        const subtotalXOF = Math.round(convertToXOF(cartSubtotal, curr));
        body.subtotal = subtotalXOF;
        body.shippingAmount = shippingXOF;
        body.total = subtotalXOF + shippingXOF;
      }
      if (isGuest) {
        body.guestEmail = email.trim();
        body.guestFirstName = firstName.trim().slice(0, 100) || null;
        body.guestLastName = lastName.trim().slice(0, 100) || null;
      }
      const currencyForPayment = needsConversion ? CANONICAL_CURRENCY : curr;
      if (requiresPayment && currencyForPayment === 'XOF' && paymentGateway && paymentConfig) {
        if (paymentGateway === 'KKIAPAY' && paymentConfig.kkiapayEnabled) {
          body.paymentGateway = 'KKIAPAY';
        } else if (paymentGateway === 'FEDAPAY' && paymentConfig.fedapayEnabled) {
          body.paymentGateway = 'FEDAPAY';
        }
      }
      const affiliateRef = getAffiliateRef();
      if (affiliateRef) body.referralCode = affiliateRef;
      const res = await fetch('/api/orders', { method: 'POST', headers, body: JSON.stringify(body) });
      const text = await res.text();
      let data: {
        error?: string;
        order?: { orderNumber?: string; id?: string };
        amountToPay?: number;
        kkiapay?: { publicKey: string; sandbox: boolean };
        fedapay?: { publicKey: string; environment: 'sandbox' | 'live' };
      } = {};
      try {
        if (text) data = JSON.parse(text);
      } catch {
        data = { error: 'Réponse serveur invalide' };
      }
      if (!res.ok) throw new Error(data.error ?? 'Erreur');

      if (data.kkiapay?.publicKey && data.order?.orderNumber && typeof data.amountToPay === 'number' && paymentGateway === 'KKIAPAY') {
        const win = typeof window !== 'undefined' ? window : undefined;
        if (!win) throw new Error('Environnement navigateur requis');
        const scriptId = 'kkiapay-sdk';
        if (!document.getElementById(scriptId)) {
          await new Promise<void>((resolve, reject) => {
            const script = document.createElement('script');
            script.id = scriptId;
            script.src = 'https://cdn.kkiapay.me/k.js';
            script.async = true;
            script.onload = () => resolve();
            script.onerror = () => reject(new Error('Chargement KKiaPay impossible'));
            document.body.appendChild(script);
          });
        }
        await new Promise<void>((resolve, reject) => {
          const cleanup = () => {
            try {
              (win as unknown as { removeSuccessListener?: () => void }).removeSuccessListener?.();
              (win as unknown as { removeFailedListener?: () => void }).removeFailedListener?.();
            } catch {}
          };
          (win as unknown as { addSuccessListener?: (cb: (r: { transactionId?: string }) => void) => void }).addSuccessListener?.((response: { transactionId?: string }) => {
            cleanup();
            const txId = response?.transactionId ?? (response as unknown as Record<string, string>)?.transaction_id;
            if (!txId) {
              toast.error('Réponse de paiement invalide');
              setSubmitting(false);
              reject(new Error('transactionId manquant'));
              return;
            }
            (async () => {
              try {
                const verifyRes = await fetch('/api/orders/verify-kkiapay', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
                  body: JSON.stringify({ orderNumber: data.order!.orderNumber, transactionId: txId }),
                });
                const verifyData = await verifyRes.json().catch(() => ({}));
                if (!verifyRes.ok) throw new Error(verifyData.error ?? 'Vérification échouée');
                setOrderNumber(data.order!.orderNumber ?? null);
                clearCart();
                clearAffiliateRef();
                toast.success(t('orderSuccess'));
                resolve();
              } catch (e) {
                toast.error(e instanceof Error ? e.message : 'Vérification échouée');
                reject(e);
              } finally {
                setSubmitting(false);
              }
            })();
          });
          (win as unknown as { addFailedListener?: (cb: (err: unknown) => void) => void }).addFailedListener?.((err: unknown) => {
            cleanup();
            toast.error(err && typeof err === 'object' && 'message' in err ? String((err as { message: string }).message) : t('paymentFailed') ?? 'Paiement échoué');
            setSubmitting(false);
            reject(err);
          });
          (win as unknown as { openKkiapayWidget?: (opts: Record<string, unknown>) => void }).openKkiapayWidget?.({
            amount: String(data.amountToPay),
            key: data.kkiapay!.publicKey,
            sandbox: data.kkiapay!.sandbox,
            position: 'center',
            paymentmethod: 'momo',
            theme: 'green',
          });
        });
      } else if (data.fedapay?.publicKey && data.order?.orderNumber && typeof data.amountToPay === 'number' && paymentGateway === 'FEDAPAY') {
        const win = typeof window !== 'undefined' ? (window as unknown as any) : undefined;
        if (!win) throw new Error('Environnement navigateur requis');
        const scriptId = 'fedapay-checkout';
        if (!document.getElementById(scriptId)) {
          await new Promise<void>((resolve, reject) => {
            const script = document.createElement('script');
            script.id = scriptId;
            script.src = 'https://cdn.fedapay.com/checkout.js?v=1.1.7';
            script.async = true;
            script.onload = () => resolve();
            script.onerror = () => reject(new Error('Chargement FedaPay impossible'));
            document.body.appendChild(script);
          });
        }

        await new Promise<void>((resolve, reject) => {
          try {
            const widget = win.FedaPay.init({
              public_key: data.fedapay!.publicKey,
              environment: data.fedapay!.environment ?? 'sandbox',
              transaction: {
                amount: Math.round(data.amountToPay ?? 0),
                description: `Commande ${data.order!.orderNumber}`,
                custom_metadata: {
                  orderNumber: data.order!.orderNumber,
                },
              },
              customer: {
                email: email || undefined,
                firstname: firstName || undefined,
                lastname: lastName || undefined,
                phone_number: phone
                  ? {
                      number: phone,
                      country: 'BJ',
                    }
                  : undefined,
              },
              onComplete: async ({ reason, transaction }: { reason: number; transaction?: { id?: number } }) => {
                if (reason !== win.FedaPay.CHECKOUT_COMPLETED || !transaction?.id) {
                  toast.error(t('paymentFailed') ?? 'Paiement échoué');
                  setSubmitting(false);
                  reject(new Error('Paiement FedaPay non complété'));
                  return;
                }
                try {
                  const verifyRes = await fetch('/api/orders/verify-fedapay', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
                    body: JSON.stringify({ orderNumber: data.order!.orderNumber, transactionId: transaction.id }),
                  });
                  const verifyData = await verifyRes.json().catch(() => ({}));
                  if (!verifyRes.ok) throw new Error(verifyData.error ?? 'Vérification échouée');
                  setOrderNumber(data.order!.orderNumber ?? null);
                  clearCart();
                  clearAffiliateRef();
                  toast.success(t('orderSuccess'));
                  resolve();
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : 'Vérification échouée');
                  reject(e);
                } finally {
                  setSubmitting(false);
                }
              },
            });
            widget.open();
          } catch (err) {
            setSubmitting(false);
            reject(err);
          }
        });
      } else {
        setOrderNumber(data.order?.orderNumber ?? null);
        clearCart();
        clearAffiliateRef();
        toast.success(t('orderSuccess'));
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setSubmitting(false);
    }
  }

  const hasCheckoutItems = fromCart || (productId && product);
  const waitingForCart = !productId && !cartReady;

  // Succès de commande : afficher en priorité (même si le panier a été vidé après commande depuis le panier)
  if (orderNumber) {
    return (
      <div className="min-h-screen bg-base-200 flex flex-col">
        <header className="navbar bg-base-100 px-2 sm:px-4 min-h-12 py-1 gap-1 flex-nowrap overflow-x-hidden w-full max-w-full">
          <div className="navbar-start shrink-0 min-w-0 max-w-[50%]">
            <AppLogo className="btn btn-ghost btn-sm px-1 truncate max-w-[130px] sm:max-w-none" />
          </div>
          <div className="navbar-end shrink-0 flex-nowrap gap-1">
            <CartLink />
            <ThemeSwitcher />
            <LocaleSwitcher />
          </div>
        </header>
        <main className="container mx-auto p-4 sm:p-6 max-w-full min-w-0 flex-1 max-w-md mx-auto text-center">
          <div className="card bg-base-100 shadow-xl">
            <div className="card-body">
              <h1 className="card-title text-xl justify-center text-success">{t('orderSuccess')}</h1>
              <p className="font-mono font-bold">{t('orderNumberLabel')}: {orderNumber}</p>
              <p className="text-sm opacity-80">
                {isGuest ? 'Un récapitulatif a été envoyé à votre email.' : ''}
              </p>
              <Link href="/catalog" className="btn btn-primary mt-4">{t('catalog')}</Link>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (loading && !fromCart) {
    return (
      <div className="min-h-screen bg-base-200 flex flex-col">
        <header className="navbar bg-base-100 px-2 sm:px-4 min-h-12 py-1 gap-1 flex-nowrap overflow-x-hidden w-full max-w-full">
          <div className="navbar-start shrink-0 min-w-0 max-w-[50%]">
            <AppLogo className="btn btn-ghost btn-sm px-1 truncate max-w-[130px] sm:max-w-none" />
          </div>
          <div className="navbar-end shrink-0 flex-nowrap gap-1">
            <CartLink />
            <ThemeSwitcher />
            <LocaleSwitcher />
          </div>
        </header>
        <main className="container mx-auto p-4 sm:p-6 max-w-full min-w-0 flex-1">
          <span className="loading loading-spinner mx-auto block w-10" />
        </main>
      </div>
    );
  }
  if (waitingForCart) {
    return (
      <div className="min-h-screen bg-base-200 flex flex-col">
        <header className="navbar bg-base-100 px-2 sm:px-4 min-h-12 py-1 gap-1 flex-nowrap overflow-x-hidden w-full max-w-full">
          <div className="navbar-start shrink-0 min-w-0 max-w-[50%]">
            <AppLogo className="btn btn-ghost btn-sm px-1 truncate max-w-[130px] sm:max-w-none" />
          </div>
          <div className="navbar-end shrink-0 flex-nowrap gap-1">
            <CartLink />
            <ThemeSwitcher />
            <LocaleSwitcher />
          </div>
        </header>
        <main className="container mx-auto p-4 sm:p-6 max-w-full min-w-0 flex-1 flex items-center justify-center">
          <span className="loading loading-spinner w-10" />
        </main>
      </div>
    );
  }
  if (!hasCheckoutItems) {
    return (
      <div className="min-h-screen bg-base-200 flex flex-col">
        <header className="navbar bg-base-100 px-2 sm:px-4 min-h-12 py-1 gap-1 flex-nowrap overflow-x-hidden w-full max-w-full">
          <div className="navbar-start shrink-0 min-w-0 max-w-[50%]">
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
              <h1 className="text-xl font-bold">{t('noProduct')}</h1>
              <p className="text-base-content/70">{t('cartEmptyDesc')}</p>
              <div className="flex gap-2 justify-center mt-4">
                <Link href="/cart" className="btn btn-outline">{t('cart')}</Link>
                <Link href="/catalog" className="btn btn-primary">{t('catalog')}</Link>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  const subtotal = fromCart ? cartItems.reduce((s, i) => s + i.price * i.quantity, 0) : product!.price * quantity;
  const shippingAmount = shippingFee?.amountInCurrency ?? 0;
  const total = subtotal + shippingAmount;
  const needsConversion =
    (paymentMode === 'FULL_UPFRONT' || paymentMode === 'PARTIAL_ADVANCE') &&
    !isPaymentAcceptedCurrency(productCurrency);
  const subtotalXOF = needsConversion ? Math.round(convertToXOF(subtotal, productCurrency)) : 0;
  const shippingXOF = shippingFee?.amountXOF ?? 0;
  const totalXOF = needsConversion ? subtotalXOF + shippingXOF : 0;
  const advanceXOF =
    needsConversion && paymentMode === 'PARTIAL_ADVANCE'
      ? Math.round((totalXOF * (rulesOverride?.minAdvancePercent ?? 30)) / 100)
      : needsConversion && paymentMode === 'FULL_UPFRONT'
        ? totalXOF
        : 0;

  return (
    <div className="min-h-screen bg-base-200 flex flex-col">
      <header className="navbar bg-base-100 px-2 sm:px-4 min-h-12 py-1 gap-1 flex-nowrap overflow-x-hidden w-full max-w-full">
        <div className="navbar-start shrink-0 min-w-0 max-w-[50%]">
          <AppLogo className="btn btn-ghost btn-sm px-1 truncate max-w-[130px] sm:max-w-none" />
        </div>
        <div className="navbar-end shrink-0 flex-nowrap gap-1">
          <CartLink />
          <ThemeSwitcher />
          <LocaleSwitcher />
        </div>
      </header>
      <main className="container mx-auto p-4 sm:p-6 max-w-full min-w-0 flex-1 max-w-lg">
        <h1 className="text-2xl font-bold mb-4 break-words">{t('checkoutTitle')}</h1>
        <div className="card bg-base-100 shadow-xl mb-6">
          <div className="card-body p-4 sm:p-6">
            {fromCart ? (
              <ul className="space-y-2">
                {cartItems.map((i) => (
                  <li key={i.productId} className="flex justify-between items-center gap-2 py-1 border-b border-base-300 last:border-0">
                    <span className="font-medium break-words">{i.name}</span>
                    <span className="text-primary font-bold shrink-0">{formatNumberForLocale(i.price, locale)} × {i.quantity}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <>
                <p className="font-semibold break-words">{product!.name}</p>
                <div className="flex flex-wrap items-center gap-3 mt-2">
                  <label className="flex items-center gap-2">
                    <span className="text-sm font-medium">{t('quantity')}:</span>
                    <div className="join">
                      <button
                        type="button"
                        className="btn btn-sm btn-outline join-item"
                        onClick={() => handleQuantityChange(quantity - 1)}
                        aria-label="-"
                      >
                        −
                      </button>
                      <input
                        type="number"
                        min={1}
                        max={999}
                        className="input input-bordered input-sm join-item w-16 text-center"
                        value={quantity}
                        onChange={(e) => handleQuantityChange(parseInt(e.target.value, 10) || 1)}
                      />
                      <button
                        type="button"
                        className="btn btn-sm btn-outline join-item"
                        onClick={() => handleQuantityChange(quantity + 1)}
                        aria-label="+"
                      >
                        +
                      </button>
                    </div>
                  </label>
                </div>
                <p className="text-primary font-bold mt-2">{formatNumberForLocale(product!.price, locale)} × {quantity} = {formatNumberForLocale(subtotal, locale)} {formatCurrencyForDisplay(productCurrency)}</p>
              </>
            )}
            <p className="text-sm opacity-80">+ {formatNumberForLocale(shippingAmount, locale)} {formatCurrencyForDisplay(productCurrency)} {t('shipping')}</p>
            <p className="font-bold">{t('total')}: {formatNumberForLocale(total, locale)} {formatCurrencyForDisplay(productCurrency)}</p>
          </div>
        </div>
        {needsConversion && (
          <div className="alert alert-warning mb-4 text-sm">
            <span>{t('paymentCurrencyNotSupported').replace('{currency}', formatCurrencyForDisplay(productCurrency))}</span>
            <p className="mt-2 font-medium">{t('payInAcceptedCurrency').replace('{currency}', formatCurrencyForDisplay(PAYMENT_ACCEPTED_CURRENCIES[0] ?? 'XOF'))}</p>
            <p className="mt-1 opacity-90">{t('convertedAmount')}: {formatNumberForLocale(totalXOF, locale)} {formatCurrencyForDisplay('XOF')}</p>
            <label className="flex items-center gap-2 mt-3 cursor-pointer">
              <input
                type="checkbox"
                className="checkbox checkbox-sm"
                checked={conversionAccepted}
                onChange={(e) => setConversionAccepted(e.target.checked)}
              />
              <span>{t('acceptConversion').replace('{currency}', formatCurrencyForDisplay(PAYMENT_ACCEPTED_CURRENCIES[0] ?? 'XOF'))}</span>
            </label>
          </div>
        )}
        <form onSubmit={handleSubmit} className="card bg-base-100 shadow-xl">
          <div className="card-body p-4 sm:p-6">
            {isGuest && (
              <>
                <h2 className="font-semibold text-lg">{t('guestCheckout')}</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder={t('firstName')}
                    className="input input-bordered min-w-0"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value.slice(0, 100))}
                    maxLength={100}
                  />
                  <input
                    type="text"
                    placeholder={t('lastName')}
                    className="input input-bordered min-w-0"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value.slice(0, 100))}
                    maxLength={100}
                  />
                </div>
                <input
                  type="email"
                  placeholder={t('email')}
                  className="input input-bordered w-full min-w-0"
                  value={email}
                  onChange={(e) => setEmail(e.target.value.slice(0, 255))}
                  required={isGuest}
                  maxLength={255}
                />
              </>
            )}
            <h2 className="font-semibold text-lg mt-2">{t('paymentModes')}</h2>
            <div className="space-y-2 text-sm">
              {!rulesOverride && (
                <p className="opacity-70">{t('loading')}</p>
              )}
              {rulesOverride && (
                <>
                  {rulesOverride.fullUpfront && (
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="radio"
                        className="radio radio-primary mt-1"
                        checked={paymentMode === 'FULL_UPFRONT'}
                        onChange={() => setPaymentMode('FULL_UPFRONT')}
                      />
                      <span>
                        <span className="font-medium">{t('fullUpfront')}</span>
                        <span className="block text-xs opacity-70">
                          {t('total')}: {formatNumberForLocale(total, locale)} {formatCurrencyForDisplay(productCurrency)}
                        </span>
                      </span>
                    </label>
                  )}
                  {rulesOverride.partialAdvance && (
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="radio"
                        className="radio radio-primary mt-1"
                        checked={paymentMode === 'PARTIAL_ADVANCE'}
                        onChange={() => setPaymentMode('PARTIAL_ADVANCE')}
                      />
                      <span>
                        <span className="font-medium">{t('partialAdvance')}</span>
                        <span className="block text-xs opacity-70">
                          {rulesOverride.minAdvancePercent}% {t('minAdvancePercent')} {needsConversion
                            ? `${formatNumberForLocale(Math.round((totalXOF * rulesOverride.minAdvancePercent) / 100), locale)} ${formatCurrencyForDisplay('XOF')}`
                            : `${formatNumberForLocale(total * rulesOverride.minAdvancePercent / 100, locale)} ${formatCurrencyForDisplay(productCurrency)}`}
                        </span>
                      </span>
                    </label>
                  )}
                  {rulesOverride.payOnDelivery && (
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="radio"
                        className="radio radio-primary mt-1"
                        checked={paymentMode === 'PAY_ON_DELIVERY'}
                        onChange={() => setPaymentMode('PAY_ON_DELIVERY')}
                      />
                      <span>
                        <span className="font-medium">{t('payOnDelivery')}</span>
                        <span className="block text-xs opacity-70">
                          {t('shippingAddress')}
                        </span>
                      </span>
                    </label>
                  )}
                </>
              )}
            </div>
            {paymentConfig?.kkiapayEnabled || paymentConfig?.fedapayEnabled ? (
              <div className="mt-4">
                <h2 className="font-semibold text-lg">{t('paymentProvider')}</h2>
                <div className="space-y-1 text-sm mt-1">
                  {paymentConfig.kkiapayEnabled && (
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        className="radio radio-primary radio-sm"
                        checked={paymentGateway === 'KKIAPAY'}
                        onChange={() => setPaymentGateway('KKIAPAY')}
                      />
                      <span>KKiaPay (Mobile Money, cartes)</span>
                    </label>
                  )}
                  {paymentConfig.fedapayEnabled && (
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        className="radio radio-primary radio-sm"
                        checked={paymentGateway === 'FEDAPAY'}
                        onChange={() => setPaymentGateway('FEDAPAY')}
                      />
                      <span>FedaPay (Mobile Money, cartes)</span>
                    </label>
                  )}
                </div>
              </div>
            ) : null}
            <h2 className="font-semibold text-lg mt-4">{t('shippingAddress')}</h2>
            <div className="flex flex-wrap gap-2 items-start">
              <input
                type="text"
                placeholder={t('address')}
                className="input input-bordered flex-1 min-w-0"
                value={address}
                onChange={(e) => setAddress(e.target.value.slice(0, 300))}
                required
                maxLength={300}
              />
              <button
                type="button"
                className="btn btn-outline btn-sm gap-1 shrink-0"
                onClick={handleUseMyLocation}
                disabled={locationLoading}
                title={t('useMyLocation')}
              >
                {locationLoading ? (
                  <span className="loading loading-spinner loading-sm" />
                ) : (
                  <span aria-hidden>📍</span>
                )}
                <span className="hidden sm:inline">{t('useMyLocation')}</span>
              </button>
            </div>
            {locationCoords && (
              <p className="text-sm text-success flex items-center gap-1">
                <span aria-hidden>✓</span> {t('locationSuccess')}: {locationCoords.lat.toFixed(5)}, {locationCoords.lng.toFixed(5)}
              </p>
            )}
            {locationError && (
              <p className="text-sm text-error">{locationError}</p>
            )}
            <input
              type="text"
              placeholder={t('city')}
              className="input input-bordered w-full min-w-0"
              value={city}
              onChange={(e) => setCity(e.target.value.slice(0, 100))}
              required
              maxLength={100}
            />
            <input
              type="tel"
              placeholder={`${t('phoneLabel')} *`}
              className="input input-bordered w-full min-w-0"
              value={phone}
              onChange={(e) => setPhone(e.target.value.slice(0, 20))}
              maxLength={20}
              required
            />
            <button
              type="submit"
              className="btn btn-primary w-full"
              disabled={submitting || (needsConversion && !conversionAccepted)}
            >
              {submitting ? '...' : t('confirmOrder')}
            </button>
          </div>
        </form>
        <p className="text-sm mt-4 text-center">
          <Link href="/catalog" className="link">← {t('catalog')}</Link>
        </p>
      </main>
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-base-200 flex items-center justify-center"><span className="loading loading-spinner" /></div>}>
      <CheckoutContent />
    </Suspense>
  );
}
