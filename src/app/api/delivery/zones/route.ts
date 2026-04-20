import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest) {
  const companySlug = request.nextUrl.searchParams.get('company');
  if (companySlug) {
    const cp = await prisma.companyProfile.findUnique({ where: { slug: companySlug } });
    if (!cp) return NextResponse.json([]);
    const zones = await prisma.deliveryZone.findMany({
      where: { companyProfileId: cp.id, isActive: true },
    });
    return NextResponse.json(
      zones.map((z) => ({ ...z, priceAmount: z.priceAmount ? Number(z.priceAmount) : null, freeAboveAmount: z.freeAboveAmount ? Number(z.freeAboveAmount) : null }))
    );
  }
  const zones = await prisma.deliveryZone.findMany({ where: { isActive: true } });
  return NextResponse.json(zones);
}
