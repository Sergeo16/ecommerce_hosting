/**
 * Création et validation des commissions affilié et plateforme
 * dès que la livraison est confirmée avec succès.
 * Applicable quel que soit le mode de paiement ou le canal d'achat (direct, panier).
 *
 * Commission affilié : priorité commande > lien > admin par défaut > produit/fournisseur > 10%
 */

import { prisma } from '@/lib/db';
import { computeCourierCommissionAmount } from './courier-commission';
import {
  getPlatformCommissionPercent,
  getAffiliateDefaultCommission,
  resolveAffiliateCommissionForOrder,
  areCommissionsHeldForVerification,
  areSupplierPayoutsHeldForVerification,
} from './commissions';

const DEFAULT_AFFILIATE_PERCENT = 10;

/**
 * Crée et approuve les commissions (plateforme + affilié + livreur) pour une commande
 * dont la livraison vient d'être confirmée. Par défaut disponibles dans les dashboards.
 * Si l'admin a activé "bloquer pour vérification", les commissions sont en ON_HOLD.
 */
export async function approveCommissionsOnDelivery(orderId: string): Promise<void> {
  const [order, delivery, held, supplierHeld] = await Promise.all([
    prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: { include: { product: { select: { categoryId: true } } } },
        companyProfile: true,
        affiliateLink: { select: { id: true, userId: true, commissionPercent: true, commissionAmount: true } },
        commissions: true,
      },
    }),
    prisma.delivery.findUnique({ where: { orderId } }),
    areCommissionsHeldForVerification(),
    areSupplierPayoutsHeldForVerification(),
  ]);

  if (!order || order.items.length === 0) return;

  const subtotal = Number(order.subtotal);
  const shippingAmount = Number(order.shippingAmount ?? 0);
  const orderTotal = subtotal + shippingAmount;
  if (orderTotal <= 0) return;

  const status = held ? 'ON_HOLD' : 'APPROVED';

  const firstItemCategoryId = order.items[0]?.product?.categoryId ?? null;
  const platformPercent = await getPlatformCommissionPercent({
    companyProfileId: order.companyProfileId,
    orderTotal,
    categoryId: firstItemCategoryId,
  });

  const platformAmountGross = Math.round((orderTotal * platformPercent) / 100 * 100) / 100;

  const existingPlatform = order.commissions.find((c) => c.type === 'PLATFORM');
  const existingAffiliate = order.commissions.find((c) => c.type === 'AFFILIATE');
  const existingCourier = order.commissions.find((c) => c.type === 'COURIER');

  // 1. Calculer la commission affilié
  let affiliateAmount = 0;
  let percentUsed: number | null = null;

  if (order.affiliateLinkId && order.affiliateLink) {
    const defaultConfig = await getAffiliateDefaultCommission();
    const resolved = resolveAffiliateCommissionForOrder({
      orderOverridePercent: order.affiliateOverridePercent != null ? Number(order.affiliateOverridePercent) : null,
      orderOverrideAmount: order.affiliateOverrideAmount != null ? Number(order.affiliateOverrideAmount) : null,
      linkCommissionPercent: order.affiliateLink.commissionPercent != null ? Number(order.affiliateLink.commissionPercent) : null,
      linkCommissionAmount: order.affiliateLink.commissionAmount != null ? Number(order.affiliateLink.commissionAmount) : null,
      defaultConfig,
    });

    if (resolved.type === 'AMOUNT') {
      affiliateAmount = Math.round(resolved.value * 100) / 100;
      percentUsed = null;
    } else {
      const hasOrderLinkOrDefaultOverride =
        order.affiliateOverridePercent != null || order.affiliateOverrideAmount != null ||
        order.affiliateLink.commissionPercent != null || order.affiliateLink.commissionAmount != null ||
        defaultConfig != null;
      if (hasOrderLinkOrDefaultOverride) {
        affiliateAmount = Math.round((orderTotal * resolved.value) / 100 * 100) / 100;
        percentUsed = resolved.value;
      } else {
        // Fallback : par ligne (produit > fournisseur > 10%)
        affiliateAmount = 0;
        percentUsed = DEFAULT_AFFILIATE_PERCENT;
        for (const item of order.items) {
          const pct =
            item.affiliateCommissionPercent != null
              ? Number(item.affiliateCommissionPercent)
              : order.companyProfile?.defaultAffiliateCommissionPercent != null
                ? Number(order.companyProfile.defaultAffiliateCommissionPercent)
                : DEFAULT_AFFILIATE_PERCENT;
          affiliateAmount += (Number(item.total) * pct) / 100;
          percentUsed = pct;
        }
        affiliateAmount = Math.round(affiliateAmount * 100) / 100;
      }
    }

    if (affiliateAmount > 0) {
      if (existingAffiliate) {
        await prisma.commission.update({
          where: { id: existingAffiliate.id },
          data: { status, amount: affiliateAmount, percent: percentUsed },
        });
      } else {
        await prisma.commission.create({
          data: {
            orderId,
            affiliateLinkId: order.affiliateLinkId,
            userId: order.affiliateLink.userId,
            type: 'AFFILIATE',
            amount: affiliateAmount,
            percent: percentUsed,
            status,
          },
        });
      }

      await prisma.affiliateLink.update({
        where: { id: order.affiliateLinkId },
        data: { conversionCount: { increment: 1 } },
      });
    }
  }

  // Commission livreur : utiliser delivery.commissionAmount si défini, sinon calculer (fallback si assign manquant ou ancienne livraison)
  let courierCommissionAmount = delivery?.courierId && delivery.commissionAmount != null && Number(delivery.commissionAmount) > 0
    ? Number(delivery.commissionAmount)
    : 0;
  if (delivery?.courierId && courierCommissionAmount <= 0) {
    courierCommissionAmount = await computeCourierCommissionAmount({
      subtotal,
      shippingAmount,
      courierId: delivery.courierId,
    });
    if (courierCommissionAmount > 0) {
      await prisma.delivery.update({
        where: { orderId },
        data: { commissionAmount: courierCommissionAmount },
      });
    }
  }
  if (delivery?.courierId && courierCommissionAmount > 0 && !existingCourier) {
    await prisma.commission.create({
      data: {
        orderId,
        userId: delivery.courierId,
        type: 'COURIER',
        amount: courierCommissionAmount,
        status,
      },
    });
  }

  // Commission plateforme = commission brute - (affilié + livreur)
  const affiliateAmountFinal = existingAffiliate ? Number(existingAffiliate.amount) : affiliateAmount;
  const courierAmountFinal = courierCommissionAmount;
  const platformAmountNet = Math.max(0, Math.round((platformAmountGross - affiliateAmountFinal - courierAmountFinal) * 100) / 100);

  if (existingPlatform) {
    await prisma.commission.update({
      where: { id: existingPlatform.id },
      data: { amount: platformAmountNet, status },
    });
  } else {
    await prisma.commission.create({
      data: {
        orderId,
        type: 'PLATFORM',
        amount: platformAmountNet,
        percent: platformPercent,
        status,
      },
    });
  }

  const existingSupplierPayout = await prisma.supplierPayout.findFirst({
    where: { orderId, companyProfileId: order.companyProfileId },
  });
  const supplierAmount = Math.round((orderTotal - platformAmountNet - affiliateAmountFinal - courierAmountFinal) * 100) / 100;

  if (supplierAmount > 0 && !existingSupplierPayout) {
    const supplierStatus = supplierHeld ? 'ON_HOLD' : 'APPROVED';
    await prisma.supplierPayout.create({
      data: {
        orderId,
        companyProfileId: order.companyProfileId,
        amount: supplierAmount,
        status: supplierStatus,
      },
    });
  }
}
