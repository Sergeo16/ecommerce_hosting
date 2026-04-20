/**
 * Notifications admin : plateforme, email, WhatsApp
 * L'admin configure les canaux via Paramètres > Notifications des commandes
 */
import { prisma } from '@/lib/db';
import { addEmailJob, addNotificationJob } from '@/lib/queue';
import { formatNumberForLocale } from '@/lib/currency';

export type AdminNotificationChannels = {
  platform?: boolean;
  email?: boolean;
  whatsapp?: boolean;
};

export type AdminNotificationConfig = {
  channels: AdminNotificationChannels;
  emailOverride?: string | null;
  whatsappPhoneOverride?: string | null;
};

const DEFAULT_CHANNELS: AdminNotificationChannels = {
  platform: true,
  email: false,
  whatsapp: false,
};

export async function getAdminNotificationConfig(): Promise<AdminNotificationConfig> {
  const settings = await prisma.settings.findMany({
    where: {
      key: {
        in: [
          'admin_notification_channels',
          'admin_notification_email',
          'admin_notification_whatsapp_phone',
        ],
      },
    },
  });
  const byKey = Object.fromEntries(settings.map((s) => [s.key, s.value]));

  const channels = (byKey.admin_notification_channels as AdminNotificationChannels) ?? DEFAULT_CHANNELS;
  const emailOverride =
    typeof byKey.admin_notification_email === 'string' &&
    byKey.admin_notification_email.trim()
      ? String(byKey.admin_notification_email).trim()
      : null;
  const whatsappPhoneOverride =
    typeof byKey.admin_notification_whatsapp_phone === 'string' &&
    byKey.admin_notification_whatsapp_phone.trim()
      ? String(byKey.admin_notification_whatsapp_phone).trim()
      : null;

  return { channels, emailOverride, whatsappPhoneOverride };
}

/** Détails complets pour que l'admin puisse confier la livraison (livreur plateforme ou contact externe). */
export type AdminOrderNotificationPayload = {
  orderId: string;
  orderNumber: string;
  clientLabel: string;
  clientEmail: string | null;
  clientPhone: string | null;
  shippingAddress: string;
  shippingCity: string;
  shippingLatLng: string | null;
  companyName: string;
  supplierAddress: string | null;
  supplierCity: string | null;
  supplierLatLng: string | null;
  supplierPhone: string | null;
  supplierEmail: string | null;
  itemsSummary: string;
  itemsDetail: { name: string; quantity: number }[];
  total: number;
  currency: string;
  advancePaid: number;
  balanceDue: number;
  paymentMode: string;
};

function formatLatLng(lat: number | null, lng: number | null): string | null {
  if (lat == null || lng == null || Number.isNaN(lat) || Number.isNaN(lng)) return null;
  return `${Number(lat)}, ${Number(lng)}`;
}

export async function notifyAdminOrderCreated(orderId: string): Promise<void> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      user: { select: { email: true, firstName: true, lastName: true } },
      companyProfile: {
        select: {
          companyName: true,
          address: true,
          city: true,
          addressLat: true,
          addressLng: true,
          user: { select: { phone: true, email: true } },
        },
      },
      items: { include: { product: { select: { name: true } } } },
    },
  });
  if (!order) return;

  const shipping = (order.shippingAddress ?? {}) as Record<string, unknown>;
  const clientAddress = String(shipping.address ?? '').trim();
  const clientCity = String(shipping.city ?? '').trim();
  const clientPhone = typeof shipping.phone === 'string' ? shipping.phone.trim() : null;
  const clientLat = typeof shipping.lat === 'number' ? shipping.lat : null;
  const clientLng = typeof shipping.lng === 'number' ? shipping.lng : null;
  const clientLatLng = formatLatLng(clientLat, clientLng);

  const clientLabel = order.user
    ? `${order.user.firstName ?? ''} ${order.user.lastName ?? ''}`.trim()
    : [order.guestFirstName, order.guestLastName].filter(Boolean).join(' ') || order.guestEmail || 'Invité';
  const clientEmail = order.user?.email ?? order.guestEmail ?? null;

  const cp = order.companyProfile;
  const supplierAddress = cp?.address != null ? String(cp.address).trim() || null : null;
  const supplierCity = cp?.city != null ? String(cp.city).trim() || null : null;
  const supplierLat = cp?.addressLat != null ? Number(cp.addressLat) : null;
  const supplierLng = cp?.addressLng != null ? Number(cp.addressLng) : null;
  const supplierLatLng = formatLatLng(supplierLat, supplierLng);
  const supplierUser = cp?.user as { phone?: string | null; email?: string | null } | undefined;
  const supplierPhone = supplierUser?.phone != null ? String(supplierUser.phone).trim() || null : null;
  const supplierEmail = supplierUser?.email != null ? String(supplierUser.email).trim() || null : null;

  const itemsDetail = order.items.map((i) => ({ name: i.product.name, quantity: i.quantity }));
  const itemsSummary = itemsDetail.map((i) => `${i.name} × ${i.quantity}`).join(', ');

  const payload: AdminOrderNotificationPayload = {
    orderId,
    orderNumber: order.orderNumber,
    clientLabel,
    clientEmail,
    clientPhone,
    shippingAddress: clientAddress,
    shippingCity: clientCity,
    shippingLatLng: clientLatLng,
    companyName: cp?.companyName ?? '',
    supplierAddress,
    supplierCity,
    supplierLatLng,
    supplierPhone,
    supplierEmail,
    itemsSummary,
    itemsDetail,
    total: Number(order.total),
    currency: order.currency,
    advancePaid: Number(order.advancePaid),
    balanceDue: Number(order.balanceDue),
    paymentMode: order.paymentMode,
  };

  const title = `Nouvelle commande ${order.orderNumber}`;
  const clientAddressLine = [clientAddress, clientCity].filter(Boolean).join(', ') || '—';
  const supplierAddressLine = [supplierAddress, supplierCity].filter(Boolean).join(', ') || '—';
  const bodyFull = [
    `Client: ${clientLabel}${clientEmail ? ` (${clientEmail})` : ''}${clientPhone ? ` — Tél: ${clientPhone}` : ''}`,
    `Adresse livraison (client): ${clientAddressLine}${clientLatLng ? ` — GPS: ${clientLatLng}` : ''}`,
    `Fournisseur: ${cp?.companyName ?? '-'} — Adresse: ${supplierAddressLine || '—'}${supplierLatLng ? ` — GPS: ${supplierLatLng}` : ''}${supplierPhone ? ` — Tél: ${supplierPhone}` : ''}${supplierEmail ? ` — ${supplierEmail}` : ''}`,
    `Articles: ${itemsSummary}`,
    `Total: ${formatNumberForLocale(Number(order.total), 'fr')} ${order.currency} (avance: ${formatNumberForLocale(Number(order.advancePaid), 'fr')}, solde: ${formatNumberForLocale(Number(order.balanceDue), 'fr')})`,
  ].join('\n');

  const config = await getAdminNotificationConfig();
  const admins = await prisma.user.findMany({
    where: { role: 'SUPER_ADMIN', status: 'ACTIVE' },
    select: { id: true, email: true, phone: true },
  });

  // À chaque commande, l'admin reçoit au moins la notification plateforme (détails complets pour confier la livraison)
  const sendPlatform = config.channels.platform !== false && admins.length > 0;
  if (sendPlatform) {
    await prisma.notification.createMany({
      data: admins.map((a) => ({
        userId: a.id,
        type: 'order_created',
        title,
        body: bodyFull,
        data: { ...payload },
      })),
    });
  }

  const adminEmail = config.emailOverride ?? admins[0]?.email;
  if (config.channels.email && adminEmail) {
    await addEmailJob(adminEmail, title, 'admin_order_created', payload).catch(() => {});
  }

  const adminPhone = config.whatsappPhoneOverride ?? admins[0]?.phone;
  if (config.channels.whatsapp && adminPhone) {
    await addNotificationJob('whatsapp', {
      to: adminPhone,
      type: 'admin_order_created',
      orderNumber: order.orderNumber,
      orderId,
      body: bodyFull,
    }).catch(() => {});
  }
}
