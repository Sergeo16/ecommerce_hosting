import { NextResponse } from 'next/server';
import { isKkiapayConfigured } from '@/lib/kkiapay';
import { getFedaPayPublicConfig } from '@/lib/fedapay';

/**
 * Configuration paiement (public) : permet au front de savoir quels
 * prestataires sont disponibles (KKiaPay, FedaPay, ...).
 */
export async function GET() {
  const kkiapayEnabled = isKkiapayConfigured();
  const fedapay = getFedaPayPublicConfig();

  return NextResponse.json({
    kkiapayEnabled,
    kkiapayPublicKey: kkiapayEnabled ? (process.env.KKIAPAY_PUBLIC_KEY ?? '') : undefined,
    kkiapaySandbox: kkiapayEnabled ? process.env.KKIAPAY_SANDBOX === 'true' : undefined,
    fedapayEnabled: fedapay.enabled,
    fedapayPublicKey: fedapay.enabled ? fedapay.publicKey : undefined,
    fedapayEnvironment: fedapay.enabled ? fedapay.environment : undefined,
  });
}
