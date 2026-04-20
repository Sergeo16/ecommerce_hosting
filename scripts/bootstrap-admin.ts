/**
 * Bootstrap du premier Super Admin en production.
 * À exécuter une fois après le déploiement (ou manuellement) lorsque
 * SUPER_ADMIN_EMAIL et SUPER_ADMIN_PASSWORD sont définis.
 * Ne crée un compte que s’il n’existe aucun utilisateur SUPER_ADMIN.
 */
import { PrismaClient, Role } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

async function main() {
  const email = process.env.SUPER_ADMIN_EMAIL?.trim();
  const password = process.env.SUPER_ADMIN_PASSWORD;

  if (!email || !password) {
    console.log(
      'Bootstrap admin ignoré : définissez SUPER_ADMIN_EMAIL et SUPER_ADMIN_PASSWORD pour créer le premier Super Admin.'
    );
    return;
  }

  if (password.length < 8) {
    console.error('SUPER_ADMIN_PASSWORD doit contenir au moins 8 caractères.');
    process.exit(1);
  }

  const existing = await prisma.user.findFirst({ where: { role: Role.SUPER_ADMIN } });
  if (existing) {
    console.log('Un Super Admin existe déjà. Aucun compte créé.');
    return;
  }

  const emailLower = email.toLowerCase();
  const duplicate = await prisma.user.findUnique({ where: { email: emailLower } });
  if (duplicate) {
    console.error(`Un utilisateur existe déjà avec l’email ${emailLower}. Changez SUPER_ADMIN_EMAIL ou attribuez le rôle SUPER_ADMIN manuellement.`);
    process.exit(1);
  }

  const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
  const user = await prisma.user.create({
    data: {
      email: emailLower,
      passwordHash,
      role: Role.SUPER_ADMIN,
      firstName: 'Super',
      lastName: 'Admin',
      phone: null,
    },
  });

  console.log('Super Admin créé avec succès:', user.email);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
