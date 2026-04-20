# Configuration Cloudflare R2 pour la production

Ce guide décrit **étape par étape** comment créer et configurer un bucket Cloudflare R2 pour que les images et vidéos du portfolio s’affichent correctement en production (notamment sur Render). Avec le free tier R2, l’usage reste en général **à 0 €/mois**.

**Oui, vous pouvez utiliser un même compte Cloudflare pour plusieurs plateformes** (plusieurs sites, plusieurs apps). Un seul compte = un seul Account ID et une seule facturation ; vous créez **un bucket par projet** (et éventuellement un jeton API par bucket pour bien isoler). Voir la section [Un même compte pour plusieurs plateformes](#un-même-compte-pour-plusieurs-plateformes) pour le détail.

---

## Prérequis

- Un compte [Cloudflare](https://dash.cloudflare.com/sign-up) (gratuit).
- R2 est facturé à l’usage ; le [free tier](https://developers.cloudflare.com/r2/pricing/) inclut chaque mois : 10 Go de stockage, 1 M d’écritures, 10 M de lectures, et **egress illimité gratuit**.

---

## Où trouver la page R2 ? (à ne pas confondre)

Dans ce guide, quand on parle de la **page R2** ou **R2 → Overview**, il s’agit de la **section principale du stockage R2** (là où vous voyez la liste de vos buckets et le bouton « Create bucket »). **Ce n’est pas** le **R2 Data Catalog** : le Data Catalog est une autre fonctionnalité (beta), visible dans les paramètres d’un bucket — vous pouvez l’ignorer pour ce guide.

**Où cliquer :** dans le tableau de bord Cloudflare, **barre latérale gauche** → cherchez **« R2 »** ou **« R2 Object Storage »** ou **« Stockage R2 »**. En cliquant dessus, vous arrivez sur la page **Overview** qui liste vos buckets. C’est depuis cette page que vous créez un bucket et que vous voyez la zone **Account details** (en bas à droite) avec **API Tokens** → bouton **Manage** pour les jetons API.

---

## Étape 1 : Activer R2 et récupérer l’Account ID

1. Connectez-vous au [tableau de bord Cloudflare](https://dash.cloudflare.com/).
2. Dans la **barre latérale gauche** : **Storage & databases** → **R2 object storage** → **Overview**. Vous devez voir la page « R2 object storage » avec le bouton **+ Create bucket**, la liste des buckets et, en bas à droite, **Account details** (API Tokens, Account ID, S3 API). Pas dans les réglages d’un bucket ni dans R2 Data Catalog.
3. Si c’est la première fois, acceptez les conditions et activez R2 (pas d’engagement, facturation à l’usage).
4. **Récupérez votre Account ID** :
   - Sur la page R2 Overview, l’**Account ID** est affiché dans l’URL :  
     `https://dash.cloudflare.com/<ACCOUNT_ID>/r2/overview`
   - Ou : **Paramètres du site** (ou n’importe quel domaine) → en bas à droite, section **API** → **Account ID**.
   - **Notez-le** : vous en aurez besoin pour l’endpoint S3 (ex. `a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6`).

---

## Étape 2 : Créer un bucket R2

Un compte peut avoir **plusieurs buckets** (un par plateforme). Pour ce projet, créez un bucket dédié.

1. Sur la **page R2** (section principale, liste des buckets — voir encadré « Où trouver la page R2 ? » ci-dessus), cliquez sur **Create bucket** (Créer un bucket).
2. **Nom du bucket** : par exemple `prospects-portfolio` (minuscules, chiffres et tirets uniquement). Choisissez un nom unique si vous avez déjà d’autres buckets pour d’autres projets.
3. **Emplacement** : laissez **Automatic** (ou choisissez une juridiction si besoin, ex. EU).
4. Cliquez sur **Create bucket**.
5. **Notez le nom du bucket** : vous en aurez besoin pour la variable `S3_BUCKET`. Pour une autre plateforme, vous créerez un **autre** bucket avec un autre nom.

---

## Étape 3 : Rendre le bucket public (pour afficher les images)

Pour que les visiteurs puissent voir les images, le bucket doit être accessible en lecture publique.

### Option A : URL publique gérée par Cloudflare (r2.dev) — le plus simple

1. Ouvrez votre bucket (cliquez sur son nom).
2. Allez dans l’onglet **Settings** (Paramètres).
3. Dans la section **General**, repérez **Public Development URL**.
4. Cliquez sur **Public Development URL** pour l’ouvrir, puis sur **Enable** (Activer).
5. Si Cloudflare demande une confirmation (ex. taper `allow`), validez.
6. Une **Public Bucket URL** apparaît, du type :  
   `https://pub-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx.r2.dev`
7. **Copiez cette URL** (sans slash final) : c’est la valeur de **S3_PUBLIC_BASE_URL**.

> **Note :** L’interface Cloudflare n’affiche plus toujours une section « Public access » séparée. L’accès public est géré directement via **Public Development URL** : en l’activant, le contenu du bucket devient visible sur l’URL r2.dev.

> Pour une utilisation en production avec beaucoup de trafic, Cloudflare recommande un **domaine personnalisé** plutôt que r2.dev (voir [Public buckets](https://developers.cloudflare.com/r2/buckets/public-buckets/)). Pour un petit portfolio, r2.dev suffit souvent.

### Option B : Domaine personnalisé (optionnel)

Si vous préférez utiliser votre propre domaine (ex. `cdn.votredomaine.com`) :

1. Le domaine doit être géré dans le même compte Cloudflare (ou en CNAME).
2. Dans les paramètres du bucket → **Custom Domains** → **Connect Domain**.
3. Entrez le sous-domaine (ex. `cdn.votredomaine.com`) et validez.
4. Utilisez ensuite `https://cdn.votredomaine.com` comme **S3_PUBLIC_BASE_URL**.

**Coût :** Cloudflare **ne facture pas** la connexion d’un domaine personnalisé à R2. C’est inclus. Vous ne payez que l’usage R2 (stockage, requêtes), déjà couvert en partie par le free tier. En revanche, si vous n’avez pas encore de **nom de domaine**, son enregistrement est payant chez un registrar (souvent ~10–15 €/an) ou « au coût » si vous l’achetez via Cloudflare Registrar.

---

## Étape 4 : Créer un jeton API S3 (credentials)

L’application a besoin d’un **Access Key ID** et d’un **Secret Access Key** pour envoyer les fichiers vers R2 via l’API S3.

### 4.1 Aller sur la page des jetons API

1. Allez sur la **page R2 Overview** (barre latérale → **Storage & databases** → **R2 object storage** → **Overview**).
2. En bas à droite, dans la zone **Account details**, vous voyez **API Tokens** avec un bouton **Manage**. Cliquez sur **Manage**.
3. Vous arrivez sur la page **API Tokens** (URL en `.../r2/api-tokens`). Vous y voyez deux blocs : **Account API Tokens** et **User API Tokens**.

### 4.2 Choisir le type de jeton et créer

- **Account API token** (recommandé pour la production) : le jeton reste actif même si vous quittez l’organisation. Idéal pour un serveur (ex. Render).  
  → Cliquez sur le bouton bleu **Create Account API token**.
- **User API token** : lié à votre compte utilisateur ; devient inactif si vous quittez l’organisation. Utile pour du développement perso.  
  → Cliquez sur **Create User API token**.

Pour ce guide (production), utilisez **Create Account API token**.

### 4.3 Remplir le formulaire « Create Account API Token »

Le formulaire affiche les champs suivants. Voici quoi choisir :

| Champ | Que choisir |
|-------|------------------|
| **Token name** | Un nom pour vous repérer, ex. `Prospects production upload` ou `R2 Account Token`. |
| **Permissions** | Cochez **Object Read & Write**. Cela permet de lire, écrire et lister les objets dans les buckets concernés — suffisant pour que l’app uploade et serve les images. *(Ne prenez pas Admin Read & Write sauf si vous voulez que le jeton puisse créer/supprimer des buckets.)* |
| **Specify bucket(s)** | **Apply to specific buckets only** → sélectionnez le bucket de ce projet (ex. `prospects-portfolio` ou `ecommerce-marketplace`). Plus sécurisé qu’« Apply to all buckets ». |
| **TTL** | Laissez **Forever** pour un jeton de production (pas d’expiration). |
| **Client IP Address Filtering** | Laissez vide (par défaut le jeton fonctionne depuis toutes les adresses). Renseignez des IP uniquement si vous voulez restreindre l’usage à un serveur dont vous connaissez l’IP. |

Ensuite cliquez sur le bouton de création du jeton (en bas du formulaire).

### 4.4 Récupérer les clés (une seule fois)

Juste après la création, la page affiche :

- **Access Key ID** — copiez-le (c’est `S3_ACCESS_KEY`).
- **Secret Access Key** — copiez-le tout de suite (c’est `S3_SECRET_KEY`) ; **vous ne pourrez plus le revoir** après avoir quitté la page.
- **Endpoint** (ou S3 API) : `https://<ACCOUNT_ID>.r2.cloudflarestorage.com` — vous pouvez aussi copier l’**Account ID** et l’**endpoint S3 API** depuis la page R2 Overview (zone Account details en bas à droite).

---

## Étape 5 : Variables d’environnement pour l’application

Dans votre projet, le stockage lit les variables suivantes. En production (ex. Render), ajoutez-les dans **Environment** du Web Service.

| Variable | Valeur | Exemple |
|----------|--------|--------|
| `STORAGE_TYPE` | `s3` | `s3` |
| `S3_BUCKET` | Nom du bucket R2 | `prospects-portfolio` |
| `S3_REGION` | Pour R2, toujours `auto` | `auto` |
| `S3_ACCESS_KEY` | Access Key ID (étape 4) | `a1b2c3d4e5f6...` |
| `S3_SECRET_KEY` | Secret Access Key (étape 4) | `xxxxxxxxxxxxxxxx...` |
| `S3_ENDPOINT` | `https://<ACCOUNT_ID>.r2.cloudflarestorage.com` | `https://a1b2c3d4e5f6....r2.cloudflarestorage.com` |
| `S3_PUBLIC_BASE_URL` | URL publique du bucket (étape 3) | `https://pub-xxxx.r2.dev` |

- Remplacez **&lt;ACCOUNT_ID&gt;** dans `S3_ENDPOINT` par votre vrai Account ID (étape 1).
- **S3_PUBLIC_BASE_URL** : sans slash à la fin (ex. `https://pub-xxxx.r2.dev` et non `https://pub-xxxx.r2.dev/`).

### Exemple complet (à adapter)

```env
# Cloudflare R2 (stockage S3-compatible)
STORAGE_TYPE=s3
S3_BUCKET=prospects-portfolio
S3_REGION=auto
S3_ACCESS_KEY=<Access Key ID créé dans R2 → API Tokens → Manage>
S3_SECRET_KEY=<Secret Access Key affiché une seule fois à la création du jeton>
S3_ENDPOINT=https://<VOTRE_ACCOUNT_ID>.r2.cloudflarestorage.com
S3_PUBLIC_BASE_URL=https://pub-<ID_PUBLIC_BUCKET>.r2.dev
```

Remplacez :
- `<VOTRE_ACCOUNT_ID>` par l’Account ID (R2 Overview → Account details, ou dans l’URL du dashboard).
- `<ID_PUBLIC_BUCKET>` par l’identifiant de l’URL publique de votre bucket (Settings du bucket → Public Development URL → Enable ; l’URL affichée contient ce segment après `pub-`).
- Les valeurs réelles pour `S3_ACCESS_KEY` et `S3_SECRET_KEY` (copiées à l’étape 4.4).

---

## Étape 6 : Configurer sur Render (production)

1. Allez sur [dashboard.render.com](https://dashboard.render.com) → votre **Web Service**.
2. **Environment** (Environnement) → **Add Environment Variable** (Ajouter une variable).
3. Ajoutez **chaque variable** listée à l’étape 5 (nom + valeur).
4. Enregistrez. **Déclenchez un redeploy** du service (Manual Deploy → Deploy latest commit) pour que les nouvelles variables soient prises en compte.

---

## Après avoir défini les variables sur Render : checklist

Une fois les variables d’environnement en place, voici ce qu’il reste à faire et à vérifier si les images/vidéos ne s’affichent pas :

| # | À faire / à vérifier |
|---|------------------------|
| 1 | **Redeploy obligatoire** : les variables ne sont lues qu’au démarrage. Après avoir tout saisi, faites **Manual Deploy** (ou poussez un commit) pour que le service redémarre avec les nouvelles valeurs. |
| 2 | **Bucket public** : dans Cloudflare R2, ouvrez votre bucket → **Settings** → **Public Development URL** doit être **activée**. Sinon l’URL `https://pub-xxx.r2.dev/...` ne servira pas les fichiers. |
| 3 | **S3_PUBLIC_BASE_URL** : doit être **exactement** l’URL affichée pour votre bucket (ex. `https://pub-xxxxxxxx.r2.dev`), **sans slash à la fin**. Si elle est fausse ou absente, l’app génère une mauvaise URL et l’image ne charge pas. |
| 4 | **Noms des variables** : sur Render, les noms doivent être exactement : `S3_BUCKET`, `S3_REGION`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_ENDPOINT`, `S3_PUBLIC_BASE_URL` (sensible à la casse). Pour l’app e-commerce, **S3_ENDPOINT doit être défini** pour activer le mode R2 (sinon le code tente AWS S3). `STORAGE_TYPE` n’est pas utilisé par cette app. |
| 5 | **Produits / médias créés avant R2** : si des images ou vidéos ont été uploadées avant la config R2, la base contient encore l’ancien chemin local ou une URL invalide. Il faut **modifier chaque produit** concerné : ouvrir le produit dans l’admin, **re-téléverser l’image/vidéo** puis enregistrer. À partir de ce moment, l’URL pointe vers R2 et le média s’affiche. |
| 6 | **Logs Render** : en cas d’erreur à l’upload (image qui ne s’enregistre pas), ouvrez les **Logs** du Web Service sur Render et regardez s’il y a une erreur au moment du téléversement (credentials, bucket, endpoint, etc.). |

En résumé : **redeploy** → vérifier **Public Development URL** et **S3_PUBLIC_BASE_URL** → pour les anciennes réalisations, **re-téléverser l’image** dans l’admin.

---

## Étape 7 : Vérifier en production

1. Une fois le déploiement terminé, ouvrez l’admin de votre site en production.
2. Allez dans **Réalisations** (portfolio) et **créez ou modifiez** une réalisation.
3. **Téléversez une image** (bouton Téléverser avec trombone) et enregistrez.
4. Ouvrez la page d’accueil en navigation privée (ou déconnecté) et vérifiez la section **Réalisations** : l’image doit s’afficher.
5. L’URL de l’image dans le code source (ou l’onglet Réseau) doit ressembler à :  
   `https://pub-xxxx.r2.dev/portfolio/1234567890-cover.jpg`

Si l’image ne s’affiche pas :

- Vérifiez que **Public Development URL** est bien **activée** sur le bucket (Settings → General → Public Development URL).
- Vérifiez que **S3_PUBLIC_BASE_URL** est exactement l’URL affichée dans R2 (sans slash final).
- Vérifiez les logs du service sur Render (erreurs d’upload ou de credentials).

---

## Récapitulatif des coûts (R2)

- **Free tier mensuel** : 10 Go stockage, 1 M requêtes d’écriture, 10 M requêtes de lecture, **egress illimité gratuit**.
- Pour un portfolio avec quelques dizaines d’images/vidéos et un trafic modéré : en pratique **0 €/mois**.
- Au-delà : [tarifs R2](https://developers.cloudflare.com/r2/pricing/) (stockage ~0,015 $/Go-mois, etc.).

---

## Références

- [R2 – Public buckets](https://developers.cloudflare.com/r2/buckets/public-buckets/)
- [R2 – S3 API tokens](https://developers.cloudflare.com/r2/api/s3/tokens/)
- [R2 – S3 API](https://developers.cloudflare.com/r2/api/s3/api/) (endpoint : `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`, région : `auto`)

---

## Un même compte pour plusieurs plateformes

Vous pouvez utiliser **un seul compte Cloudflare** pour plusieurs projets (Prospects, un autre site, une autre app, etc.). Chaque plateforme a son propre **bucket** et sa propre **URL publique** ; vous pouvez partager le même **jeton API** pour tous les buckets ou en créer un par projet.

### Ce qui est commun à toutes les plateformes

- **Un seul compte Cloudflare** → un seul **Account ID**.
- **Un seul endpoint** pour toutes les plateformes :  
  `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`
- **Région** : toujours `auto` pour R2.
- Le **free tier** (10 Go, 1 M écritures, 10 M lectures, egress illimité) s’applique à **tout le compte** : l’usage de tous les buckets est additionné.

### Ce qui change par plateforme

Pour chaque plateforme (chaque site ou app), vous avez :

- **Un bucket dédié** (ex. `prospects-portfolio`, `mon-autre-site-uploads`).
- **Une URL publique** propre à ce bucket (chaque bucket a sa propre URL r2.dev ou son propre domaine).
- **Variables d’environnement** différentes sur chaque hébergement (Render, Vercel, etc.) : au minimum `S3_BUCKET` et `S3_PUBLIC_BASE_URL` différents ; vous pouvez réutiliser le même `S3_ACCESS_KEY` / `S3_SECRET_KEY` si vous utilisez un jeton commun.

---

### Procédure : ajouter une nouvelle plateforme avec le même compte

À faire **une seule fois** par compte : [Étape 1](#étape-1--activer-r2-et-récupérer-laccount-id) (Account ID).

Ensuite **pour chaque nouvelle plateforme** :

| Étape | Action | À noter pour cette plateforme |
|-------|--------|-------------------------------|
| 1 | [Étape 2](#étape-2--créer-un-bucket-r2) : créer un **nouveau** bucket | Nom unique, ex. `prospects-portfolio`, `blog-images`, `app-docs-uploads`. → **S3_BUCKET** |
| 2 | [Étape 3](#étape-3--rendre-le-bucket-public-pour-afficher-les-images) : activer l’accès public sur **ce** bucket | Récupérer la **Public Bucket URL** de ce bucket. → **S3_PUBLIC_BASE_URL** |
| 3 | Jeton API : **choix A ou B** ci‑dessous | |
| 4 | [Étape 5](#étape-5--variables-denvironnement-pour-lapplication) et [6](#étape-6--configurer-sur-render-production) : configurer les variables **sur l’hébergement de cette plateforme** | Même **S3_ENDPOINT** (Account ID), même **S3_REGION** (`auto`). **S3_BUCKET** et **S3_PUBLIC_BASE_URL** = ceux de ce bucket. |

#### Choix pour le jeton API (étape 3)

**Option A — Un jeton par plateforme (recommandé pour la sécurité)**  
- **Manage R2 API Tokens** → **Create API token**.  
- Permissions : **Object Read & Write**.  
- **Apply to specific buckets only** → sélectionnez **uniquement le bucket de cette plateforme**.  
- Nom du jeton : ex. `Prospects production`, `Blog images`, etc.  
- Vous obtenez un **Access Key ID** et **Secret Access Key** dédiés à ce bucket.  
- Sur cette plateforme uniquement : `S3_ACCESS_KEY` et `S3_SECRET_KEY` = ce jeton. Les autres plateformes gardent leurs propres jetons.

**Option B — Un seul jeton pour tous les buckets**  
- **Manage R2 API Tokens** → **Create API token** (une seule fois).  
- Permissions : **Object Read & Write**.  
- **Apply to specific buckets only** → sélectionnez **tous** les buckets que vous utilisez pour vos plateformes (ou ne limitez pas = accès à tous les buckets du compte).  
- Nom du jeton : ex. `Tous mes projets R2`.  
- **Sur chaque plateforme** : utilisez le **même** Access Key ID et Secret Access Key ; seuls **S3_BUCKET** et **S3_PUBLIC_BASE_URL** changent selon le bucket de la plateforme.

---

### Tableau récapitulatif par plateforme

À remplir pour ne rien oublier quand vous configurez ou ajoutez une plateforme :

| Plateforme (ex. nom du site / app) | Bucket (`S3_BUCKET`) | URL publique (`S3_PUBLIC_BASE_URL`) | Hébergement (Render, etc.) |
|-----------------------------------|----------------------|-------------------------------------|----------------------------|
| Prospects (ce projet)             | `prospects-portfolio` | `https://pub-xxxx.r2.dev`           | Render – Web Service X    |
| Autre site                        | `autre-site-uploads`  | `https://pub-yyyy.r2.dev`           | Render – Web Service Y    |
| …                                 | …                    | …                                   | …                          |

**Variables identiques pour toutes** (même compte) :  
`STORAGE_TYPE=s3`, `S3_REGION=auto`, `S3_ENDPOINT=https://<ACCOUNT_ID>.r2.cloudflarestorage.com`  
et, si vous avez choisi l’option B, `S3_ACCESS_KEY` et `S3_SECRET_KEY` aussi.

**Variables différentes par plateforme** :  
`S3_BUCKET`, `S3_PUBLIC_BASE_URL` (et en option A : `S3_ACCESS_KEY`, `S3_SECRET_KEY`).
