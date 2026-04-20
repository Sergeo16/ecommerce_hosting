import { NextRequest, NextResponse } from 'next/server';
import { createPaymentIntent } from '@/lib/stripe';
import { prisma } from '@/lib/db';

export async function POST(request: NextRequest) {
  const userId = request.headers.get('x-user-id');
  const body = await request.json();
  const orderId = typeof body.orderId === 'string' ? body.orderId : '';
  const amount = typeof body.amount === 'number' ? body.amount : parseFloat(body.amount);
  const guestEmail = typeof body.guestEmail === 'string' ? body.guestEmail.trim() : '';

  if (!orderId || !Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: 'orderId et amount requis' }, { status: 400 });
  }

  const isGuest = !userId && guestEmail;
  const order = await prisma.order.findFirst({
    where: isGuest
      ? { id: orderId, userId: null, guestEmail }
      : { id: orderId, userId: userId! },
  });
  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });

  const result = await createPaymentIntent(amount, order.currency, { orderId, userId: order.userId ?? '' });
  if (!result) {
    return NextResponse.json({
      mock: true,
      clientSecret: `mock_${orderId}_${amount}`,
      message: 'Stripe non configuré — utiliser mock ou Mobile Money',
    });
  }
  return NextResponse.json({ clientSecret: result.clientSecret, id: result.id });
}
