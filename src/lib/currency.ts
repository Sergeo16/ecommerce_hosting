/**
 * Devises : chaque produit a sa devise source (choisie par le fournisseur).
 * Le système de paiement (Mobile Money, KkiaPay, etc.) n'accepte que certaines devises.
 * Si la devise du produit n'est pas acceptée, on notifie le client et on propose une conversion
 * vers une devise acceptée avant validation.
 */

export const CANONICAL_CURRENCY = 'XOF' as const;

/** Devises acceptées par le système de paiement (ex. Mobile Money / KkiaPay). */
export const PAYMENT_ACCEPTED_CURRENCIES: string[] = ['XOF'];

/** 1 unité de devise → XOF (ex. 1 EUR = 655.957 XOF). À configurer côté admin si besoin. */
export const RATE_TO_XOF: Record<string, number> = {
  XOF: 1,
  EUR: 655.957,
  USD: 600,
};

/** Normalise un libellé de devise vers un code canonique.
 * Exemple : "CFA", "F CFA", "FCFA" → "XOF".
 */
export function normalizeCurrencyCode(input: string): string {
  const raw = String(input ?? '').trim().toUpperCase();
  const compact = raw.replace(/\s+/g, '');
  if (compact === 'CFA' || compact === 'FCFA') return 'XOF';
  return compact;
}

/**
 * Formate un nombre selon la locale : en français, séparateur de milliers "." (ex: 10.000).
 */
export function formatNumberForLocale(n: number, locale: 'fr' | 'en', options?: { minFraction?: number; maxFraction?: number }): string {
  const { minFraction = 0, maxFraction = 2 } = options ?? {};
  const formatted = n.toLocaleString(locale === 'fr' ? 'fr-FR' : 'en-US', {
    minimumFractionDigits: minFraction,
    maximumFractionDigits: maxFraction,
  });
  if (locale === 'fr') {
    return formatted.replace(/\s/g, '.');
  }
  return formatted;
}

/** Affichage user : XOF → "F CFA", les autres devises inchangées. */
export function formatCurrencyForDisplay(currency: string): string {
  const code = normalizeCurrencyCode(currency);
  return code === 'XOF' ? 'F CFA' : (currency || '').trim() || code;
}

/** Indique si la devise est acceptée pour le paiement en ligne. */
export function isPaymentAcceptedCurrency(currency: string): boolean {
  const code = normalizeCurrencyCode(currency);
  return PAYMENT_ACCEPTED_CURRENCIES.includes(code);
}

/** Convertit un montant de la devise source vers XOF. */
export function convertToXOF(amount: number, fromCurrency: string): number {
  const code = normalizeCurrencyCode(fromCurrency);
  const rate = RATE_TO_XOF[code] ?? 1;
  return amount * rate;
}

/** Montant de livraison fixe en XOF (utilisé quand la commande est convertie en XOF). */
export const SHIPPING_AMOUNT_XOF = 2000;

/** Livraison dans une autre devise : équivalent de SHIPPING_AMOUNT_XOF (pour affichage / commande en devise produit). */
export function shippingInCurrency(currency: string): number {
  const code = normalizeCurrencyCode(currency);
  if (code === 'XOF') return SHIPPING_AMOUNT_XOF;
  const rate = RATE_TO_XOF[code];
  if (!rate || rate <= 0) return SHIPPING_AMOUNT_XOF;
  return Math.round((SHIPPING_AMOUNT_XOF / rate) * 100) / 100;
}
