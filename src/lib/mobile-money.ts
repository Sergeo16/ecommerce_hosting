/**
 * Abstraction Mobile Money (MTN / Moov) — Mock pour dev
 * En prod : brancher APIs MTN MoMo / Moov Money
 */
export type MobileMoneyProvider = 'MTN' | 'MOOV';

export interface MobileMoneyPaymentRequest {
  amount: number;
  currency: string;
  phone: string;
  provider: MobileMoneyProvider;
  reference: string;
  description?: string;
}

export interface MobileMoneyPaymentResult {
  success: boolean;
  transactionId?: string;
  message?: string;
}

/**
 * Mock : simule un paiement Mobile Money réussi
 */
export async function initiateMobileMoneyPayment(
  req: MobileMoneyPaymentRequest
): Promise<MobileMoneyPaymentResult> {
  if (process.env.MOBILE_MONEY_MOCK === 'false' && process.env.MTN_API_KEY) {
    // Intégration réelle MTN MoMo (exemple)
    // return mtnMomocollect(req);
    return realMtnRequest(req);
  }
  return {
    success: true,
    transactionId: `mock-${req.provider}-${Date.now()}-${req.reference}`,
    message: 'Paiement simulé (mock)',
  };
}

async function realMtnRequest(_req: MobileMoneyPaymentRequest): Promise<MobileMoneyPaymentResult> {
  // TODO: appeler MTN MoMo API avec fetch
  return { success: false, message: 'MTN API non configurée' };
}

export async function checkMobileMoneyStatus(
  _provider: MobileMoneyProvider,
  _transactionId: string
): Promise<'PENDING' | 'SUCCESS' | 'FAILED'> {
  return 'SUCCESS';
}
