# ADR 0002 — JWT sessions with a per-request database revocation check

**Status**: Accepted

## Context

NextAuth supports two session strategies: `"database"` (a `Session` row per
login, queried on every request) and `"jwt"` (a signed, stateless token, no
database read needed to validate it). The project also needs an admin
feature: disabling a user account, with the disable taking effect
immediately — including for a session that's already open in someone's
browser.

Stateless JWTs are the classic trap here: once issued, there is nothing to
delete server-side, so a naive JWT implementation means a disabled account
stays fully functional until its token naturally expires.

## Decision

Use the `"jwt"` strategy for performance and simplicity (no `Session` table
hit on every request), but re-verify `role` and `disabled` against the
database inside the `jwt()` callback — which NextAuth invokes on every call
to `getServerSession`, not only at sign-in. If the account is disabled or no
longer exists, the callback strips the token's identity (`sub`, `role`)
instead of passing it through unchanged, which makes every
`if (!session?.user?.id)` check in the codebase treat the request as
unauthenticated.

## Consequences

**Positive**
- Gets JWT's performance characteristics (no session table lookup) while
  still supporting near-immediate revocation — the admin's expectation
  ("disable this account") is met without adding a `Session` table read to
  every request.
- One code path: credentials and OAuth (GitHub) both flow through the same
  `jwt()`/`session()` callbacks in `src/server/auth/auth.ts`.

**Negative / accepted trade-offs**
- Every authenticated request still does one database read (`prisma.user.findUnique`
  for `role`/`disabled`) — not truly stateless, just cheaper than a full
  session-table design and simpler to reason about, since it's one row by
  primary key rather than a join through `Session`.
- The `Session` Prisma model still exists in the schema purely because
  NextAuth's `PrismaAdapter` contract requires it, even though the JWT
  strategy never writes to it. Slightly confusing for a new contributor
  reading `schema.prisma` cold — documented in the model's own code comment
  and in [`../architecture.md`](../architecture.md#data-model).
