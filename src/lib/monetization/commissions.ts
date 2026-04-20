/**
 * Commissions dynamiques : résolution du % plateforme selon
 * catégorie, fournisseur, volume, zone, abonnement vendeur.
 * S'appuie sur CommissionRule (Prisma) et/ou Settings (clés commission_*).
 *
 * Commission affilié : ordre de priorité
 * 1. Override commande (affiliateOverridePercent | affiliateOverrideAmount)
 * 2. Override lien affilié (commissionPercent | commissionAmount)
 * 3. Paramètre admin par défaut (affiliate_default_commission)
 * 4. Fallback 10%
 */

import { prisma } from "@/lib/db";

export type AffiliateCommissionConfig = { type: 'PERCENT'; value: number } | { type: 'AMOUNT'; value: number };

const DEFAULT_AFFILIATE_PERCENT = 10;

async function getSettingJson<T>(key: string): Promise<T | null> {
  const row = await prisma.settings.findUnique({ where: { key } });
  if (!row?.value) return null;
  return row.value as unknown as T;
}

/** Commission affilié par défaut définie par l'admin (Settings). */
export async function getAffiliateDefaultCommission(): Promise<AffiliateCommissionConfig | null> {
  const raw = await getSettingJson<{ type?: string; percent?: number; amount?: number; value?: number }>('affiliate_default_commission');
  if (!raw || typeof raw !== 'object') return null;
  if (raw.type === 'AMOUNT' && (typeof raw.amount === 'number' || typeof raw.value === 'number')) {
    const v = typeof raw.amount === 'number' ? raw.amount : (raw.value ?? 0);
    return v >= 0 ? { type: 'AMOUNT', value: v } : null;
  }
  if ((raw.type === 'PERCENT' || !raw.type) && (typeof raw.percent === 'number' || typeof raw.value === 'number')) {
    const v = typeof raw.percent === 'number' ? raw.percent : (raw.value ?? 0);
    return v >= 0 && v <= 100 ? { type: 'PERCENT', value: v } : null;
  }
  return null;
}

/** Si true, les nouvelles commissions sont créées en ON_HOLD (bloquées) pour vérification admin. */
export async function areCommissionsHeldForVerification(): Promise<boolean> {
  const v = await getSettingJson<boolean>('commissions_hold_for_verification');
  return v === true;
}

/** Si true, les paiements fournisseurs sont créés en ON_HOLD. Sinon APPROVED par défaut. */
export async function areSupplierPayoutsHeldForVerification(): Promise<boolean> {
  const v = await getSettingJson<boolean>('supplier_payouts_hold_for_verification');
  return v === true;
}

export type CommissionAccessDelay = { value: number; unit: 'seconds' | 'minutes' | 'hours' | 'days' | 'months' };

/** Délai configuré par l'admin avant que les commissions APPROVED soient accessibles. Par défaut 0 seconde. */
export async function getCommissionAccessDelay(): Promise<CommissionAccessDelay> {
  const raw = await getSettingJson<{ value?: number; unit?: string }>('commission_access_delay');
  if (!raw || typeof raw !== 'object' || typeof raw.value !== 'number' || raw.value <= 0)
    return { value: 0, unit: 'seconds' };
  const unit = ['seconds', 'minutes', 'hours', 'days', 'months'].includes(raw.unit ?? '')
    ? (raw.unit as CommissionAccessDelay['unit'])
    : 'seconds';
  return { value: raw.value, unit };
}

/** Date de coupure : les commissions créées avant cette date sont accessibles (avec délai appliqué). */
export async function getCommissionAvailableCutoff(): Promise<Date> {
  const d = await getCommissionAccessDelay();
  if (d.value <= 0) return new Date(); // tout est accessible immédiatement
  const now = Date.now();
  let ms: number;
  switch (d.unit) {
    case 'seconds': ms = d.value * 1000; break;
    case 'minutes': ms = d.value * 60 * 1000; break;
    case 'hours': ms = d.value * 3600 * 1000; break;
    case 'days': ms = d.value * 86400 * 1000; break;
    case 'months': ms = d.value * 30 * 86400 * 1000; break; // ~30 jours
    default: ms = 0;
  }
  return new Date(now - ms);
}

/**
 * Résout la config de commission affilié pour une commande.
 * Priorité : commande > lien affilié > admin par défaut > 10%.
 */
export function resolveAffiliateCommissionForOrder(opts: {
  orderOverridePercent?: number | null;
  orderOverrideAmount?: number | null;
  linkCommissionPercent?: number | null;
  linkCommissionAmount?: number | null;
  defaultConfig: AffiliateCommissionConfig | null;
}): AffiliateCommissionConfig {
  const { orderOverridePercent, orderOverrideAmount, linkCommissionPercent, linkCommissionAmount, defaultConfig } = opts;
  if (orderOverrideAmount != null && orderOverrideAmount >= 0)
    return { type: 'AMOUNT', value: orderOverrideAmount };
  if (orderOverridePercent != null && orderOverridePercent >= 0 && orderOverridePercent <= 100)
    return { type: 'PERCENT', value: orderOverridePercent };
  if (linkCommissionAmount != null && Number(linkCommissionAmount) >= 0)
    return { type: 'AMOUNT', value: Number(linkCommissionAmount) };
  if (linkCommissionPercent != null && Number(linkCommissionPercent) >= 0 && Number(linkCommissionPercent) <= 100)
    return { type: 'PERCENT', value: Number(linkCommissionPercent) };
  if (defaultConfig) return defaultConfig;
  return { type: 'PERCENT', value: DEFAULT_AFFILIATE_PERCENT };
}

export type CommissionContext = {
  categoryId?: string | null;
  companyProfileId: string;
  orderTotal: number;
  zoneId?: string | null;
  sellerPlanSlug?: "FREE" | "PRO" | "ELITE";
};

export async function getPlatformCommissionPercent(
  ctx: CommissionContext
): Promise<number> {
  // 1. Règle spécifique vendeur (abonnement Pro/Elite)
  if (ctx.sellerPlanSlug && ctx.sellerPlanSlug !== "FREE") {
    const plan = await prisma.sellerSubscriptionPlan.findUnique({
      where: { slug: ctx.sellerPlanSlug },
    });
    if (plan?.commissionPercentOverride != null) {
      return Number(plan.commissionPercentOverride);
    }
  }

  // 2. Règle par company
  const companyRule = await prisma.commissionRule.findFirst({
    where: { scope: "COMPANY", scopeId: ctx.companyProfileId, isActive: true },
    orderBy: { updatedAt: "desc" },
  });
  if (companyRule) return Number(companyRule.platformPercent);

  // 3. Règle par catégorie
  if (ctx.categoryId) {
    const catRule = await prisma.commissionRule.findFirst({
      where: { scope: "CATEGORY", scopeId: ctx.categoryId, isActive: true },
      orderBy: { updatedAt: "desc" },
    });
    if (catRule) return Number(catRule.platformPercent);
  }

  // 4. Règle globale
  const globalRule = await prisma.commissionRule.findFirst({
    where: { scope: "GLOBAL", isActive: true },
    orderBy: { updatedAt: "desc" },
  });
  if (globalRule) return Number(globalRule.platformPercent);

  // 5. Paramètre admin (Settings platform_commission_percent ou commission_rules.platformPercent)
  const platformSetting = await getSettingJson<number>('platform_commission_percent');
  if (typeof platformSetting === 'number' && platformSetting >= 0 && platformSetting <= 100) {
    return platformSetting;
  }
  const commissionRules = await getSettingJson<{ platformPercent?: number }>('commission_rules');
  if (commissionRules && typeof commissionRules === 'object' && typeof commissionRules.platformPercent === 'number' && commissionRules.platformPercent >= 0 && commissionRules.platformPercent <= 100) {
    return commissionRules.platformPercent;
  }

  // 6. Défaut (10%) - uniquement si aucun paramètre admin
  return 10;
}
