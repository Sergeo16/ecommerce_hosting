import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSupplierIdentityVisible } from '@/lib/rules-engine';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const product = await prisma.product.findFirst({
    where: { slug, isActive: true },
    include: {
      category: true,
      companyProfile: { select: { companyName: true, slug: true } },
      attributes: true,
      variants: true,
    },
  });
  if (!product) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const showSupplier = await getSupplierIdentityVisible();
  const out: Record<string, unknown> = {
    ...product,
    price: Number(product.price),
    compareAtPrice: product.compareAtPrice ? Number(product.compareAtPrice) : null,
    affiliateCommissionPercent: product.affiliateCommissionPercent ? Number(product.affiliateCommissionPercent) : null,
    variants: product.variants.map((v) => ({ ...v, price: Number(v.price) })),
  };
  if (!showSupplier) out.companyProfile = null;
  return NextResponse.json(out);
}
