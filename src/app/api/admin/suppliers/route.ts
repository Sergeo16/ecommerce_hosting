import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest) {
  const role = request.headers.get('x-user-role');
  if (role !== 'SUPER_ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const suppliers = await prisma.companyProfile.findMany({
    select: { id: true, companyName: true },
    orderBy: { companyName: 'asc' },
  });
  return NextResponse.json(suppliers);
}
