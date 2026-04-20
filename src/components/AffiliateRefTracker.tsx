'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

const AFFILIATE_REF_KEY = 'ecommerce_affiliate_ref';

/** Persiste le paramètre ref (code affilié) dans localStorage pour l'attacher à la commande au checkout. */
export function AffiliateRefTracker() {
  const searchParams = useSearchParams();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const ref = searchParams.get('ref');
    if (ref && typeof ref === 'string' && ref.trim().length > 0) {
      try {
        localStorage.setItem(AFFILIATE_REF_KEY, ref.trim().slice(0, 100));
      } catch {}
    }
  }, [searchParams]);

  return null;
}

export function getAffiliateRef(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const v = localStorage.getItem(AFFILIATE_REF_KEY);
    return v && v.trim().length > 0 ? v.trim() : null;
  } catch {
    return null;
  }
}

export function clearAffiliateRef(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(AFFILIATE_REF_KEY);
  } catch {}
}
