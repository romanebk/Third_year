# POC — Comparaison de notre stack aux alternatives

**Objet.** Justifier nos choix technologiques face aux alternatives crédibles
pour ce projet, avec preuves (code + docs du repo). Public : jury de
soutenance Epitech, G-WEB-500.

**Méthode et sources.** Inventaire réel du repo (`.md` + `.pdf`), pas de
théorie générique :
- Sujet : `docs/dashboard-project.pdf` (contraintes imposées, §2)
- Stack de référence : `docs/tech-stack.md`, `docs/architecture.md`, `docs/adr/`
- Historique : `docs/ariel-contribution-defense.pdf` (généré le 21/09/2026),
  `révision/stacks-implementation-FR.pdf`, `révision/*.md`, `rapport.md`
- Code réel : `backend/package.json`, `frontend/package.json`,
  `docker-compose.yml`, `render.yaml`

> ⚠️ **Avertissement de fraîcheur.** Les PDF de défense datent du
> 21/09/2026 et `tech-stack.md` dit encore « pas de suite de tests » : c'est
> **périmé**. Depuis : suite vitest (**136 tests**, 16 fichiers),
> 14 services / 30 widgets (exigence : 3 services / 6 widgets pour 2 pers.),
> OAuth Google, clés API par utilisateur, reset password, rate limiting,
> Mailpit, blueprint Render. Ce POC fait foi sur l'état **octobre 2026**.

---

## 1. Contraintes imposées par le sujet (non négociables)

| Contrainte | Impact sur le choix |
|---|---|
| Langages/frameworks libres (recommandés : Node.js, React, Tailwind, Python, PHP…) | On reste dans la liste recommandée : Node.js + React + Tailwind |
| `docker-compose build` + `docker-compose up` obligatoires, app sur **port 8080** | Docker dès le jour 1 ; un seul conteneur publié |
| `GET /about.json` avec contrat exact (services, widgets, params `integer`/`string`) | Registre centralisé qui alimente à la fois l'API et la validation |
| Timer **central** de rafraîchissement (pas de `setInterval` client seul) | Timer serveur + push vers le navigateur |
| Comptes + confirmation, services, widgets configurables, CRUD dashboard complet, section admin | Vraie base relationnelle + vraie auth, pas de prototype |
| OAuth : lier le compte tiers à l'utilisateur existant |_events sign-in_ + garde anti-détournement |
| Justifier les choix « de manière professionnelle » + README complet | ADRs + `tech-stack.md` + ce POC |

## 2. Notre stack (état réel)

| Couche | Choix | Fichier preuve |
|---|---|---|
| Framework ×2 | Next.js 15 App Router (backend API-only + frontend) | `backend/package.json`, `frontend/package.json`, ADR 0009 |
| Langage | TypeScript strict | `tsc --noEmit` vert des deux côtés |
| Base | PostgreSQL + Prisma (migrations au boot) | `backend/prisma/`, `docker-compose.yml` |
| Auth | NextAuth v4 : Credentials + GitHub + Google, sessions JWT + re-check DB | `backend/src/server/auth/auth.ts`, ADR 0002 |
| Secrets tiers | AES-256-GCM, clé dédiée séparée de `NEXTAUTH_SECRET` | `token-encryption.ts`, ADR 0006 |
| Temps réel | Timer central (1 interval/instance) + SSE, pas de WebSocket | `server/timer/`, ADR 0003 |
| UI | Tailwind + shadcn/Radix, Font Awesome, react-grid-layout, Framer Motion (sidebar) | `frontend/package.json`, ADR 0008 |
| Email | Nodemailer + Mailpit auto-hébergé (+ repli dev documenté) | `docker-compose.yml`, `server/auth/mailer.ts` |
| Tests | Vitest, 136 tests (tous les fetchers + refresh-rates + mapping OAuth) | `backend/tests/services/` (16 fichiers) |
| Infra | Docker Compose en local, blueprint `render.yaml` en prod | `docker-compose.yml`, `render.yaml` |

## 3. Comparaison par couche

### 3.1 Framework : Next.js des deux côtés

| Option | Pour | Contre | Verdict |
|---|---|---|---|
| **Next.js partout (choisi)** | Un seul langage, un seul pipeline ; handlers déplacés tels quels au split (ADR 0001→0009) ; équipe de 2, délai 8 jours | Backend Next.js inhabituel (pas de pages) | ✅ **POC = le split lui-même** : déplacement sans réécriture |
| Express/Nest + React SPA | Standard, séparation nette | 2e framework à apprendre ; duplication des contrats API | ❌ Coût injustifié à 2 |
| Fastify + React | Performances brutes | Même coût double-framework, écosystème moindre | ❌ |
| Django / Laravel monolithe | Admin/batteries incluses | Rupture avec React recommandé ;JS quand même côté widgets temps réel | ❌ |
| Nuxt / SvelteKit / Angular | Valables techniquement | Hors compétences équipe, doc/francophonie Epitech plus faible | ❌ |

### 3.2 Langage : TypeScript

| Option | Verdict |
|---|---|
| **TypeScript strict (choisi)** | ✅ Le client Prisma typé + `tsc` vert attrapent les fautes de colonnes/contrats à la compilation ; indispensable avec 30 widgets |
| JavaScript pur | ❌ Aucun garde-fou sur les 30+ formes de données |
| Python/PHP | ❌ Couperait l'uniformité Next.js des deux côtés |

### 3.3 Base : PostgreSQL + Prisma

| Option | Pour | Contre | Verdict |
|---|---|---|---|
| **Postgres + Prisma (choisi)** | Données relationnelles (`@@unique([provider, providerAccountId])` anti double-liaison) ; migrations versionnées appliquées au boot ; `PrismaAdapter` officiel | Heavier que SQLite | ✅ Contraintes d'intégrité = bugs éliminés par construction |
| MongoDB | Flexible | Aucune contrainte → doublons/états incohérents silencieux | ❌ |
| SQLite | Zéro ops | Concurrence du timer + 31 instances ;-image multi-process | ❌ |
| JSON libre pour `params` (dans Postgres) | ✅ Une table par widget = une migration par widget, zéro bénéfice ; validation applicative contre le même registre que `/about.json` | — | ✅ Hybride assumé, pas du « tout relationnel » dogmatique |

### 3.4 Auth : NextAuth (Credentials + GitHub + Google, JWT)

| Option | Pour | Contre | Verdict |
|---|---|---|---|
| **NextAuth JWT + re-check DB (choisi)** | Un seul `getServerSession` partout ; pas de lecture Session/requête ; désactivation admin quasi immédiate via `jwt()` (testé en conteneur) ; tokens tiers chiffrés GCM | JWT non révocable par nature → contourné, pas ignoré (ADR 0002) | ✅ |
| JWT maison | Contrôle total | Réinventer sessions, CSRF, OAuth : surface de bugs énorme à 2 | ❌ Sujet conseille d'assembler, pas de réinventer |
| Sessions DB pures | Révocation triviale | 1 lecture Session par requête ; `Session` existe déjà (contrat adapter, inutilisée) | ❌ Coût permanent pour un besoin couvert |
| Supabase Auth / Clerk / Auth0 | Rapide | Dépendance externe + quotas ; OAuth multi-provider à câbler quand même ; données hors UE possiblement | ❌ Souveraineté + gratuité (Mailpit/self-hosted même logique) |
| Passport.js | Léger | Assemblage sessions + OAuth à la main | ❌ NextAuth fait déjà ça, testé |

### 3.5 Temps réel : timer central + SSE

| Option | Verdict |
|---|---|
| **1 interval/serveur/instance + SSE (choisi)** | ✅ Exigence sujet respectée à la lettre ; un upstream lent ne bloque jamais les autres ; SSE = HTTP + reconnect native, suffisant pour un flux unidirectionnel (ADR 0003). Prouvé : 3 push à ~5 s sur 16 s d'écoute |
| WebSocket / Socket.io | ❌ Protocole + reconnect maison pour un besoin unidirectionnel |
| Polling client | ❌ Interdit de fait par le sujet (timer central exigé) |
| tRPC subscriptions / GraphQL | ❌ Sujet impose REST (`/about.json`) ; deux paradigmes pour rien |

Limite assumée : timers en mémoire → réenregistrés au boot (`instrumentation`), pas de scaling horizontal (scheduler externe hors scope).

### 3.6 UI : Tailwind + shadcn/Radix + Font Awesome + react-grid-layout

| Option | Verdict |
|---|---|
| **Tailwind + tokens + `cn()` (choisi)** | ✅ Zéro aller-retour fichiers, overrides propres (`Panel`, `Button`) |
| Bootstrap | ❌ Look générique, contre l'exigence d'UX soignée |
| CSS Modules / styled-components | ❌ Dispersion des styles pour un gain nul ici |
| **Polices auto-hébergées (choisi, ADR 0007)** | ✅ Le build Docker échouait à fetch Google Fonts → `.woff2` locaux suppriment la dépendance réseau |
| **Font Awesome (choisi, ADR 0008)** | ✅ Une graisse, même API — demande explicite de l'équipe |
| **react-grid-layout + `findFreeSlot` maison (choisi)** | ✅ Collisions/snapping/breakpoints offerts ; algo maison pour le placement côte à côte |
| Grille drag & drop maison | ❌ Semaines de travail pour réinventer collisions + responsive |
| Redux/Zustand | ❌ État local ou dérivé serveur — rien à globaliser |
| Framer Motion partout | ❌ Sidebar uniquement ; le reste en CSS (`prefers-reduced-motion` global) |

### 3.7 Email : Nodemailer + Mailpit auto-hébergé

| Option | Verdict |
|---|---|
| **Mailpit self-hosted (choisi)** | ✅ Zéro dépendance externe, boîte visible à `:8025`, suffit à démontrer inscription/confirmation/reset |
| SendGrid/Resend externe | ❌ Clé + quotas + confidentialité pour un besoin de démo |
| `console.log` seul (J1–J7) | ⚠️ Suffisait au dev, insuffisant en soutenance — d'où Mailpit |

### 3.8 Tests : Vitest (136 tests)

| Option | Verdict |
|---|---|
| **Vitest ciblé fetchers (choisi, octobre)** | ✅ Tous les fetchers mockés (succès/validation/429/réseau) + `refresh-rates` + mapping OAuth ; 4 s d'exécution. Rend les docs « pas de tests » obsolètes — à mettre à jour avant soutenance |
| Jest | Équivalent, écosystème plus lourd pour du pur fetch | ❌ Pas de gain |
| Playwright/Cypress E2E | Utile en principe ; temps indisponible à 2 sur 8 jours | ⚠️ Recommandé en suite, pas en替代 |
| Rien (état initial) | ❌ Ne plus revendiquer : c'est faux aujourd'hui | — |

### 3.9 Infra : Docker Compose imposé, Render en prod

| Option | Verdict |
|---|---|
| **Compose en local (imposé par le sujet)** | ✅ Port 8080 unique publié, migrations au boot, `db` healthy avant le backend, Mailpit inclus |
| **Blueprint `render.yaml` (choisi)** | ✅ `NEXTAUTH_URL` + `BACKEND_INTERNAL_URL` câblés, secrets générés/saisis, free tiers ; backend public mais routes sous session |
| Vercel | ❌ Postgres + timer SSE longue durée mal adaptés au serverless |
| VPS manuel | ❌ Ops manuels pour zéro bénéfice pédagogique ici |

## 4. Preuves POC par décision (ce qui a été *testé*, pas affirmé)

| Décision | Preuve exécutée |
|---|---|
| Split mono → 2 apps | Handlers déplacés sans réécriture ; proxy `/api/*` transparent (cookie, SSE, callback OAuth) |
| Timer central + SSE | 3 push à ~5 s sur 16 s d'écoute ; suppression → timer arrêté + 404 ; reboot → `registered N instance(s)` |
| JWT + re-check | Compte désactivé à session ouverte → coupé avant la prochaine action |
| Link OAuth + garde | Double liaison refusée (`AccountLinkedElsewhere`) ; token périmé → consentement re-demandé |
| 136 tests | `npx vitest run` : 16 fichiers, ~4 s |
| Compose from scratch | Volume Postgres neuf → migrations auto → `/about.json` 200 |

## 5. Gaps à annoncer soi-même (crédibilité jury)

1. **Docs réalignées (oct 2026)** : `tech-stack.md`, `architecture.md`,
   `rapport.md` (§11), `révision/*.md` corrigés ; PDF `revision-FR`,
   `demo-day-playbook-EN`, `stacks-implementation-FR` régénérés depuis ces
   sources le 2026-10-14. Restent les PDF sans source `.md`
   (`ariel-contribution`, `revision-EN`, `demo-day-playbook-FR`,
   `stacks-implementation-EN`) : à signaler au jury comme antérieurs si
   utilisés.
2. **Timer mono-process**, pas de scaling horizontal (assumé, ADR 0003).
3. **`ipgeo_current` géolocalise l'IP du serveur**, pas du visiteur ; quota ipapi.co 1000 j/IP partagé (429 constaté en test).
4. **SMTP prod commenté** (`render.yaml`) : `devConfirmationToken` renvoyé en réponse sans SMTP — fuite assumée pour la démo, à brancher avant exposition réelle.
5. **Consent Google non vérifiée** : écran `Advanced → Go to` en prod (cap 100 utilisateurs), vérification = jours/semaines.
6. Secrets dev dans l'historique git (rotation prévue après soutenance — déjà signalé dans les docs).

## 6. Conclusion

Chaque couche suit la même règle, imposée par le sujet lui-même : *assembler des briques éprouvées, n'écrire que la colle*. Next.js ×2 supprime un framework, Postgres supprime une classe de bugs, NextAuth supprime un système d'auth maison, SSE supprime un protocole, react-grid-layout supprime une grille maison, Vitest verrouille les 30 fetchers en 4 secondes. Les alternatives écartées l'ont été sur coût mesuré (temps à 2, complexité d'ops, paradigmes doubles), pas sur goût — et chaque décision structurante a son ADR + sa preuve d'exécution.
