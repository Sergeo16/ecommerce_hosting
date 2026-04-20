/**
 * Badges & niveaux : attribution selon règles (premier achat, parrainage, etc.).
 */

import { prisma } from "@/lib/db";

export async function awardBadge(userId: string, badgeKey: string) {
  await prisma.userBadge.upsert({
    where: {
      userId_badgeKey: { userId, badgeKey },
    },
    create: { userId, badgeKey },
    update: {},
  });
}

export async function addXp(userId: string, xp: number) {
  await prisma.userLevel.upsert({
    where: { userId },
    create: { userId, level: 1, xp },
    update: { xp: { increment: xp } },
  });
}
