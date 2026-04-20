import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

/** PATCH : mise à jour commission affilié spécifique (override par commande). */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const role = request.headers.get('x-user-role');
  if (role !== 'SUPER_ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { orderId } = await params;
  if (!orderId) return NextResponse.json({ error: 'orderId requis' }, { status: 400 });

  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) return NextResponse.json({ error: 'Commande introuvable' }, { status: 404 });
  if (!order.affiliateLinkId) return NextResponse.json({ error: 'Commande sans lien affilié' }, { status: 400 });

  const body = await request.json();
  const data: { affiliateOverridePercent?: number | null; affiliateOverrideAmount?: number | null } = {};
  if ('affiliateOverridePercent' in body) {
    const v = body.affiliateOverridePercent;
    data.affiliateOverridePercent = v != null && typeof v === 'number' && v >= 0 && v <= 100 ? v : null;
  }
  if ('affiliateOverrideAmount' in body) {
    const v = body.affiliateOverrideAmount;
    data.affiliateOverrideAmount = v != null && typeof v === 'number' && v >= 0 ? v : null;
  }

  await prisma.order.update({
    where: { id: orderId },
    data,
  });

  return NextResponse.json({ ok: true });
}

/** GET : détail d'une commande pour l'admin (tous les éléments pour confier la livraison). */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const role = request.headers.get('x-user-role');
  if (role !== 'SUPER_ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { orderId } = await params;
  if (!orderId) return NextResponse.json({ error: 'orderId requis' }, { status: 400 });

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      user: { select: { id: true, email: true, firstName: true, lastName: true, phone: true } },
      companyProfile: {
        select: {
          id: true,
          companyName: true,
          slug: true,
          address: true,
          city: true,
          addressLat: true,
          addressLng: true,
          user: { select: { id: true, email: true, firstName: true, lastName: true, phone: true } },
        },
      },
      affiliateLink: { select: { id: true, referralCode: true, commissionPercent: true, commissionAmount: true } },
      items: { include: { product: { select: { id: true, name: true, slug: true } } } },
      delivery: {
        include: {
          courier: { select: { id: true, email: true, firstName: true, lastName: true, phone: true } },
        },
      },
    },
  });

  if (!order) return NextResponse.json({ error: 'Commande introuvable' }, { status: 404 });

  const cp = order.companyProfile;
  const serialized = {
    ...order,
    subtotal: Number(order.subtotal),
    total: Number(order.total),
    advancePaid: Number(order.advancePaid),
    balanceDue: Number(order.balanceDue),
    shippingAmount: Number(order.shippingAmount),
    affiliateLinkId: order.affiliateLinkId,
    affiliateOverridePercent: order.affiliateOverridePercent != null ? Number(order.affiliateOverridePercent) : null,
    affiliateOverrideAmount: order.affiliateOverrideAmount != null ? Number(order.affiliateOverrideAmount) : null,
    affiliateLink: order.affiliateLink,
    companyProfile: cp
      ? {
          ...cp,
          address: cp.address ?? null,
          city: cp.city ?? null,
          addressLat: cp.addressLat != null ? Number(cp.addressLat) : null,
          addressLng: cp.addressLng != null ? Number(cp.addressLng) : null,
        }
      : null,
    delivery: order.delivery
      ? {
          ...order.delivery,
          externalCourierName: order.delivery.externalCourierName,
          externalCourierPhone: order.delivery.externalCourierPhone,
        }
      : null,
  };

  return NextResponse.json(serialized);
}
