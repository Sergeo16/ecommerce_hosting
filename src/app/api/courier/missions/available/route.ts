import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest) {
  const userId = request.headers.get('x-user-id');
  const role = request.headers.get('x-user-role');
  if (!userId || role !== 'COURIER') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const deliveries = await prisma.delivery.findMany({
    where: {
      courierId: null,
      status: 'PENDING',
    },
    include: {
      order: {
        select: {
          orderNumber: true,
          shippingAddress: true,
          companyProfile: {
            select: {
              companyName: true,
              city: true,
              address: true,
            },
          },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  return NextResponse.json(
    deliveries.map((d) => ({
      id: d.id,
      orderId: d.orderId,
      orderNumber: d.order.orderNumber,
      status: d.status,
      deliveryAddress: d.deliveryAddress,
      companyName: d.order.companyProfile?.companyName ?? null,
      companyCity: d.order.companyProfile?.city ?? null,
      companyAddress: d.order.companyProfile?.address ?? null,
    }))
  );
}

