'use client';

import { useState, useEffect } from 'react';

export interface ShippingFee {
  amountXOF: number;
  amountInCurrency: number;
  currency: string;
}

export function useShippingFee(opts?: { companyId?: string; currency?: string }) {
  const [fee, setFee] = useState<ShippingFee | null>(null);
  useEffect(() => {
    const params = new URLSearchParams();
    if (opts?.companyId) params.set('companyId', opts.companyId);
    if (opts?.currency) params.set('currency', opts.currency);
    fetch(`/api/rules/shipping?${params}`)
      .then(async (r) => {
        if (!r.ok) return null;
        const text = await r.text();
        if (!text) return null;
        try {
          return JSON.parse(text) as ShippingFee;
        } catch {
          return null;
        }
      })
      .then(setFee)
      .catch(() => setFee(null));
  }, [opts?.companyId, opts?.currency]);
  return fee;
}
