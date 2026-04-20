import { CommissionStatus } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

/** PATCH : bloquer (ON_HOLD), libérer (APPROVED) ou rejeter (CANCELLED) une commission */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const role = request.headers.get('x-user-role');
  if (role !== 'SUPER_ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  const commission = await prisma.commission.findUnique({ where: { id } });
  if (!commission) return NextResponse.json({ error: 'Commission introuvable' }, { status: 404 });

  const body = await request.json();
  const action = typeof body.action === 'string' ? body.action : '';

  let status: CommissionStatus | null = null;
  if (action === 'release' || action === 'approve') status = CommissionStatus.APPROVED;
  else if (action === 'block' || action === 'hold') status = CommissionStatus.ON_HOLD;
  else if (action === 'reject' || action === 'cancel') status = CommissionStatus.CANCELLED;

  if (!status) return NextResponse.json({ error: 'action invalide (release, block, reject)' }, { status: 400 });

  await prisma.commission.update({
    where: { id },
    data: { status },
  });

  return NextResponse.json({ ok: true, status });
}
