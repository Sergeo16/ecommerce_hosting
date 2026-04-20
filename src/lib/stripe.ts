/**
 * Stripe : paiements et escrow
 */
import Stripe from 'stripe';

const key = process.env.STRIPE_SECRET_KEY;
export const stripe = key
  ? new Stripe(key, { apiVersion: '2023-10-16', typescript: true })
  : null;

export async function createPaymentIntent(
  amount: number,
  currency: string,
  metadata: { orderId: string; userId: string }
): Promise<{ clientSecret: string; id: string } | null> {
  if (!stripe) return null;
  const intent = await stripe.paymentIntents.create({
    amount: Math.round(amount * 100),
    currency: currency.toLowerCase() === 'xof' ? 'xof' : currency.toLowerCase(),
    automatic_payment_methods: { enabled: true },
    metadata,
  });
  return { clientSecret: intent.client_secret!, id: intent.id };
}

export async function retrievePaymentIntent(paymentIntentId: string): Promise<Stripe.PaymentIntent | null> {
  if (!stripe) return null;
  return stripe.paymentIntents.retrieve(paymentIntentId);
}
