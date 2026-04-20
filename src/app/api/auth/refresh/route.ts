import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { signAccessToken, signRefreshToken, verifyRefreshToken, revokeRefreshToken } from '@/lib/auth';

export async function POST(request: NextRequest) {
  const body = await request.json();
  const refreshToken = typeof body.refreshToken === 'string' ? body.refreshToken : '';
  if (!refreshToken) {
    return NextResponse.json({ error: 'Refresh token requis' }, { status: 400 });
  }

  const payload = await verifyRefreshToken(refreshToken);
  if (!payload) {
    return NextResponse.json({ error: 'Token invalide ou expiré' }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    include: { companyProfile: true, courierProfile: true },
  });
  if (!user || user.status === 'BLOCKED' || user.status === 'SUSPENDED') {
    return NextResponse.json({ error: 'Compte indisponible' }, { status: 403 });
  }

  await revokeRefreshToken(refreshToken);
  const accessToken = await signAccessToken({
    sub: user.id,
    email: user.email,
    role: user.role,
  });
  const newRefresh = await signRefreshToken(user.id);

  return NextResponse.json({
    accessToken,
    refreshToken: newRefresh,
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      firstName: user.firstName,
      lastName: user.lastName,
      companyProfile: user.companyProfile ? { id: user.companyProfile.id, slug: user.companyProfile.slug } : null,
      courierProfile: user.courierProfile ? { id: user.courierProfile.id } : null,
    },
  });
}
