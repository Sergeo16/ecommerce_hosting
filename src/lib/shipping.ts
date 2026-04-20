/**
 * Frais de livraison : configurés par l'admin
 * - Montant par défaut (s'applique à toutes les commandes)
 * - Override par fournisseur (companyProfileId)
 * - 0 = livraison gratuite
 */
import { prisma } from '@/lib/db';
import { RATE_TO_XOF } from './currency';

const DEFAULT_SHIPPING_XOF = 2000;

export async function getShippingAmountXOF(companyProfileId?: string): Promise<number> {
  const settings = await prisma.settings.findMany({
    where: {
      key: {
        in: ['delivery_fee_default', 'delivery_fee_suppliers'],
      },
    },
  });
  const byKey = Object.fromEntries(settings.map((s) => [s.key, s.value]));

  const defaultAmount = typeof byKey.delivery_fee_default === 'number' ? byKey.delivery_fee_default : DEFAULT_SHIPPING_XOF;
  const supplierOverrides = (byKey.delivery_fee_suppliers as Record<string, number>) ?? {};

  if (companyProfileId && supplierOverrides[companyProfileId] !== undefined) {
    const override = supplierOverrides[companyProfileId];
    return typeof override === 'number' ? Math.max(0, override) : defaultAmount;
  }
  return typeof defaultAmount === 'number' ? Math.max(0, defaultAmount) : DEFAULT_SHIPPING_XOF;
}

/** Montant livraison dans la devise donnée (pour affichage / commande). */
export function shippingInCurrency(amountXOF: number, currency: string): number {
  if (amountXOF === 0) return 0;
  if (currency.toUpperCase() === 'XOF') return amountXOF;
  const rate = RATE_TO_XOF[currency.toUpperCase()];
  if (!rate || rate <= 0) return amountXOF;
  return Math.round((amountXOF / rate) * 100) / 100;
}
