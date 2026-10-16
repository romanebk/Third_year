# ADR 0009 — Split into two apps, `backend/` and `frontend/`

**Status**: Accepted

## Context

[ADR 0001](0001-monolithic-nextjs-app.md) deliberately kept the project as
one Next.js app for the reasons stated there. The team later asked for a
genuine split into two top-level folders/apps — not just an internal
rename — while keeping the app working exactly as graded: reachable on
host port 8080, `GET /about.json` unchanged, the central widget timer/SSE
mechanism unaffected.

## Decision

Two Next.js apps:
- **`backend/`** — API-only (no pages): everything under the old
  `src/app/api/**`, `src/app/about.json/route.ts`, `src/server/**`,
  `src/lib/db.ts`, `instrumentation*.ts`, `prisma/**`. Runs on an
  internal-only port, never published to the host.
- **`frontend/`** — all pages/components. The only container published on
  the host (`8080:3000`, unchanged).

The browser only ever talks to `http://localhost:8080` (`frontend`). A
small hand-written proxy Route Handler inside `frontend`
(`src/app/api/[...path]/route.ts`, plus a dedicated one for
`/about.json`) forwards every request to the backend over the
Docker-internal network (`http://backend:3002`), streaming the response
body back unmodified — including the `text/event-stream` SSE response, the
same `ReadableStream`-passthrough pattern the SSE route itself already
used. Because the browser stays same-origin, the NextAuth session cookie,
`new EventSource("/api/dashboard/[id]/stream")` (unchanged, still a
same-origin relative URL from the browser's point of view), and the GitHub
OAuth callback URL all keep working with zero client-side or GitHub-App
config changes.

Rejected: `next.config.js` `rewrites()` to an external origin (unproven for
long-lived SSE streams in this Next version — verified this specific
proxy pattern instead with a throwaway two-app spike before migrating any
real code); an nginx/Caddy sidecar (proven industry-wide for SSE, but a
new tool under time pressure with its own footguns — buffering, gzip,
http version — the team has no fluency debugging); Express/Fastify instead
of a second Next.js app (would mean hand-porting all 12 route handlers
instead of moving them verbatim); a real cross-origin split with CORS +
`SameSite=None` cookies (unreliable HTTPS/cookie requirements on
`localhost` across browsers, and still needs something in front of 8080
anyway).

`src/lib/validation.ts` and `src/types/{index.ts,next-auth.d.ts}`
(~100 lines total, type-only or trivial) are duplicated into both apps
rather than extracted into a shared npm workspace package — a workspace
setup would add more Docker/tsconfig tooling risk than these files are
worth at this project's size.

The one real coupling break: `admin/page.tsx` used to call
`getServerSession(authOptions)` directly (the only page doing so, instead
of letting an API route 401/403 and the client react, per the codebase's
own stated convention). Since `/api/users` already independently re-checks
`role === "ADMIN"` (`requireAdminSession()`), removing the page-level check
is defense-in-depth being removed, not the only gate. Fixed by having
`AdminUsersManager` (already a Client Component) fetch `/api/auth/session`
itself on mount and redirect client-side if not admin — a brief loading
flash instead of an instant server redirect for non-admins, cosmetic only.

## Consequences

**Positive**
- Genuinely two separate, independently buildable/deployable codebases —
  what was asked for — while every ADR 0001 trade-off that mattered (no
  CORS, single Compose stack, port 8080, `/about.json` shape, SSE/timer
  behavior) stays true, because the browser-facing contract didn't change
  at all, only what's behind it.
- The proxy is the one genuinely new piece of code in the whole migration;
  everything else is a verbatim file move — kept the blast radius as small
  as a real split allows this close to the graded follow-up.

**Negative / accepted trade-offs**
- One more network hop (frontend → backend) per request, inside the
  Docker-internal network only — not a meaningful latency concern at this
  scale.
- `validation.ts`/`types/index.ts`/`next-auth.d.ts` now exist in two
  places, kept in sync by hand (documented with a comment in each copy).
- `client.host` in `/about.json` depends on `x-forwarded-for` being set by
  whatever sits in front of the deployment — true before this split too
  (Next.js self-hosted without a reverse proxy doesn't expose the raw
  socket IP through the standard Route Handler `Request`), not a
  regression introduced here; the frontend proxy passes the header through
  unchanged if present rather than dropping it.
