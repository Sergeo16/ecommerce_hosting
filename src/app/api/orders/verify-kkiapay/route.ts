import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyKkiapayTransaction } from '@/lib/kkiapay';
import { addOrderJob, addDeliveryJob, addCommissionJob } from '@/lib/queue';
import type { PaymentMethod } from '@prisma/client';

/**
 * Vérifie une transaction KKiaPay et confirme la commande (côté serveur, anti-fraude).
 * POST body: { orderNumber: string, transactionId: string }
 */
export async function POST(request: NextRequest) {
  const userId = request.headers.get('x-user-id');
  let body: { orderNumber?: string; transactionId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Body JSON invalide' }, { status: 400 });
  }
  const orderNumber = typeof body.orderNumber === 'string' ? body.orderNumber.trim() : '';
  const transactionId = typeof body.transactionId === 'string' ? body.transactionId.trim() : '';
  if (!orderNumber || !transactionId) {
    return NextResponse.json(
      { error: 'orderNumber et transactionId requis' },
      { status: 400 }
    );
  }

  const order = await prisma.order.findFirst({
    where: { orderNumber },
    include: { payments: true },
  });
  if (!order) {
    return NextResponse.json({ error: 'Commande introuvable' }, { status: 404 });
  }
  if (order.status !== 'PENDING') {
    return NextResponse.json(
      { error: 'Cette commande a déjà été traitée' },
      { status: 400 }
    );
  }
  if (order.payments.some((p) => p.status === 'COMPLETED')) {
    return NextResponse.json(
      { error: 'Paiement déjà enregistré pour cette commande' },
      { status: 400 }
    );
  }

  const verify = await verifyKkiapayTransaction(transactionId);
  if (!verify.success) {
    return NextResponse.json(
      { error: verify.message ?? 'Transaction KKiaPay invalide ou échouée' },
      { status: 400 }
    );
  }

  const advancePct = order.advancePercent != null ? Number(order.advancePercent) : 30;
  const paidAmount = order.paymentMode === 'FULL_UPFRONT' ? Number(order.total) : Math.round((Number(order.total) * advancePct) / 100);

  await prisma.order.update({
    where: { id: order.id },
    data: {
      status: 'CONFIRMED',
      advancePaid: paidAmount,
      balanceDue: Number(order.total) - paidAmount,
    },
  });

  const paymentUserId = userId ?? order.userId;
  if (paymentUserId) {
    await prisma.payment.create({
      data: {
        orderId: order.id,
        userId: paymentUserId,
        amount: paidAmount,
        currency: order.currency,
        method: 'MOBILE_MONEY_MTN' as PaymentMethod,
        status: 'COMPLETED',
        externalId: transactionId,
        metadata: { gateway: 'KKIAPAY' },
      },
    });
  }

  await addOrderJob('created', { orderId: order.id });
  await addDeliveryJob('created', { orderId: order.id });
  await addCommissionJob(order.id, {});

  return NextResponse.json({
    order: {
      orderNumber: order.orderNumber,
    },
  });
}
