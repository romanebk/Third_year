# GéoEmploi, note de déploiement

Ce qu'il faut pour faire tourner l'application, et pourquoi elle est construite ainsi.

## 1. Pile technique

| Composant | Techno | Port par défaut |
|---|---|---|
| Frontend | React 18 + Vite | 5173 (dev) |
| Backend | Node.js 22 + Express + TypeScript | 3000 |
| Base de données | PostgreSQL 16 + PostGIS 3.4 | 5432 |

## 2. Pourquoi cette pile

- **PostgreSQL + PostGIS**, plutôt qu'une base sans extension géo : le cœur du produit est une recherche de proximité (offres à moins de N km d'un candidat). PostGIS fournit `ST_DWithin` en natif, sur une base libre et gratuite à héberger soi-même, cohérent avec la contrainte de Thomas Vignal ("Stripe interdit, tout service tiers payant interdit", "100% locale, aucun cloud payant", voir docs/SYNTHESE_ARBITRAGES.md §4). Une base géo managée tierce (ou une API de recherche géo payante) aurait été plus rapide à intégrer mais violait directement cette contrainte.
- **Prisma**, plutôt que des requêtes SQL écrites à la main : un seul schéma (`prisma/schema.prisma`) fait à la fois office de source de vérité du modèle de données et de générateur de migrations, avec un client TypeScript typé de bout en bout. Les requêtes géo natives (`ST_DWithin`) restent accessibles via `$queryRaw` quand Prisma n'a pas d'équivalent, sans perdre les garanties de typage sur le reste.
- **Express**, plutôt qu'un framework plus opinionated (NestJS, etc.) : équipe réduite, délais courts, l'organisation en modules (`backend/src/modules/<domaine>`) donne déjà la structure nécessaire sans la courbe d'apprentissage d'un framework à conventions.
- **React + Vite**, plutôt que Next.js : l'application n'a pas besoin de rendu serveur (pas de SEO critique sur les pages authentifiées, la carte publique reste un cas isolé) ; Vite donne un rechargement à chaud quasi instantané en développement et un temps de build de production mesuré (§9), suffisant pour l'usage.
- **Leaflet + tuiles IGN Géoplateforme**, plutôt qu'un fournisseur de cartes commercial (Google Maps, Mapbox) : source publique française gratuite, sans clé à provisionner, alignée sur l'interdiction des services tiers payants. OpenStreetMap a été explicitement écarté en cours de projet sur instruction (voir docs/MIGRATION-IGN.md).

## 3. Base de données

```bash
docker compose up -d          # démarre Postgres + PostGIS (docker-compose.yml, racine)
cd backend
npm run prisma:migrate        # applique les migrations (schéma dans prisma/schema.prisma)
```

## 4. Variables d'environnement

Copier `.env.example` vers `.env` à la racine et renseigner :

- `DATABASE_URL` : chaîne de connexion Postgres (`postgresql://user:pass@host:5432/db`)
- `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` : secrets forts en production (16 caractères minimum, changer les valeurs par défaut de dev)
- `JWT_ACCESS_EXPIRES_IN` / `JWT_REFRESH_EXPIRES_IN` : durées de vie des tokens (15m / 7j par défaut)
- `CORS_ORIGIN` : URL du frontend déployé
- `GEOCODING_API_URL` : optionnel, par défaut l'API Adresse du gouvernement (`api-adresse.data.gouv.fr`), publique et sans clé. Seule dépendance externe de l'application.

## 5. Backend

```bash
cd backend
npm install                   # génère aussi le client Prisma (postinstall)
npm run build                 # compile TypeScript
npm start                     # lance dist/index.js
```

Documentation API interactive servie automatiquement sur `/api/docs` (Swagger, générée depuis les annotations du code, toujours à jour avec les routes réelles).

## 6. Frontend

```bash
cd frontend
npm install
npm run build                 # build de production (dist/)
npm run preview               # vérifier le build localement
```

Le build de production nécessite `VITE_API_URL` (ou équivalent selon l'hébergeur) pointant vers le backend déployé.

## 7. RGPD : export et purge

- `GET /api/users/me/export` : export de portabilité (article 20), JSON complet, sans mot de passe.
- `npm run purge:accounts` (dans `backend/`) : purge définitive des comptes désactivés depuis plus de 30 jours (`--dry-run` pour simuler, `--retention-days=N` pour ajuster). Pas d'ordonnanceur automatique : à planifier via une tâche cron du système hôte si besoin.

## 8. Temps réel, WebSockets et repli polling

Serveur Socket.IO réel (`backend/src/realtime/socket.ts`), attaché au même serveur HTTP que
l'API REST (pas de port séparé). Émet `offer:created`/`offer:updated`/`offer:removed` (création,
modération, suppression d'une offre) et `application:status` (changement de statut d'une
candidature). Le client (`frontend/src/lib/socket.ts`) s'y connecte automatiquement.

**Repli polling**, exigé car le réseau ministériel bloque les WebSockets sortants :
- Activable par configuration, sans changement de code : `VITE_REALTIME_MODE=polling` (frontend, au build).
- Déclenché aussi automatiquement si la connexion WebSocket échoue (`connect_error`), sans attendre une reconfiguration.
- Intervalle réglable : `VITE_REALTIME_POLL_MS` (8 secondes par défaut).

**Différence de comportement entre les deux modes** : en WebSocket, un événement porte les
données de l'offre concernée (le candidat voit un message "Nouvelle offre à proximité : ...").
En polling, il n'y a pas de flux poussé par le serveur : le client revalide simplement ses
données à intervalle régulier, donc les nouvelles offres apparaissent sur la carte sans ce
message dédié, au prochain cycle de sondage plutôt qu'immédiatement.

## 8bis. E-mail transactionnel (SMTP)

Un vrai serveur SMTP tourne sur le VPS (Mailpit, conteneur Docker `geoemploi-mailpit`,
`docker run -d --name geoemploi-mailpit --restart unless-stopped -p 1026:1025 -p 8026:8025
axllent/mailpit`). Le backend s'y connecte via `SMTP_HOST=localhost`, `SMTP_PORT=1026` (voir
`.env`). Interface web de consultation des e-mails reçus : http://13.140.150.236:8026.

**Pourquoi Mailpit plutôt qu'un relais vers de vraies boîtes externes (Gmail, etc.)** : les
ports 25/587 sortants sont ouverts sur ce VPS, mais sans nom de domaine avec SPF/DKIM/reverse-DNS
configurés, un e-mail envoyé depuis cette IP brute serait quasi systématiquement rejeté ou classé
spam par les grands fournisseurs. Mailpit est un vrai serveur SMTP (protocole complet, pas un
mock), il capture réellement les e-mails envoyés par le backend, consultables immédiatement.

**Ce qui envoie réellement un e-mail** : bienvenue à l'inscription, réinitialisation de mot de
passe (le lien pointe vers `APP_URL`, distinct de `CORS_ORIGIN` car le frontend est en HTTPS
alors que `CORS_ORIGIN` sert uniquement à la vérification d'origine côté serveur), notification
de candidature reçue. Sans `SMTP_HOST` configuré (cas d'un poste de développement sans Docker
lancé pour Mailpit), repli automatique déjà existant : écriture en `.eml` dans
`backend/mail-outbox/`, aucun code applicatif à changer entre les deux modes.

**Vérifié en direct** (2026-09-10) : inscription puis mot de passe oublié, e-mails réellement
reçus dans Mailpit, lien de réinitialisation cliqué depuis le contenu réel du mail, mot de passe
changé, connexion réussie avec le nouveau mot de passe.

## 9. Temps de déploiement mesurés

Chronométré en réel le 9 septembre 2026, sur l'environnement de développement (image Docker déjà en cache local, pas de téléchargement réseau compté) :

| Étape | Commande | Durée mesurée |
|---|---|---|
| Démarrage base PostGIS à froid, jusqu'à `pg_isready` | `docker run postgis/postgis:16-3.4 ...` | **2,8 s** |
| Compilation backend (TypeScript) | `npm run build` (backend) | **5,3 s** |
| Démarrage backend, jusqu'à `GET /api/health` → 200 | `node dist/index.js` | **2,9 s** |
| Build frontend, vérification de types + bundle | `npm run build` (frontend, `tsc --noEmit && vite build`) | **26,4 s** (dont 10,6 s pour le seul `vite build`) |

Démarrage complet à froid (base + backend + build frontend), étapes cumulées : environ **37 secondes**. Le vérificateur de types (`tsc --noEmit`) domine le temps de build frontend (≈16 s des 26,4 s) ; retiré en production si un pipeline CI sépare typecheck et build, ce qui n'est pas le cas ici faute de CI/CD (voir §10).

## 10. Ce que ce démonstrateur n'inclut pas

Pas de paiement réel, pas d'abonnement (la publication d'une offre est gratuite), pas de CI/CD configuré (la purge n'est donc pas planifiée automatiquement, voir §7). Le service de géocodage (API Adresse + centroïdes officiels des communes, geo.api.gouv.fr) est public et gratuit, aucune clé à provisionner.

---
Document technique, mis à jour le 10 septembre 2026.
