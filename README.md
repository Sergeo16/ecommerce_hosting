# Africa Marketplace — SaaS E-commerce + Affiliation + Livraison

Plateforme scalable pour l’Afrique (priorité Bénin) : marketplace, affiliés, livraison, paiements flexibles, moteur de règles Super Admin.

## Stack

- **Next.js 14** (App Router), TypeScript, Tailwind CSS, DaisyUI
- **Prisma** + PostgreSQL
- **Redis** + BullMQ (optionnel)
- **Stripe**, Mobile Money (mock), Wallet
- **S3**, Sentry, Docker

## Démarrage rapide

```bash
npm install
cp .env.example .env
docker compose up -d
npx prisma migrate dev --name init
npm run seed
npm run dev
```

- App : http://localhost:3000
- **En local uniquement** : le seed crée un compte Super Admin de démo : `superadmin@marketplace.bj` / `Admin123!`. Ce compte **n’est jamais créé en production** (voir section Déploiement pour définir l’admin en prod).

## Déploiement gratuit sur Vercel

Pour quitter Render et héberger **gratuitement** sur Vercel, suivez le guide:

- `docs/VERCEL_DEPLOY.md`

## Déploiement sur Render (avec ressources existantes)

Cette section explique **comment héberger cette plateforme sur Render** en réutilisant :

- la base PostgreSQL existante `prospects-db` (instance Render Postgres) ;
- l’instance Key Value (Redis-compatible) `prospects-redis` ;
- en créant **uniquement un nouveau Web Service Starter** pour cette app e‑commerce.

L’objectif est d’éviter tout chevauchement de données ou de processus avec vos autres projets, tout en gardant les coûts au minimum.

Les références Render utilisées :

- [Render Key Value (Redis-compatible)](https://render.com/docs/key-value)
- [Render Postgres – création et connexion](https://render.com/docs/postgresql-creating-connecting)

---

### 1. Vue d’ensemble de l’architecture sur Render

Dans votre workspace Render « My Workspace », vous disposez déjà de :

- **PostgreSQL** : `prospects-db` (plan Basic‑1gb)  
  - Host interne : `dpg-d5ap9rpr0fns738fvr5g-a`
  - Port : `5432`
  - Database actuelle : `prospects_v2`
  - Username : `prospects_user`
  - Stockage : 10 Go (suffisant pour démarrer cette plateforme)

- **Key Value (Redis-compatible)** : `prospects-redis` (plan Starter)  
  - Runtime : Valkey 8.1.4 (compatible Redis)
  - Internal URL : `redis://red-d5ap9rhr0fns738fvr40:6379`
  - **Partagé par 3 applications** : `prospects-app`, `doc-proof`, et cette plateforme e‑commerce.

- **Web Services existants** : `prospects-app`, `doc-proof` (chacun avec son propre dépôt et déploiement).

Pour éviter tout conflit :

- la plateforme e‑commerce utilisera **une nouvelle base logique** dans la même instance Postgres (`prospects-db`) ;
- et un **logical DB Redis dédié** dans `prospects-redis`. Répartition actuelle pour un bon fonctionnement de toutes les apps :
  - **DB 0** : `prospects-app` (URL sans suffixe) et `doc-proof` (même DB 0, isolation par **préfixe de clés** : `REDIS_KEY_PREFIX=docproof:`)
  - **DB 2** : cette plateforme e‑commerce (URL avec `/2`), pour une isolation complète sans préfixe à gérer

Vous n’aurez donc **aucune duplication d’infrastructure**, uniquement un nouveau Web Service Starter. Aucun changement n’est requis côté `doc-proof` ni `prospects-app`.

---

### 2. Préparer la base de données dans `prospects-db`

1. Dans Render, ouvrez `prospects-db` → onglet **Info**.
2. Cliquez sur **Connect → PSQL Command** et copiez la commande proposée (elle ressemble à quelque chose comme) :

   ```bash
   psql postgresql://prospects_user:VOTRE_MOT_DE_PASSE@dpg-d5ap9rpr0fns738fvr5g-a:5432/prospects_v2
   ```

3. Exécutez cette commande :

   - **Depuis votre machine locale** (psql installé en local) ; ou  
   - **Depuis Docker**, par exemple si vous travaillez toujours dans un conteneur :

     ```bash
     docker run --rm -it \
       postgres:16 \
       psql "postgresql://prospects_user:VOTRE_MOT_DE_PASSE@dpg-d5ap9rpr0fns738fvr5g-a:5432/prospects_v2"
     ```

     Vous pouvez aussi lancer `psql` depuis un conteneur déjà démarré (par ex. via `docker exec -it <nom_du_conteneur> psql ...`).
4. Dans la session `psql`, créez une base dédiée à la marketplace (par ex. `ecommerce_marketplace`) :

   ```sql
   CREATE DATABASE ecommerce_marketplace;
   ```

   Vous pouvez choisir un autre nom, mais **gardez‑le cohérent** avec ce que vous mettrez ensuite dans `DATABASE_URL`.

5. Quittez `psql` :

   ```sql
   \q
   ```

Résultat : la même instance Render Postgres `prospects-db` contient maintenant **deux bases** :

- `prospects_v2` (pour l’app existante) ;
- `ecommerce_marketplace` (pour cette plateforme e‑commerce).

Aucune table n’est partagée, donc **zéro chevauchement de données**.

---

### 3. Préparer l’URL Postgres pour la plateforme e‑commerce

1. Toujours dans `prospects-db` → onglet **Info**, cliquez sur **Connect → Internal Database URL**.
2. Copiez l’URL interne fournie (masquée dans l’interface, mais de la forme) :

   ```text
   postgresql://prospects_user:VOTRE_MOT_DE_PASSE@dpg-d5ap9rpr0fns738fvr5g-a:5432/prospects_v2
   ```

3. Pour la plateforme e‑commerce, vous allez **simplement remplacer le nom de la base** par `ecommerce_marketplace` :

   ```text
   postgresql://prospects_user:VOTRE_MOT_DE_PASSE@dpg-d5ap9rpr0fns738fvr5g-a:5432/ecommerce_marketplace
   ```

4. Cette URL deviendra la valeur de `DATABASE_URL` dans les variables d’environnement du futur Web Service e‑commerce.

> Render recommande d’utiliser l’URL interne pour les services du même région, ce qui réduit la latence et reste privé ([docs Postgres Render](https://render.com/docs/postgresql-creating-connecting)).

---

### 4. Préparer l’URL Redis (Key Value `prospects-redis`)

L’instance `prospects-redis` est utilisée par **trois applications**. Pour que toutes fonctionnent sans conflit :

| Application       | Logical DB | Isolation | Variables d’environnement |
|-------------------|------------|-----------|---------------------------|
| prospects-app     | 0 (défaut) | —         | `REDIS_URL=redis://red-d5ap9rhr0fns738fvr40:6379` |
| doc-proof         | 0          | Préfixe de clés | `REDIS_URL=redis://red-d5ap9rhr0fns738fvr40:6379` et `REDIS_KEY_PREFIX=docproof:` |
| e‑commerce (cette plateforme) | **2** | Logical DB dédié | `REDIS_URL=redis://red-d5ap9rhr0fns738fvr40:6379/2` (aucun préfixe requis) |

**Pour cette plateforme e‑commerce :**

1. Ouvrez `prospects-redis` → onglet **Info**.
2. Repérez **Internal Key Value URL** (sans numéro de base) :

   ```text
   redis://red-d5ap9rhr0fns738fvr40:6379
   ```

3. Pour cette plateforme, utilisez le **logical DB 2** en ajoutant `/2` à la fin :

   ```text
   redis://red-d5ap9rhr0fns738fvr40:6379/2
   ```

4. Cette URL deviendra la valeur de **`REDIS_URL`** pour le Web Service e‑commerce. Vous n’avez **pas besoin** de `REDIS_KEY_PREFIX` : l’isolation est assurée par le logical DB 2.

> **Côté doc-proof** : la config actuelle (`REDIS_URL` sans `/1`, `REDIS_KEY_PREFIX=docproof:`) reste correcte ; elle partage la DB 0 avec prospects-app mais les clés sont préfixées, donc pas de chevauchement. Aucun changement à faire.  
> Valkey 8 est compatible Redis ; l’URL `redis://...` est supportée par la plupart des clients ([docs Render Key Value](https://render.com/docs/key-value)).

---

### 5. Créer le nouveau Web Service Starter pour la marketplace

1. Dans Render, cliquez sur **New → Web Service**.
2. Source : **Connecter le dépôt GitHub** correspondant à ce projet (`ecommerce_v1`).  
   - Branche : `main` (ou celle que vous utilisez en production).
3. Plan : **Starter** (Node).
4. Région : **Oregon (US West)** pour être aligné avec `prospects-db` et `prospects-redis`.
5. Runtime :
   - Choisissez **Node 20** (ou version LTS récente).
6. **Build Command** (recommandé, automatisé via script) :

   ```bash
   npm run render:build
   ```

   Ce script fait automatiquement :

   - `npx prisma migrate deploy` : applique les migrations Prisma sur la base `ecommerce_marketplace` via `DATABASE_URL` (sans rejouer les migrations déjà appliquées).
   - `npm run build` : build Next.js en mode production.

7. **Start Command** :

   ```bash
   npm run start
   ```

   (le script `start` du projet démarre Next.js en mode production).

8. Cochez éventuellement **Auto-Deploy** sur la branche principale si vous souhaitez des déploiements automatiques à chaque push.

> Les scripts de worker BullMQ (`npm run worker`) pourront rester désactivés au début pour ne pas créer de service supplémentaire. Les jobs asynchrones (emails, notifications, etc.) pourront être externalisés plus tard dans un Worker Render dédié si besoin.

---

### 6. Variables d’environnement à configurer sur Render

Dans l’onglet **Environment** du nouveau Web Service e‑commerce, configurez au minimum :

- **Connexion base de données**
  - `DATABASE_URL` : URL interne modifiée vers `ecommerce_marketplace`, par ex. :

    ```text
    postgresql://prospects_user:VOTRE_MOT_DE_PASSE@dpg-d5ap9rpr0fns738fvr5g-a:5432/ecommerce_marketplace
    ```

- **Redis / BullMQ**
  - `REDIS_URL` (logical DB **2** pour cette plateforme, afin de ne pas chevaucher prospects-app ni doc-proof) :

    ```text
    redis://red-d5ap9rhr0fns738fvr40:6379/2
    ```

- **Premier Super Admin (production)**  
  Définissez vous‑même les identifiants du premier admin ; aucun compte de démo n’est créé en prod. Ajoutez (en **Secret** sur Render) :
  - `SUPER_ADMIN_EMAIL` : l’email du compte Super Admin (ex. `vous@votredomaine.com`)
  - `SUPER_ADMIN_PASSWORD` : mot de passe (min. 8 caractères)  
  Après le premier déploiement, exécutez **une seule fois** (Shell Render ou one-off job) : `npm run bootstrap:admin`. Ce script crée le compte Super Admin uniquement s’il n’existe aucun SUPER_ADMIN en base.

- **Secrets applicatifs**
  - `JWT_SECRET`
  - `REFRESH_SECRET`
  - `NEXT_PUBLIC_APP_URL` (par ex. `https://votre-domaine.onrender.com`)
  - `MOBILE_MONEY_MOCK` (`false` en prod si KKiaPay / FedaPay sont configurés)
  - Variables **KKiaPay** : `KKIAPAY_PUBLIC_KEY`, `KKIAPAY_PRIVATE_KEY`, `KKIAPAY_SECRET_KEY`, `KKIAPAY_SANDBOX`
  - Variables **FedaPay** : `FEDAPAY_PUBLIC_KEY`, `FEDAPAY_SECRET_API_KEY`, `FEDAPAY_ENV`
  - Éventuellement S3 / Stripe / Sentry si utilisés en production.

> Vous pouvez partir de votre `.env` local comme base, puis **coller les valeurs dans Render** en veillant à remplacer l’URL de base de données et `REDIS_URL` par celles indiquées ci‑dessus.

---

### 7. Première mise en production : migrations et premier admin

1. Assurez‑vous que toutes les migrations Prisma sont commitées dans le dépôt (dossier `prisma/migrations`).
2. Dans l’onglet **Environment** du Web Service, définissez **SUPER_ADMIN_EMAIL** et **SUPER_ADMIN_PASSWORD** (secrets) avec les identifiants du premier Super Admin. Aucun admin de démo n’est créé en production.
3. Sur Render, déclenchez un **Manual Deploy** du nouveau Web Service.
4. Pendant le build, `npm run render:build` applique les migrations sur `ecommerce_marketplace` ; la base `prospects_v2` n’est pas modifiée.
5. Après le premier déploiement réussi, créez le compte Super Admin **une seule fois** : dans le Shell Render du service (ou un one-off job), exécutez :

   ```bash
   npm run bootstrap:admin
   ```

   Le script crée un utilisateur SUPER_ADMIN avec l’email et le mot de passe définis en variables d’environnement, uniquement s’il n’existe pas encore de Super Admin en base.

---

### 8. Vérifications post‑déploiement

Une fois le premier déploiement live :

1. Ouvrez l’URL Render du Web Service (par ex. `https://votre-marketplace.onrender.com`).
2. Testez :
   - la page d’accueil et le catalogue (`/catalog`) ;
   - la création de compte et la connexion ;
   - au moins un parcours de commande (avec Mobile Money mock ou KKiaPay / FedaPay si configurés).
3. Dans Render :
   - consultez les **Logs** du Web Service ;
   - vérifiez que les erreurs éventuelles ne font pas référence à `prospects_v2` ni à des clés Redis utilisées par d’autres apps.

Si tout est OK, vous avez maintenant :

- une **plateforme e‑commerce isolée au niveau données** (nouvelle base dans `prospects-db`) ;
- un partage non intrusif de l’instance Key Value (Redis) en utilisant un logical DB dédié (`/1`) ;
- et **un seul Web Service Starter supplémentaire** à payer pour faire tourner l’application.

---

## Rôles

- **Super Admin** : règles globales, commissions, maintenance, users, dashboard financier
- **Fournisseur** : produits, zones livraison, ventes
- **Affilié** : liens, commissions, retraits, classement
- **Livreur** : missions, statuts, preuves
- **Client** : commandes, paiement (total / partiel / à la livraison), suivi

## Affiliation : parcours complet d’un affilié

Cette section explique, pour un affilié, **comment proposer ses services et gagner de l’argent** grâce à la plateforme.

### 1. Création du compte affilié

- **Inscription** via la page d’enregistrement classique.
- Choix du **rôle "Affilié"** (ou conversion de compte existant par l’Admin).
- Une fois validé, l’affilié accède à son **Dashboard affilié** avec :
  - résumé des commissions,
  - liens d’affiliation disponibles,
  - historique des performances.

### 2. Choix de l’offre à promouvoir

- L’affilié peut :
  - promouvoir **un produit précis** (lien profond vers la fiche produit),
  - ou une **boutique / fournisseur** (lien vers la vitrine du vendeur),
  - ou éventuellement une **catégorie / campagne spéciale** (landing d’une promo, selon les règles définies par le Super Admin).
- Chaque lien est **personnalisé** avec l’identifiant affilié pour assurer le tracking.

### 3. Génération et partage des liens

- Depuis son dashboard, l’affilié peut :
  - copier un **lien court** prêt à partager,
  - ou générer un **lien UTM** pour mesurer les performances marketing (campagne, source, medium…).
- Canaux typiques :
  - réseaux sociaux (Facebook, Instagram, TikTok, Twitter, WhatsApp, Telegram),
  - blog / site perso,
  - email / SMS marketing,
  - groupes Messenger / communautés.

### 4. Tracking des clics et des ventes

- Chaque visiteur qui clique sur un lien affilié est **tagué** (cookie + session + éventuellement device / IP).
- Si le visiteur :
  - crée un compte,
  - ajoute des produits au panier,
  - puis **paye la commande**,
  alors la commande est **rattachée à l’affilié** (selon les règles configurées : dernier clic, premier clic, durée de vie du cookie, etc.).
- Les **commandes annulées, remboursées ou échouées** ne génèrent pas de commission (ou sont déduites, selon les règles définies par le Super Admin).

### 5. Calcul des commissions

- Le Super Admin définit :
  - un **taux global par défaut**,
  - des **taux spécifiques par fournisseur**, par catégorie, voire par produit.
- Pour chaque commande éligible :
  - la plateforme calcule la **commission brute** (montant commande × taux),
  - applique éventuellement des **ajustements** (frais, remises, plafonds),
  - enregistre une **ligne de commission** rattachée à l’affilié et à la commande.
- L’affilié voit dans son dashboard :
  - le **détail des commissions par commande**,
  - le **statut** de chaque commission (en attente, validée, payée, annulée),
  - les **totaux** (jour, semaine, mois, période personnalisée).

### 6. Solde, classement et motivation

- Le dashboard affiche :
  - le **solde disponible** (commissions validées et non encore retirées),
  - un **historique des gains** (filtrable par période / fournisseur / produit),
  - un **classement** optionnel (top affiliés) pour la gamification.
- Le Super Admin peut mettre en place :
  - des **paliers de bonus** (ex. +5 % de commission au‑dessus de X ventes),
  - des **challenges** (meilleur affilié du mois, campagne spéciale, etc.).

### 7. Demande de retrait et paiement

- Quand son solde atteint le **minimum de retrait** défini par l’Admin :
  - l’affilié peut créer une **demande de retrait** depuis son dashboard,
  - en choisissant un mode de paiement (Mobile Money, virement, cash, wallet interne… selon la configuration).
- Le Super Admin (ou l’équipe finance) :
  - valide ou rejette la demande,
  - marque le retrait comme **payé** une fois le virement effectué.
- L’historique des retraits reste accessible dans le dashboard affilié (montant, date, statut, moyen de paiement).

### 8. Résumé pour un affilié

1. **S’inscrire** comme affilié et accéder au dashboard.
2. **Choisir des produits / boutiques** à promouvoir.
3. **Partager ses liens** (réseaux sociaux, blog, groupes, emails…).
4. **Suivre les ventes et commissions** dans le dashboard.
5. **Demander un retrait** dès que le solde minimum est atteint.
6. Continuer à optimiser ses campagnes pour **gagner plus**.

L’objectif de la plateforme est que l’affilié n’ait **que trois choses à faire** : **choisir de bonnes offres, bien communiquer et suivre ses résultats**. Tout le reste (tracking, calcul des commissions, paiements des vendeurs, logistique) est géré par la marketplace.

## Paiement

- Total avant livraison, partiel (avance + solde), à la livraison — configurable par Admin (produit, fournisseur, pays, user)
- **KKiaPay** (1er moyen Mobile Money intégré) : MTN Mobile Money, Moov Money, cartes (Visa, Mastercard) — Bénin et région. Si les clés KKiaPay sont configurées dans `.env`, le checkout utilise le widget KKiaPay pour les paiements en XOF (total ou acompte). Vérification obligatoire côté serveur (anti-fraude). Voir [Intégration KKiaPay](#intégration-kkiapay) ci-dessous.
- Méthodes additionnelles : Stripe, wallet, cash on delivery (mock Mobile Money si KKiaPay non configuré).

## Livraison

- Zones, tarifs (fixe / par distance / gratuit)
- Statuts : PENDING → ASSIGNED → PICKED_UP → IN_TRANSIT → DELIVERED / FAILED / RETURNED
- **Notification admin à chaque commande** : l’admin reçoit une notification (plateforme, et optionnellement email / WhatsApp selon Paramètres > Notifications des commandes) avec tous les détails utiles pour confier la livraison : client, adresse et téléphone de livraison, fournisseur et contact, liste des articles, total.
- **Confier la livraison** : depuis Dashboard Admin > Commandes, l’admin peut cliquer « Confier livraison » pour chaque commande. Il peut assigner soit un **livreur enregistré** sur la plateforme, soit un **contact externe** (nom + téléphone) s’il n’y a pas de livreur disponible ou proche du fournisseur. L’assignation est enregistrée (livreur plateforme ou champs `externalCourierName` / `externalCourierPhone`).
- **Suivi livraison** : activable/désactivable par le Super Admin (Paramètres globaux). Quand activé, l’admin, le fournisseur et le client peuvent suivre la livraison via `GET /api/tracking/[orderId]` (authentification requise, accès restreint au commande concernée).

## Mode maintenance

- Le Super Admin peut **activer/désactiver le mode maintenance** à tout moment (Paramètres globaux → « Mode maintenance »).
- Quand il est **activé** : le public voit uniquement une page « Maintenance en cours » sur tout le site.
- **Connexion admin possible** : les pages **`/auth/login`** et **`/auth/register`** restent accessibles pendant la maintenance. L’admin peut ainsi se connecter puis accéder au dashboard et désactiver la maintenance si besoin.
- **Aperçu « comme le public »** : sans désactiver la maintenance, l’admin peut cliquer sur « Voir le site comme le public (aperçu) » dans le bandeau orange. Il voit alors exactement la page de maintenance telle que le public la voit. Un bouton « Quitter l’aperçu » le ramène au dashboard. Permet de vérifier le rendu avant de rouvrir le site.

## Identité des fournisseurs

- **Visibilité contrôlée par l’admin** (Paramètres globaux → « Afficher l’identité des fournisseurs »).
- **Par défaut : masquée** — les clients ne voient pas « Vendu par [nom] » sur les produits, pour inciter les commandes via la plateforme (commissions).
- Si l’admin active l’option, le nom du fournisseur est affiché sur le catalogue et la fiche produit.

## Inscription fournisseur

- **Obligatoire** : nom de l’entreprise, numéro de téléphone, adresse (saisie ou position GPS).
- **Optionnel** : prénom et nom du contact.
- Sur l’inscription, si le rôle « Fournisseur » est choisi : champ « Nom de l’entreprise » *, téléphone *, adresse * (avec bouton « Utiliser ma position » pour remplir via GPS). Prénom et nom deviennent optionnels.

## Produits (publication)

- **Devise** : choix dans une liste (XOF, EUR, USD, etc.) ou saisie personnalisée (« Autre »).
- **Catégorie** : choix dans la liste existante ou saisie d’une nouvelle catégorie (création automatique si besoin).
- **Images / vidéos** : soit URL, soit **upload depuis l’appareil** (API `POST /api/supplier/upload`, puis URL renvoyée utilisée comme image/vidéo du produit).
- **Validation** : messages d’erreur (champs requis, caractères non autorisés, etc.) dans la **langue de l’utilisateur** (FR/EN).

## Boutique & checkout

- **Quantité** : modifiable sur la fiche produit et sur la page checkout (sélecteur − / nombre / +).
- **Adresse de livraison** : bouton « Utiliser ma position » pour remplir l’adresse et la ville via géolocalisation (reverse geocoding). Coordonnées GPS optionnellement enregistrées avec la commande pour le livreur.

## Navigation

- **Logo** : présent sur toutes les pages (barre globale en haut). Un clic sur le logo renvoie à l’accueil.

## Thèmes DaisyUI

dark, business, corporate, luxury, cyberpunk — switch dans le dashboard, sauvegardé en local.

## Intégration KKiaPay

[KKiaPay](https://kkiapay.me) est l’agrégateur de paiement Mobile Money (MTN, Moov) et cartes utilisé en priorité pour les paiements en XOF.

### Références

- [Documentation KKiaPay](https://docs.kkiapay.me/v1/)
- [SDK JavaScript (widget)](https://docs.kkiapay.me/v1/plugin-et-sdk/sdk-javascript) — chargement du script, `openKkiapayWidget`, `addSuccessListener` / `addFailedListener`
- [SDK serveur (Node.js)](https://docs.kkiapay.me/v1/plugin-et-sdk/admin-sdks-server-side) — vérification des transactions côté API
- [Sécurité](https://docs.kkiapay.me/v1/securite/untitled) — HTTPS, chiffrement, vérification obligatoire des transactions
- [Création de compte](https://docs.kkiapay.me/v1/compte/creation-dun-compte) — inscription KKiaPay
- [Méthodes de paiement](https://docs.kkiapay.me/v1/paiements/methodes-de-paiement) — Mobile Money, cartes
- [Sandbox / test](https://docs.kkiapay.me/v1/compte/kkiapay-sandbox-guide-de-test) — mode test et numéros de téléphone de test

### Configuration (.env)

Récupérer les clés dans le [tableau de bord KKiaPay](https://kkiapay.me) → **Développeurs** → **Clés API**.

| Variable | Description |
|----------|-------------|
| `KKIAPAY_PUBLIC_KEY` | Clé API publique (affichée dans le widget côté client) |
| `KKIAPAY_PRIVATE_KEY` | Clé privée (serveur uniquement) |
| `KKIAPAY_SECRET_KEY` | Clé secrète (serveur uniquement) |
| `KKIAPAY_SANDBOX` | `true` pour le mode test, `false` en production |

Si les trois clés sont renseignées, le checkout propose automatiquement le paiement via KKiaPay pour les commandes en **XOF** (paiement total ou acompte). Sinon, le flux Mobile Money mock est utilisé.

### Flux technique

1. **Checkout** : l’utilisateur valide la commande (total ou acompte en XOF).
2. **Création commande** : `POST /api/orders` avec `paymentGateway: "KKIAPAY"` crée une commande en statut `PENDING` et renvoie `orderNumber`, `amountToPay` et les paramètres KKiaPay (clé publique, sandbox).
3. **Widget** : le front charge le script `https://cdn.kkiapay.me/k.js`, ouvre le widget KKiaPay (Mobile Money uniquement : `paymentmethod: "momo"`), avec montant et clé.
4. **Succès** : `addSuccessListener` reçoit le `transactionId`. Le front appelle `POST /api/orders/verify-kkiapay` avec `orderNumber` et `transactionId`.
5. **Vérification serveur** : l’API vérifie la transaction auprès de KKiaPay (SDK Node.js `k.verify(transactionId)`), met la commande en `CONFIRMED`, enregistre le paiement et déclenche les jobs (emails, livraison, commissions).

Aucune commande n’est confirmée sans vérification côté serveur (recommandation KKiaPay anti-fraude).

## Scripts

- `npm run dev` — Next.js
- `npm run build` / `npm run start` — production
- `npm run worker` — worker BullMQ (commandes, emails)
- `npm run db:studio` — Prisma Studio

## Checklist

- [x] npm install
- [x] cp .env.example .env
- [x] docker compose up
- [x] npx prisma migrate dev --name init
- [x] npm run seed
- [x] npm run dev

FIN.


**Méthode 1 : Reset complet (Recommandée si vous voulez vraiment tout écraser)**
```bash
# 1. Récupérer toutes les informations du dépôt distant
git fetch origin

# 2. Réinitialiser votre branche locale pour qu'elle corresponde exactement à la branche distante
git reset --hard origin/main

# 3. Nettoyer tous les fichiers non suivis (optionnel, mais recommandé)
git clean -fd
```

**Explication :**
- `git fetch origin` : Télécharge les dernières informations du dépôt distant sans modifier vos fichiers locaux
- `git reset --hard origin/main` : Réinitialise votre branche locale `main` pour qu'elle corresponde exactement à `origin/main`. **Toutes vos modifications locales non commitées seront perdues**
- `git clean -fd` : Supprime tous les fichiers et dossiers non suivis par Git (fichiers créés localement mais jamais ajoutés à Git)

**Méthode 2 : Checkout direct (Alternative simple)**
```bash
# 1. Récupérer les dernières informations
git fetch origin

# 2. Forcer le checkout de la branche distante
git checkout -f origin/main

# 3. Déplacer votre branche locale sur cette version
git branch -f main origin/main

# 4. Revenir sur votre branche locale
git checkout main
```

**Explication :**
- `git fetch origin` : Télécharge les informations du dépôt distant
- `git checkout -f origin/main` : Force le checkout de la version distante (ignore les modifications locales)
- `git branch -f main origin/main` : Force votre branche locale `main` à pointer vers `origin/main`
- `git checkout main` : Revenir sur votre branche locale (maintenant identique à la distante)

## 📄 Licence

Propriétaire - Tous droits réservés

## 👥 Support

Pour toute question ou problème, contactez l'équipe de développement.

---

**Développé par Open Digital Land**
