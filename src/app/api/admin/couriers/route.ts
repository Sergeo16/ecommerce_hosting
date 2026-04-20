import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

/** GET : liste des livreurs de la plateforme (pour assignation par l'admin). */
export async function GET(request: NextRequest) {
  const role = request.headers.get('x-user-role');
  if (role !== 'SUPER_ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const couriers = await prisma.user.findMany({
    where: {
      role: 'COURIER',
      status: 'ACTIVE',
    },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      phone: true,
    },
    orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
  });

  return NextResponse.json({
    couriers: couriers.map((c) => ({
      id: c.id,
      label: [c.firstName, c.lastName].filter(Boolean).join(' ') || c.email,
      email: c.email,
      phone: c.phone,
    })),
  });
}
