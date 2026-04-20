import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyPassword, signAccessToken, signRefreshToken } from '@/lib/auth';
import { checkRateLimit, recordLoginAttempt, clearLoginAttempts } from '@/lib/rate-limit';
import { auditLog } from '@/lib/audit';

export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for') ?? '127.0.0.1';
  const { allowed } = await checkRateLimit(ip);
  if (!allowed) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  const body = await request.json();
  const email = typeof body.email === 'string' ? body.email.trim() : '';
  const password = typeof body.password === 'string' ? body.password : '';

  if (!email || !password) {
    return NextResponse.json({ error: 'Email et mot de passe requis' }, { status: 400 });
  }

  const { locked } = await recordLoginAttempt(email);
  if (locked) {
    return NextResponse.json({ error: 'Compte temporairement verrouillé. Réessayez plus tard.' }, { status: 429 });
  }

  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
    include: { companyProfile: true, courierProfile: true },
  });

  if (!user || !(await verifyPassword(user.passwordHash, password))) {
    return NextResponse.json({ error: 'Identifiants incorrects' }, { status: 401 });
  }

  if (user.status === 'BLOCKED' || user.status === 'SUSPENDED') {
    return NextResponse.json({ error: 'Compte désactivé' }, { status: 403 });
  }

  await clearLoginAttempts(email);
  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  const accessToken = await signAccessToken({
    sub: user.id,
    email: user.email,
    role: user.role,
  });
  const refreshToken = await signRefreshToken(user.id);

  await auditLog({
    userId: user.id,
    action: 'LOGIN',
    resource: 'user',
    resourceId: user.id,
    ip,
    userAgent: request.headers.get('user-agent') ?? undefined,
  });

  return NextResponse.json({
    accessToken,
    refreshToken,
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
