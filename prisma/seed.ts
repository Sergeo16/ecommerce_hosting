/**
 * Seed complet : 1 Super Admin, 3 fournisseurs, 10 produits, 5 affiliés, 3 livreurs, 10 commandes, 5 livraisons
 */
import { PrismaClient, Role, ProductType, OrderStatus, DeliveryStatus, CommissionType, PaymentMethod, PaymentStatus } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

async function main() {
  const hash = await argon2.hash('Admin123!', { type: argon2.argon2id });

  // 1 Super Admin (uniquement en dev : ne jamais créer l’admin de démo en production)
  if (process.env.NODE_ENV !== 'production') {
    const superAdmin = await prisma.user.upsert({
      where: { email: 'superadmin@marketplace.bj' },
      update: {},
      create: {
        email: 'superadmin@marketplace.bj',
        passwordHash: hash,
        role: Role.SUPER_ADMIN,
        firstName: 'Super',
        lastName: 'Admin',
        phone: '+22997000000',
      },
    });
    console.log('Super Admin (dev) créé:', superAdmin.email);
  } else {
    console.log('Super Admin (dev) ignoré en production — utilisez le bootstrap ou créez l’admin manuellement.');
  }

  // 3 Fournisseurs + CompanyProfile
  const suppliers = await Promise.all([
    prisma.user.upsert({
      where: { email: 'fournisseur1@marketplace.bj' },
      update: {},
      create: {
        email: 'fournisseur1@marketplace.bj',
        passwordHash: hash,
        role: Role.SUPPLIER,
        firstName: 'Jean',
        lastName: 'Vendeur',
        phone: '+22997000001',
      },
    }),
    prisma.user.upsert({
      where: { email: 'fournisseur2@marketplace.bj' },
      update: {},
      create: {
        email: 'fournisseur2@marketplace.bj',
        passwordHash: hash,
        role: Role.SUPPLIER,
        firstName: 'Marie',
        lastName: 'Commerce',
        phone: '+22997000002',
      },
    }),
    prisma.user.upsert({
      where: { email: 'fournisseur3@marketplace.bj' },
      update: {},
      create: {
        email: 'fournisseur3@marketplace.bj',
        passwordHash: hash,
        role: Role.SUPPLIER,
        firstName: 'Paul',
        lastName: 'Boutique',
        phone: '+22997000003',
      },
    }),
  ]);

  await Promise.all([
    prisma.companyProfile.upsert({
      where: { userId: suppliers[0].id },
      update: {},
      create: {
        userId: suppliers[0].id,
        companyName: 'Tech Store BJ',
        slug: 'tech-store-bj',
        description: 'Électronique et téléphonie',
        country: 'BJ',
        city: 'Cotonou',
        defaultAffiliateCommissionPercent: 10,
        isVerified: true,
      },
    }),
    prisma.companyProfile.upsert({
      where: { userId: suppliers[1].id },
      update: {},
      create: {
        userId: suppliers[1].id,
        companyName: 'Mode & Style',
        slug: 'mode-style',
        description: 'Vêtements et accessoires',
        country: 'BJ',
        city: 'Porto-Novo',
        defaultAffiliateCommissionPercent: 15,
        isVerified: true,
      },
    }),
    prisma.companyProfile.upsert({
      where: { userId: suppliers[2].id },
      update: {},
      create: {
        userId: suppliers[2].id,
        companyName: 'Recharge Pro',
        slug: 'recharge-pro',
        description: 'Codes recharge et forfaits',
        country: 'BJ',
        city: 'Cotonou',
        defaultAffiliateCommissionPercent: 5,
        isVerified: true,
      },
    }),
  ]);

  const [cp1, cp2, cp3] = await prisma.companyProfile.findMany({ orderBy: { createdAt: 'asc' } });

  // Catégories
  const catElectro = await prisma.category.upsert({
    where: { slug: 'electronique' },
    update: {},
    create: { name: 'Électronique', slug: 'electronique', sortOrder: 1, isActive: true },
  });
  const catMode = await prisma.category.upsert({
    where: { slug: 'mode' },
    update: {},
    create: { name: 'Mode', slug: 'mode', sortOrder: 2, isActive: true },
  });
  const catRecharge = await prisma.category.upsert({
    where: { slug: 'recharge' },
    update: {},
    create: { name: 'Recharge', slug: 'recharge', sortOrder: 3, isActive: true },
  });

  // 10 produits variés
  const products = await Promise.all([
    prisma.product.create({
      data: {
        companyProfileId: cp1.id,
        categoryId: catElectro.id,
        name: 'Smartphone Samsung A54',
        slug: 'samsung-a54',
        description: 'Smartphone 128Go',
        productType: ProductType.PHYSICAL,
        imageUrls: [],
        price: 185000,
        affiliateCommissionPercent: 10,
        sku: 'SAM-A54',
        trackInventory: true,
        stockQuantity: 50,
        isActive: true,
      },
    }),
    prisma.product.create({
      data: {
        companyProfileId: cp1.id,
        categoryId: catElectro.id,
        name: 'Chargeur rapide USB-C',
        slug: 'chargeur-rapide-usbc',
        productType: ProductType.PHYSICAL,
        imageUrls: [],
        price: 8500,
        affiliateCommissionPercent: 8,
        sku: 'CHG-01',
        stockQuantity: 200,
        isActive: true,
      },
    }),
    prisma.product.create({
      data: {
        companyProfileId: cp1.id,
        categoryId: catElectro.id,
        name: 'Cours React avancé',
        slug: 'cours-react-avance',
        productType: ProductType.COURSE,
        imageUrls: [],
        price: 25000,
        isDigital: true,
        downloadUrl: 'https://example.com/course',
        affiliateCommissionPercent: 20,
        isActive: true,
      },
    }),
    prisma.product.create({
      data: {
        companyProfileId: cp2.id,
        categoryId: catMode.id,
        name: 'T-shirt premium',
        slug: 'tshirt-premium',
        productType: ProductType.PHYSICAL,
        imageUrls: [],
        price: 7500,
        affiliateCommissionPercent: 15,
        sku: 'TSH-01',
        stockQuantity: 100,
        isActive: true,
      },
    }),
    prisma.product.create({
      data: {
        companyProfileId: cp2.id,
        categoryId: catMode.id,
        name: 'Jean slim',
        slug: 'jean-slim',
        productType: ProductType.PHYSICAL,
        imageUrls: [],
        price: 15000,
        affiliateCommissionPercent: 12,
        sku: 'JN-01',
        stockQuantity: 80,
        isActive: true,
      },
    }),
    prisma.product.create({
      data: {
        companyProfileId: cp2.id,
        categoryId: catMode.id,
        name: 'Sac à main cuir',
        slug: 'sac-main-cuir',
        productType: ProductType.PHYSICAL,
        imageUrls: [],
        price: 35000,
        affiliateCommissionPercent: 15,
        sku: 'SAC-01',
        stockQuantity: 30,
        isActive: true,
      },
    }),
    prisma.product.create({
      data: {
        companyProfileId: cp3.id,
        categoryId: catRecharge.id,
        name: 'Recharge MTN 1000',
        slug: 'recharge-mtn-1000',
        productType: ProductType.RECHARGE_CODE,
        imageUrls: [],
        price: 1000,
        affiliateCommissionPercent: 5,
        isDigital: true,
        isActive: true,
      },
    }),
    prisma.product.create({
      data: {
        companyProfileId: cp3.id,
        categoryId: catRecharge.id,
        name: 'Forfait Moov 2Go',
        slug: 'forfait-moov-2go',
        productType: ProductType.SUBSCRIPTION,
        imageUrls: [],
        price: 1500,
        affiliateCommissionPercent: 5,
        isActive: true,
      },
    }),
    prisma.product.create({
      data: {
        companyProfileId: cp1.id,
        categoryId: catElectro.id,
        name: 'Ticket concert Cotonou',
        slug: 'ticket-concert-cotonou',
        productType: ProductType.TICKET,
        imageUrls: [],
        price: 5000,
        affiliateCommissionPercent: 10,
        isActive: true,
      },
    }),
    prisma.product.create({
      data: {
        companyProfileId: cp2.id,
        categoryId: catMode.id,
        name: 'Service personnalisation tee-shirt',
        slug: 'service-perso-tee',
        productType: ProductType.SERVICE,
        imageUrls: [],
        price: 3000,
        affiliateCommissionPercent: 10,
        isActive: true,
      },
    }),
  ]);

  // 5 affiliés
  const affiliates = await Promise.all(
    ['aff1@marketplace.bj', 'aff2@marketplace.bj', 'aff3@marketplace.bj', 'aff4@marketplace.bj', 'aff5@marketplace.bj'].map(
      (email, i) =>
        prisma.user.upsert({
          where: { email },
          update: {},
          create: {
            email,
            passwordHash: hash,
            role: Role.AFFILIATE,
            firstName: `Affilié`,
            lastName: `${i + 1}`,
            phone: `+2299700010${i}`,
          },
        })
    )
  );

  // 3 livreurs
  const couriers = await Promise.all(
    ['livreur1@marketplace.bj', 'livreur2@marketplace.bj', 'livreur3@marketplace.bj'].map((email, i) =>
      prisma.user.upsert({
        where: { email },
        update: {},
        create: {
          email,
          passwordHash: hash,
          role: Role.COURIER,
          firstName: `Livreur`,
          lastName: `${i + 1}`,
          phone: `+2299700020${i}`,
        },
      })
    )
  );

  for (const c of couriers) {
    await prisma.courierProfile.upsert({
      where: { userId: c.id },
      update: {},
      create: {
        userId: c.id,
        vehicleType: 'moto',
        isVerified: true,
        rating: 4.5,
        totalDeliveries: 0,
      },
    });
  }

  // 1 client
  const client = await prisma.user.upsert({
    where: { email: 'client@marketplace.bj' },
    update: {},
    create: {
      email: 'client@marketplace.bj',
      passwordHash: hash,
      role: Role.CLIENT,
      firstName: 'Client',
      lastName: 'Test',
      phone: '+22997000300',
    },
  });

  await prisma.wallet.createMany({
    data: [...affiliates, ...couriers].map((u) => ({ userId: u.id, balance: 0, currency: 'XOF' })),
    skipDuplicates: true,
  });

  // Liens affiliés
  const links = await Promise.all(
    affiliates.slice(0, 3).map((aff, i) =>
      prisma.affiliateLink.create({
        data: {
          userId: aff.id,
          productId: products[i].id,
          slug: `aff-${aff.id.slice(-6)}-${i}`,
          referralCode: `REF${1000 + i}`,
          utmSource: 'whatsapp',
          clickCount: 10 + i * 5,
          conversionCount: i + 1,
        },
      })
    )
  );

  // 10 commandes
  const ordersData = [
    { total: 185000, advance: 185000, status: OrderStatus.CONFIRMED },
    { total: 8500, advance: 8500, status: OrderStatus.PROCESSING },
    { total: 25000, advance: 12500, status: OrderStatus.PENDING },
    { total: 7500, advance: 7500, status: OrderStatus.DELIVERED },
    { total: 15000, advance: 7500, status: OrderStatus.SHIPPED },
    { total: 35000, advance: 35000, status: OrderStatus.CONFIRMED },
    { total: 1000, advance: 1000, status: OrderStatus.DELIVERED },
    { total: 1500, advance: 1500, status: OrderStatus.DELIVERED },
    { total: 5000, advance: 5000, status: OrderStatus.PENDING },
    { total: 3000, advance: 3000, status: OrderStatus.CONFIRMED },
  ];

  const orders = [];
  for (let i = 0; i < 10; i++) {
    const o = ordersData[i];
    const companyId = [cp1.id, cp1.id, cp1.id, cp2.id, cp2.id, cp2.id, cp3.id, cp3.id, cp1.id, cp2.id][i];
    const product = products[i];
    const order = await prisma.order.create({
      data: {
        orderNumber: `ORD-${Date.now()}-${i}`,
        userId: client.id,
        companyProfileId: companyId,
        status: o.status,
        paymentMode: 'FULL_UPFRONT',
        subtotal: o.total,
        shippingAmount: i % 2 === 0 ? 2000 : 0,
        total: o.total + (i % 2 === 0 ? 2000 : 0),
        advancePaid: o.advance,
        balanceDue: o.total + (i % 2 === 0 ? 2000 : 0) - o.advance,
        currency: 'XOF',
        affiliateLinkId: links[i % 3]?.id,
        shippingAddress: {
          city: 'Cotonou',
          district: 'Godomey',
          address: 'Rue 123',
          phone: client.phone,
        },
      },
    });
    await prisma.orderItem.create({
      data: {
        orderId: order.id,
        productId: product.id,
        quantity: 1,
        unitPrice: product.price,
        total: product.price,
        affiliateCommissionPercent: product.affiliateCommissionPercent,
      },
    });
    orders.push(order);
  }

  // Paiements
  for (const order of orders.slice(0, 6)) {
    await prisma.payment.create({
      data: {
        orderId: order.id,
        userId: client.id,
        amount: order.total,
        method: PaymentMethod.MOBILE_MONEY_MTN,
        status: PaymentStatus.COMPLETED,
        externalId: `mock-${order.id}`,
      },
    });
  }

  // Commissions (plateforme, affilié)
  for (let i = 0; i < 5; i++) {
    const order = orders[i];
    const item = await prisma.orderItem.findFirst({ where: { orderId: order.id }, include: { product: true } });
    if (!item || !order.affiliateLinkId) continue;
    const affPercent = Number(item.affiliateCommissionPercent ?? 10);
    const affAmount = (Number(item.total) * affPercent) / 100;
    const platformAmount = Number(item.total) * 0.05;
    await prisma.commission.createMany({
      data: [
        { orderId: order.id, type: CommissionType.PLATFORM, amount: platformAmount, percent: 5, status: 'APPROVED' },
        {
          orderId: order.id,
          affiliateLinkId: order.affiliateLinkId,
          userId: affiliates[i % 3].id,
          type: CommissionType.AFFILIATE,
          amount: affAmount,
          percent: affPercent,
          status: 'PENDING',
        },
      ],
    });
  }

  // 5 livraisons
  const deliveryStatuses: DeliveryStatus[] = [DeliveryStatus.DELIVERED, DeliveryStatus.IN_TRANSIT, DeliveryStatus.ASSIGNED, DeliveryStatus.PICKED_UP, DeliveryStatus.PENDING];
  for (let i = 0; i < 5; i++) {
    await prisma.delivery.create({
      data: {
        orderId: orders[i].id,
        courierId: couriers[i % 3].id,
        status: deliveryStatuses[i],
        deliveryAddress: orders[i].shippingAddress as object,
        commissionAmount: 1500,
        ...(deliveryStatuses[i] === DeliveryStatus.DELIVERED && { deliveredAt: new Date() }),
      },
    });
  }

  // Settings globales (Super Admin)
  await prisma.settings.upsert({
    where: { key: 'platform_commission_percent' },
    update: {},
    create: { key: 'platform_commission_percent', value: 5, group: 'commission' },
  });
  await prisma.settings.upsert({
    where: { key: 'payment_modes' },
    update: {},
    create: {
      key: 'payment_modes',
      value: {
        fullUpfront: true,
        partialAdvance: true,
        payOnDelivery: true,
        minAdvancePercent: 30,
      },
      group: 'payment',
    },
  });
  await prisma.settings.upsert({
    where: { key: 'theme' },
    update: {},
    create: { key: 'theme', value: 'business', group: 'ui' },
  });
  await prisma.settings.upsert({
    where: { key: 'allowed_currencies' },
    update: {},
    create: { key: 'allowed_currencies', value: ['XOF'], group: 'payment' },
  });

  console.log('Seed terminé avec succès.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
