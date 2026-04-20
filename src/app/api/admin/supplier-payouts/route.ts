import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { SupplierPayoutStatus, type Prisma } from '@prisma/client';

/** GET : liste des paiements fournisseurs pour l'admin */
export async function GET(request: NextRequest) {
  const role = request.headers.get('x-user-role');
  if (role !== 'SUPER_ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');
  const limit = Math.min(100, parseInt(searchParams.get('limit') ?? '50', 10));

  const where: Prisma.SupplierPayoutWhereInput = {};
  if (status && Object.values(SupplierPayoutStatus).includes(status as SupplierPayoutStatus)) {
    where.status = status as SupplierPayoutStatus;
  }

  const payouts = await prisma.supplierPayout.findMany({
    where,
    include: {
      order: { select: { orderNumber: true } },
      companyProfile: { select: { companyName: true, user: { select: { email: true, firstName: true, lastName: true } } } },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

  return NextResponse.json(
    payouts.map((p) => ({
      id: p.id,
      orderId: p.orderId,
      orderNumber: p.order?.orderNumber,
      companyProfileId: p.companyProfileId,
      companyName: p.companyProfile?.companyName,
      supplier: p.companyProfile?.user,
      amount: Number(p.amount),
      status: p.status,
      createdAt: p.createdAt.toISOString(),
    }))
  );
}
