import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { sanitizeName, sanitizePhone, validatePhone, LIMITS } from '@/lib/validate-fields';
import { computeCourierCommissionAmount } from '@/lib/monetization/courier-commission';

/**
 * POST : confier la livraison à un livreur de la plateforme ou à un contact externe.
 * Body: { orderId: string, courierId?: string | null, externalCourierName?: string, externalCourierPhone?: string }
 * - Si courierId fourni : assignation à un livreur enregistré (external* ignorés).
 * - Sinon si externalCourierName + externalCourierPhone : assignation à un contact externe.
 */
export async function POST(request: NextRequest) {
  const role = request.headers.get('x-user-role');
  if (role !== 'SUPER_ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  let body: {
    orderId?: string;
    courierId?: string | null;
    externalCourierName?: string | null;
    externalCourierPhone?: string | null;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Body JSON invalide' }, { status: 400 });
  }

  const orderId = typeof body.orderId === 'string' ? body.orderId.trim() : '';
  if (!orderId) return NextResponse.json({ error: 'orderId requis' }, { status: 400 });

  const courierId = body.courierId != null && body.courierId !== '' ? String(body.courierId).trim() : null;
  const externalName = typeof body.externalCourierName === 'string' ? sanitizeName(body.externalCourierName, LIMITS.name) : null;
  const externalPhone = typeof body.externalCourierPhone === 'string' ? sanitizePhone(body.externalCourierPhone) : null;

  const usePlatformCourier = !!courierId;
  const useExternal = !usePlatformCourier && !!externalName && !!externalPhone;

  if (!usePlatformCourier && !useExternal) {
    return NextResponse.json(
      { error: 'Indiquez soit un livreur de la plateforme (courierId), soit un contact externe (externalCourierName et externalCourierPhone).' },
      { status: 400 }
    );
  }

  if (useExternal) {
    const phoneCheck = validatePhone(externalPhone);
    if (!phoneCheck.ok) {
      return NextResponse.json({ error: phoneCheck.message ?? 'Téléphone du contact externe invalide' }, { status: 400 });
    }
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { delivery: true },
  });
  if (!order) return NextResponse.json({ error: 'Commande introuvable' }, { status: 404 });

  const subtotal = Number(order.subtotal);
  const shippingAmount = Number(order.shippingAmount);

  // Dès que le livreur a signalé la livraison (ou échec/retour), l'admin ne peut plus réaffecter
  const terminalStatuses = ['DELIVERED', 'FAILED', 'RETURNED'];
  if (order.delivery && terminalStatuses.includes(order.delivery.status)) {
    return NextResponse.json(
      {
        error:
          order.delivery.status === 'DELIVERED'
            ? 'Cette commande est déjà livrée ; elle ne peut plus être affectée à un autre livreur.'
            : 'Cette livraison est clôturée (échec ou retour) et ne peut plus être réaffectée.',
      },
      { status: 400 }
    );
  }

  if (usePlatformCourier) {
    const courier = await prisma.user.findFirst({
      where: { id: courierId!, role: 'COURIER', status: 'ACTIVE' },
    });
    if (!courier) return NextResponse.json({ error: 'Livreur introuvable ou inactif' }, { status: 400 });
  }

  const commissionAmount = usePlatformCourier
    ? await computeCourierCommissionAmount({
        subtotal,
        shippingAmount,
        courierId,
      })
    : null;

  const delivery = await prisma.delivery.upsert({
    where: { orderId },
    create: {
      orderId,
      status: 'ASSIGNED',
      deliveryAddress: order.shippingAddress as object,
      ...(usePlatformCourier
        ? { courierId, commissionAmount: commissionAmount ?? undefined }
        : { externalCourierName: externalName!, externalCourierPhone: externalPhone! }),
    },
    update: {
      status: 'ASSIGNED',
      ...(usePlatformCourier
        ? {
            courierId,
            externalCourierName: null,
            externalCourierPhone: null,
            commissionAmount: commissionAmount ?? undefined,
          }
        : { courierId: null, externalCourierName: externalName!, externalCourierPhone: externalPhone!, commissionAmount: null }),
    },
  });

  return NextResponse.json({
    delivery: {
      id: delivery.id,
      orderId: delivery.orderId,
      status: delivery.status,
      courierId: delivery.courierId,
      externalCourierName: delivery.externalCourierName,
      externalCourierPhone: delivery.externalCourierPhone,
    },
  });
}
