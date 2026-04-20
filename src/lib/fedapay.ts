/**
 * FedaPay — intégration Node.js (transactions & webhooks).
 *
 * Docs:
 * - Checkout.js: https://docs-v1.fedapay.com/paiements/checkout
 * - Node SDK: https://docs.fedapay.com/sdks/en/nodejs-en
 * - API Transactions: https://docs.fedapay.com/api-reference/transactions
 */

import { FedaPay, Transaction } from 'fedapay';

/** Réponse Transaction.retrieve (forme minimale pour notre usage) */
interface FedaPayTx {
  id?: number;
  status?: string;
  amount?: number;
  currency?: { iso?: string };
  currency_iso?: string;
}

export function isFedaPayConfigured(): boolean {
  return !!(process.env.FEDAPAY_PUBLIC_KEY && process.env.FEDAPAY_SECRET_API_KEY);
}

export function getFedaPayPublicConfig():
  | { enabled: false }
  | { enabled: true; publicKey: string; environment: 'sandbox' | 'live' } {
  if (!isFedaPayConfigured()) return { enabled: false };
  const env = process.env.FEDAPAY_ENV === 'live' ? 'live' : 'sandbox';
  return {
    enabled: true,
    publicKey: process.env.FEDAPAY_PUBLIC_KEY as string,
    environment: env,
  };
}

function configureFedaPayClient() {
  const secret = process.env.FEDAPAY_SECRET_API_KEY;
  if (!secret) return false;
  FedaPay.setApiKey(secret);
  FedaPay.setEnvironment(process.env.FEDAPAY_ENV === 'live' ? 'live' : 'sandbox');
  return true;
}

export interface FedaPayVerifyResult {
  success: boolean;
  status?: string;
  transactionId?: number;
  amount?: number;
  currencyIso?: string;
  message?: string;
}

/**
 * Vérifie une transaction FedaPay en interrogeant l'API.
 * On vérifie au minimum le statut, et idéalement le montant / la devise.
 */
export async function verifyFedaPayTransaction(
  transactionId: number | string,
): Promise<FedaPayVerifyResult> {
  if (!configureFedaPayClient()) {
    return { success: false, message: 'FedaPay non configuré' };
  }

  try {
    const idNumber = typeof transactionId === 'string' ? Number(transactionId) : transactionId;
    const tx = (await Transaction.retrieve(idNumber as number)) as FedaPayTx;
    const status = (tx?.status ?? '').toString().toLowerCase();
    const success = status === 'approved';

    return {
      success,
      status,
      transactionId: tx?.id,
      amount: typeof tx?.amount === 'number' ? tx.amount : undefined,
      currencyIso: tx?.currency?.iso ?? tx?.currency_iso,
      message: success ? undefined : `Statut FedaPay: ${status || 'inconnu'}`,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Échec vérification FedaPay';
    return { success: false, message };
  }
}

