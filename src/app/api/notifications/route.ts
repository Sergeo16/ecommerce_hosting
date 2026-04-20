import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import type { Prisma } from '@prisma/client';

export async function GET(request: NextRequest) {
  const userId = request.headers.get('x-user-id');
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') ?? '20', 10)));
  const unreadOnly = searchParams.get('unreadOnly') === 'true';

  const where: Prisma.NotificationWhereInput = { userId };
  if (unreadOnly) where.readAt = null;

  const [notifications, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
    }),
    prisma.notification.count({
      where: { userId, readAt: null },
    }),
  ]);

  return NextResponse.json({ notifications, unreadCount });
}
