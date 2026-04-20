import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { auditLog } from '@/lib/audit';

export async function GET(request: NextRequest) {
  const role = request.headers.get('x-user-role');
  if (role !== 'SUPER_ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const list = await prisma.settings.findMany({ orderBy: { key: 'asc' } });
  const byKey: Record<string, unknown> = {};
  for (const s of list) byKey[s.key] = s.value;
  return NextResponse.json(byKey);
}

export async function PUT(request: NextRequest) {
  const role = request.headers.get('x-user-role');
  const userId = request.headers.get('x-user-id');
  if (role !== 'SUPER_ADMIN' || !userId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await request.json();
  const key = typeof body.key === 'string' ? body.key : '';
  const value = body.value;
  const group = typeof body.group === 'string' ? body.group : null;
  if (!key) return NextResponse.json({ error: 'key required' }, { status: 400 });

  await prisma.settings.upsert({
    where: { key },
    update: { value: value as object, group },
    create: { key, value: value as object, group },
  });

  await auditLog({
    userId,
    action: 'SETTINGS_UPDATE',
    resource: 'settings',
    resourceId: key,
    details: { key, group },
  });

  return NextResponse.json({ ok: true });
}
