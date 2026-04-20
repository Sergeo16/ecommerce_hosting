import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

/** PATCH : mise à jour commission spécifique par affilié (admin uniquement). */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const role = request.headers.get('x-user-role');
  if (role !== 'SUPER_ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  const link = await prisma.affiliateLink.findUnique({ where: { id } });
  if (!link) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await request.json();
  const pct = body.commissionPercent;
  const amt = body.commissionAmount;
  const validPct = pct != null && typeof pct === 'number' && pct >= 0 && pct <= 100;
  const validAmt = amt != null && typeof amt === 'number' && amt >= 0;
  const data: { commissionPercent: number | null; commissionAmount: number | null } = {
    commissionPercent: null,
    commissionAmount: null,
  };
  if (validPct) {
    data.commissionPercent = pct;
  } else if (validAmt) {
    data.commissionAmount = amt;
  }

  const updated = await prisma.affiliateLink.update({
    where: { id },
    data,
    include: { product: { select: { name: true, slug: true } } },
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = request.headers.get('x-user-id');
  const role = request.headers.get('x-user-role');
  if (!userId || role !== 'AFFILIATE') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const link = await prisma.affiliateLink.findFirst({
    where: { id, userId },
  });
  if (!link) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  await prisma.affiliateLink.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
