import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { addEmailJob, addNotificationJob } from '@/lib/queue';
import { computeCourierCommissionAmount } from '@/lib/monetization/courier-commission';

export async function POST(request: NextRequest) {
  const userId = request.headers.get('x-user-id');
  const role = request.headers.get('x-user-role');
  if (!userId || role !== 'COURIER') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json();
  const deliveryId = typeof body.deliveryId === 'string' ? body.deliveryId : '';
  if (!deliveryId) {
    return NextResponse.json({ error: 'deliveryId requis' }, { status: 400 });
  }

  const deliveryBefore = await prisma.delivery.findFirst({
    where: { id: deliveryId, courierId: null, status: 'PENDING' },
    include: { order: { select: { subtotal: true, shippingAmount: true } } },
  });
  if (!deliveryBefore) {
    return NextResponse.json({ error: 'ALREADY_TAKEN' }, { status: 409 });
  }

  const subtotal = Number(deliveryBefore.order?.subtotal ?? 0);
  const shippingAmount = Number(deliveryBefore.order?.shippingAmount ?? 0);
  const commissionAmount = await computeCourierCommissionAmount({
    subtotal,
    shippingAmount,
    courierId: userId,
  });

  const updated = await prisma.delivery.updateMany({
    where: { id: deliveryId, courierId: null, status: 'PENDING' },
    data: {
      courierId: userId,
      status: 'ASSIGNED',
      commissionAmount: commissionAmount > 0 ? commissionAmount : null,
    },
  });

  if (updated.count === 0) {
    return NextResponse.json({ error: 'ALREADY_TAKEN' }, { status: 409 });
  }

  const delivery = await prisma.delivery.findUnique({
    where: { id: deliveryId },
    include: {
      order: {
        include: {
          companyProfile: {
            include: {
              user: { select: { email: true, phone: true, firstName: true, lastName: true } },
            },
          },
        },
      },
      courier: {
        select: { firstName: true, lastName: true, phone: true, email: true },
      },
    },
  });

  if (delivery?.order?.companyProfile?.user?.email && delivery.courier) {
    await addEmailJob(
      delivery.order.companyProfile.user.email,
      'Commande prise en charge par un livreur',
      'supplier_delivery_assigned',
      {
        companyName: delivery.order.companyProfile.companyName,
        orderNumber: delivery.order.orderNumber,
        courierFirstName: delivery.courier.firstName,
        courierLastName: delivery.courier.lastName,
        courierPhone: delivery.courier.phone ?? null,
      }
    ).catch(() => {});
  }

  if (delivery?.order?.companyProfile?.user?.phone && delivery.courier) {
    await addNotificationJob('whatsapp', {
      to: delivery.order.companyProfile.user.phone,
      type: 'supplier_delivery_assigned',
      orderNumber: delivery.order.orderNumber,
      courierFirstName: delivery.courier.firstName,
      courierLastName: delivery.courier.lastName,
      courierPhone: delivery.courier.phone ?? null,
    }).catch(() => {});
  }

  // Signaler aux autres livreurs que cette mission n'est plus disponible
  const orderNumber = delivery?.order?.orderNumber ?? 'Commande';
  const otherCouriers = await prisma.user.findMany({
    where: { role: 'COURIER', status: 'ACTIVE', id: { not: userId } },
    select: { id: true },
  });
  if (otherCouriers.length > 0) {
    await prisma.notification.createMany({
      data: otherCouriers.map((c) => ({
        userId: c.id,
        type: 'mission_taken',
        title: 'Mission prise par un autre livreur',
        body: `La mission ${orderNumber} a été prise par un autre livreur et n'est plus disponible.`,
        data: { orderNumber, orderId: delivery?.orderId, deliveryId },
      })),
    });
  }

  return NextResponse.json({ ok: true });
}

