/**
 * Audit log pour actions sensibles (Super Admin, modifs règles, etc.)
 */
import { prisma } from './db';
import type { Prisma } from '@prisma/client';

export async function auditLog(params: {
  userId?: string;
  action: string;
  resource: string;
  resourceId?: string;
  details?: Record<string, unknown>;
  ip?: string;
  userAgent?: string;
}): Promise<void> {
  const details: Prisma.InputJsonValue | undefined =
    params.details !== undefined ? (params.details as unknown as Prisma.InputJsonValue) : undefined;

  await prisma.auditLog.create({
    data: {
      userId: params.userId,
      action: params.action,
      resource: params.resource,
      resourceId: params.resourceId,
      details,
      ip: params.ip,
      userAgent: params.userAgent,
    },
  });
}
