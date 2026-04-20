import { NextRequest, NextResponse } from 'next/server';
import { getPaymentRules } from '@/lib/rules-engine';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const productId = searchParams.get('productId') ?? undefined;
  const companyId = searchParams.get('companyId') ?? undefined;
  const rules = await getPaymentRules({ productId, companyId });
  return NextResponse.json(rules);
}
