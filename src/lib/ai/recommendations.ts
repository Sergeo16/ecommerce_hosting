/**
 * Recommandations produits : similaires, cross-sell, upsell.
 * À enrichir avec embeddings / co-views selon données.
 */

import { prisma } from "@/lib/db";

export async function getRecommendedProductIds(
  productId: string,
  limit = 6
): Promise<string[]> {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { categoryId: true, companyProfileId: true },
  });
  if (!product) return [];

  const others = await prisma.product.findMany({
    where: {
      isActive: true,
      id: { not: productId },
      OR: [
        { categoryId: product.categoryId ?? undefined },
        { companyProfileId: product.companyProfileId },
      ],
    },
    select: { id: true },
    take: limit,
  });
  return others.map((p) => p.id);
}
