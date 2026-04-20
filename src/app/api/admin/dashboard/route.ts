import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest) {
  const role = request.headers.get('x-user-role');
  if (role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const [
    totalRevenue,
    platformCommissions,
    affiliateCommissions,
    courierCommissions,
    pendingWithdrawals,
    ordersCount,
    deliveriesSuccess,
    deliveriesTotal,
  ] = await Promise.all([
    prisma.payment.aggregate({ where: { status: 'COMPLETED' }, _sum: { amount: true } }),
    prisma.commission.aggregate({ where: { type: 'PLATFORM' }, _sum: { amount: true } }),
    prisma.commission.aggregate({ where: { type: 'AFFILIATE' }, _sum: { amount: true } }),
    prisma.commission.aggregate({ where: { type: 'COURIER' }, _sum: { amount: true } }),
    prisma.withdrawalRequest.aggregate({ where: { status: 'PENDING' }, _sum: { amount: true } }),
    prisma.order.count(),
    prisma.delivery.count({ where: { status: 'DELIVERED' } }),
    prisma.delivery.count(),
  ]);

  const salesByCategory = await prisma.orderItem.groupBy({
    by: ['productId'],
    _sum: { total: true },
    _count: true,
  });
  const productIds = salesByCategory.map((s) => s.productId);
  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    include: { category: true },
  });
  const byCategory: Record<string, number> = {};
  for (let i = 0; i < products.length; i++) {
    const p = products[i];
    const s = salesByCategory.find((x) => x.productId === p.id);
    if (p.category?.name) {
      byCategory[p.category.name] = (byCategory[p.category.name] ?? 0) + Number(s?._sum.total ?? 0);
    }
  }

  return NextResponse.json({
    revenue: Number(totalRevenue._sum.amount ?? 0),
    platformCommissions: Number(platformCommissions._sum.amount ?? 0),
    affiliateCommissions: Number(affiliateCommissions._sum.amount ?? 0),
    courierCommissions: Number(courierCommissions._sum.amount ?? 0),
    pendingWithdrawals: Number(pendingWithdrawals._sum.amount ?? 0),
    ordersCount,
    deliverySuccessRate: deliveriesTotal > 0 ? (deliveriesSuccess / deliveriesTotal) * 100 : 0,
    salesByCategory: byCategory,
  });
}
