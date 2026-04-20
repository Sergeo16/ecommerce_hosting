import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { normalizeProductMedia } from '@/lib/normalize-product-media';

const PUBLISHER_ROLES = ['SUPPLIER', 'SUPER_ADMIN', 'AFFILIATE'] as const;

export async function GET(request: NextRequest) {
  const userId = request.headers.get('x-user-id');
  const role = request.headers.get('x-user-role');
  if (!userId || !PUBLISHER_ROLES.includes(role as any)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const cp = await prisma.companyProfile.findFirst({ where: { userId } });
  let companyId: string | null = cp?.id ?? null;
  if (role === 'AFFILIATE' && !companyId) {
    const first = await prisma.companyProfile.findFirst();
    companyId = first?.id ?? null;
  }
  if (role === 'SUPPLIER' && !companyId) return NextResponse.json({ products: [] });
  if (role === 'AFFILIATE' && !companyId) return NextResponse.json({ products: [] });

  const where = role === 'SUPER_ADMIN' ? {} : companyId ? { companyProfileId: companyId } : {};
  const products = await prisma.product.findMany({
    where: Object.keys(where).length ? where : undefined,
    include: { category: { select: { name: true, slug: true } } },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json(
    products.map((p) => ({
      ...p,
      price: Number(p.price),
      compareAtPrice: p.compareAtPrice ? Number(p.compareAtPrice) : null,
      affiliateCommissionPercent: p.affiliateCommissionPercent ? Number(p.affiliateCommissionPercent) : null,
    }))
  );
}

const MAX_IMAGES = 10;
const MAX_VIDEOS = 2;

export async function POST(request: NextRequest) {
  const userId = request.headers.get('x-user-id');
  const role = request.headers.get('x-user-role');
  if (!userId || !PUBLISHER_ROLES.includes(role as any)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const cp = await prisma.companyProfile.findFirst({ where: { userId } });
  let companyId: string | null = cp?.id ?? null;
  if (role === 'AFFILIATE' && !companyId) {
    const first = await prisma.companyProfile.findFirst();
    companyId = first?.id ?? null;
  }
  if (role === 'SUPPLIER' && !companyId) return NextResponse.json({ error: 'Company profile required' }, { status: 403 });
  if (role === 'AFFILIATE' && !companyId) return NextResponse.json({ error: 'Aucune entreprise plateforme. Créez-en une (seed).' }, { status: 400 });

  const body = await request.json();
  if (role === 'SUPER_ADMIN' && !companyId) companyId = body.companyProfileId ?? (await prisma.companyProfile.findFirst())?.id ?? null;
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const slug = typeof body.slug === 'string' ? body.slug.trim() : name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  const description = body.description != null ? String(body.description) : null;
  const productType = body.productType ?? 'PHYSICAL';
  const price = parseFloat(body.price);
  const affiliateCommissionPercent = body.affiliateCommissionPercent != null ? parseFloat(body.affiliateCommissionPercent) : null;
  const sku = body.sku ?? null;
  const trackInventory = body.trackInventory !== false;
  const stockQuantity = parseInt(body.stockQuantity, 10) || 0;
  let categoryId = body.categoryId ?? null;
  const categoryName = typeof body.categoryName === 'string' ? body.categoryName.trim() : '';
  const currency = typeof body.currency === 'string' && body.currency.trim().length > 0 && body.currency.trim().length <= 10
    ? body.currency.trim().toUpperCase()
    : 'XOF';

  if (!categoryId && categoryName) {
    const baseSlug = categoryName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') || 'cat';
    let cat = await prisma.category.findFirst({
      where: { name: { equals: categoryName, mode: 'insensitive' } },
    });
    if (!cat) {
      const slug = `${baseSlug}-${Date.now()}`;
      cat = await prisma.category.create({
        data: { name: categoryName, slug, isActive: true },
      });
    }
    categoryId = cat.id;
  }

  let imageUrls = Array.isArray(body.imageUrls) ? body.imageUrls.filter((u: unknown) => typeof u === 'string' && (u as string).trim()) : [];
  let videoUrls = Array.isArray(body.videoUrls) ? body.videoUrls.filter((u: unknown) => typeof u === 'string' && (u as string).trim()) : [];
  let mainImageIndex = typeof body.mainImageIndex === 'number' ? Math.max(0, Math.min(body.mainImageIndex, imageUrls.length - 1)) : 0;

  if (imageUrls.length > MAX_IMAGES) imageUrls = imageUrls.slice(0, MAX_IMAGES);
  if (videoUrls.length > MAX_VIDEOS) videoUrls = videoUrls.slice(0, MAX_VIDEOS);
  if (mainImageIndex >= imageUrls.length) mainImageIndex = 0;

  const normalized = await normalizeProductMedia(userId, imageUrls, videoUrls);
  imageUrls = normalized.imageUrls;
  videoUrls = normalized.videoUrls;

  if (!name || !Number.isFinite(price)) {
    return NextResponse.json({ error: 'name et price requis' }, { status: 400 });
  }

  if (!companyId) companyId = body.companyProfileId ?? null;
  if (!companyId) return NextResponse.json({ error: 'companyProfileId required' }, { status: 400 });

  // Garantir un slug unique par entreprise (éviter P2002 + course critique)
  const baseSlug = slug || 'product';
  let finalSlug = baseSlug;
  for (let attempt = 0; attempt < 15; attempt++) {
    if (attempt > 0) finalSlug = `${baseSlug}-${Date.now()}-${Math.floor(Math.random() * 9999)}`;
    const exists = await prisma.product.findFirst({
      where: { companyProfileId: companyId, slug: finalSlug },
    });
    if (!exists) break;
  }

  let product;
  try {
    product = await prisma.product.create({
      data: {
        companyProfileId: companyId,
        categoryId: categoryId || undefined,
        name,
        slug: finalSlug,
        description,
        productType,
        price,
        currency,
        affiliateCommissionPercent,
        sku,
        trackInventory,
        stockQuantity,
        imageUrls,
        mainImageIndex,
        videoUrls,
        isActive: true,
      },
    });
  } catch (err: unknown) {
    const code = err && typeof err === 'object' && 'code' in err ? (err as { code: string }).code : '';
    if (code === 'P2002') {
      // Course critique : réessayer une fois avec slug aléatoire
      finalSlug = `${baseSlug}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      try {
        product = await prisma.product.create({
          data: {
            companyProfileId: companyId,
            categoryId: categoryId || undefined,
            name,
            slug: finalSlug,
            description,
            productType,
            price,
            currency,
            affiliateCommissionPercent,
            sku,
            trackInventory,
            stockQuantity,
            imageUrls,
            mainImageIndex,
            videoUrls,
            isActive: true,
          },
        });
      } catch (retryErr) {
        console.error('Product create P2002 retry failed:', retryErr);
        return NextResponse.json({ error: 'slug_duplicate_retry' }, { status: 500 });
      }
    } else {
      throw err;
    }
  }

  return NextResponse.json({
    ...product,
    price: Number(product.price),
    affiliateCommissionPercent: product.affiliateCommissionPercent ? Number(product.affiliateCommissionPercent) : null,
  });
}
