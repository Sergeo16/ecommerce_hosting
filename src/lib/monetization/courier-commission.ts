/**
 * Commission livreur : configurable par l'admin
 * - Type : montant fixe (F CFA) ou pourcentage
 * - Par défaut pour tous les livreurs, ou override par livreur
 * - Source : prix produit, frais livraison, ou les deux (répartition configurable)
 */
import { prisma } from '@/lib/db';

export type CourierCommissionType = 'AMOUNT' | 'PERCENT';
export type CourierCommissionSource = 'PRODUCT' | 'DELIVERY' | 'BOTH';

export type CourierCommissionConfig = {
  type: CourierCommissionType;
  value: number; // montant XOF ou pourcentage
};

export type CourierCommissionSettings = {
  default: CourierCommissionConfig;
  source: CourierCommissionSource;
  /** Si source=BOTH : % pris sur le produit, le reste sur la livraison (0-100) */
  splitProductPercent: number;
  overrides: Record<string, CourierCommissionConfig>; // userId -> config
};

async function getSettingJson<T>(key: string): Promise<T | null> {
  const row = await prisma.settings.findUnique({ where: { key } });
  if (!row?.value) return null;
  return row.value as unknown as T;
}

const DEFAULT_CONFIG: CourierCommissionConfig = { type: 'AMOUNT', value: 500 };

/**
 * Charge la config complète commission livreur depuis les settings.
 */
export async function getCourierCommissionSettings(): Promise<CourierCommissionSettings> {
  const raw = await getSettingJson<{
    default?: CourierCommissionConfig;
    source?: CourierCommissionSource;
    splitProductPercent?: number;
    overrides?: Record<string, CourierCommissionConfig>;
  }>('courier_commission');

  if (!raw || typeof raw !== 'object') {
    return {
      default: DEFAULT_CONFIG,
      source: 'DELIVERY',
      splitProductPercent: 50,
      overrides: {},
    };
  }

  const def = raw.default && typeof raw.default === 'object'
    ? {
        type: (raw.default.type === 'PERCENT' ? 'PERCENT' : 'AMOUNT') as CourierCommissionType,
        value: typeof raw.default.value === 'number' && raw.default.value >= 0 ? raw.default.value : DEFAULT_CONFIG.value,
      }
    : DEFAULT_CONFIG;

  const source = ['PRODUCT', 'DELIVERY', 'BOTH'].includes(raw.source ?? '') ? raw.source as CourierCommissionSource : 'DELIVERY';
  const split = typeof raw.splitProductPercent === 'number' && raw.splitProductPercent >= 0 && raw.splitProductPercent <= 100
    ? raw.splitProductPercent
    : 50;
  const overrides = raw.overrides && typeof raw.overrides === 'object' ? raw.overrides : {};

  return { default: def, source, splitProductPercent: split, overrides };
}

/**
 * Résout la config à utiliser pour un livreur donné.
 * Priorité : override livreur > config par défaut.
 */
export async function resolveCourierCommissionConfig(courierId: string | null): Promise<CourierCommissionConfig> {
  const settings = await getCourierCommissionSettings();
  if (courierId && settings.overrides[courierId]) {
    const o = settings.overrides[courierId];
    return {
      type: o.type === 'PERCENT' ? 'PERCENT' : 'AMOUNT',
      value: typeof o.value === 'number' && o.value >= 0 ? o.value : settings.default.value,
    };
  }
  return settings.default;
}

/**
 * Calcule le montant de la commission livreur en XOF.
 * @param subtotal Montant produits (order.subtotal) en XOF
 * @param shippingAmount Frais livraison en XOF
 * @param courierId ID du livreur (pour override spécifique)
 */
export async function computeCourierCommissionAmount(opts: {
  subtotal: number;
  shippingAmount: number;
  courierId?: string | null;
}): Promise<number> {
  const { subtotal, shippingAmount, courierId } = opts;
  const settings = await getCourierCommissionSettings();
  const config = await resolveCourierCommissionConfig(courierId ?? null);

  if (config.type === 'AMOUNT' && config.value <= 0) return 0;
  if (config.type === 'PERCENT' && (config.value <= 0 || config.value > 100)) return 0;

  let baseFromProduct = 0;
  let baseFromDelivery = 0;

  switch (settings.source) {
    case 'PRODUCT':
      baseFromProduct = Math.max(0, subtotal);
      break;
    case 'DELIVERY':
      baseFromDelivery = Math.max(0, shippingAmount);
      break;
    case 'BOTH': {
      const productRatio = settings.splitProductPercent / 100;
      baseFromProduct = Math.max(0, subtotal) * productRatio;
      baseFromDelivery = Math.max(0, shippingAmount) * (1 - productRatio);
      break;
    }
  }

  const totalBase = baseFromProduct + baseFromDelivery;
  if (totalBase <= 0) return 0;

  let amount: number;
  if (config.type === 'AMOUNT') {
    amount = config.value;
  } else {
    amount = Math.round((totalBase * config.value) / 100 * 100) / 100;
  }

  return Math.max(0, Math.round(amount * 100) / 100);
}
