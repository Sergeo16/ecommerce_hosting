import { NextRequest, NextResponse } from 'next/server';
import { redis } from '@/lib/redis';
import { auditLog } from '@/lib/audit';

const MAINTENANCE_KEY = 'maintenance_mode';

export async function GET() {
  const value = await redis.get(MAINTENANCE_KEY);
  return NextResponse.json({ maintenance: value === '1' });
}

export async function POST(request: NextRequest) {
  const role = request.headers.get('x-user-role');
  const userId = request.headers.get('x-user-id');
  if (role !== 'SUPER_ADMIN' || !userId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await request.json();
  const enabled = Boolean(body.enabled);
  if (enabled) {
    await redis.set(MAINTENANCE_KEY, '1');
  } else {
    await redis.del(MAINTENANCE_KEY);
  }

  await auditLog({
    userId,
    action: 'MAINTENANCE_TOGGLE',
    resource: 'system',
    details: { enabled },
  });

  return NextResponse.json({ maintenance: enabled });
}
