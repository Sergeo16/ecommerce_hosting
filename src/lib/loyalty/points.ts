/**
 * Points fidélité : crédit selon programme (pointsPerXof), échange, historique.
 */

import { prisma } from "@/lib/db";

export async function getOrCreateUserPoints(userId: string) {
  const program = await prisma.loyaltyProgram.findFirst({
    where: { isActive: true },
  });
  if (!program) return null;

  let up = await prisma.userLoyaltyPoints.findUnique({
    where: { userId },
    include: { program: true },
  });
  if (!up) {
    up = await prisma.userLoyaltyPoints.create({
      data: {
        userId,
        programId: program.id,
        points: 0,
        lifetimeEarned: 0,
      },
      include: { program: true },
    });
  }
  return up;
}

export function pointsForAmount(amountXof: number, pointsPerXof: number): number {
  return Math.floor(amountXof / pointsPerXof);
}
