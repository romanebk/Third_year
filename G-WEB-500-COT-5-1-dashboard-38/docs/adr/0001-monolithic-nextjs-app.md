# ADR 0001 — One Next.js app for frontend + backend, not two services

**Status**: Superseded by [ADR 0009](0009-split-backend-frontend-apps.md) —
kept for the original reasoning (still valid on its own terms), but the
project now uses two apps. See ADR 0009 for why that changed and how the
split kept every trade-off below true in practice (single Docker Compose
stack, no CORS, no two-halves-drifting-apart risk).

## Context

The Epitech brief requires both a frontend (dashboard UI) and a backend
(business logic, data fetching from external services, `/about.json`
introspection). The obvious "textbook" split is two separate applications —
a React SPA talking to an Express/NestJS API — deployed and versioned
independently.

The team is two people, with an eight-day window (J1–J8) and a hard
requirement to ship a working Docker Compose stack on port 8080.

## Decision

Build one Next.js 15 App Router project. Pages live under `src/app/*`, API
routes live under `src/app/api/*`, and both are served by the same Node
process, built by the same `docker compose build`.

## Consequences

**Positive**
- No CORS configuration between two origins — API routes and pages share
  the same origin by construction.
- One `package.json`, one TypeScript config, one lint config, one
  `docker compose build` — no risk of the two halves drifting apart on
  Node/TypeScript versions.
- Server Components can call backend logic directly (no network hop) where
  it makes sense, while Client Components still go through `/api/*` for
  anything that needs to run after page load (forms, the SSE stream).

**Negative / accepted trade-offs**
- The frontend and backend can't be scaled or deployed independently. Not a
  real constraint here: the brief specifies a single Docker Compose stack.
- A team that grows beyond a couple of contributors would likely want the
  clearer ownership boundary a separate service gives — revisit if this
  project's scope grows past this course. See
  [`../tech-stack.md`](../tech-stack.md#next.js-app-router-instead-of-a-separate-backend-expressnest)
  for further context.
