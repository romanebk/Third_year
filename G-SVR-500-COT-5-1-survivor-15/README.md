# ChomageGo

Application web de recherche d'emploi **géolocalisée en temps réel** (projet pédagogique Epitech). Complète les dispositifs existants, sans s'y substituer.

Le **frontend complet** (React 18 + Vite + MSW) se lance seul :

```bash
cd frontend
npm install
npm run dev
```

Comptes de démo (`Demo1234567`) : `yasmine@demo.fr` (candidat) · `rh@maisonbardot.fr` (employeur) · `admin@chomagego.fr` (admin). Détail : [frontend/README.md](frontend/README.md).

---

# GéoEmploi (API)

Le dossier `backend/` contient l'API Express / Prisma du socle Survivor. Le frontend ChomageGo mocke le contrat d'API via MSW tant que le backend n'est pas branché.


## Description

GéoEmploi met en relation des **demandeurs d'emploi** et des **employeurs** autour d'offres géolocalisées. La consultation des offres et de la carte est possible sans compte ; la candidature nécessite une authentification.

## Problématique

Faciliter la découverte d'opportunités d'emploi **à proximité**, en combinant recherche par métier, filtres géographiques et carte interactive.

## Objectifs

- Permettre la consultation publique des offres (liste + carte)
- Permettre l'inscription et la connexion par rôle (demandeur, employeur)
- Permettre aux employeurs de publier et gérer des offres géolocalisées
- Permettre aux demandeurs de postuler et suivre leurs candidatures
- Fournir un espace d'administration (modération, utilisateurs, statistiques)

## Fonctionnalités principales

| Domaine | État dans le dépôt | Détail |
|---------|-------------------|--------|
| Frontend React (pages, navigation, carte Leaflet) | ✅ Présent | Branché sur le vrai backend (MSW désactivé par défaut, réactivable via `VITE_USE_MOCKS=1`) |
| Schéma Prisma + migrations | ✅ Présent | PostgreSQL + PostGIS, migrations à jour (voir [docs/SCHEMA_BDD.md](docs/SCHEMA_BDD.md)) |
| Authentification JWT (access + refresh, rotation) | ✅ Présent | `backend/src/modules/auth/` |
| Offres géolocalisées (CRUD, recherche PostGIS, secteur/contrat/salaire) | ✅ Présent | `backend/src/modules/offers/` |
| Candidatures (dépôt, suivi, CV) | ✅ Présent | `backend/src/modules/applications/`, stockage CV en local |
| Profil demandeur (compétences, expérience, téléphone) | ✅ Présent | `backend/src/modules/users/` |
| Middleware rôles, validation Zod, erreurs | ✅ Présent | `backend/src/middleware/` |
| Service notifications interne | 🟡 Partiel | `createNotification()` couvre candidature reçue + changement de statut (testé, `backend/src/scripts/notifications-smoke-test.ts`). Type "alert" (nouvelle offre à proximité) non implémenté, aucune position candidat stockée en base |
| Module admin (modération, statistiques) | ✅ Présent | `backend/src/modules/admin/`, testé de bout en bout (`backend/src/scripts/admin-smoke-test.ts`) |
| Documentation OpenAPI vivante, curl-vérifiée | ✅ Présent | Servie sur `/api/docs` (Try it out fonctionnel), snapshot statique équivalent : [docs/API.md](docs/API.md) |
| Test de charge (k6) | ✅ Présent | `backend/loadtest/`, voir [docs/JOURNAL_MODULE3.md](docs/JOURNAL_MODULE3.md) |

> Historique détaillé des fonctionnalités et bugs corrigés côté module 3 : [docs/JOURNAL_MODULE3.md](docs/JOURNAL_MODULE3.md). Répartition et architecture par module : [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Utilisateurs et rôles

| Rôle Prisma | Description |
|-------------|-------------|
| `JOBSEEKER` | Demandeur d'emploi, profil, candidatures, notifications |
| `EMPLOYER` | Employeur, offres, gestion des candidatures |
| `ADMIN` | Administration, modération, utilisateurs, statistiques |

## Architecture générale

Monolithe modulaire : frontend React (Vite) + API Express + PostgreSQL/PostGIS via Prisma.

```
[ Frontend : frontend/ ]  →  proxy /api  →  [ Backend : backend/ ]  →  [ PostgreSQL + PostGIS ]
```

Voir [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Stack technique

| Couche | Technologie |
|--------|-------------|
| Frontend | React 18, Vite 5, TypeScript, React Router 6 |
| Cartographie | Leaflet, react-leaflet, OpenStreetMap |
| API | Node.js, Express 4, TypeScript |
| ORM | Prisma 6 |
| Base de données | PostgreSQL 16 + PostGIS 3.4 (Docker) |
| Auth (prévu) | JWT (access + refresh), bcrypt |
| Validation | Zod |
| Documentation API | OpenAPI 3, Swagger UI (`/api/docs`), snapshot : [docs/API.md](docs/API.md) |
| Conteneurisation | Docker Compose (base de données) |

## Structure du repository

```
├── backend/           # API Express (modules métier)
├── frontend/          # SPA React + Vite
├── prisma/            # Schéma et migrations
├── docs/              # Documentation projet
├── docker-compose.yml # PostgreSQL + PostGIS
├── .env.example       # Variables d'environnement
└── README.md
```

## Prérequis

- **Node.js** 20+
- **npm** (inclus avec Node.js)
- **Git**
- **Docker + Docker Compose** (pour une base locale ; optionnel si base partagée)

## Installation rapide

```bash
git clone git@github.com:EpitechPGE3-2026/G-SVR-500-COT-5-1-survivor-15.git
cd G-SVR-500-COT-5-1-survivor-15
git checkout develop
cp .env.example .env
docker compose up -d
cd backend && npm install && npm run prisma:generate
npx prisma migrate deploy --schema=../prisma/schema.prisma
cd ../frontend && npm install
```

Guide détaillé : [docs/INSTALLATION.md](docs/INSTALLATION.md).

## Configuration des variables d'environnement

Fichier `.env` à la **racine** du projet (voir `.env.example`) :

| Variable | Rôle |
|----------|------|
| `NODE_ENV` | Environnement (`development`, `production`, `test`) |
| `PORT` | Port de l'API (défaut : `3000`) |
| `DATABASE_URL` | Connexion PostgreSQL |
| `JWT_ACCESS_SECRET` | Secret JWT access (min. 16 caractères) |
| `JWT_REFRESH_SECRET` | Secret JWT refresh (min. 16 caractères) |
| `JWT_ACCESS_EXPIRES_IN` | Durée du token access (défaut : `15m`) |
| `JWT_REFRESH_EXPIRES_IN` | Durée du token refresh (défaut : `7d`) |
| `CORS_ORIGIN` | Origine autorisée du frontend |

> **Note :** avec le frontend Vite en développement (`http://localhost:5173`), `CORS_ORIGIN` doit correspondre à cette origine.

## Lancement du projet

**Terminal 1, API :**

```bash
cd backend
npm run dev
```

**Terminal 2, Frontend :**

```bash
cd frontend
npm run dev
```

| Service | URL |
|---------|-----|
| API | http://localhost:3000 |
| Swagger | http://localhost:3000/api/docs |
| Frontend Vite | http://localhost:5173 |

## Tests

Aucun test unitaire/intégration automatisé dans les `package.json` actuels.

Un test de charge existe (k6, 50 utilisateurs simultanés sur la carte + le détail
d'offre) : `k6 run backend/loadtest/carte-offres.js`. Résultats et méthode dans
[docs/JOURNAL_MODULE3.md](docs/JOURNAL_MODULE3.md).

## Typecheck et build

**Frontend :**

```bash
cd frontend
npm run typecheck
npm run build
npm run preview   # prévisualiser le build
```

**Backend :**

```bash
cd backend
npm run build
npm run start     # exécuter dist/index.js
```

## Documentation API

- Doc vivante, curl-vérifiée (source de vérité) : Swagger UI sur `/api/docs` (serveur local)
- [docs/API.md](docs/API.md) : export markdown de cette même doc, lisible directement sur GitHub sans lancer le serveur
- Contrat OpenAPI de référence (squelette, voir note en tête de fichier) : [docs/api.yaml](docs/api.yaml)
- Module Auth (endpoints + exemples curl) : [docs/API_AUTH.md](docs/API_AUTH.md)

## Documentation complémentaire

| Document | Contenu |
|----------|---------|
| [docs/INSTALLATION.md](docs/INSTALLATION.md) | Installation détaillée, BDD, migrations |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Architecture, modules, répartition équipe |
| [docs/SCHEMA_BDD.md](docs/SCHEMA_BDD.md) | Modèle de données Prisma (schéma complet, à jour) |
| [docs/JOURNAL_MODULE3.md](docs/JOURNAL_MODULE3.md) | Historique fonctionnalités/bugs/config (module 3) |
| [docs/RGPD_FICHE_REGISTRE.md](docs/RGPD_FICHE_REGISTRE.md) | Registre RGPD, données collectées |
| [docs/RGPD_TABLEAU_CONSENTEMENT.md](docs/RGPD_TABLEAU_CONSENTEMENT.md) | Gestion du consentement géolocalisation |
| [docs/SYNTHESE_ARBITRAGES.md](docs/SYNTHESE_ARBITRAGES.md) | Décisions et arbitrages du projet |

## Workflow Git

```text
feature/*  →  Pull Request  →  develop  →  validation  →  main
```

## Équipe

Projet réalisé par **4 développeurs**. Répartition par branche documentée dans [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md#6-répartition-équipe-4-développeurs).
