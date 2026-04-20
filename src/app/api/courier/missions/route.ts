import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest) {
  const userId = request.headers.get('x-user-id');
  const role = request.headers.get('x-user-role');
  if (!userId || role !== 'COURIER') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');

  const where: { courierId?: string } = { courierId: userId };
  if (status) where.courierId = userId;

  const deliveries = await prisma.delivery.findMany({
    where,
    include: {
      order: {
        include: {
          user: { select: { firstName: true, lastName: true, phone: true } },
          companyProfile: { select: { companyName: true, address: true } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json(
    deliveries.map((d) => ({
      id: d.id,
      orderId: d.orderId,
      orderNumber: d.order.orderNumber,
      status: d.status,
      deliveryAddress: d.deliveryAddress,
      commissionAmount: d.commissionAmount ? Number(d.commissionAmount) : null,
      createdAt: d.createdAt,
      pickedUpAt: d.pickedUpAt,
      deliveredAt: d.deliveredAt,
      notes: d.notes,
      customer: d.order.user,
    }))
  );
}
