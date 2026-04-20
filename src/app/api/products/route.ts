import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSupplierIdentityVisible } from '@/lib/rules-engine';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const categorySlug = searchParams.get('category');
  const companySlug = searchParams.get('company');
  const q = searchParams.get('q');
  const page = Math.max(0, parseInt(searchParams.get('page') ?? '0', 10));
  const limit = Math.min(50, parseInt(searchParams.get('limit') ?? '20', 10));

  const where: { isActive: boolean; category?: { slug: string }; companyProfile?: { slug: string }; OR?: object[] } = {
    isActive: true,
  };
  if (categorySlug) {
    where.category = { slug: categorySlug };
  }
  if (companySlug) {
    where.companyProfile = { slug: companySlug };
  }
  if (q?.trim()) {
    where.OR = [
      { name: { contains: q.trim(), mode: 'insensitive' } },
      { description: { contains: q.trim(), mode: 'insensitive' } },
    ];
  }

  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where,
      include: {
        category: { select: { name: true, slug: true } },
        companyProfile: { select: { companyName: true, slug: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: page * limit,
      take: limit,
    }),
    prisma.product.count({ where }),
  ]);

  const showSupplier = await getSupplierIdentityVisible();
  return NextResponse.json({
    products: products.map((p) => {
      const out: Record<string, unknown> = {
        ...p,
        price: Number(p.price),
        compareAtPrice: p.compareAtPrice ? Number(p.compareAtPrice) : null,
        affiliateCommissionPercent: p.affiliateCommissionPercent ? Number(p.affiliateCommissionPercent) : null,
      };
      if (!showSupplier) out.companyProfile = null;
      return out;
    }),
    total,
    page,
    limit,
  });
}
