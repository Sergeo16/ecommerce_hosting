import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { hashPassword, signAccessToken, signRefreshToken } from '@/lib/auth';
import { sanitizeAddress, sanitizeCity, sanitizeLat, sanitizeLng } from '@/lib/validate-fields';
import type { Role } from '@prisma/client';
import { z } from 'zod';

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  firstName: z.string().max(100).optional().default(''),
  lastName: z.string().max(100).optional().default(''),
  phone: z.string().optional(),
  role: z.enum(['CLIENT', 'AFFILIATE', 'SUPPLIER', 'COURIER']).default('CLIENT'),
  companyName: z.string().max(200).optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  addressLat: z.number().optional(),
  addressLng: z.number().optional(),
});

export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Données invalides', details: parsed.error.flatten() }, { status: 400 });
  }

  const { email, password, firstName, lastName, phone, role, companyName, address, city, addressLat, addressLng } = parsed.data;
  const emailLower = email.toLowerCase();

  if (role === 'SUPPLIER') {
    const hasCompanyName = companyName != null && String(companyName).trim().length > 0;
    const hasPhone = phone != null && String(phone).trim().length > 0;
    const hasAddressText = address != null && city != null && String(address).trim().length > 0 && String(city).trim().length > 0;
    const hasAddressGps = addressLat != null && addressLng != null && Number.isFinite(addressLat) && Number.isFinite(addressLng);
    if (!hasCompanyName) {
      return NextResponse.json({ error: 'Le nom de l\'entreprise est obligatoire pour les fournisseurs.' }, { status: 400 });
    }
    if (!hasPhone) {
      return NextResponse.json({ error: 'Le numéro de téléphone est obligatoire pour les fournisseurs.' }, { status: 400 });
    }
    if (!hasAddressText && !hasAddressGps) {
      return NextResponse.json({ error: 'L\'adresse (saisie ou position GPS) est obligatoire pour les fournisseurs.' }, { status: 400 });
    }
  }

  if (role === 'COURIER') {
    const hasPhone = phone != null && String(phone).trim().length > 0;
    if (!hasPhone) {
      return NextResponse.json({ error: 'Le numéro de téléphone est obligatoire pour les livreurs.' }, { status: 400 });
    }
  }

  const safeFirstName = firstName?.trim() ?? '';
  const safeLastName = lastName?.trim() ?? '';
  if (role !== 'SUPPLIER' && (!safeFirstName || !safeLastName)) {
    return NextResponse.json({ error: 'Le prénom et le nom sont obligatoires.' }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { email: emailLower } });
  if (existing) {
    return NextResponse.json({ error: 'Un compte existe déjà avec cet email' }, { status: 409 });
  }

  const userFirstName = role === 'SUPPLIER' && !safeFirstName ? (companyName?.trim() ?? 'Entreprise') : (safeFirstName || '—');
  const userLastName = role === 'SUPPLIER' && !safeLastName ? '' : (safeLastName || '—');

  const passwordHash = await hashPassword(password);
  const userAddress = role !== 'SUPPLIER' ? (sanitizeAddress(address) || null) : null;
  const userCity = role !== 'SUPPLIER' ? (sanitizeCity(city) || null) : null;
  const userLat = role !== 'SUPPLIER' ? sanitizeLat(addressLat) : undefined;
  const userLng = role !== 'SUPPLIER' ? sanitizeLng(addressLng) : undefined;

  const user = await prisma.user.create({
    data: {
      email: emailLower,
      passwordHash,
      firstName: userFirstName,
      lastName: userLastName,
      phone: phone ?? null,
      role: role as Role,
      address: userAddress ?? undefined,
      city: userCity ?? undefined,
      addressLat: userLat,
      addressLng: userLng,
    },
  });

  if (role === 'SUPPLIER') {
    const slug = `company-${user.id.slice(-8)}`;
    const hasGps = addressLat != null && addressLng != null && Number.isFinite(addressLat) && Number.isFinite(addressLng);
    await prisma.companyProfile.create({
      data: {
        userId: user.id,
        companyName: (companyName?.trim() ?? '').slice(0, 200) || userFirstName,
        slug,
        country: 'BJ',
        address: address?.trim() || (hasGps ? `Position GPS ${addressLat},${addressLng}` : null),
        city: city?.trim() || null,
        addressLat: hasGps ? addressLat! : undefined,
        addressLng: hasGps ? addressLng! : undefined,
      },
    });
  }
  if (role === 'COURIER') {
    await prisma.courierProfile.create({
      data: { userId: user.id, vehicleType: 'moto' },
    });
  }
  if (role === 'AFFILIATE' || role === 'COURIER' || role === 'SUPPLIER') {
    await prisma.wallet.create({
      data: { userId: user.id, balance: 0, currency: 'XOF' },
    });
  }

  const accessToken = await signAccessToken({ sub: user.id, email: user.email, role: user.role });
  const refreshToken = await signRefreshToken(user.id);

  return NextResponse.json({
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      firstName: user.firstName,
      lastName: user.lastName,
    },
  });
}
