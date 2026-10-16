# Journal module 3 (Employeur & candidatures) — 2026-09-03 / 2026-09-04

Historique des fonctionnalités, bugs et changements de configuration réalisés
sur cette période. Chaque entrée renvoie vers la PR correspondante quand elle
existe. Les bugs critiques ont aussi un post détaillé dans le forum Discord
#bugs (symptôme, diagnostic, correctif).

## Fonctionnalités ajoutées

**Stockage CV** (PR #5, #6)
- `POST/GET/DELETE /api/users/me/cv` : upload PDF (5 Mo max), stockage disque
  local (`backend/storage/cvs/`, jamais commité), jamais de chemin serveur
  exposé au client.
- `GET /api/applications/:id/cv` : téléchargement par l'employeur propriétaire
  de l'offre concernée (403 sinon).
- Champs `cvPath` / `cvOriginalName` / `cvUploadedAt` sur `JobseekerProfile`.

**Profil demandeur étendu** (PR #5)
- `PATCH /api/users/me` accepte désormais `phone` / `skills` / `experience` /
  `availability` (colonnes déjà existantes, jamais exposées en écriture
  jusque-là).

**Champs métier sur les offres** (PR #8, #9, #13)
- `sector`, `contractType`, `salaryMin`, `salaryMax`, `salaryKind`, `workTime`
  sur `Offer` : alignés sur ce que le frontend attendait déjà
  (`NewOfferPage.tsx`) sans jamais avoir de colonnes backend en face.
- `experienceLevel`, `requiredSkills` : suggérés par Stella, validés par
  l'équipe.
- Formulaire `NewOfferPage.tsx` complété avec les deux champs manquants
  (expérience demandée, compétences recherchées) — le backend et l'affichage
  étaient prêts avant le formulaire de saisie lui-même.
- Affichage détaillé dans `OfferDetailModal.tsx` (labels explicites : Salaire,
  Expérience demandée, Compétences recherchées, au lieu de tags génériques
  sans contexte).

**Documentation API réelle** (PR #6, #10)
- Tous les exemples `@openapi` de `offers.routes.ts`, `applications.routes.ts`,
  `auth.routes.ts`, `users.routes.ts` remplacés par des requêtes/réponses
  réellement capturées en curl (avant : hand-écrits ou carrément absents pour
  auth/users).
- Fichiers `.http` reproductibles + traces d'exécution brutes dans
  `backend/docs/`.

**Données de charge**
- `prisma/seed-load-test.ts` : 500+ offres réparties sur 50+ communes, avec
  secteur/contrat/salaire/expérience/compétences cohérents par métier.
- `prisma/seed.ts` (seed IGN, module 2) : les 15 offres historiques ont aussi
  reçu les champs métier, qui manquaient après coup (voir bugs).

**Test de charge** (PR #7)
- `backend/loadtest/carte-offres.js` (k6) : 50 utilisateurs simultanés,
  3 minutes, consultation carte + détail d'offre.
- Résultat : 0 % d'erreur, p50 = 18.5 ms, p95 = 105.3 ms sur 7800 requêtes.
- `backend/loadtest/RAPPORT-2026-09-03.md` : le point d'attention réel trouvé
  via `EXPLAIN ANALYZE` (scan complet de table sur `/offers/nearby`, aucun
  index géo utilisable, invisible à petite échelle mais coût linéaire avec
  le volume d'offres).

## Bugs trouvés et corrigés

| Bug | Cause réelle | Correctif |
|---|---|---|
| Réinscription impossible après suppression de compte (409) | L'email n'était jamais libéré (contrainte unique en base non contournée par le soft-delete) | Email anonymisé (`deleted-<userId>@geoemploi.invalid`) au moment du soft-delete |
| Backend ne démarre pas sur un clone frais (`TypeError: ... reading 'JOBSEEKER'`) | Aucun `postinstall` n'appelait `prisma generate` après `npm install` — pas un bug Prisma, juste un client jamais généré | `"postinstall": "prisma generate"` ajouté à `backend/package.json` |
| Compte employeur/admin toujours affiché comme candidat à la connexion | `mapBackendRole()` (`lib/api.ts`) ne matchait que les rôles backend bruts en MAJUSCULES ; ce mapping est appliqué deux fois selon le chemin d'appel (intercepteur global vs `refreshAccessToken` en axios brut), avec des formats de casse pas garantis identiques | `mapBackendRole` compare désormais en `.toUpperCase()`, insensible à la casse |
| Session figée sur un compte mocké après un changement de compte | MSW enregistre un Service Worker (`worker.start()`) jamais désenregistré, même une fois les mocks désactivés par défaut | Désenregistrement automatique du Service Worker au boot quand les mocks sont désactivés |
| "Se connecter" affiché même une fois connecté sur la vitrine | `LandingPage.tsx` n'avait aucune conscience de l'état de session | Remplacé par "Mon espace" (`/app` ou `/pro` selon le rôle) quand un utilisateur est connecté |
| Nom d'entreprise manquant ("(entreprise)") sur la vue détail d'une offre | `GET /offers/:id` ne joignait jamais `EmployerProfile`, contrairement à `/offers/nearby` | Jointure ajoutée, `companyName` inclus dans la réponse |
| Salaire / expérience / dates manquants sur les offres de démo | Le seed IGN original (`prisma/seed.ts`) n'avait jamais reçu les champs métier ajoutés a posteriori ; les dates existaient déjà mais n'étaient affichées nulle part dans l'UI | Seed réécrit avec des valeurs cohérentes par métier + affichage des dates ajouté à la modale |
| Tableaux Markdown cassés dans `docs/SCHEMA_BDD.md` et `docs/RGPD_FICHE_REGISTRE.md` | Effet de bord du nettoyage global des tirets cadratins (`—` utilisé comme valeur "aucun défaut"/"aucun destinataire" dans des cellules de tableau, remplacé par une virgule isolée sans sens) | Cellules restaurées avec un simple tiret `-` comme placeholder |

## Configuration / outils ajoutés

- `backend/package.json` : script `postinstall` (génère le client Prisma
  automatiquement après `npm install`, condition nécessaire pour qu'un clone
  frais démarre sans étape manuelle oubliable).
- `backend/loadtest/` : script k6 + rapport, réutilisable pour retester la
  charge à tout moment (`k6 run backend/loadtest/carte-offres.js`).
- `backend/docs/*.http` : fichiers REST Client (VSCode/IntelliJ) exécutables
  tels quels pour reproduire tous les appels API de auth/users/offers/
  applications sans Postman.
- `prisma/seed-load-test.ts` : seed dédié au volume, séparé du seed IGN
  (`prisma/seed.ts`) qui garde son rôle propre (test de reprise cartographique
  module 2, coordonnées volontairement fausses sur certaines entrées).

## Ce qui reste ouvert

- Cache tuiles serveur + repli WebSocket/polling (exigence Thomas Vignal,
  point cartographie) : signalé en #cartographie, pas de propriétaire
  confirmé.
- Index géographique manquant sur `Offer` (voir `RAPPORT-2026-09-03.md`) :
  correctif proposé (colonne `geography` persistée + index GIST) mais pas
  encore implémenté, pas bloquant au volume de données actuel.
- Données de fréquentation (heures de passage / `peakHours`) sur le dashboard
  employeur : aucune trace horodatée des vues n'existe côté backend
  actuellement (juste un compteur), donc pas de vraies données possibles
  sans construire ce suivi.
