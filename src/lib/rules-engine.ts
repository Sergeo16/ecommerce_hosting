/**
 * Moteur de règles configurable par Super Admin
 * Commission, paiement, livraison, feature flags par produit/fournisseur/pays/user
 */
import { prisma } from './db';

export interface PaymentRules {
  fullUpfront: boolean;
  partialAdvance: boolean;
  payOnDelivery: boolean;
  minAdvancePercent: number;
  forcedMode?: 'FULL_UPFRONT' | 'PARTIAL_ADVANCE' | 'PAY_ON_DELIVERY';
}

export interface CommissionRules {
  platformPercent: number;
  maxAffiliatePercent: number;
  courierFixed?: number;
}

const defaults: { payment: PaymentRules; commission: CommissionRules } = {
  payment: {
    fullUpfront: true,
    partialAdvance: true,
    payOnDelivery: true,
    minAdvancePercent: 30,
  },
  commission: {
    platformPercent: 5,
    maxAffiliatePercent: 30,
    courierFixed: 1500,
  },
};

export async function getPaymentRules(opts?: {
  productId?: string;
  companyId?: string;
  country?: string;
  userId?: string;
}): Promise<PaymentRules> {
  const global = await getSettingJson<PaymentRules>('payment_modes', defaults.payment);
  if (!opts) return global;
  // Règles par produit
  if (opts.productId) {
    const productRule = await getSettingJson<PaymentRules | null>(`payment_product_${opts.productId}`, null);
    if (productRule) return { ...global, ...productRule };
  }
  // Règles par fournisseur
  if (opts.companyId) {
    const companyRule = await getSettingJson<PaymentRules | null>(`payment_company_${opts.companyId}`, null);
    if (companyRule) return { ...global, ...companyRule };
  }
  // Règles par pays
  if (opts.country) {
    const countryRule = await getSettingJson<PaymentRules | null>(`payment_country_${opts.country}`, null);
    if (countryRule) return { ...global, ...countryRule };
  }
  // Règles par user
  if (opts.userId) {
    const userRule = await getSettingJson<PaymentRules | null>(`payment_user_${opts.userId}`, null);
    if (userRule) return { ...global, ...userRule };
  }
  return global;
}

export async function getCommissionRules(opts?: { productId?: string; companyId?: string }): Promise<CommissionRules> {
  const global = await getSettingJson<CommissionRules>('commission_rules', defaults.commission);
  if (opts?.productId) {
    const productRule = await getSettingJson<CommissionRules | null>(`commission_product_${opts.productId}`, null);
    if (productRule) return { ...global, ...productRule };
  }
  if (opts?.companyId) {
    const companyRule = await getSettingJson<CommissionRules | null>(`commission_company_${opts.companyId}`, null);
    if (companyRule) return { ...global, ...companyRule };
  }
  return global;
}

async function getSettingJson<T>(key: string, defaultValue: T): Promise<T> {
  const row = await prisma.settings.findUnique({ where: { key } });
  if (!row?.value) return defaultValue;
  return row.value as unknown as T;
}

export async function isFeatureEnabled(
  feature: string,
  opts?: { role?: string; userId?: string }
): Promise<boolean> {
  const flags = await getSettingJson<Record<string, boolean>>('feature_flags', {});
  const global = flags[feature];
  if (opts?.userId) {
    const userFlag = await getSettingJson<boolean>(`feature_${feature}_user_${opts.userId}`, undefined as unknown as boolean);
    if (userFlag !== undefined) return userFlag;
  }
  if (opts?.role) {
    const roleFlag = await getSettingJson<boolean>(`feature_${feature}_role_${opts.role}`, undefined as unknown as boolean);
    if (roleFlag !== undefined) return roleFlag;
  }
  return global ?? true;
}

export async function getTheme(): Promise<string> {
  const row = await prisma.settings.findUnique({ where: { key: 'theme' } });
  return (row?.value as string) ?? 'business';
}

export async function getDeliveryTrackingEnabled(): Promise<boolean> {
  const v = await getSettingJson<boolean>('delivery_tracking_enabled', true);
  return v !== false;
}

/** Par défaut false : masquer l'identité des fournisseurs pour que les clients passent par la plateforme (commissions). */
export async function getSupplierIdentityVisible(): Promise<boolean> {
  const v = await getSettingJson<boolean>('supplier_identity_visible', false);
  return v === true;
}
