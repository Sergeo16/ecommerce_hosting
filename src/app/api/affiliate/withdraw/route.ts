import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCommissionAvailableCutoff } from '@/lib/monetization/commissions';

export async function GET(request: NextRequest) {
  const userId = request.headers.get('x-user-id');
  const role = request.headers.get('x-user-role');
  if (!userId || role !== 'AFFILIATE') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const cutoff = await getCommissionAvailableCutoff();
  const [wallet, pendingWithdrawals, approvedSum, withdrawnSum] = await Promise.all([
    prisma.wallet.findUnique({ where: { userId } }),
    prisma.withdrawalRequest.findMany({
      where: { userId, status: 'PENDING' },
      orderBy: { createdAt: 'desc' },
      take: 20,
    }),
    prisma.commission.aggregate({
      where: { userId, type: 'AFFILIATE', status: 'APPROVED', createdAt: { lte: cutoff } },
      _sum: { amount: true },
    }),
    prisma.withdrawalRequest.aggregate({
      where: { userId, status: { in: ['PENDING', 'APPROVED', 'PAID'] } },
      _sum: { amount: true },
    }),
  ]);

  const totalApproved = Number(approvedSum._sum.amount ?? 0);
  const withdrawn = Number(withdrawnSum._sum.amount ?? 0);
  const balance = Math.max(0, totalApproved - withdrawn);

  return NextResponse.json({
    balance,
    currency: wallet?.currency ?? 'XOF',
    frozen: wallet?.frozen ?? false,
    pendingWithdrawals: pendingWithdrawals.map((w) => ({
      id: w.id,
      amount: Number(w.amount),
      status: w.status,
      createdAt: w.createdAt.toISOString(),
    })),
  });
}

export async function POST(request: NextRequest) {
  const userId = request.headers.get('x-user-id');
  const role = request.headers.get('x-user-role');
  if (!userId || role !== 'AFFILIATE') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await request.json();
  const amount = typeof body.amount === 'number' ? body.amount : parseFloat(body.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: 'Montant invalide' }, { status: 400 });
  }

  const wallet = await prisma.wallet.findUnique({ where: { userId } });
  if (!wallet || wallet.frozen) {
    return NextResponse.json({ error: 'Portefeuille indisponible' }, { status: 403 });
  }
  const cutoff = await getCommissionAvailableCutoff();
  const [approvedSum, withdrawnSum] = await Promise.all([
    prisma.commission.aggregate({
      where: { userId, type: 'AFFILIATE', status: 'APPROVED', createdAt: { lte: cutoff } },
      _sum: { amount: true },
    }),
    prisma.withdrawalRequest.aggregate({
      where: { userId, status: { in: ['PENDING', 'APPROVED', 'PAID'] } },
      _sum: { amount: true },
    }),
  ]);
  const totalApproved = Number(approvedSum._sum.amount ?? 0);
  const withdrawn = Number(withdrawnSum._sum.amount ?? 0);
  const balance = Math.max(0, totalApproved - withdrawn);
  if (amount > balance) {
    return NextResponse.json({ error: 'Solde insuffisant' }, { status: 400 });
  }

  const req = await prisma.withdrawalRequest.create({
    data: {
      userId,
      amount,
      currency: 'XOF',
      status: 'PENDING',
      method: body.method ?? 'mobile_money',
      details: body.details ?? null,
    },
  });

  return NextResponse.json({
    id: req.id,
    amount: req.amount,
    status: req.status,
    message: 'Demande enregistrée. Traitement sous 24-48h.',
  });
}
