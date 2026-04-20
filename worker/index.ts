/**
 * Worker BullMQ : commandes, emails, livraisons, notifications
 */
import {
  createOrderWorker,
  createEmailWorker,
  createDeliveryWorker,
  createNotificationWorker,
  addEmailJob,
  addNotificationJob,
} from '../src/lib/queue';
import { prisma } from '../src/lib/db';
import { notifyAdminOrderCreated } from '../src/lib/admin-notifications';

async function processOrderJob(job: { name: string; data: Record<string, unknown> }) {
  if (job.name === 'created') {
    const orderId = job.data.orderId as string;
    if (orderId) {
      await prisma.order.update({ where: { id: orderId }, data: {} }).catch(() => {});
      await notifyAdminOrderCreated(orderId).catch((err) =>
        console.error('[Worker] Admin notification failed:', err)
      );
      console.log('[Worker] Order created:', orderId);
    }
  }
}

async function processEmailJob(job: { data: Record<string, unknown> }) {
  const { to, subject, template } = job.data;
  console.log('[Worker] Email would send:', { to, subject, template });
  // Intégrer SendGrid, Resend, etc.
}

async function processDeliveryJob(job: { name: string; data: Record<string, unknown> }) {
  if (job.name !== 'created') return;
  const orderId = job.data.orderId as string | undefined;
  if (!orderId) return;

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
  if (!order || !order.companyProfile) return;

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

  // Notifications email aux livreurs proches (approximation : tous les livreurs actifs et vérifiés)
  await Promise.all(
    couriers.map(async (c) => {
      if (c.email) {
        await addEmailJob(
          c.email,
          'Nouvelle mission de livraison',
          'courier_new_mission',
          {
            courierFirstName: c.firstName,
            orderNumber: order.orderNumber,
            deliveryId: delivery.id,
          }
        ).catch(() => {});
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

  // Notification email + WhatsApp au fournisseur (admin côté vendeur)
  const supplierUser = order.companyProfile.user;
  if (supplierUser?.email) {
    await addEmailJob(
      supplierUser.email,
      'Nouvelle commande à livrer',
      'supplier_new_order_delivery',
      {
        companyName: order.companyProfile.companyName,
        orderNumber: order.orderNumber,
        deliveryId: delivery.id,
      }
    ).catch(() => {});
  }
  if (supplierUser?.phone) {
    await addNotificationJob('whatsapp', {
      to: supplierUser.phone,
      type: 'supplier_new_order_delivery',
      orderNumber: order.orderNumber,
      deliveryId: delivery.id,
    }).catch(() => {});
  }

  console.log('[Worker] Delivery created and notifications queued:', delivery.id);
}

async function processNotificationJob(job: { name: string; data: Record<string, unknown> }) {
  // Pour l’instant : simple log. Plus tard, intégrer WhatsApp API / push temps réel.
  console.log('[Worker] Notification job', job.name, job.data);
}

async function run() {
  const orderWorker = createOrderWorker(async (job) => {
    await processOrderJob(job);
  });
  const emailWorker = createEmailWorker(async (job) => {
    await processEmailJob(job);
  });
  const deliveryWorker = createDeliveryWorker(async (job) => {
    await processDeliveryJob(job);
  });
  const notificationWorker = createNotificationWorker(async (job) => {
    await processNotificationJob(job);
  });

  orderWorker.on('completed', (job) => console.log('Order job completed', job.id));
  emailWorker.on('completed', (job) => console.log('Email job completed', job.id));
  deliveryWorker.on('completed', (job) => console.log('Delivery job completed', job.id));
  notificationWorker.on('completed', (job) => console.log('Notification job completed', job.id));

  orderWorker.on('failed', (job, err) => console.error('Order job failed', job?.id, err));
  emailWorker.on('failed', (job, err) => console.error('Email job failed', job?.id, err));
  deliveryWorker.on('failed', (job, err) => console.error('Delivery job failed', job?.id, err));
  notificationWorker.on('failed', (job, err) => console.error('Notification job failed', job?.id, err));

  console.log('Workers started (orders, emails, deliveries, notifications).');
}

run().catch(console.error);
