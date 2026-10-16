# Guide d'installation, GéoEmploi

Ce document explique comment installer le projet, lancer l'application en local, et comment la base de données est gérée en équipe.

---

## 1. Prérequis

Installez les outils suivants sur votre machine :

| Outil | Version minimale | Vérification |
|---|---|---|
| **Node.js** | 20+ | `node -v` |
| **npm** | inclus avec Node | `npm -v` |
| **Git** | récent | `git --version` |
| **Docker + Docker Compose** | optionnel (BDD locale) | `docker compose version` |
| **psql** | optionnel (debug BDD) | `psql --version` |

> **Note :** Docker n'est nécessaire que si vous utilisez une base PostgreSQL **locale**. Si vous travaillez sur la base **partagée AlwaysData**, Docker n'est pas obligatoire.

---

## 2. Cloner le dépôt

```bash
git clone git@github.com:EpitechPGE3-2026/G-SVR-500-COT-5-1-survivor-15.git
cd G-SVR-500-COT-5-1-survivor-15
git checkout develop
```

---

## 3. Variables d'environnement

Le fichier `.env` se place **à la racine du projet** (pas dans `backend/`). Le backend le charge automatiquement.

```bash
cp .env.example .env
```

Éditez `.env` :

```env
NODE_ENV=development
PORT=3000

# Voir section 4, choisir la BDD locale ou partagée
DATABASE_URL=...

JWT_ACCESS_SECRET=change-me-access-secret-min-16-chars
JWT_REFRESH_SECRET=change-me-refresh-secret-min-16-chars
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Frontend Vite tourne sur le port 5173
CORS_ORIGIN=http://localhost:5173
```

| Variable | Rôle |
|---|---|
| `DATABASE_URL` | Connexion PostgreSQL (Prisma + API) |
| `JWT_*` | Secrets pour les tokens d'authentification (min. 16 caractères) |
| `CORS_ORIGIN` | Origine autorisée du frontend React |

> **Important :** ne commitez jamais le fichier `.env` (il est dans `.gitignore`). Demandez les identifiants de la BDD partagée à un coéquipier si besoin.

---

## 4. Base de données, deux options

### Option A, Base partagée AlwaysData (recommandée pour l'équipe)

La base de production de développement est déjà créée et migrée. Chaque coéquipier reçoit la `DATABASE_URL` de l'équipe (format AlwaysData avec `sslmode=require`).

**Avantages :** pas de Docker, données communes, schéma déjà à jour.

**Étapes :**

```bash
# 1. Mettre la DATABASE_URL dans .env (fournie par l'équipe)

# 2. Backend, installer les dépendances et générer le client Prisma
cd backend
npm install
npm run prisma:generate

# 3. Vérifier que la BDD est synchronisée
set -a && source ../.env && set +a   # Linux / macOS
npm run prisma:validate
npx prisma migrate status --schema=../prisma/schema.prisma
```

Résultat attendu : `Database schema is up to date!`

PostGIS est **déjà activé** sur cette base. Aucune action supplémentaire.

---

### Option B, Base locale avec Docker

Pour travailler hors ligne ou sans toucher à la base partagée.

```bash
# À la racine du projet
docker compose up -d
```

Cela démarre PostgreSQL 16 + PostGIS sur `localhost:5432` avec :

- utilisateur : `geoemploi`
- mot de passe : `geoemploi`
- base : `geoemploi`

Dans `.env` :

```env
DATABASE_URL=postgresql://geoemploi:geoemploi@localhost:5432/geoemploi
```

Puis initialiser le schéma :

```bash
cd backend
npm install
npm run prisma:generate

# Appliquer les migrations existantes
set -a && source ../.env && set +a
npx prisma migrate deploy --schema=../prisma/schema.prisma

# Activer PostGIS (une seule fois)
psql "postgresql://geoemploi:geoemploi@localhost:5432/geoemploi" \
  -f ../prisma/scripts/postgis/enable_postgis.sql
```

> Sous Windows (PowerShell), remplacez `set -a && source ../.env && set +a` par `$env:DATABASE_URL = "..."` ou utilisez un outil comme `dotenv-cli`.

---

## 5. Lancer l'application

Deux terminaux sont nécessaires.

### Terminal 1, API (backend)

```bash
cd backend
npm run dev
```

| Service | URL |
|---|---|
| API | http://localhost:3000 |
| Swagger (doc API) | http://localhost:3000/api/docs |

### Terminal 2, Frontend (React + Vite)

```bash
cd frontend
npm install
npm run dev
```

| Service | URL |
|---|---|
| Frontend | http://localhost:5173 |

---

## 6. Scripts utiles

### Backend (`cd backend`)

```bash
npm run dev              # Développement avec rechargement automatique
npm run build            # Compilation TypeScript
npm run start            # Lancer la version compilée (production)
npm run prisma:validate  # Valider le schéma Prisma
npm run prisma:generate  # Régénérer le client Prisma après changement de schéma
npm run prisma:migrate   # Créer + appliquer une migration (dev)
npm run prisma:push      # Pousser le schéma sans migration (proto rapide, éviter en équipe)
```

### Frontend (`cd frontend`)

```bash
npm run dev        # Serveur de développement Vite
npm run build      # Build de production
npm run preview    # Prévisualiser le build
npm run typecheck  # Vérification TypeScript
```

---

## 7. Comment la base de données est gérée

### Architecture

```
prisma/
├── schema.prisma              ← Source de vérité (modèles, relations, enums)
├── migrations/
│   └── 20250901120000_init/   ← Migration initiale (tables, index, FK)
│       └── migration.sql
└── scripts/
    └── postgis/
        └── enable_postgis.sql ← Activation PostGIS (hors Prisma)
```

| Couche | Technologie | Rôle |
|---|---|---|
| SGBD | PostgreSQL 16 + PostGIS 3.4 | Stockage relationnel + requêtes géospatiales |
| ORM | Prisma | Modèles TypeScript, migrations, client généré |
| App | `@prisma/client` dans `backend/src/config/database.ts` | Accès BDD depuis l'API |

### Tables créées

| Table | Description |
|---|---|
| `User` | Compte utilisateur (email, rôle, suspension, soft delete) |
| `JobseekerProfile` | Profil demandeur d'emploi (compétences, localisation) |
| `EmployerProfile` | Profil employeur (entreprise, vérification) |
| `Offer` | Offre géolocalisée (lat/lng, rayon, statut, expiration) |
| `Application` | Candidature (1 par offre et par utilisateur) |
| `Notification` | Notifications in-app |
| `Report` | Signalement d'une offre |
| `Session` | Refresh tokens JWT |

Les enums Prisma (`Role`, `OfferStatus`, `ApplicationStatus`, `ReportStatus`) sont stockés comme types PostgreSQL natifs.

### PostGIS, géolocalisation

Prisma ne gère pas nativement les types géométriques. Le projet utilise une approche hybride :

1. **Coordonnées** stockées en `latitude` / `longitude` (`Float`) dans les tables Prisma.
2. **Extension PostGIS** activée sur la base pour les requêtes spatiales.
3. **Requêtes avancées** (ex. offres à proximité) via `$queryRaw` avec `ST_DWithin` dans le code backend.

Script PostGIS : `prisma/scripts/postgis/enable_postgis.sql`

### Workflow migrations en équipe

> **Règle d'équipe :** une seule personne coordonne les changements de schéma (gatekeeper) pour éviter les conflits sur `prisma/schema.prisma`.

#### Quand vous modifiez le schéma

1. **Modifier** `prisma/schema.prisma`.
2. **Créer une migration** (gatekeeper ou avec accord de l'équipe) :

   ```bash
   cd backend
   set -a && source ../.env && set +a
   npm run prisma:migrate
   # Prisma demande un nom, ex. : add_offer_category
   ```

3. **Commiter** le schéma + le dossier `prisma/migrations/XXXX_nom/`.
4. **Prévenir l'équipe** sur le canal de com (Slack, Discord, etc.).
5. Chaque coéquipier **récupère** et applique :

   ```bash
   git pull
   cd backend
   npm run prisma:generate
   set -a && source ../.env && set +a
   npx prisma migrate deploy --schema=../prisma/schema.prisma
   ```

#### Commandes de vérification

```bash
cd backend
set -a && source ../.env && set +a

# État des migrations
npx prisma migrate status --schema=../prisma/schema.prisma

# Écart entre la BDD live et le schéma Prisma
npx prisma migrate diff \
  --from-url "$DATABASE_URL" \
  --to-schema-datamodel ../prisma/schema.prisma
```

Si tout est synchronisé : `No difference detected.`

#### Ce qu'il ne faut pas faire

| Action | Pourquoi |
|---|---|
| `prisma db push` sur la base partagée | Contourne l'historique des migrations, crée des divergences |
| Modifier une migration déjà appliquée | Casse la cohérence entre environnements |
| Changer `schema.prisma` sans prévenir l'équipe | Conflits Git et schémas désynchronisés |

### Accès direct à la BDD (debug)

Avec `psql`, retirez le paramètre `?schema=public&sslmode=require` de l'URL Prisma :

```bash
# Exemple AlwaysData
psql "postgresql://USER:PASS@HOST:5432/DATABASE?sslmode=require"

# Lister les tables
\dt

# Vérifier PostGIS
SELECT extname, extversion FROM pg_extension WHERE extname = 'postgis';
```

Prisma Studio (interface graphique) :

```bash
cd backend
set -a && source ../.env && set +a
npx prisma studio --schema=../prisma/schema.prisma
```

Ouvre http://localhost:5555, permet de consulter et modifier les données visuellement.

---

## 8. Vérifier que tout fonctionne

Checklist rapide après installation :

- [ ] `npm run prisma:validate` → schéma valide
- [ ] `npx prisma migrate status` → `Database schema is up to date!`
- [ ] `npm run dev` (backend) → API sur http://localhost:3000
- [ ] http://localhost:3000/api/docs → Swagger accessible
- [ ] `npm run dev` (frontend) → http://localhost:5173
- [ ] Pas d'erreur CORS dans la console du navigateur

---

## 9. Dépannage

### `Environment variable not found: DATABASE_URL`

Le `.env` doit être à la **racine** du projet. Les commandes Prisma doivent être lancées depuis `backend/` avec la variable chargée :

```bash
set -a && source ../.env && set +a
```

### `Can't reach database server`

- Vérifiez votre connexion internet (AlwaysData).
- Vérifiez que Docker tourne (`docker compose ps`) si BDD locale.
- Testez le port : `nc -zv HOST 5432`

### `Database schema is not up to date`

```bash
cd backend
set -a && source ../.env && set +a
npx prisma migrate deploy --schema=../prisma/schema.prisma
npm run prisma:generate
```

### Erreur CORS dans le navigateur

Mettez à jour `.env` :

```env
CORS_ORIGIN=http://localhost:5173
```

Puis redémarrez le backend.

### Client Prisma obsolète après un `git pull`

```bash
cd backend
npm run prisma:generate
```

---

## 10. Ressources complémentaires

| Document | Contenu |
|---|---|
| [README.md](../README.md) | Vue d'ensemble du projet |
| [docs/ARCHITECTURE.md](ARCHITECTURE.md) | Architecture, modules, branches Git, répartition équipe |
| [docs/API.md](API.md) | Documentation API, 42 endpoints, exemples réels (régénérée depuis `/api/docs`) |
| [prisma/schema.prisma](../prisma/schema.prisma) | Schéma de base de données |
