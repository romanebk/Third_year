# Notes de session — révision soutenance
Tout ce qui est demandé en chat est archivé ici, en version courte.

## 2026-09-28 — Stacks (par cœur : 3 options, choix, pourquoi)

1. **Framework → Next.js partout** (vs Express/Nest, Fastify+React).
   Un langage/pipeline ; handlers inchangés au split.
2. **DB → PostgreSQL + Prisma** (vs Mongo, SQLite). Données
   relationnelles + contraintes ; migrations ; client typé.
3. **Auth → NextAuth JWT + re-check DB** (vs JWT maison, Supabase).
   Un système credentials+OAuth ; révocation via re-check à chaque
   requête (démo : kill admin).
4. **Temps réel → timer central + SSE** (vs WebSocket, polling).
   Un setInterval/instance ; SSE = unidirectionnel + reconnect natif.
5. **Frontend → Tailwind / fonts locales / Font Awesome / RGL**
   (vs CSS Modules, Google Fonts, SVG, grille maison). Chaque choix =
   une histoire (build fonts cassé, etc.).
6. **Rejets** : pas de Redux (état local/serveur), pas de tRPC (REST
   imposé), tests vitest ciblés (136, fetchers) + vérif manuelle).
7. **Backgrounds** : Rayann = Next/React/Tailwind → UI ;
   Ariel = Prisma/NextAuth/Docker → backend.

## Pourquoi Next.js (version développée)
Le sujet impose un frontend ET un backend. Deux approches : soit deux
technologies séparées (ex. Express/Nest + React), soit Next.js des deux
côtés. On a choisi Next.js partout, pour trois raisons liées. D'abord,
**un seul langage et un seul pipeline** : toute l'équipe lit et écrit le
même TypeScript, un seul `package.json` à maintenir par app, un seul
build à comprendre. Ensuite, **les API Routes font office de backend** :
pas besoin de monter un serveur Express séparé juste pour exposer du
REST — chaque route est un fichier, déployé avec l'app. La preuve que ce
choix était bon : au split monolithe → 2 apps (ADR 0009), les handlers
ont déménagé **tels quels**, zéro réécriture. Enfin, **l'équipe savait
déjà** (Rayann : Next/React) : sur un projet de 8 jours à 2, chaque jour
de montée en compétence en moins = une feature en plus. Le revers
assumé : Next embarque du SSR/rendering dont le backend n'a pas besoin —
on l'utilise comme pur serveur de routes, le coût est nul en pratique.

## Pourquoi PostgreSQL + Prisma (version développée)
Nos données sont relationnelles par nature : un User possède des
WidgetInstance et des ServiceSubscription, et certaines règles doivent
être **impossibles à violer** — ex. `@@unique([provider,
providerAccountId])` interdit de lier 2 fois le même compte GitHub.
Avec MongoDB, rien n'empêche ce doublon : le bug passe en silence et on
le découvre en prod. Postgres le refuse au niveau du moteur, avant même
notre code. Ensuite, **Prisma = migrations versionnées** : chaque
évolution du schéma est un fichier rejouable, appliqué automatiquement
au démarrage du conteneur (`migrate deploy`) — un clone frais a toujours
une DB à jour, zéro manip. Et le **client généré typé** transforme les
fautes de noms de colonnes en erreurs de compilation au lieu de crashs
runtime. Bonus décisif : l'adapter officiel NextAuth/Prisma branche
auth et DB sans couche maison. Choix assumé dans l'autre sens : les
params de widgets restent en JSON libre (pas une table par widget) —
une migration par widget n'apporterait rien, la validation applicative
suffit.

## Mail confirmation → boîte Gmail (option A : SendGrid)
Réseau bloque Gmail direct (587/465 timeout hôte+conteneur). Solution :
envoyer via SendGrid **vers** l'adresse Gmail (le destinataire reste un
Gmail, l'expéditeur passe par SendGrid). SendGrid :587 OK sur ce réseau.
Étapes user : compte gratuit → clé API (Mail Send) → Single Sender
vérifié (= MAIL_FROM). Puis : MAJ .env local + recreate backend + test
inscription (vérifier inbox + spams, Mailpit doit rester vide).

## SMTP : SendGrid = même protocole, autre provider
Le mailer est SMTP-générique : aucun changement de code, seules les
vars changent (HOST/PORT/USER/PASS). SendGrid via
smtp.sendgrid.net:587 (USER=apikey). Gmail bloqué = filtrage réseau
vers Google, pas un problème SMTP en soi.

## Service crypto — comment fait
Module `backend/src/server/services/crypto/` : `index.ts` déclare 2
widgets (`crypto_price` : coin+currency ; `crypto_top_coins` :
currency+limit), `auth: "none"` (aucune clé). `fetch.ts` appelle
CoinGecko gratuit : `/simple/price` (prix + change 24h) et
`/coins/markets` (top par market cap). Quotas → erreur 429 mappée.

## Refresh des widgets — où géré
`backend/src/server/timer/` : `register-instance.ts` (démarre/arrête
par instance), `timer.ts` (classe WidgetTimer : **un setInterval par
instance** avec son `refreshRateSeconds`), `events.ts` (EventEmitter
par id → SSE `/api/dashboard/[id]/stream`). Changer le taux (PATCH)
= réenregistrer le timer. `instrumentation.ts` réenregistre tout au
boot (timers en mémoire, perdus au restart).
