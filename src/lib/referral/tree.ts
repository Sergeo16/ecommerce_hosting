/**
 * Arbre de parrainage : enregistrement referred, niveau, code.
 */

import { prisma } from "@/lib/db";

export async function registerReferral(params: {
  referrerId: string;
  referredId: string;
  referralCode: string;
}) {
  return prisma.referralTree.create({
    data: {
      referrerId: params.referrerId,
      referredId: params.referredId,
      referralCode: params.referralCode,
      level: 1,
      status: "PENDING",
    },
  });
}

export async function getReferrerStats(referrerId: string) {
  const [total, qualified] = await Promise.all([
    prisma.referralTree.count({ where: { referrerId } }),
    prisma.referralTree.count({
      where: { referrerId, status: "QUALIFIED" },
    }),
  ]);
  return { total, qualified };
}
