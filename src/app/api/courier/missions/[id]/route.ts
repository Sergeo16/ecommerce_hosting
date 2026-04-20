import { NextRequest, NextResponse } from 'next/server';
import type { DeliveryStatus } from '@prisma/client';
import { prisma } from '@/lib/db';
import { approveCommissionsOnDelivery } from '@/lib/monetization';

const DECISION_STATUSES = ['COURIER_ACCEPTED', 'ON_HOLD', 'COURIER_REFUSED'];
const PROGRESS_STATUSES = ['PICKED_UP', 'IN_TRANSIT', 'DELIVERED', 'FAILED', 'RETURNED'];
const ALL_ALLOWED = [...DECISION_STATUSES, ...PROGRESS_STATUSES];

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = request.headers.get('x-user-id');
  const role = request.headers.get('x-user-role');
  if (!userId || role !== 'COURIER') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  const body = await request.json();
  const status = body.status as string | undefined;
  const reason = typeof body.reason === 'string' ? body.reason.trim().slice(0, 2000) : undefined;
  const proofPhotoUrl = body.proofPhotoUrl;
  const signatureUrl = body.signatureUrl;
  const notes = body.notes;

  if (!status || !ALL_ALLOWED.includes(status)) {
    return NextResponse.json({ error: 'Statut invalide' }, { status: 400 });
  }

  const delivery = await prisma.delivery.findFirst({
    where: { id, courierId: userId },
    include: { order: true },
  });
  if (!delivery) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const isDecision = DECISION_STATUSES.includes(status);
  const canDecide = ['ASSIGNED', 'ON_HOLD'].includes(delivery.status);
  if (isDecision && !canDecide) {
    return NextResponse.json(
      { error: 'Cette mission ne peut plus être acceptée, mise en attente ou refusée.' },
      { status: 400 }
    );
  }

  const data: {
    status: DeliveryStatus;
    courierDecisionAt?: Date;
    pickedUpAt?: Date;
    deliveredAt?: Date;
    proofPhotoUrl?: string;
    signatureUrl?: string;
    notes?: string | null;
    courierId?: null;
  } = { status: status as DeliveryStatus };
  if (status === 'PICKED_UP') data.pickedUpAt = new Date();
  if (status === 'DELIVERED') data.deliveredAt = new Date();
  if (isDecision) data.courierDecisionAt = new Date();
  if (proofPhotoUrl) data.proofPhotoUrl = proofPhotoUrl;
  if (signatureUrl) data.signatureUrl = signatureUrl;
  if (notes !== undefined) data.notes = notes;

  if (isDecision && reason !== undefined) {
    const prefix = status === 'COURIER_ACCEPTED' ? 'Accepté' : status === 'ON_HOLD' ? 'En attente' : 'Refusé';
    data.notes = [prefix, reason].filter(Boolean).join('. ') || (delivery.notes ?? null);
  }

  if (status === 'COURIER_REFUSED') {
    data.courierId = null;
  }

  await prisma.delivery.update({
    where: { id },
    data,
  });

  if (status === 'DELIVERED') {
    await prisma.order.update({
      where: { id: delivery.orderId },
      data: { status: 'DELIVERED' },
    });
    await approveCommissionsOnDelivery(delivery.orderId).catch((err) =>
      console.error('[Courier] Commission approval on delivery failed:', err)
    );
  }

  // Quand un livreur accepte la mission, notifier les autres livreurs (qui avaient pu la voir en disponible)
  if (status === 'COURIER_ACCEPTED') {
    const orderNumber = delivery.order?.orderNumber ?? 'Commande';
    const otherCouriers = await prisma.user.findMany({
      where: { role: 'COURIER', status: 'ACTIVE', id: { not: userId } },
      select: { id: true },
    });
    if (otherCouriers.length > 0) {
      await prisma.notification.createMany({
        data: otherCouriers.map((c) => ({
          userId: c.id,
          type: 'mission_accepted_by_another',
          title: 'Mission acceptée par un autre livreur',
          body: `La mission ${orderNumber} a été acceptée par un autre livreur et n'est plus disponible.`,
          data: { orderNumber, orderId: delivery.orderId, deliveryId: id },
        })),
      });
    }
  }

  return NextResponse.json({ ok: true, status });
}
