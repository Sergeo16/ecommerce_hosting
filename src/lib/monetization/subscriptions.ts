/**
 * Abonnements vendeurs : plans FREE / PRO / ELITE,
 * statut, période courante, Stripe Billing.
 */

import { prisma } from "@/lib/db";

export async function getActiveSubscription(companyProfileId: string) {
  return prisma.sellerSubscription.findUnique({
    where: { companyProfileId },
    include: { plan: true },
  });
}

export function isPremiumPlan(slug: string): boolean {
  return slug === "PRO" || slug === "ELITE";
}
