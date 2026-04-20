# 🚀 Money Machine — Architecture E-commerce Ultra Rentable

Document d'architecture pour transformer la plateforme en **machine à cash** multi-vendeurs, multi-paiements, multi-livraisons, 100% configurable par le Super Admin, avec IA + automatisation + monétisation agressive et éthique.

**État d'avancement :** Schéma Prisma étendu et fusionné dans `prisma/schema.prisma` (abonnements vendeurs, pub, fidélité, parrainage, escrow, KYC, litiges, 2FA, flash sales, CommissionRule). Structure `lib/` en place : `lib/monetization/`, `lib/ai/`, `lib/loyalty/`, `lib/referral/`, `lib/escrow/` avec stubs et logique de base. À faire : migration Prisma (`npx prisma migrate dev`), puis implémentation Phase 1 (roadmap 90 jours).

---

## 1. Stack & Principes

- **Next.js 14+** (App Router), **TypeScript strict**
- **Prisma** + **PostgreSQL**
- **TailwindCSS** + **DaisyUI**
- **Stripe** + paiements locaux (Mobile Money, Wallet)
- **Redis** + **BullMQ** (jobs, cache)
- **RBAC avancé**, API sécurisée, scaling horizontal possible

---

## 2. Architecture des dossiers (extension)

```
src/
├── app/
│   ├── (marketing)/           # Accueil, landing, SEO
│   ├── (shop)/                # Catalogue, produit, panier, checkout
│   ├── (dashboard)/
│   │   ├── admin/             # Super Admin (déjà partiel)
│   │   │   ├── analytics/
│   │   │   ├── monetization/  # Commissions, abonnements, pub
│   │   │   ├── delivery-rules/
│   │   │   ├── kyc/
│   │   │   └── disputes/
│   │   ├── supplier/
│   │   │   ├── subscription/  # Plan Pro/Elite
│   │   │   ├── ads/           # Enchères, bannières
│   │   │   └── analytics/
│   │   ├── affiliate/
│   │   ├── courier/
│   │   └── client/            # Wallet, fidélité, parrainage
│   ├── api/
│   │   ├── v1/                # API publique marketplace (optionnel)
│   │   ├── admin/
│   │   ├── monetization/      # Commissions, abos, pub
│   │   ├── ai/                # Recommandations, fraude, prix dynamique
│   │   ├── loyalty/           # Points, cashback, gamification
│   │   ├── referral/          # Parrainage multi-niveaux
│   │   └── escrow/            # Smart escrow (optionnel)
│   └── ...
├── lib/
│   ├── monetization/          # Commissions dynamiques, abos, pub
│   ├── ai/                    # Recommandations, fraude, prédictions
│   ├── loyalty/               # Points, badges, niveaux
│   ├── referral/              # Arbre parrainage
│   ├── escrow/                # Logique escrow
│   └── rules-engine.ts        # Étendre (volume, zone, catégorie)
├── components/
│   ├── checkout/              # 1-clic, express, guest
│   ├── loyalty/               # Badges, compteur points
│   └── ...
└── ...
```

---

## 3. RBAC détaillé

| Rôle         | Périmètre |
|-------------|-----------|
| **SUPER_ADMIN** | Tout : settings, modules on/off, commissions globales, maintenance, KYC, litiges, analytics CA/marge/LTV/CAC, frais livraison par zone, pays, rôles. |
| **SUPPLIER**    | Produits, zones livraison, abonnement (voir/upgrade), campagnes pub, analytics vendeur, ventes. |
| **AFFILIATE**   | Liens, stats, retraits, parrainage (si activé). |
| **COURIER**     | Missions, statuts, preuves. |
| **CLIENT**      | Commandes, wallet, fidélité, parrainage, adresses. |

Permissions granulaires (ex. `monetization.commissions.read`, `admin.kyc.approve`) peuvent être ajoutées via table `Permission` + `RolePermission` si besoin au-delà du rôle simple.

---

## 4. Modules de monétisation (obligatoires)

### 4.1 Commissions intelligentes dynamiques

- **Configurable par** : catégorie, fournisseur, volume de ventes (tranches), performance (rating), zone géographique.
- **Commission « Top visibilité »** : % supplémentaire pour mise en avant.
- **Commission réduite** : vendeurs avec abonnement Pro/Elite.
- **Implémentation** : étendre `lib/rules-engine.ts` + table `Settings` (clés `commission_category_*`, `commission_volume_*`, `commission_zone_*`) ou tables dédiées `CommissionRule` (scope: GLOBAL | CATEGORY | COMPANY | ZONE, JSON conditions).

### 4.2 Abonnements vendeurs

- **Plans** : Gratuit (commission élevée), Pro (commission réduite), Elite (visibilité + analytics + badge).
- **Gestion** : facturation récurrente (Stripe Billing ou manuel), suspension auto si impayé, renouvellement.
- **Schéma** : `SellerSubscriptionPlan`, `SellerSubscription` (companyId, planId, status, currentPeriodEnd, stripeSubscriptionId?).

### 4.3 Publicité interne

- **Produits sponsorisés**, mise en avant catégorie, bannière homepage.
- **Enchères CPC** (budget, cible, période).
- **Tableau ROI** pour le vendeur (impressions, clics, conversions).
- **Schéma** : `AdCampaign`, `AdPlacement` (type: PRODUCT_SPOTLIGHT | CATEGORY_TOP | BANNER_HOME), `AdBid` (CPC, budget).

### 4.4 Livraison ultra flexible

- **Modes** : livreurs internes, partenaires, auto-livraison vendeur, API externe.
- **Règles** : 100% avant / avance + solde / 100% à livraison, par rôle et par vendeur (déjà partiellement dans `getPaymentRules`).
- **Schéma** : étendre `DeliveryZone` + `Settings` (delivery_mode_per_company, external_carrier_api_url, etc.).

### 4.5 Smart Escrow (option activable)

- Paiement bloqué jusqu’à confirmation livraison/acceptation.
- Libération automatique selon règles (délai, statut).
- Historique transparent (table `EscrowTransaction` ou champs sur `Payment` + statut ESCROW_HOLD / ESCROW_RELEASED).

---

## 5. Module IA (obligatoire)

- **Recommandation** : produits similaires, « autres achats », cross-sell / upsell (règles ou modèle léger type embeddings).
- **Prix dynamique** : selon demande, stock, saison (règles + optional ML).
- **Détection fraude** : score par commande (règles + optional modèle).
- **Score qualité vendeur** : agrégation retards, annulations, avis.
- **Prédiction rupture stock** : tendance ventes + seuils.
- **Relance panier abandonné** : jobs BullMQ + emails (déjà queue), personnalisation IA optionnelle.

Implémentation : `lib/ai/recommendations.ts`, `lib/ai/fraud.ts`, `lib/ai/inventory-forecast.ts` + appels depuis API et workers.

---

## 6. Conversion maximale

- **Checkout 1 clic** : tokenisation carte / wallet, one-tap pour utilisateurs connectés.
- **Achat sans compte** : déjà (guest checkout).
- **Paiement express** : Stripe Payment Request / Link, wallet pré-rempli.
- **Wallet interne** : déjà `Wallet`; ajouter dépôt, retrait, usage au checkout.
- **Cashback** : % sur commande crédité en wallet ou points (voir fidélité).
- **Points fidélité** : points par XOF dépensé, échange contre réduction ou produits.
- **Gamification** : badges, niveaux (table `UserBadge`, `UserLevel`).
- **Flash sales** : produits avec `promoEndsAt`, compteur urgence côté front.
- **Offres personnalisées** : règles par segment (ex. premier achat, panier > X).

---

## 7. Growth & viralité

- **Parrainage multi-niveaux** : arbre (referrerId sur User ou table `Referral`), commission par niveau (configurable).
- **Affiliation** : déjà en place; étendre avec objectifs, paliers.
- **Cashback partage social** : partage lien → bonus points/cashback si inscription ou achat.
- **Liens traçables** : UTM + referralCode (déjà).
- **Marketplace API publique** : REST/GraphQL pour partenaires (auth API key, rate limit).
- **Influenceurs** : rôle ou tag INFLUENCER, commission dédiée, dashboard simplifié.

---

## 8. Analytics avancés

- **Admin** : CA temps réel, marge plateforme, taux conversion, panier moyen, LTV, CAC, ROI campagnes, top vendeurs/produits, heatmap activité (agrégations + cache Redis si besoin).
- **Vendeur** : revenus nets, taux conversion, performance produits, suggestions IA (recommandations, stock).
- **Schéma** : vues matérialisées ou tables `AggregationDaily` (date, companyId?, metric, value) + jobs nocturnes pour remplissage.

---

## 9. Super Admin — Contrôle total

- Activer/désactiver modules (feature_flags dans Settings).
- Modifier commissions globales et par scope (rules-engine + UI).
- Paramétrer méthodes de paiement par rôle / pays (Settings + rules-engine).
- Mode maintenance (déjà `api/admin/maintenance`).
- Bloquer vendeur / livreur (status User ou CompanyProfile).
- Frais livraison dynamiques (DeliveryZone + règles par pays).
- Règles par pays (taxation, devise, règles livraison).
- KYC vendeurs (statut, pièces, workflow approbation).
- Arbitrage litiges (table `Dispute` + statut, résolution, remboursement partiel/total).

---

## 10. Produits (types illimités)

- Types déjà en enum : PHYSICAL, DIGITAL, SERVICE, SUBSCRIPTION, TICKET, RECHARGE_CODE, BUNDLE, COURSE, APP, DOWNLOAD, CUSTOM.
- Ajouter si besoin : RENTAL, AUCTION, DROPSHIPPING (flag ou type).
- Produits groupés : `ProductBundle` (productId parent, productId child, quantity).
- Enchères : `Auction` (productId, startAt, endAt, currentBid, winnerId).
- Système extensible : `ProductType` en DB (optionnel) ou garder enum + metadata JSON par produit.

---

## 11. Multilingue & multidevise

- **i18n** : déjà FR/EN (LocaleContext, translations); ajouter ZH (chinois) dans `translations.ts`.
- **Multidevise** : `Order.currency`, `Wallet.currency`; taux de change dans Settings (`exchange_rates`) ou API externe; conversion à l’affichage et à la commande.
- **Taxation par pays** : Settings `tax_rate_XX`, appliqué au checkout selon adresse/pays.

---

## 12. Sécurité & confiance

- **2FA** : TOTP (table `UserTwoFactor` secret hash, backup codes); check après login.
- **KYC vendeurs** : statut (PENDING, APPROVED, REJECTED), pièces (S3), workflow Admin.
- **Score réputation** : agrégation avis, retards, annulations (champ dérivé ou table `SellerReputation`).
- **Avis vérifiés** : lien Order → Review (purchased = true).
- **Anti-fraude IA** : score par commande (règles + optionnel modèle).
- **Logs** : AuditLog déjà en place; étendre pour paiements, KYC, litiges.

---

## 13. API Design (résumé)

| Domaine        | Méthodes / Endpoints (exemples) |
|----------------|----------------------------------|
| Admin          | GET/PUT /api/admin/settings, /api/admin/analytics/*, /api/admin/kyc, /api/admin/disputes |
| Monetization   | GET/POST /api/monetization/commission-rules, /api/monetization/subscriptions, /api/monetization/ads |
| AI             | GET /api/ai/recommendations?productId=, GET /api/ai/fraud-score (interne), POST /api/ai/cart-suggestions |
| Loyalty        | GET /api/loyalty/points, GET /api/loyalty/badges, POST /api/loyalty/redeem |
| Referral       | GET /api/referral/tree, POST /api/referral/apply (code parrain) |
| Escrow         | POST /api/escrow/release (admin ou automatique), GET /api/escrow/status |
| Public API     | GET /v1/products, GET /v1/categories (auth API key, rate limit) |

---

## 14. Stratégie de monétisation (résumé)

1. **Commissions** : plateforme sur chaque vente (déjà) + variabilisation (catégorie, volume, zone, abonnement).
2. **Abonnements vendeurs** : Pro / Elite → revenus récurrents + baisse de commission = rétention.
3. **Pub interne** : CPC / CPM → revenus sans dépendre uniquement du GMV.
4. **Livraison** : marge sur frais ou forfait livreur.
5. **Escrow** : option payante ou marge sur délai de déblocage.
6. **API marketplace** : abonnement partenaires / usage.
7. **Fidélité / cashback** : financé par marge produit ou part vendeur pour augmenter panier et répétition.

---

## 15. Roadmap d’implémentation (90 jours)

### Phase 1 — J1–J30 : Fondations monétisation & abos

- Étendre Prisma : plans abo vendeur, souscriptions, règles de commission avancées (tables ou Settings).
- Back-office Admin : CRUD commissions (par catégorie, fournisseur, zone), écran abonnements vendeurs.
- Stripe Billing (ou équivalent) : création abonnements Pro/Elite, webhook renouvellement / échec.
- Appliquer commissions dynamiques au calcul des commandes (rules-engine + order creation).

### Phase 2 — J31–J60 : Pub, livraison, conversion

- Publicité interne : modèles `AdCampaign`, `AdPlacement`, enchères CPC, affichage sur catalogue/home.
- Livraison : modes externe / auto-livraison, règles par vendeur (Settings + UI).
- Checkout 1 clic / express (Stripe Link, wallet), fidélité : points, cashback, badges (tables + jobs).

### Phase 3 — J61–J90 : IA, growth, scaling

- IA : recommandations (produits similaires, cross-sell), score fraude basique, relance panier abandonné.
- Parrainage multi-niveaux : arbre, commissions par niveau, API + UI.
- Analytics : dashboards Admin (CA, marge, LTV, CAC) et Vendeur (revenus, conversion, suggestions).
- Escrow optionnel, 2FA, KYC vendeur, API publique (auth + rate limit).

---

## 16. Performance & scaling

- Cache Redis : recommandations, taux de change, règles de commission (invalidation à la mise à jour).
- Agrégations lourdes : jobs nocturnes → tables/vues dédiées; API lit depuis ces tables.
- CDN pour assets et images produits (S3 + CloudFront ou équivalent).
- Rate limiting sur API publique et endpoints sensibles (déjà rate-limit en place sur auth).
- DB : index sur (companyId, createdAt), (orderId), (userId, role); connexion pooling (Prisma).

---

## 17. Orientation business

- Maximiser revenus à chaque étape : commissions, abos, pub, livraison, API.
- Réduire dépendance au capital : cashflow via avance paiement (escrow, avance partielle).
- Effets réseau : parrainage, affiliation, API partenaires pour plus de vendeurs et de trafic.
- Fidélisation : wallet, points, badges, offres ciblées.
- Expansion : multidevise, multilingue (FR, EN, ZH), règles par pays pour passer Afrique → international.

---

*Document de référence pour l’évolution de la plateforme. À faire évoluer avec les sprints.*
