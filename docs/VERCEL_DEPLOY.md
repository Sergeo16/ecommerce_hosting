# Déploiement 100% gratuit sur Vercel (sans Render)

Ce projet est une application **Next.js 14 (App Router)** avec **Prisma/PostgreSQL**.

L’objectif de ce guide est un déploiement **gratuit sur Vercel**, sans service “worker” long-running.

## Principe (important)

- **Web app**: hébergée sur **Vercel**.
- **Base de données**: PostgreSQL **gratuite** ailleurs (ex: Neon/Supabase).
- **Files BullMQ / Redis**: **désactivées** par défaut sur Vercel via `QUEUE_MODE=inline` (les jobs deviennent des actions synchrones ou des logs).
- **Uploads**: sur Vercel, **le disque n’est pas persistant** → configurez **obligatoirement** S3/R2 en prod.
- **Serverless = connexions DB**: sur Vercel, il peut y avoir plusieurs instances → utilisez une **URL poolée** pour l’app (`DATABASE_URL`) et une **URL directe** pour les migrations (`DIRECT_URL`).

## Stack “gratuite” recommandée (plateformes / outils)

- **Hébergement**: **Vercel (Free)** — build + déploiement + serverless.
- **Code**: **GitHub (Free)** — repo + intégration Vercel.
- **PostgreSQL** (au choix):
  - **Neon (Free tier)**: Postgres + **pooling** très adapté au serverless.
  - **Supabase (Free tier)**: Postgres + dashboard + Auth/Storage/Edge Functions (optionnels).
- **Stockage fichiers**: **Cloudflare R2** (free tier généralement suffisant) — S3 compatible, egress gratuit.
- **Observabilité** (optionnel mais utile): **Sentry (Free)** pour erreurs front/back.
- **Redis** (optionnel):
  - En mode gratuit “simple”, **ne mettez pas Redis** et gardez `QUEUE_MODE=inline`.
  - Si vous voulez Redis plus tard: un provider avec free tier (ex: Upstash) + `QUEUE_MODE=bullmq` + un vrai worker **hors Vercel**.

## 1) Pré-requis gratuits

- Un compte **Vercel** (Free).
- Une base **PostgreSQL gratuite**:
  - Neon (free tier) ou Supabase (free tier).
- Un stockage S3-compatible gratuit/peu coûteux:
  - Cloudflare **R2** (souvent le plus simple).

## 2) Variables d’environnement à définir sur Vercel

Dans Vercel → Project → **Settings → Environment Variables**.

### Obligatoires

- **`DATABASE_URL`**: URL PostgreSQL **poolée** (celle de Neon/Supabase).
- **`DIRECT_URL`**: URL PostgreSQL **directe** (sans pooler) — utilisée par Prisma pour `migrate deploy` au build.
- **`JWT_SECRET`**: secret JWT (long, aléatoire).
- **`REFRESH_SECRET`**: secret refresh tokens (long, aléatoire).
- **`NEXT_PUBLIC_APP_URL`**: URL publique de l’app (ex: `https://votre-projet.vercel.app`).
- **`QUEUE_MODE`**: mettez **`inline`** (pour ne pas dépendre de Redis/BullMQ sur Vercel).
- **`SUPER_ADMIN_EMAIL`** et **`SUPER_ADMIN_PASSWORD`**: identifiants du premier Super Admin (voir section 7).

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

### Monitoring (optionnel)

- Sentry: `SENTRY_DSN`, `SENTRY_ORG`, `SENTRY_PROJECT`

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

### Pourquoi `DIRECT_URL` est important sur Vercel

- **`DATABASE_URL` (poolée)**: protège la DB contre l’explosion de connexions due au serverless.
- **`migrate deploy`**: a besoin d’une connexion “stable” et **ne doit pas passer par un pooler** (PgBouncer/transaction pooling) dans la plupart des cas.
- Le repo est déjà prêt: `prisma/schema.prisma` supporte `directUrl = env("DIRECT_URL")`.

## 5) Point d’attention: BullMQ/Redis & workers

Sur Render, vous pouviez lancer `npm run worker` en process séparé.

Sur Vercel Free, ce modèle **n’existe pas** (pas de worker long-running). Le projet a donc un mode:

- `QUEUE_MODE=inline` (recommandé sur Vercel): les jobs “order/delivery/email/notification” deviennent immédiats (ou loggués).
- `QUEUE_MODE=bullmq` (si un jour vous branchez Redis + un vrai worker ailleurs).

### À savoir si vous n’avez pas Redis

Le code a un fallback “in-memory” si `REDIS_URL` n’est pas défini:
- **OK pour démarrer gratuitement**.
- Limites: la rate-limit et certains drapeaux (maintenance) deviennent **par instance** et peuvent “oublier” leur état entre deux requêtes.

## 6) Vérification rapide

- Déployez (Vercel).
- Ouvrez la home.
- Testez la création de commande et la création de livraison (les notifications email/whatsapp sont en **log** si `QUEUE_MODE=inline`).

## 7) Créer le premier Super Admin (obligatoire en production)

En production, **aucun** compte de démo n’est créé automatiquement. Le repo fournit un script:

- Script: `npm run bootstrap:admin`
- Entrées: `SUPER_ADMIN_EMAIL`, `SUPER_ADMIN_PASSWORD`

Sur Vercel, vous n’avez pas de “shell” serveur pour lancer ce script directement. La méthode gratuite et simple:

1. **Depuis votre machine locale**, exportez temporairement les variables d’environnement de prod (au minimum `DATABASE_URL` + `DIRECT_URL` + `SUPER_ADMIN_EMAIL` + `SUPER_ADMIN_PASSWORD`).
2. Lancez:

```bash
npm run bootstrap:admin
```

Ce script crée le Super Admin **uniquement s’il n’en existe aucun** en base.

## 8) Stockage des uploads (Cloudflare R2) — configuration complète

Suivez le guide déjà prêt dans ce repo:
- `CLOUDFLARE_R2_SETUP.md`

En bref:
- Sur Vercel, **ne comptez jamais** sur `UPLOAD_DIR`/disque local.
- R2 doit être public (via “Public Development URL” ou un domaine custom) pour servir les images.

## 9) Neon vs Supabase (quoi choisir, quoi configurer, comment et pourquoi)

L’objectif ici est: **Postgres gratuit + stable + compatible serverless** + configuration claire pour Prisma.

### Choix rapide (recommandation pratique)

- **Choisissez Neon si**:
  - vous voulez le chemin le plus simple sur Vercel (pooling + serverless friendly),
  - vous n’avez besoin que de Postgres (et éventuellement d’un dashboard léger).

- **Choisissez Supabase si**:
  - vous voulez un “backend toolbox” (Auth, Storage, Edge Functions, Realtime) en plus de Postgres,
  - vous acceptez de faire un peu plus attention au **pooler** (Transaction pooling / PgBouncer) avec Prisma.

### Configuration Neon (conseillée pour Vercel)

1. Créez un projet Neon (free tier) et une base (par défaut).
2. Dans Neon, récupérez deux URLs:
   - **URL poolée** (pooler) → à mettre dans `DATABASE_URL` sur Vercel.
   - **URL directe** (direct connection) → à mettre dans `DIRECT_URL` sur Vercel.
3. Vérifiez que l’URL contient bien le SSL (souvent `sslmode=require`).

**Pourquoi**:
- Les fonctions Vercel peuvent ouvrir beaucoup de connexions; l’URL poolée limite la casse.
- Prisma migrations au build restent fiables via `DIRECT_URL`.

### Configuration Supabase (si vous voulez l’écosystème Supabase)

1. Créez un projet Supabase (free tier).
2. Dans “Database” / “Connect” (ou équivalent), récupérez:
   - **Direct connection** (port 5432) → `DIRECT_URL`
   - **Connection pooler** / **Transaction pooler** (port 6543 en général) → `DATABASE_URL`
3. Si Supabase vous fournit des paramètres PgBouncer, conservez-les sur l’URL poolée (celle de `DATABASE_URL`).

**Pourquoi**:
- `DATABASE_URL` via pooler: évite les limites de connexions en serverless.
- `DIRECT_URL` direct: évite les problèmes de migrations/schema introspection via pooler.

### Différences importantes Neon vs Supabase (impact sur ce projet)

- **Pooler**:
  - Neon: pooling très “plug and play” pour Vercel.
  - Supabase: pooling OK, mais Prisma préfère souvent migrer via **direct** (d’où `DIRECT_URL`).
- **Fonctionnalités bonus gratuites**:
  - Supabase: Auth/Storage/Realtime/Edge Functions (utile si vous voulez externaliser des features).
  - Neon: focus Postgres + branches + pooling.
- **Ce projet n’exige pas Supabase**:
  - L’app a déjà son auth (JWT) et son stockage S3/R2.
  - Donc Supabase est un choix “plateforme”, pas une obligation technique.

