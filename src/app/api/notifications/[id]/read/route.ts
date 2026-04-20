import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const userId = request.headers.get('x-user-id');
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const n = await prisma.notification.findFirst({
    where: { id: params.id, userId },
  });
  if (!n) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await prisma.notification.update({
    where: { id: params.id },
    data: { readAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}
