import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const categories = await prisma.category.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    include: {
      children: { where: { isActive: true }, orderBy: { sortOrder: 'asc' } },
      _count: { select: { products: true } },
    },
  });
  return NextResponse.json(categories);
}
