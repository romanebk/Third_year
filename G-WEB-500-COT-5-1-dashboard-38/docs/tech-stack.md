# Tech stack — and why

What we used, and why — grounded in the actual code (`package.json`, code
comments), not a generic list. For the narrative behind specific decisions
(with alternatives and trade-offs), see the [ADRs](adr/). This document is
the flat reference: one entry per technology.

## Overview

| Layer | Choice |
|-------|--------|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript |
| Database | PostgreSQL, via Prisma ORM |
| Authentication | NextAuth.js (JWT session strategy) |
| Styling | TailwindCSS |
| Real-time | Server-Sent Events (native, no library) |
| Containerization | Docker + docker compose |

---

## Backend

### Next.js (App Router) on both sides, not Express/Nest for the backend

The brief requires both a frontend and a backend. The project is now split
into two apps, `backend/` and `frontend/` (see
[ADR 0009](adr/0009-split-backend-frontend-apps.md) — it started as one app,
per [ADR 0001](adr/0001-monolithic-nextjs-app.md), then split later), but
both are still Next.js App Router projects rather than, say, an
Express/NestJS backend paired with a React frontend: the backend reuses
every API route handler verbatim (same file, same code, just moved), with
the same language (TypeScript) and build pipeline as the frontend — no
separate framework to learn or hand-port route handlers into, for a
two-person team on a tight deadline. `backend/` never renders a page —
it's a Next.js app used purely for its Route Handler conventions and
build/runtime tooling.

### PostgreSQL + Prisma instead of MongoDB / a lighter ORM

- **PostgreSQL**: the project's data is relational by nature (`User` →
  `WidgetInstance` → `ServiceSubscription`, uniqueness constraints like
  `@@unique([provider, providerAccountId])` on `Account` to prevent the same
  GitHub account from being linked twice). A relational database with real
  integrity constraints rules out a whole class of bugs that a document
  store like MongoDB would let through silently.
- **Prisma**: versioned, replayable migrations (`prisma/migrations/`,
  applied on every container startup in this project — `prisma migrate deploy`
  runs before `next start`, see `backend/Dockerfile` — not at build time), a generated
  typed client (column-name typos caught at compile time, not in
  production), and NextAuth's official `PrismaAdapter` uses it directly —
  no hand-written adapter layer for session/account persistence.
- **Free-form JSON for `WidgetInstance.params`** rather than a table per
  widget: every widget has different parameters (a handful of string/integer
  pairs, see `ConfigParam`); modeling that as strict relational columns
  would add a table and a migration for every new widget with no real
  benefit — strict validation already happens at the application layer
  (`validateInstanceParams`, against the same registry that powers
  `/about.json`), so the database doesn't need to re-enforce it.

### NextAuth.js, JWT strategy (not "database")

- One auth system for both credentials (email/password) and OAuth (GitHub + Google):
  the dashboard, the admin section and every API route only have one
  mechanism to check (`getServerSession`), not two that could drift apart.
- **JWT rather than database-backed sessions**: no `Session` table queried
  on every request (the `Session` model in the schema exists only because
  NextAuth's `PrismaAdapter` contract requires it — it isn't actually used
  for credentials/JWT session persistence). The usual downside of stateless
  JWTs — no immediate way to revoke a token, since there's nothing to delete
  server-side — is worked around: the `jwt()` callback re-checks
  `role`/`disabled` against the database on **every** call to
  `getServerSession`, not just at sign-in. Disabling an account from the
  admin section therefore cuts off an already-open session almost
  immediately, despite the JWT strategy. See
  [ADR 0002](adr/0002-jwt-sessions-with-db-revocation-check.md).
- **Third-party OAuth tokens encrypted at rest** (AES-256-GCM,
  `TOKEN_ENCRYPTION_KEY`, kept separate from `NEXTAUTH_SECRET`): two keys
  for two different jobs (signing sessions vs. encrypting stored secrets) —
  a compromised secret shouldn't weaken the other. GCM rather than CBC: an
  authenticated mode, so tampering with the ciphertext (or using the wrong
  key) is detected at decryption instead of silently producing garbage
  data. See [ADR 0006](adr/0006-aes-gcm-token-encryption.md).

### Central timer via Server-Sent Events, not WebSocket

The brief requires widgets to be refreshed by a central timer, not a plain
client-side `setInterval`. The architecture we settled on:
- An independent `setInterval` per widget instance, server-side
  (`src/server/timer/`), rather than one big timer looping over everything —
  a slow refresh for one widget (an external API call) never delays the
  others.
- The server pushes new data to the browser over **SSE**
  (`/api/dashboard/[id]/stream`), not a WebSocket: the stream is strictly
  one-directional (server → client, the client never needs to send anything
  back on this channel), SSE runs over plain HTTP with automatic
  reconnection built into the browser — a WebSocket would have added a
  protocol and hand-written reconnection logic for a need that doesn't
  require either. See
  [ADR 0003](adr/0003-central-timer-with-sse.md).
- Accepted trade-off: the timer lives in memory (not persisted), so a
  server restart loses in-flight timers — compensated by
  `instrumentation.ts`, which re-registers every existing instance at boot.
  True horizontal scaling (several server instances in parallel) would need
  a shared external scheduler — out of scope for this project's size.

---

## Frontend

### Next.js App Router (React 19) on the client side too

Same framework as the backend (see above) — Server Components for pages
that don't need interactivity, Client Components (`"use client"`) for
anything with state (forms, drag & drop, the SSE stream).

### TailwindCSS instead of CSS Modules / styled-components

Fast iteration without switching files between a component and its style,
and design consistency enforced by a shared token system
(`tailwind.config.ts`: colors, radius) rather than scattered magic values.
`tailwind-merge` (`cn()` in `src/lib/utils.ts`) lets a shared component
(`Panel`, `Button`) expose a `className` that the caller can cleanly
override (e.g. the weather panel's blue background) without class
conflicts.

### Self-hosted fonts (`next/font/local`), not `next/font/google`

`next/font/google` downloads font files from `fonts.googleapis.com` **at
build time**, not only at runtime — on this project, `docker compose build`
repeatedly failed with `NextFontError: Failed to fetch ... from Google
Fonts` because of an unstable build-time network. Self-hosting the
`.woff2` files (Plus Jakarta Sans, Instrument Serif, Fira Code — all under
the SIL OFL license, free to redistribute) removes that network dependency
from the build entirely: `docker compose build` now only depends on the npm
registry (already required for `npm install` anyway), not an additional
font CDN. See [ADR 0007](adr/0007-self-hosted-fonts.md).

### Plus Jakarta Sans + Instrument Serif, not Inter alone

A two-family pairing: Plus Jakarta Sans (variable, weights 200–800) for the
interface (dashboard, forms, body copy) — legible, neutral, with enough
weights available for a real typographic hierarchy. Instrument Serif for
editorial headings on the landing page (`font-instrument-serif`) — a
display serif on the big marketing headlines reads more considered/premium
than sans-serif everywhere, without sacrificing the legibility of the
application UI itself, which stays sans-serif.

### Font Awesome instead of hand-rolled inline SVGs

One consistent icon set (uniform stroke weight) instead of SVGs copy-pasted
from different sources with subtly diverging styles — an explicit team
request. The `Fa()` component (`src/components/icons.tsx`) wraps
`FontAwesomeIcon` behind exactly the same API the previous icons exposed
(same exported names, same `className`/`style` props) — no call site in the
rest of the code had to change.

### react-grid-layout for the dashboard's drag & drop

A central requirement of the brief ("the user can rearrange their
dashboard"): rather than hand-rolling a draggable/resizable grid (collision
handling, snapping, responsive breakpoints), a dedicated, maintained
library covers that — with a custom placement algorithm on top
(`findFreeSlot`, `src/components/dashboard-overview.tsx`) so that two new,
narrow-enough panels land side by side instead of always stacking at
`x: 0`, which the library doesn't do out of the box.

### Framer Motion, used sparingly (not everywhere)

Used only for the sidebar's open/close animation (`dashboard-shell.tsx`,
`ui/sidebar.tsx`) — a piece of UI where the open/closed state animates
several properties at once (width, opacity, visibility). No dependency
added for simple CSS transitions (hover, focus), which stay in Tailwind
(`transition-colors`, etc.) — `prefers-reduced-motion` is respected
globally (`globals.css`) without having to handle it per animation.

---

## Why not some of the obvious alternatives

- **No Redux/Zustand**: application state is either local to a component
  (forms) or derived from the server on every request (session,
  subscriptions, instances) — no complex shared global state that would
  justify a dedicated state-management library.
- **No tRPC/GraphQL**: the brief mandates a precise REST contract for
  `/about.json` anyway; keeping the rest of the routes in plain REST
  (`src/app/api/*`) avoids mixing two API paradigms in the same project for
  a marginal gain at this scale.
- **Vitest suite, not zero tests**: `backend/tests/services/` covers every
  widget fetcher (success / validation / 429 / network failure) plus the
  refresh-rate floors and the OAuth provider mapping — 136 tests in ~4 s
  (`npx vitest run`). Manual verification (curl, disposable Docker
  containers, the browser) still covers the flows no unit test reaches
  (OAuth round-trips, SSE streaming, drag & drop).
