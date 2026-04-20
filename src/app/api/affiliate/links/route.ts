import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest) {
  const userId = request.headers.get('x-user-id');
  const role = request.headers.get('x-user-role');
  if (!userId || (role !== 'AFFILIATE' && role !== 'SUPER_ADMIN')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const where = role === 'SUPER_ADMIN' ? {} : { userId };
  const links = await prisma.affiliateLink.findMany({
    where,
    include: {
      user: { select: { firstName: true, lastName: true, email: true } },
      product: { select: { name: true, slug: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  const categoryRows = role === 'SUPER_ADMIN'
    ? await prisma.$queryRaw<{ id: string; category_slug: string | null }[]>`SELECT id, category_slug FROM affiliate_links`
    : await prisma.$queryRaw<{ id: string; category_slug: string | null }[]>`
        SELECT id, category_slug FROM affiliate_links WHERE user_id = ${userId}
      `;
  const categoryMap = new Map(categoryRows.map((r) => [r.id, r.category_slug]));

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  const linksWithUrl = links.map((link) => {
    const categorySlug = categoryMap.get(link.id) ?? (link as { categorySlug?: string }).categorySlug;
    let trackingLink: string;
    if (link.product?.slug) {
      trackingLink = `${baseUrl}/p/${link.product.slug}?ref=${link.referralCode}`;
    } else if (categorySlug) {
      trackingLink = `${baseUrl}/catalog?category=${encodeURIComponent(categorySlug)}&ref=${link.referralCode}`;
    } else {
      trackingLink = `${baseUrl}/catalog?ref=${link.referralCode}`;
    }
    return { ...link, categorySlug, trackingLink };
  });
  return NextResponse.json(linksWithUrl);
}

export async function POST(request: NextRequest) {
  const userId = request.headers.get('x-user-id');
  const role = request.headers.get('x-user-role');
  if (!userId || role !== 'AFFILIATE') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await request.json();
  const productId = typeof body.productId === 'string' ? body.productId : null;
  const categorySlug = typeof body.categorySlug === 'string' ? body.categorySlug.trim() || null : null;
  const utmSource = typeof body.utmSource === 'string' ? body.utmSource : null;
  const utmMedium = typeof body.utmMedium === 'string' ? body.utmMedium : null;
  const utmCampaign = typeof body.utmCampaign === 'string' ? body.utmCampaign : null;

  const slug = `aff-${userId.slice(-8)}-${Date.now().toString(36)}`;
  const referralCode = `REF-${Date.now().toString(36).toUpperCase()}`;

  const link = await prisma.affiliateLink.create({
    data: {
      userId,
      productId: productId || null,
      slug,
      referralCode,
      utmSource,
      utmMedium,
      utmCampaign,
    },
    include: { product: { select: { name: true, slug: true } } },
  });

  if (categorySlug) {
    await prisma.$executeRaw`
      UPDATE affiliate_links SET category_slug = ${categorySlug}
      WHERE id = ${link.id}
    `;
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  let trackingLink: string;
  if (link.product?.slug) {
    trackingLink = `${baseUrl}/p/${link.product.slug}?ref=${link.referralCode}`;
  } else if (categorySlug) {
    trackingLink = `${baseUrl}/catalog?category=${encodeURIComponent(categorySlug)}&ref=${link.referralCode}`;
  } else {
    trackingLink = `${baseUrl}/catalog?ref=${link.referralCode}`;
  }

  return NextResponse.json({
    ...link,
    categorySlug,
    trackingLink,
    shareUrl: trackingLink,
  });
}
