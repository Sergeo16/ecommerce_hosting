Description :
Dans un marché où la confiance, la rapidité et l'expérience client font la différence, cette plateforme e-commerce multi-acteurs transforme un simple site de vente en véritable **centre commercial digital** : un écosystème où clients, fournisseurs, affiliés et livreurs créent de la valeur ensemble.

---

## Vision et intention du projet

L’ambition de cette plateforme est double :
- **Offrir aux clients finaux** un point d’entrée unique pour acheter des produits de qualité, livrés rapidement, avec une expérience fluide sur mobile comme sur desktop.
- **Donner aux partenaires (fournisseurs, affiliés, livreurs)** un outil complet pour développer leur activité, suivre leurs performances et sécuriser leurs revenus au sein d’un même environnement.

Au-delà d’une boutique en ligne, il s’agit d’un **écosystème orchestré** qui connecte l’offre (fournisseurs), la demande (clients), la force de vente (affiliés) et la logistique (livreurs), avec une logique métier pensée pour l’Afrique francophone (moyens de paiement, parcours client, contraintes terrain).

---

## Valeur apportée aux différents acteurs

### Pour les clients

- **Catalogue unifié** : accès à un ensemble de produits issus de plusieurs fournisseurs, avec filtrage avancé par catégories, recherche intelligente et fiches produits claires.
- **Parcours d’achat simplifié** : panier unifié, checkout guidé, géolocalisation optionnelle pour faciliter la livraison, suivi de commande et notifications.
- **Paiements adaptés au contexte local** : intégration de moyens de paiement comme KKiaPay et FedaPay (Mobile Money, cartes) avec gestion des acomptes et du paiement intégral.

### Pour les fournisseurs

- **Espace dédié** pour publier, modifier et suivre leurs produits (stock, prix, commissions affiliés).
- **Visibilité accrue** : leurs produits sont mis en avant dans un catalogue global qui bénéficie du trafic généré par les campagnes d’affiliation et le référencement.
- **Suivi financier** : calcul automatique des commissions, des revenus et des statistiques de vente.

### Pour les affiliés

- **Programme d’affiliation intégré** : création de liens de tracking vers un produit précis, une catégorie ou l’ensemble du catalogue.
- **Statistiques en temps réel** : clics, conversions, commissions générées, avec une interface claire pour suivre la performance de chaque lien.
- **Simplicité d’usage** : l’affilié génère son lien, partage, et la plateforme se charge du reste (tracking, attribution, calcul de commissions).

### Pour les livreurs

- **Gestion des missions** : affectation, suivi d’état (acceptée, en cours, livrée), historique des livraisons.
- **Traçabilité** : chaque mission est liée à une commande et à un client, avec des statuts clairs et des informations structurées.

---

## Excellence de conception

### Architecture pensée pour l’écosystème

La plateforme repose sur une architecture modulaire qui sépare clairement :
- la **gestion du catalogue** (produits, catégories, fournisseurs),
- la **logique de commande et de paiement** (règles métiers, acomptes, multi-moyens de paiement),
- l’**affiliation** (liens trackés, statistiques, commissions),
- la **logistique** (missions livreurs, états, notifications).

Cette organisation facilite l’évolution du système : ajout de nouveaux moyens de paiement, intégration d’un nouveau type de partenaire, extension à d’autres pays ou devises.

### Sécurité et fiabilité intégrées

- **Authentification et rôles** : séparation nette des profils (client, affilié, fournisseur, livreur, admin) avec des droits adaptés à chaque usage.
- **Traçabilité des opérations** : commandes, paiements, retraits affiliés et missions de livraison sont historisés avec horodatage et liens croisés.
- **Robustesse des paiements** : vérification serveur-side des transactions (KKiaPay, FedaPay), gestion fine des statuts de commande (PENDING, CONFIRMED, etc.) pour éviter toute incohérence.

### Expérience utilisateur orientée terrain

- **Interface claire et responsive**, optimisée pour les connexions mobiles et les écrans de petite taille.
- **Parcours dédiés** à chaque rôle :
  - dashboard affilié centré sur les liens et les commissions,
  - dashboard fournisseur focalisé sur les produits et les ventes,
  - interface livreur tournée vers les missions et la géolocalisation,
  - espace client simple, rassurant, centré sur l’achat.
- **Messages métiers soignés**, pensés pour accompagner des utilisateurs non techniques dans des parcours parfois complexes (affiliation, paiements en plusieurs modes, suivi de livraison).

---

## Impact et crédibilité professionnelle

Ce projet illustre la capacité à :
- **concevoir une plateforme multi-acteurs** avec des logiques métiers imbriquées (vente, affiliation, livraison, paiements),
- **orchestrer plusieurs briques techniques** (paiements locaux, queue de traitements, notifications, tracking d’affiliation),
- **livrer une solution réellement exploitable** : prête à être utilisée par des clients finaux comme par des partenaires business.

Au-delà de la technique, cette réalisation montre une compréhension fine des enjeux des places de marché africaines : intégration de moyens de paiement locaux, importance des circuits de livraison, rôle central des réseaux d’affiliés et contraintes de connectivité.

Cette plateforme peut servir de **socle pour déployer un centre commercial digital** dans un pays ou une région, ou être adaptée à d’autres univers (places de marché spécialisées, plateformes B2B, écosystèmes de services).

---

Si vous cherchez à lancer ou faire évoluer une place de marché en ligne — avec des parcours clairs pour vos clients, des outils puissants pour vos partenaires, et une architecture prête pour la production — ce projet est une base concrète de ce que nous pouvons construire ensemble.

Quelques technologies utilisées :
Next.js
React
TypeScript
PostgreSQL
Prisma
Redis
Tailwind CSS
Node.js
Docker

