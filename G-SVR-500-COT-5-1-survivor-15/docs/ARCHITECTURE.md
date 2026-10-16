# GéoEmploi, Architecture & Répartition du projet

*Document de référence, aligné sur la structure réelle du dépôt*

---

## 1. Résumé du projet

**GéoEmploi** est une application web de mise en relation emploi géolocalisée, projet pédagogique Epitech sur **2 semaines**.

### Trois profils utilisateurs

| Profil | Fonctionnalités clés |
|---|---|
| **Demandeur d'emploi** | Profil pro, recherche sur carte, candidature, suivi |
| **Employeur** | Compte vérifié, publication d'offres, dashboard, gestion candidatures |
| **Admin** | Modération, gestion comptes, métriques nationales |

### Exigences prioritaires (non négociables)

1. Consultation de la carte **sans compte**
2. Candidature **obligatoirement** avec compte authentifié
3. Archivage automatique des offres après **30 jours**
4. Notification employeur à chaque nouvelle candidature

---

## 2. Stack technique (figée)

| Couche | Choix |
|---|---|
| Frontend | HTML, CSS, JavaScript (vanilla) → **React + Vite + TypeScript** |
| API | Node.js 20+, Express, TypeScript |
| ORM | Prisma |
| BDD | PostgreSQL 16 + PostGIS |
| Carte | Leaflet.js + OpenStreetMap |
| Auth | JWT (access + refresh) |
| Validation | Zod |
| Doc API | Swagger / OpenAPI |
| Environnement | Docker |

---

## 3. Vue d'ensemble

```
[ Frontend, frontend/ ]
        |
        |  HTTPS / JSON
        v
[ API REST, backend/src/ ]  ← Swagger / docs/api.yaml
        |
        |  Prisma
        v
[ PostgreSQL + PostGIS ]
```

**Monolithe modulaire** : un seul serveur Express, modules métier isolés par dossier.

---

## 4. Structure du projet

```
G-SVR-500-COT-5-1-survivor-15/
│
├── backend/
│   ├── src/
│   │   ├── config/           # env, database, swagger
│   │   ├── middleware/       # auth, roles, validate, errorHandler
│   │   ├── modules/
│   │   │   ├── auth/
│   │   │   ├── users/
│   │   │   ├── offers/
│   │   │   ├── applications/
│   │   │   ├── notifications/
│   │   │   ├── reports/
│   │   │   ├── admin/
│   │   │   └── index.ts      # Registre central des routes
│   │   ├── types/
│   │   ├── utils/
│   │   ├── app.ts
│   │   └── index.ts
│   ├── package.json
│   └── tsconfig.json
│
├── frontend/                     # React + Vite + TypeScript
│   ├── package.json
│   ├── vite.config.ts
│   ├── index.html
│   ├── public/
│   └── src/
│       ├── components/
│       ├── pages/
│       ├── layouts/
│       ├── services/             # api.ts + mocks (remplaçables par API REST)
│       ├── hooks/
│       ├── types/
│       ├── styles/
│       ├── App.tsx
│       └── main.tsx
│
├── prisma/
│   ├── schema.prisma
│   └── migrations/
│
├── docs/
│   ├── ARCHITECTURE.md
│   └── api.yaml
│
├── docker-compose.yml
├── .env.example
├── .gitignore
└── README.md
```

---

## 5. Organisation des modules

### Module Auth / Users, `feature/auth`

**Responsable de :**
- Inscription, connexion, JWT, refresh tokens
- Rôles et permissions de base
- Profil courant : **`GET /api/users/me`** (endpoint unique, pas de `/auth/me`)
- Gestion du compte : `PATCH /api/users/me`, `DELETE /api/users/me`
- Profils demandeur et employeur (CRUD backend)

**Frontend :** `login.html`, `register.html`, `auth.js`

---

### Module Demandeur, `feature/job-seeker`

**Responsable de (frontend + consommation API) :**
- Carte Leaflet / OpenStreetMap
- Consultation des offres sans compte
- Recherche et filtres côté interface
- Formulaire profil demandeur (UI)
- Bouton signalement (UI)
- Candidature côté interface

**IMPORTANT, le backend des offres reste dans `offers/` (feature/employer).**
Ce module **consomme** :
- `GET /api/offers/nearby`
- `GET /api/offers/:id`
- `POST /api/applications`
- `POST /api/reports/:offerId`

---

### Module Offers / Employer, `feature/employer`

**Responsable de :**
- Profil employeur (backend)
- CRUD offres géolocalisées
- `GET /api/offers/nearby` (PostGIS `ST_DWithin`)
- Publication, expiration, archivage 30 jours (`offers.cron.ts`)
- Métriques offres (`viewCount`)
- Gestion candidatures côté employeur

**Frontend :** `dashboard-employer.html`

---

### Module Applications, `feature/employer`

Logique dans `backend/src/modules/applications/`.
- `POST /api/applications`, demandeur authentifié uniquement
- `GET /api/applications/mine`, suivi demandeur
- `PATCH /api/applications/:id`, statut employeur

**Notification interne (pas de HTTP inter-modules) :**

```
Candidature créée
      ↓
notificationsService.create()
```

---

### Module Notifications, `feature/admin`

- Endpoints publics (frontend) : `GET /api/notifications`, `PATCH /api/notifications/:id`
- Service interne : `notifications.service.ts` → `createNotification()`
- **Pas de `POST /api/notifications` public**

---

### Module Reports, `feature/admin`

- `POST /api/reports/:offerId`
- Bouton UI dans la carte (feature/job-seeker), backend ici

---

### Module Admin, `feature/admin`

- `GET /api/admin/users`, `PATCH /api/admin/users/:id`
- Suspension, activation, vérification employeur
- `GET /api/admin/stats`
- `PATCH /api/admin/offers/:id` (modération)

**Frontend :** `admin.html`

---

## 6. Répartition équipe (4 développeurs)

| Membre | Branche | Backend | Frontend |
|---|---|---|---|
| 1 | `feature/auth` | auth, users, middleware JWT | login, register, gestion compte |
| 2 | `feature/job-seeker` | consommation API offres | carte Leaflet, profil UI, candidature UI |
| 3 | `feature/employer` | offers, applications, cron | dashboard employeur, CRUD offres |
| 4 | `feature/admin` | admin, reports, notifications | panel admin, notifs UI |

---

## 7. Contrats d'API (figés Jour 1)

| Endpoint | Module propriétaire | Accès |
|---|---|---|
| `POST /api/auth/register` | auth | Public |
| `POST /api/auth/login` | auth | Public |
| `POST /api/auth/refresh` | auth | Public |
| `GET /api/users/me` | users | Authentifié |
| `PATCH /api/users/me` | users | Authentifié |
| `DELETE /api/users/me` | users | Authentifié |
| `GET /api/offers/nearby` | offers | **Public** |
| `GET /api/offers/:id` | offers | **Public** |
| `POST /api/offers` | offers | EMPLOYER |
| `POST /api/applications` | applications | JOBSEEKER |
| `GET /api/applications/mine` | applications | JOBSEEKER |
| `PATCH /api/applications/:id` | applications | EMPLOYER |
| `GET /api/notifications` | notifications | Authentifié |
| `PATCH /api/notifications/:id` | notifications | Authentifié |
| `POST /api/reports/:offerId` | reports | Authentifié |
| `GET /api/admin/users` | admin | ADMIN |
| `PATCH /api/admin/users/:id` | admin | ADMIN |
| `GET /api/admin/stats` | admin | ADMIN |
| `PATCH /api/admin/offers/:id` | admin | ADMIN |

Contrat figé au démarrage, à titre historique : plusieurs routes ont changé de nom en cours
de développement (ex. `/api/admin/stats` → `/api/admin/metrics`, `/api/reports/:offerId` →
`/api/offers/:offerId/report`, modération via `PATCH /api/offers/:id` plutôt qu'une route
`/api/admin/offers/:id` dédiée). Documentation à jour et curl-vérifiée : `docs/API.md`
(régénérée depuis `/api/docs`, voir `docs/API.md` en tête de fichier).

---

## 8. Stratégie Git

### Branches principales

- `main` → version **stable**, toujours fonctionnelle
- `develop` → branche **d'intégration**

### Branches feature

```
main
└── develop
    ├── feature/auth
    ├── feature/job-seeker
    ├── feature/employer
    └── feature/admin
```

### Règles

- Ne **jamais** travailler directement sur `main` ni `develop`
- Merge dans `develop` quand la feature est testée
- Merge `develop` → `main` pour une version stable
- **feature/auth** merge en premier (dépendance des autres)
- **Coordination obligatoire** avant toute modification de `prisma/schema.prisma`

### Convention des commits

Format : `type(scope): description`

- `feat(auth): add login endpoint`
- `fix(offers): correct nearby radius`
- `refactor(users): extract profile service`

---

## 9. Base de données

Schéma centralisé : `prisma/schema.prisma`

| Modèle | Rôle |
|---|---|
| User | Compte, rôle, suspension, soft delete (`deletedAt`) |
| JobseekerProfile | Profil demandeur |
| EmployerProfile | Profil employeur, vérification |
| Offer | Offre géolocalisée, `viewCount`, archivage |
| Application | Candidature (unique par offre/user) |
| Notification | Notifications in-app |
| Report | Signalements |
| Session | Refresh tokens JWT |

**PostGIS :** coordonnées `latitude`/`longitude` dans Prisma ; requêtes spatiales via `$queryRaw` et `ST_DWithin`. Extension activée via `prisma/migrations/postgis/enable_postgis.sql`.

**Gatekeeper migrations :** une personne coordonne les changements de schéma pour éviter les conflits.

---

## 10. Fichiers sensibles (conflits Git)

| Fichier | Règle |
|---|---|
| `prisma/schema.prisma` | Modification coordonnée en équipe |
| `backend/src/modules/index.ts` | Ajout de route par le propriétaire du module |
| `frontend/js/api.js` | Figé au cadrage, modifications groupées |
| `frontend/js/app.js` | Idem |
| `backend/src/middleware/auth.ts` | Propriété feature/auth |

---

## 11. Plan d'exécution

| Jour | Action |
|---|---|
| **J1 matin** | Docker, `.env`, `prisma push`, branches feature |
| **J1 aprem** | feature/auth : register, login, JWT, middleware |
| **J2 matin** | feature/employer : offers CRUD + nearby PostGIS |
| **J2 aprem** | feature/admin : notifications service + feature/employer : applications |
| **J3-J4** | Développement parallèle sur les 4 branches |
| **S1 vendredi** | POC : carte sans compte, comptes, ≥1 offre geo |

---

## 12. Points à trancher en équipe

- Stratégie exacte de suppression de compte (anonymisation vs cascade)
- Workflow de vérification employeur (manuel admin vs automatique)
- Refresh token : durée et révocation
- Index spatial PostGIS GIST : activation dès le POC ou en optimisation S2
