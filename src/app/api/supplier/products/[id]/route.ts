import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { normalizeProductMedia } from '@/lib/normalize-product-media';
import type { Prisma } from '@prisma/client';

const PUBLISHER_ROLES = ['SUPPLIER', 'SUPER_ADMIN', 'AFFILIATE'] as const;
const MAX_IMAGES = 10;
const MAX_VIDEOS = 2;

type ProductWithCompany = Prisma.ProductGetPayload<{
  include: { companyProfile: { select: { userId: true } }; category: true };
}>;

/** Vérifie que l'utilisateur peut modifier/supprimer ce produit (créateur ou admin). */
async function canEditProduct(productId: string, userId: string, role: string): Promise<{ ok: boolean; product?: ProductWithCompany }> {
  const product = await prisma.product.findFirst({
    where: { id: productId },
    include: { companyProfile: { select: { userId: true } }, category: true },
  });
  if (!product) return { ok: false };
  if (role === 'SUPER_ADMIN') return { ok: true, product };
  if (product.companyProfile.userId === userId && PUBLISHER_ROLES.includes(role as (typeof PUBLISHER_ROLES)[number])) return { ok: true, product };
  return { ok: false };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = request.headers.get('x-user-id');
  const role = request.headers.get('x-user-role');
  if (!userId || !role || !PUBLISHER_ROLES.includes(role as (typeof PUBLISHER_ROLES)[number])) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const uid: string = userId;
  const { id } = await params;
  const { ok, product } = await canEditProduct(id, uid, role);
  if (!ok || !product) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const { companyProfile, ...rest } = product;
  return NextResponse.json({
    ...rest,
    price: Number(product.price),
    compareAtPrice: product.compareAtPrice ? Number(product.compareAtPrice) : null,
    affiliateCommissionPercent: product.affiliateCommissionPercent ? Number(product.affiliateCommissionPercent) : null,
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = request.headers.get('x-user-id');
  const role = request.headers.get('x-user-role');
  if (!userId || !role || !PUBLISHER_ROLES.includes(role as (typeof PUBLISHER_ROLES)[number])) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const uid: string = userId;
  const { id } = await params;
  const { ok, product: existing } = await canEditProduct(id, uid, role);
  if (!ok || !existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await request.json();
  const name = typeof body.name === 'string' ? body.name.trim() : existing.name;
  const slug = typeof body.slug === 'string' ? body.slug.trim() : name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  const description = body.description !== undefined ? (body.description == null ? null : String(body.description)) : existing.description;
  const productType = body.productType ?? existing.productType;
  const price = typeof body.price === 'number' ? body.price : parseFloat(body.price);
  const affiliateCommissionPercent = body.affiliateCommissionPercent != null ? parseFloat(body.affiliateCommissionPercent) : existing.affiliateCommissionPercent;
  const sku = body.sku !== undefined ? body.sku : existing.sku;
  const trackInventory = body.trackInventory !== undefined ? body.trackInventory : existing.trackInventory;
  const stockQuantity = body.stockQuantity !== undefined ? (parseInt(body.stockQuantity, 10) || 0) : existing.stockQuantity;
  const isActive = body.isActive !== undefined ? body.isActive : existing.isActive;
  const currency = typeof body.currency === 'string' && body.currency.trim().length > 0 && body.currency.trim().length <= 10
    ? body.currency.trim().toUpperCase()
    : existing.currency;

  let categoryId = body.categoryId !== undefined ? body.categoryId : existing.categoryId;
  const categoryName = typeof body.categoryName === 'string' ? body.categoryName.trim() : '';
  if (!categoryId && categoryName) {
    const baseSlug = categoryName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') || 'cat';
    let cat = await prisma.category.findFirst({
      where: { name: { equals: categoryName, mode: 'insensitive' } },
    });
    if (!cat) {
      cat = await prisma.category.create({
        data: { name: categoryName, slug: `${baseSlug}-${Date.now()}`, isActive: true },
      });
    }
    categoryId = cat.id;
  }

  let imageUrls = Array.isArray(body.imageUrls) ? body.imageUrls.filter((u: unknown) => typeof u === 'string' && (u as string).trim()) : existing.imageUrls;
  let videoUrls = Array.isArray(body.videoUrls) ? body.videoUrls.filter((u: unknown) => typeof u === 'string' && (u as string).trim()) : existing.videoUrls;
  let mainImageIndex = typeof body.mainImageIndex === 'number' ? Math.max(0, Math.min(body.mainImageIndex, imageUrls.length - 1)) : existing.mainImageIndex;
  if (imageUrls.length > MAX_IMAGES) imageUrls = imageUrls.slice(0, MAX_IMAGES);
  if (videoUrls.length > MAX_VIDEOS) videoUrls = videoUrls.slice(0, MAX_VIDEOS);
  if (mainImageIndex >= imageUrls.length) mainImageIndex = 0;

  const normalized = await normalizeProductMedia(uid, imageUrls, videoUrls);
  imageUrls = normalized.imageUrls;
  videoUrls = normalized.videoUrls;

  if (!name || !Number.isFinite(price)) {
    return NextResponse.json({ error: 'name et price requis' }, { status: 400 });
  }

  const finalSlug = slug || existing.slug;
  let slugToUse = finalSlug;
  if (finalSlug !== existing.slug) {
    let suffix = 0;
    let taken = true;
    while (taken) {
      const cand = suffix === 0 ? finalSlug : `${finalSlug}-${suffix}`;
      const conflict = await prisma.product.findFirst({
        where: { companyProfileId: existing.companyProfileId, slug: cand, id: { not: id } },
      });
      taken = !!conflict;
      if (!taken) slugToUse = cand;
      else suffix++;
    }
  }

  const product = await prisma.product.update({
    where: { id },
    data: {
      name,
      slug: slug || existing.slug,
      description,
      productType,
      price,
      currency,
      affiliateCommissionPercent,
      sku,
      trackInventory,
      stockQuantity,
      isActive,
      imageUrls,
      mainImageIndex,
      videoUrls,
      categoryId: categoryId ?? null,
    },
  });

  return NextResponse.json({
    ...product,
    price: Number(product.price),
    affiliateCommissionPercent: product.affiliateCommissionPercent ? Number(product.affiliateCommissionPercent) : null,
  });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = request.headers.get('x-user-id');
  const role = request.headers.get('x-user-role');
  if (!userId || !role || !PUBLISHER_ROLES.includes(role as (typeof PUBLISHER_ROLES)[number])) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const uid: string = userId;
  const { id } = await params;
  const { ok } = await canEditProduct(id, uid, role);
  if (!ok) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  await prisma.product.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
