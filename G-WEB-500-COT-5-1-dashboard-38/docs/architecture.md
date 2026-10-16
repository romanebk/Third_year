# Architecture

System design reference: how the pieces fit together, the data model, and
the request/data flows. For *why* a given technology or pattern was chosen,
see [`tech-stack.md`](tech-stack.md) and the [ADRs](adr/). For how to run
the project, see the [root README](../README.md).

## System overview

Two apps ([ADR 0009](adr/0009-split-backend-frontend-apps.md)): `frontend`
is the only container published on the host, and proxies everything under
`/api/*` and `/about.json` straight through to `backend` over the internal
Docker network — the browser only ever sees one origin, so the session
cookie, the SSE `EventSource`, and the GitHub OAuth callback URL all behave
exactly as if this were still one app.

```
┌──────────────┐   HTTP / SSE    ┌────────────────────────┐   HTTP / SSE    ┌──────────────────────────────────┐
│   Browser    │ ──────────────▶ │      frontend/          │ ──────────────▶ │            backend/               │
│ (React/Next) │ ◀────────────── │  pages + proxy route     │ ◀────────────── │  App Router : /api/* + /about.json │
└──────────────┘  :8080 (public)  │  handler (/api/[...path], │  :3002 (internal │                                     │
                                   │  /about.json)             │  only)          │  src/server/                       │
                                   └────────────────────────┘                  │  ├─ auth/      NextAuth,            │
                                                                                 │  │             token encryption      │
                                                                                 │  ├─ services/  one folder per        │
                                                                                 │  │             service               │
                                                                                 │  ├─ widgets/   fetcher registry       │
                                                                                 │  ├─ dashboard/ params validation,     │
                                                                                 │  │             position ordering     │
                                                                                 │  └─ timer/     scheduler + SSE        │
                                                                                 │                bridge                 │
                                                                                 └────────────────┬────────────────────┘
                                                                                                    │ Prisma
                                                                                                    ▼
                                                                                 ┌────────────────────────────────┐
                                                                                 │           PostgreSQL             │
                                                                                 └────────────────────────────────┘
                                                                                                    │
                                                                     instrumentation.ts (at boot)   │
                                                                     re-registers every existing ───┘
                                                                     widget instance with the timer
                                                                     (in-memory, not persisted)
```

The central timer (one independent scheduler per widget instance): every
`refreshRateSeconds`, it fetches from the external service (GitHub, Steam,
Open-Meteo, an RSS feed…), publishes to an in-process `EventEmitter`, and
any SSE connection open on `/api/dashboard/[id]/stream` receives the update
— no client-side polling. Full rationale in
[ADR 0003](adr/0003-central-timer-with-sse.md).

The initial fetch for a widget (first render) goes through
`GET /api/widgets/[service]/[widget]`; every update after that arrives only
through the SSE stream, driven by the server timer — two different paths
for two different needs (immediate display vs. live updates).

## Module map (`backend/src/server/`)

| Module | Responsibility |
|--------|-----------------|
| `auth/` | NextAuth config (credentials + GitHub/Google OAuth), token encryption, confirmation email |
| `services/` | One folder per external service (`github/`, `google-calendar/`, `holidays/`, `ipgeo/`, `nasa/`, `steam/`, `universities/`, `weather/`, `rss/`, `crypto/`, `maps/`, `devises/`, `wikipedia/`, `youtube/`), plus the `services` registry and `isSubscribed()` |
| `widgets/` | Derives the widget catalog from the service registry (`getAllWidgets`), and executes a widget's data fetch (`getWidgetDataFetcher`) |
| `dashboard/` | Validates a widget instance's parameters against the registry; maintains the contiguous position ordering used for drag-and-drop reordering |
| `timer/` | The central timer (`WidgetTimer`), the SSE event bridge (`widgetDataEvents`), and instance registration (`registerInstanceTimer`) |

Why split this way: `services/` knows nothing about Next.js or Prisma (just
"how to fetch data from GitHub/Steam/…"), `widgets/` knows how to execute
any widget in the registry without knowing who's calling it (a plain API
route or the timer), and `timer/` knows nothing about HTTP — just "how
often to call this function, and where to publish the result." Each layer
is independently testable and replaceable.

Dashboard CRUD and admin user management live directly in the corresponding
API routes via Prisma (`backend/src/app/api/dashboard/*`,
`backend/src/app/api/users/*`) — not in `server/dashboard/`/`server/users/`,
which only hold shared helpers (`reorder.ts`, `validate-params.ts`, and
`users/delete-user.ts`, used by both the admin and the self-service account
deletion). Two unused placeholder files that used to live at
`server/dashboard/widgets.ts` and `server/users/users.service.ts` were
removed in a pre-defense cleanup pass — mentioned here in case an older
commit/branch still references them.

## Data model

Full schema in [`../backend/prisma/schema.prisma`](../backend/prisma/schema.prisma).

| Model | Purpose | Key fields |
|-------|---------|-------------|
| `User` | Account | `email`, `passwordHash?`, `emailVerified?`, `role` (`USER`/`ADMIN`), `disabled` |
| `Account` | Linked third-party account (OAuth) | `provider`, `access_token`/`refresh_token` (encrypted), `@@unique([provider, providerAccountId])` |
| `Session` | Required by the NextAuth adapter contract — not actually used for session persistence, since the app uses the `jwt` strategy | — |
| `EmailVerificationToken` | Sign-up confirmation token | `token`, `expiresAt` |
| `ServiceSubscription` | A user's subscription to a service — gates widget usage for anything except `auth: "none"` services | `userId`, `service`, `@@unique([userId, service])` |
| `WidgetInstance` | A widget configured on a user's dashboard | `service`, `widget`, `params` (free-form JSON), `refreshRateSeconds`, `position` (linear order, see [ADR 0005](adr/0005-linear-position-ordering.md)) |
| `UserSettings` | Centralized per-account preferences (`/settings`), applied to the default widget instances | `weatherCity`, `weatherUnit`, `githubRepository`, `rssFeedUrl`, `defaultsSeeded` (guards the one-time lazy seed) |

`params` is deliberately free-form JSON rather than a table per widget:
every widget has different parameters (just string/integer pairs), so
over-modeling this relationally would add a table and migration per widget
for no real benefit — strict validation already happens at the application
layer against the same registry that powers `/about.json`.

## API reference

All `/api/dashboard/*`, `/api/widgets/[service]/[widget]` and `/api/users/*`
routes require a session (NextAuth cookie); `/api/users/*` additionally
requires `role: "ADMIN"`. Widget data is never served to an anonymous caller,
including for services that need no subscription (weather, RSS, crypto, maps).

| Method | Route | Description |
|--------|-------|--------------|
| `GET`  | `/about.json` | Machine-readable introspection of exposed services/widgets (required by the brief) |
| `POST` | `/api/auth/register` | Create an account (username + email + password + `acceptTerms: true`) |
| `POST` | `/api/auth/confirm` | Confirm an account with the token received by email |
| `POST` | `/api/auth/forgot-password` | *(public)* Email a password-reset link (valid 1 h, single use). Same `200` whether or not the account exists; 5 requests / 15 min per IP |
| `POST` | `/api/auth/reset-password` | *(public)* Set a new password from that link (`token`, `password`). Only the SHA-256 of the token is stored |
| `GET`  | `/api/services` | Service catalog, with the signed-in user's subscription, OAuth link and API-key status |
| `POST`/`DELETE` | `/api/services/[name]/subscribe` | Connect / disconnect a service. API-key services (Steam, YouTube) take `{ apiKey }`: checked against the provider, then stored encrypted |
| `GET`  | `/api/widgets` | Widget catalog, across all services |
| `GET`  | `/api/widgets/[service]/[widget]?<params>` | Executes a widget's data fetch (used for the catalog preview and first render) |
| `GET`  | `/api/dashboard` | The signed-in user's widget instances |
| `POST` | `/api/dashboard` | Adds an instance (`service`, `widget`, `params`, `refreshRateSeconds`) |
| `PATCH`/`DELETE` | `/api/dashboard/[id]` | Reconfigures / moves / removes an instance |
| `GET`  | `/api/dashboard/[id]/stream` | SSE stream of live updates for one instance |
| `GET`  | `/api/users` | *(admin)* List of accounts |
| `PATCH`/`DELETE` | `/api/users/[id]` | *(admin)* Enable/disable or delete an account |
| `DELETE` | `/api/profile` | Delete your own account and all its data (`password`, or `confirmation: "DELETE"` for GitHub/Google-only accounts) |
| `POST` | `/api/contact` | *(public)* Contact form, emailed to `CONTACT_EMAIL` (5 messages / 15 min per IP) |

## Repository structure

```
backend/                  # API-only Next.js app — never exposed to the host
├── src/
│   ├── app/
│   │   ├── api/           # All API routes (auth, dashboard, services, users, widgets)
│   │   └── about.json/    # GET /about.json
│   ├── server/            # See "Module map" above
│   ├── lib/db.ts          # Prisma client singleton
│   └── instrumentation.ts # Re-registers existing widget instances with the timer at boot
└── prisma/
    ├── schema.prisma
    ├── migrations/
    └── promote-admin.ts   # Admin promotion script (see root README)

frontend/                 # All pages/UI — the only container published on :8080
└── src/
    ├── app/
    │   ├── api/[...path]/route.ts  # Proxy: forwards /api/* to backend
    │   ├── about.json/route.ts     # Proxy: forwards /about.json to backend
    │   └── admin/ dashboard/ login/ profile/ register/ services/ settings/
    ├── components/         # React components (UI + widgets)
    │   └── widgets/        # One component per widget type (weather, GitHub, Steam, RSS, crypto, maps, YouTube…)
    └── lib/                # Frontend-only utilities (cn(), widget error messages, localStorage helpers)

Duplicated between both apps (documented trade-off, see ADR 0009):
src/lib/validation.ts, src/types/index.ts, src/types/next-auth.d.ts
```

## Adding a new service or widget

1. Copy an existing registered service's `index.ts` (e.g.
   `backend/src/server/services/github/index.ts`) into a new
   `backend/src/server/services/<name>/` folder — every registered service
   follows the same `ServiceInfo` shape.
2. Fill in `name` (unique), `description`, `auth` (`"none"`, or an
   auth-requiring value matched by `isSubscribed()`), and the `widgets`
   list — every widget needs **at least one parameter**
   (`ConfigParam[]`, type `"string"` or `"integer"`).
3. Implement the actual fetch in a separate `fetch.ts` (see the existing
   services) — `index.ts` only describes the service's *shape* (what feeds
   `/about.json` and the catalog), `fetch.ts` does the network work.
4. Register the fetcher in `backend/src/server/widgets/data.ts` (the
   `service → widget → fetcher` map used both by the initial-render API
   route and by the timer's periodic refresh).
5. Import the new service in `backend/src/server/services/index.ts`
   (`services: ServiceInfo[]`) — this single registry is what
   `getAllWidgets()`, the catalog UI, and `/about.json` all read from, so
   nothing else needs to be updated separately.

This structure is directly dictated by the brief: `/about.json` must
dynamically list the services and widgets that are actually available —
adding a service here makes it appear everywhere (catalog, the "add widget"
form, `/about.json`) without duplicating the declaration.
