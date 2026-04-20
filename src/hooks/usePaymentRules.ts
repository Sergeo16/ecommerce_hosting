'use client';

import { useState, useEffect } from 'react';

export interface PaymentRules {
  fullUpfront: boolean;
  partialAdvance: boolean;
  payOnDelivery: boolean;
  minAdvancePercent: number;
}

export function usePaymentRules(opts?: { productId?: string; companyId?: string }) {
  const [rules, setRules] = useState<PaymentRules | null>(null);
  useEffect(() => {
    const params = new URLSearchParams();
    if (opts?.productId) params.set('productId', opts.productId);
    if (opts?.companyId) params.set('companyId', opts.companyId);
    fetch(`/api/rules/payment?${params}`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setRules)
      .catch(() => setRules(null));
  }, [opts?.productId, opts?.companyId]);
  return rules;
}
