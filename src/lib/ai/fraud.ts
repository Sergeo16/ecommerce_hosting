/**
 * Détection fraude : score par commande (règles + optionnel ML).
 * À enrichir avec historique IP, device, montants anormaux.
 */

export type FraudContext = {
  orderTotal: number;
  userId?: string | null;
  guestEmail?: string | null;
  ip?: string | null;
};

export function getFraudScore(ctx: FraudContext): number {
  let score = 0;
  if (!ctx.userId && ctx.guestEmail) score += 20;
  if (ctx.orderTotal > 500_000) score += 15;
  if (ctx.orderTotal > 1_000_000) score += 25;
  return Math.min(100, score);
}

export function isHighRisk(score: number): boolean {
  return score >= 60;
}
