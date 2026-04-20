/**
 * BullMQ : files pour emails, commissions, notifications, tracking
 */
import { Queue, Worker, type Job } from 'bullmq';
import { prisma } from '@/lib/db';

type QueueMode = 'bullmq' | 'inline';

function getQueueMode(): QueueMode {
  const explicit = (process.env.QUEUE_MODE ?? '').toLowerCase();
  if (explicit === 'bullmq') return 'bullmq';
  if (explicit === 'inline') return 'inline';

  // En prod serverless (ex. Vercel), éviter de dépendre d’un worker long-running par défaut.
  // Si REDIS_URL est fourni, on peut activer BullMQ volontairement via QUEUE_MODE=bullmq.
  return 'inline';
}

let queues:
  | null
  | {
      orderQueue: Queue;
      emailQueue: Queue;
      commissionQueue: Queue;
      deliveryQueue: Queue;
      notificationQueue: Queue;
      connection: import('bullmq').QueueOptions;
    } = null;

function getQueues() {
  if (queues) return queues;
  // Import lazy pour éviter toute tentative de connexion Redis en mode inline.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { getRedisConnection } = require('./redis') as typeof import('./redis');
  // BullMQ accepte un client ioredis; le typing peut varier selon versions, on cast pour stabilité build.
  const connection = { connection: getRedisConnection() as unknown } as unknown as import('bullmq').QueueOptions;
  queues = {
    connection,
    orderQueue: new Queue('orders', connection),
    emailQueue: new Queue('emails', connection),
    commissionQueue: new Queue('commissions', connection),
    deliveryQueue: new Queue('deliveries', connection),
    notificationQueue: new Queue('notifications', connection),
  };
  return queues;
}

export async function addOrderJob(name: string, data: Record<string, unknown>, opts?: { delay?: number }) {
  if (getQueueMode() === 'inline') {
    if (name === 'created') {
      const orderId = data.orderId as string | undefined;
      if (orderId) {
        // Émule l’ancien worker: notification admin + éventuels side-effects.
        await prisma.order.update({ where: { id: orderId }, data: {} }).catch(() => {});
        const mod = await import('@/lib/admin-notifications');
        await mod.notifyAdminOrderCreated(orderId).catch(() => {});
      }
    }
    return { id: `inline-${Date.now()}` } as unknown;
  }

  const { orderQueue } = getQueues();
  return orderQueue.add(name, data, { ...opts });
}

export async function addEmailJob(to: string, subject: string, template: string, data: Record<string, unknown>) {
  if (getQueueMode() === 'inline') {
    // En mode inline, on n'envoie pas réellement d'email: on log seulement (remplaçable plus tard).
    console.log('[InlineQueue] Email job', { to, subject, template, data });
    return { id: `inline-${Date.now()}` } as unknown;
  }

  const { emailQueue } = getQueues();
  return emailQueue.add('send', { to, subject, template, data });
}

export async function addCommissionJob(orderId: string, data: Record<string, unknown>) {
  if (getQueueMode() === 'inline') {
    // La queue commissions n'était pas traitée par le worker actuel.
    console.log('[InlineQueue] Commission job (noop)', { orderId, data });
    return { id: `inline-${Date.now()}` } as unknown;
  }

  const { commissionQueue } = getQueues();
  return commissionQueue.add('compute', { orderId, ...data });
}

export async function addDeliveryJob(name: string, data: Record<string, unknown>) {
  if (getQueueMode() === 'inline') {
    if (name === 'created') {
      const orderId = data.orderId as string | undefined;
      if (orderId) {
        const order = await prisma.order.findUnique({
          where: { id: orderId },
          include: {
            companyProfile: {
              include: {
                user: { select: { id: true, email: true, firstName: true, lastName: true, phone: true } },
              },
            },
          },
        });
        if (!order || !order.companyProfile) return { id: `inline-${Date.now()}` } as unknown;

        const delivery = await prisma.delivery.upsert({
          where: { orderId },
          update: {},
          create: {
            orderId,
            status: 'PENDING',
            deliveryAddress: order.shippingAddress as unknown as import('@prisma/client').Prisma.InputJsonValue,
          },
        });

        const couriers = await prisma.user.findMany({
          where: {
            role: 'COURIER',
            status: 'ACTIVE',
            courierProfile: { isVerified: true },
          },
          select: {
            id: true,
            email: true,
            phone: true,
            firstName: true,
            lastName: true,
          },
        });

        await Promise.all(
          couriers.map(async (c) => {
            if (c.email) {
              await addEmailJob(c.email, 'Nouvelle mission de livraison', 'courier_new_mission', {
                courierFirstName: c.firstName,
                orderNumber: order.orderNumber,
                deliveryId: delivery.id,
              }).catch(() => {});
            }
            if (c.phone) {
              await addNotificationJob('whatsapp', {
                to: c.phone,
                type: 'courier_new_mission',
                orderNumber: order.orderNumber,
                deliveryId: delivery.id,
              }).catch(() => {});
            }
          })
        );

        const supplierUser = order.companyProfile.user;
        if (supplierUser?.email) {
          await addEmailJob(supplierUser.email, 'Nouvelle commande à livrer', 'supplier_new_order_delivery', {
            companyName: order.companyProfile.companyName,
            orderNumber: order.orderNumber,
            deliveryId: delivery.id,
          }).catch(() => {});
        }
        if (supplierUser?.phone) {
          await addNotificationJob('whatsapp', {
            to: supplierUser.phone,
            type: 'supplier_new_order_delivery',
            orderNumber: order.orderNumber,
            deliveryId: delivery.id,
          }).catch(() => {});
        }
      }
    }

    return { id: `inline-${Date.now()}` } as unknown;
  }

  const { deliveryQueue } = getQueues();
  return deliveryQueue.add(name, data);
}

export async function addNotificationJob(channel: 'whatsapp' | 'in_app', data: Record<string, unknown>) {
  if (getQueueMode() === 'inline') {
    console.log('[InlineQueue] Notification job', { channel, data });
    return { id: `inline-${Date.now()}` } as unknown;
  }

  const { notificationQueue } = getQueues();
  return notificationQueue.add(channel, data);
}

export function createOrderWorker(processor: (job: Job) => Promise<void>) {
  const { connection } = getQueues();
  return new Worker('orders', processor, connection as unknown as import('bullmq').WorkerOptions);
}

export function createEmailWorker(processor: (job: Job) => Promise<void>) {
  const { connection } = getQueues();
  return new Worker('emails', processor, connection as unknown as import('bullmq').WorkerOptions);
}

export function createDeliveryWorker(processor: (job: Job) => Promise<void>) {
  const { connection } = getQueues();
  return new Worker('deliveries', processor, connection as unknown as import('bullmq').WorkerOptions);
}

export function createNotificationWorker(processor: (job: Job) => Promise<void>) {
  const { connection } = getQueues();
  return new Worker('notifications', processor, connection as unknown as import('bullmq').WorkerOptions);
}
