import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { Role, UserStatus, type Prisma } from '@prisma/client';
import { auditLog } from '@/lib/audit';

export async function GET(request: NextRequest) {
  const role = request.headers.get('x-user-role');
  if (role !== 'SUPER_ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');
  const userRole = searchParams.get('role');
  const page = Math.max(0, parseInt(searchParams.get('page') ?? '0', 10));
  const limit = Math.min(50, parseInt(searchParams.get('limit') ?? '20', 10));

  const where: Prisma.UserWhereInput = {};
  if (status && Object.values(UserStatus).includes(status as UserStatus)) {
    where.status = status as UserStatus;
  }
  if (userRole && Object.values(Role).includes(userRole as Role)) {
    where.role = userRole as Role;
  }

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        role: true,
        status: true,
        firstName: true,
        lastName: true,
        phone: true,
        createdAt: true,
        companyProfile: { select: { companyName: true, slug: true } },
        courierProfile: { select: { isVerified: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: page * limit,
      take: limit,
    }),
    prisma.user.count({ where }),
  ]);

  return NextResponse.json({ users, total, page, limit });
}

export async function PATCH(request: NextRequest) {
  const role = request.headers.get('x-user-role');
  const adminId = request.headers.get('x-user-id');
  if (role !== 'SUPER_ADMIN' || !adminId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await request.json();
  const targetId = typeof body.userId === 'string' ? body.userId : '';
  const newStatus = body.status; // ACTIVE | SUSPENDED | BLOCKED
  if (!targetId || !['ACTIVE', 'SUSPENDED', 'BLOCKED'].includes(newStatus)) {
    return NextResponse.json({ error: 'userId et status (ACTIVE|SUSPENDED|BLOCKED) requis' }, { status: 400 });
  }

  const user = await prisma.user.update({
    where: { id: targetId },
    data: { status: newStatus },
  });

  await auditLog({
    userId: adminId,
    action: 'USER_STATUS_CHANGE',
    resource: 'user',
    resourceId: targetId,
    details: { previousStatus: user.status, newStatus },
  });

  return NextResponse.json({ ok: true, status: newStatus });
}
