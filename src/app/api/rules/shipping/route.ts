import { NextRequest, NextResponse } from 'next/server';
import { getShippingAmountXOF } from '@/lib/shipping';
import { shippingInCurrency } from '@/lib/shipping';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const companyId = searchParams.get('companyId') ?? undefined;
  const currency = (searchParams.get('currency') ?? 'XOF').toUpperCase();

  const amountXOF = await getShippingAmountXOF(companyId);
  const amountInCurrency = shippingInCurrency(amountXOF, currency);

  return NextResponse.json({ amountXOF, amountInCurrency, currency });
}
