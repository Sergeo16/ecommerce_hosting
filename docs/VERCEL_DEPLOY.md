# Déploiement 100% gratuit sur Vercel (sans Render)

Ce projet est une application **Next.js 14 (App Router)** avec **Prisma/PostgreSQL**.

L’objectif de ce guide est un déploiement **gratuit sur Vercel**, sans service “worker” long-running.

## Principe (important)

- **Web app**: hébergée sur **Vercel**.
- **Base de données**: PostgreSQL **gratuite** ailleurs (ex: Neon/Supabase).
- **Files BullMQ / Redis**: **désactivées** par défaut sur Vercel via `QUEUE_MODE=inline` (les jobs deviennent des actions synchrones ou des logs).
- **Uploads**: sur Vercel, **le disque n’est pas persistant** → configurez **obligatoirement** S3/R2 en prod.

## 1) Pré-requis gratuits

- Un compte **Vercel** (Free).
- Une base **PostgreSQL gratuite**:
  - Neon (free tier) ou Supabase (free tier).
- Un stockage S3-compatible gratuit/peu coûteux:
  - Cloudflare **R2** (souvent le plus simple).

## 2) Variables d’environnement à définir sur Vercel

Dans Vercel → Project → **Settings → Environment Variables**.

### Obligatoires

- **`DATABASE_URL`**: URL PostgreSQL (celle de Neon/Supabase).
- **`JWT_SECRET`**: secret JWT (long, aléatoire).
- **`REFRESH_SECRET`**: secret refresh tokens (long, aléatoire).
- **`NEXT_PUBLIC_APP_URL`**: URL publique de l’app (ex: `https://votre-projet.vercel.app`).
- **`QUEUE_MODE`**: mettez **`inline`** (pour ne pas dépendre de Redis/BullMQ sur Vercel).

### Uploads (fortement recommandé / quasi obligatoire en prod)

Pour Cloudflare R2 (S3-compatible):

- **`S3_ENDPOINT`**: endpoint R2 (ex: `https://<accountid>.r2.cloudflarestorage.com`)
- **`S3_PUBLIC_BASE_URL`**: base URL publique (ex: `https://pub-xxxxx.r2.dev`)
- **`S3_BUCKET`**
- **`S3_ACCESS_KEY`**
- **`S3_SECRET_KEY`**
- **`S3_REGION`**: `auto`

### Paiements (optionnels)

- Kkiapay: `KKIAPAY_PUBLIC_KEY`, `KKIAPAY_PRIVATE_KEY`, `KKIAPAY_SECRET_KEY`, `KKIAPAY_SANDBOX`
- FedaPay: `FEDAPAY_PUBLIC_KEY`, `FEDAPAY_SECRET_API_KEY`, `FEDAPAY_ENV`
- Stripe: `STRIPE_SECRET_KEY`

## 3) Créer le projet Vercel

1. Poussez le code sur GitHub (repo).
2. Vercel → **Add New → Project** → importer le repo.
3. Framework: Vercel détecte **Next.js** automatiquement.
4. Build & Output:
   - **Build Command**: `npm run vercel-build`
   - **Install Command**: `npm ci` (ou `npm install`)
   - Output: laissez par défaut (Next.js)

## 4) Migrations Prisma en production

Le script `vercel-build` exécute:

- `prisma migrate deploy`
- puis `next build`

Donc les migrations sont appliquées automatiquement au build.

## 5) Point d’attention: BullMQ/Redis & workers

Sur Render, vous pouviez lancer `npm run worker` en process séparé.

Sur Vercel Free, ce modèle **n’existe pas** (pas de worker long-running). Le projet a donc un mode:

- `QUEUE_MODE=inline` (recommandé sur Vercel): les jobs “order/delivery/email/notification” deviennent immédiats (ou loggués).
- `QUEUE_MODE=bullmq` (si un jour vous branchez Redis + un vrai worker ailleurs).

## 6) Vérification rapide

- Déployez (Vercel).
- Ouvrez la home.
- Testez la création de commande et la création de livraison (les notifications email/whatsapp sont en **log** si `QUEUE_MODE=inline`).

