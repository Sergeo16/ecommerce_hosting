import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCommissionAvailableCutoff } from '@/lib/monetization/commissions';

export async function GET(request: NextRequest) {
  const userId = request.headers.get('x-user-id');
  const role = request.headers.get('x-user-role');
  if (!userId || role !== 'COURIER') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const cutoff = await getCommissionAvailableCutoff();
  const [totalCommissions, pendingCommissions, availableCommissions, heldCommissions] = await Promise.all([
    prisma.commission.aggregate({
      where: { userId, type: 'COURIER' },
      _sum: { amount: true },
    }),
    prisma.commission.aggregate({
      where: { userId, type: 'COURIER', status: 'PENDING' },
      _sum: { amount: true },
    }),
    prisma.commission.aggregate({
      where: { userId, type: 'COURIER', status: 'APPROVED', createdAt: { lte: cutoff } },
      _sum: { amount: true },
    }),
    prisma.commission.aggregate({
      where: { userId, type: 'COURIER', status: 'ON_HOLD' },
      _sum: { amount: true },
    }),
  ]);

  return NextResponse.json({
    totalCommissions: Number(totalCommissions._sum.amount ?? 0),
    pendingCommissions: Number(pendingCommissions._sum.amount ?? 0),
    availableCommissions: Number(availableCommissions._sum.amount ?? 0),
    heldCommissions: Number(heldCommissions._sum.amount ?? 0),
  });
}
