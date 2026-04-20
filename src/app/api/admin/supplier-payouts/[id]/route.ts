import { SupplierPayoutStatus } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

/** PATCH : bloquer (ON_HOLD), libérer (APPROVED) ou rejeter (CANCELLED) un paiement fournisseur */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const role = request.headers.get('x-user-role');
  if (role !== 'SUPER_ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  const payout = await prisma.supplierPayout.findUnique({ where: { id } });
  if (!payout) return NextResponse.json({ error: 'Paiement introuvable' }, { status: 404 });

  const body = await request.json();
  const action = typeof body.action === 'string' ? body.action : '';

  let status: SupplierPayoutStatus | null = null;
  if (action === 'release' || action === 'approve') status = SupplierPayoutStatus.APPROVED;
  else if (action === 'block' || action === 'hold') status = SupplierPayoutStatus.ON_HOLD;
  else if (action === 'reject' || action === 'cancel') status = SupplierPayoutStatus.CANCELLED;

  if (!status) return NextResponse.json({ error: 'action invalide (release, block, reject)' }, { status: 400 });

  await prisma.supplierPayout.update({
    where: { id },
    data: { status },
  });

  return NextResponse.json({ ok: true, status });
}
