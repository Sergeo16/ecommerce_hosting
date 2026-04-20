import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCommissionAvailableCutoff } from '@/lib/monetization/commissions';

export async function GET(request: NextRequest) {
  const userId = request.headers.get('x-user-id');
  const role = request.headers.get('x-user-role');
  if (!userId || (role !== 'SUPPLIER' && role !== 'SUPER_ADMIN')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const cp = await prisma.companyProfile.findFirst({ where: { userId } });
  if (!cp) return NextResponse.json({ totalEarnings: 0, availableEarnings: 0, heldEarnings: 0, salesEvolution: [] }, { status: 200 });

  const companyProfileId = cp.id;
  const cutoff = await getCommissionAvailableCutoff();

  const [totalEarnings, availableEarnings, heldEarnings, ordersDelivered] = await Promise.all([
    prisma.supplierPayout.aggregate({
      where: { companyProfileId, status: { in: ['APPROVED', 'ON_HOLD', 'PAID'] } },
      _sum: { amount: true },
    }),
    prisma.supplierPayout.aggregate({
      where: { companyProfileId, status: 'APPROVED', createdAt: { lte: cutoff } },
      _sum: { amount: true },
    }),
    prisma.supplierPayout.aggregate({
      where: { companyProfileId, status: 'ON_HOLD' },
      _sum: { amount: true },
    }),
    prisma.order.findMany({
      where: { companyProfileId, status: 'DELIVERED' },
      select: { subtotal: true, createdAt: true },
    }),
  ]);

  const last30Days = new Date();
  last30Days.setDate(last30Days.getDate() - 30);
  const byDay: Record<string, number> = {};
  for (let i = 0; i < 30; i++) {
    const d = new Date(last30Days);
    d.setDate(d.getDate() + i);
    const key = d.toISOString().slice(0, 10);
    byDay[key] = 0;
  }
  for (const o of ordersDelivered) {
    const key = o.createdAt.toISOString().slice(0, 10);
    if (key in byDay) byDay[key] += Number(o.subtotal);
  }
  const salesEvolution = Object.entries(byDay)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, amount]) => ({ date, amount }));

  return NextResponse.json({
    totalEarnings: Number(totalEarnings._sum.amount ?? 0),
    availableEarnings: Number(availableEarnings._sum.amount ?? 0),
    heldEarnings: Number(heldEarnings._sum.amount ?? 0),
    ordersCount: ordersDelivered.length,
    salesEvolution,
  });
}
