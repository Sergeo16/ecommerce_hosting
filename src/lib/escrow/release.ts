/**
 * Logique de libération escrow : après livraison confirmée ou résolution litige.
 */

import { prisma } from "@/lib/db";

export async function releaseEscrow(
  orderId: string,
  reason: "DELIVERY_CONFIRMED" | "DISPUTE_WON_SELLER" | "REFUND"
) {
  return prisma.escrowTransaction.updateMany({
    where: { orderId, status: "HELD" },
    data: {
      status: reason === "REFUND" ? "REFUNDED" : "RELEASED",
      releasedAt: new Date(),
      releaseReason: reason,
    },
  });
}

export async function getEscrowByOrder(orderId: string) {
  return prisma.escrowTransaction.findUnique({
    where: { orderId },
  });
}
