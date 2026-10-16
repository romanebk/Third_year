# Hubly — Revision File 2/2: Defense Checklist Q&A
One section per checklist line. Short answers in English + where it lives.
Current truth (Oct 2026): **14 services, 30 widgets** (github×3,
steam×2, youtube×3, google-calendar×2, weather×2, rss×2, crypto×2, maps×2,
devises×2, wikipedia×2, nasa×2, holidays×2, ipgeo×2, universities×2).
Spotify was removed and replaced by YouTube; the old 7/13 counts below are
kept for history but no longer valid.

## Starting the project
- **Builds/runs with docker-compose from fresh clone?** Yes:
  `git clone && cd … && docker compose up --build` → :8080. Backend
  Dockerfile runs `prisma migrate deploy` before `next start`. Zero
  manual steps; all env vars have dev defaults (incl. GitHub/Google
  OAuth with localhost callbacks, Mailpit for mail).
- **Port 8080?** Yes: `8080:3000` on frontend, the only published
  container. Backend is internal (`backend:3002`).
- **No error at start?** DB `healthcheck` (`pg_isready`), backend waits
  `service_healthy`; `instrumentation.ts` re-registers all timers at
  boot. Verified: `/` → 200.

## about.json
- **Available, valid JSON?** Yes: `backend/src/app/about.json/route.ts`,
  proxied by frontend at the same path.
- **Content?** `{client:{host}, server:{current_time, services}}` —
  host from `x-forwarded-for`, time = Unix seconds, services = the exact
  registry (`services/index.ts`): 14 services, 30 widgets with typed
  params. Same array feeds `/api/services` and `getAllWidgets()`, so it
  always matches the app.

## Accounts
- **Register/verify/login?** Register (email+strong password, bcrypt 12)
  → token mail via Mailpit → confirm sets `emailVerified` + auto-login
  → login via CredentialsProvider (bcrypt + verified + not disabled).
- **Passwords/tokens unreadable?** Only bcrypt hashes stored; OAuth
  tokens AES-256-GCM encrypted (`token-encryption.ts`), key
  `TOKEN_ENCRYPTION_KEY` separate from `NEXTAUTH_SECRET`.
- **OAuth 2.0 for logged-in user?** GitHub + Google providers
  (`auth.ts`), email-match linking, scopes `read:user user:email security_events`
  / `openid email profile` (+ `calendar.readonly` for Google Calendar).

## Services & widgets
- **5+/8+?** 14 services, 30 widgets — above minimum.
- **Usable without subscription?** weather, rss, crypto, maps
  (`auth:"none"`, 20 widgets) work instantly; `isSubscribed()` returns
  true without DB read; new accounts get seeded weather+RSS widgets.
- **Configurable, typed params?** Catalog `ConfigParam[]`
  (string/integer) → dynamic form (number inputs for integers) →
  server re-validation (allowlist/coercion/ranges), 400 on bad input.
- **Same widget twice, different results?** Yes: separate DB rows,
  separate timers, separate SSE streams (Paris + Tokyo example).

## Dashboard
- **Choose/configure/rate/confirm?** Add dialog → dynamic form
  (rate ≥ 5 s) → `POST /api/dashboard` → 201.
- **Reconfigure/move/delete?** Menu → `PATCH` (params/rate/position);
  drag-and-drop + keyboard move; `DELETE` (404 if not owner).
- **Survives reload?** Instances in Postgres; geometry in localStorage.
- **Own refresh rate?** One `setInterval` per instance server-side,
  SSE push, no client polling.

## Security
- **Server-side checks?** Every mutation: 401 session → 404 owner →
  403 subscribed → 400 params/rate. Single choke point
  `validateInstanceParams()`. SSRF guard on user URLs.
- **Secrets protected?** `.env` gitignored/never committed; OAuth
  tokens encrypted. **Honest gap**: `docker-compose.yml` (tracked)
  ships REAL dev-only GitHub/Google secrets + `TOKEN_ENCRYPTION_KEY`
  default. Say: deliberate fresh-clone trade-off, localhost callbacks
  only, documented "change in prod", must rotate after defense.
  Never claim "no secrets in git" — false.
- **Repo organised?** `backend/` (API/Prisma/timer/auth),
  `frontend/` (pages/components), `docs/` (architecture, 9 ADRs,
  runbook). Duplicated `types/`+`validation.ts` is documented (ADR
  0009), not accidental.

## Interface
- **Visual identity?** Dark theme tokens (bg #000000, card #0A0A0A),
  Plus Jakarta Sans + Instrument Serif + Fira Code (self-hosted, ADR
  0007), Font Awesome icons (ADR 0008), `cn()` class merging.
- **Loading/errors/empty?** Skeletons (`role="status"`), errors
  (`role="alert"`), inline form errors. Minor gap: no "empty
  dashboard" message, no global toasts (errors stay local).
- **Responsive + a11y?** 12/8/4/1-col grid, dialogs full-width mobile,
  ≥44px targets; skip link, landmarks, focus trap + Escape, timer
  `role="timer"`, `prefers-reduced-motion`. Fixed in PR #63.

## Tech choices (know 3-per-layer + why)
Framework Next.js > Express+Nest, Fastify+React (ADR 0001/0009 — one
language, SSR+API). DB Postgres+Prisma > Mongo, SQLite (relations,
migrations, typed client). Auth NextAuth > custom JWT, Supabase
(credentials+OAuth, JWT+DB revocation, ADR 0002). Realtime SSE >
WebSocket, polling (one-way push, ADR 0003). Styling Tailwind > CSS
Modules, styled-components. Fonts self-hosted > Google CDN (build
reliability, ADR 0007). Icons Font Awesome > inline SVG, Lucide (ADR
0008). Grid react-grid-layout > hand-rolled. **POCs**: throwaway spikes
(SSE proxy, fonts, AES-GCM), not committed. **Backgrounds**: Rayann
knew Next.js/React/Tailwind → UI/DnD; Ariel knew Prisma/NextAuth/
Postgres/Docker → backend/auth/timer.

## README
Install/run/understand from README alone (Docker + dev, env table,
admin, troubleshooting, health checklist). Counts: 14 services / 30 widgets.
English, minor typos possible — readable.

## Defense prep
- **Data flow**: browser → frontend:3000 → proxy
  `[...path]/route.ts` → `backend:3002` → handler → Prisma → back.
  SSE same path as `text/event-stream`.
- **Codes**: 200/201/400/401/403/404/409/429/502/500 (see file 1 §5).
- **Both answer everything**: pair-programmed auth/timer/subs, ADRs
  co-written, every PR cross-reviewed.
- **Already running**: build takes ~10 min — never build live.

## Gaps to admit (scores honesty points)
1. Every catalog widget fetches (Spotify was removed, YouTube added) — 30/30 usable.
2. Real dev secrets in compose history — rotate after defense.
3. Vitest suite (136 tests) covers all fetchers; E2E (OAuth round-trips, SSE, DnD) still manual.
4. No empty-dashboard message / global toasts.
5. Old counts (7/13, "14 widgets") are stale — current truth is 14 services / 30 widgets.
