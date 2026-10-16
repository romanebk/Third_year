# GéoEmploi : frontend

Application web responsive de recherche d’emploi géolocalisée en temps réel (projet pédagogique Epitech). Le backend n’est pas requis : **MSW mocke l’API** au démarrage de `npm run dev`.

Complète les dispositifs existants (France Travail, Apec) sans s’y substituer.

## Installation

```bash
cd frontend
npm install
npm run dev
```

Ouvrir [http://localhost:5173](http://localhost:5173).

## Scripts

| Commande | Effet |
|---|---|
| `npm run dev` | Vite + MSW |
| `npm run build` | `tsc --noEmit` puis bundle |
| `npm run preview` | Servir le build |
| `npm run test` | Vitest watch |
| `npm run test:run` | Vitest CI |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript strict |

## Comptes de démonstration

Mot de passe commun : `Demo1234567` (10 caractères, 1 majuscule, 1 chiffre).

| Rôle | Email | Notes |
|---|---|---|
| Candidat | `yasmine@demo.fr` | Profil, 4 captures, badges bronze/argent |
| Employeur | `rh@maisonbardot.fr` | Compte **actif**, publication possible |
| Employeur en attente | `contact@ateliernaif.fr` | Statut `pending`, publication bloquée 48 h |
| Admin | `admin@geoemploi.fr` | Modération, utilisateurs, métriques |

Réinitialisation de mot de passe : jeton de démo `demo-reset` → `/reinitialisation/demo-reset`.

## Ce qui est mocké (MSW)

Toutes les routes du contrat, avec données réalistes **Paris 11e** (vraies coordonnées) :

- `POST /auth/register` `login` `refresh` `forgot` `reset/:token`
- `GET/PATCH /me` `POST /me/cv`
- `GET /offers?bbox=&lat=&lng=&radius=&q=&contract=&sector=&new=`
- `GET/POST/PATCH/DELETE /offers/:id` `POST /offers/:id/report`
- `POST/GET /applications` `GET/PATCH /pro/applications`
- `GET /pro/stats` `GET /pro/offers` `POST /pro/subscription`
- `GET /admin/offers` `GET /admin/users` `PATCH /admin/users/:id` `GET /admin/metrics`

Le temps réel (`offer:created`, `offer:updated`, `offer:removed`, `application:status`) passe par un bus local compatible socket.io, en attendant le serveur.

Aucun paiement réel : l’abonnement employeur simule le flux.

## Stack

React 18, TypeScript strict, Vite, React Router v6, Tailwind (tokens maquette), Framer Motion, react-leaflet + tuiles CARTO Voyager / dark, React Hook Form + Zod, TanStack Query, Axios (JWT + refresh), Zustand, MSW, Vitest.

Le **refresh token** est le seul secret en `localStorage` (`cg_refresh`) : il permet de restaurer la session après rechargement. L’access token reste en mémoire.

## Consentement GPS

Bannière au premier lancement (accepter / refuser). Réversible depuis **Profil → Localisation**. Obligatoire, même si une version annotée du cahier des charges barre la section données personnelles.
