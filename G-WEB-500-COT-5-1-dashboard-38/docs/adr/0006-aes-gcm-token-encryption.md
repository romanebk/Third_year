# ADR 0006 — AES-256-GCM encryption for stored OAuth tokens

**Status**: Accepted

## Context

Linking a GitHub account stores an access token (and possibly a refresh
token) in the `Account` table via NextAuth's `PrismaAdapter`. Storing these
in plaintext means a database leak directly leaks working credentials to
every linked third-party account.

## Decision

Wrap the `PrismaAdapter` with a custom adapter
(`src/server/auth/encrypted-adapter.ts`) that encrypts `access_token` and
`refresh_token` before every write and decrypts them on every read, using
AES-256-GCM (`src/server/auth/token-encryption.ts`). The encryption key
(`TOKEN_ENCRYPTION_KEY`) is a separate environment variable from
`NEXTAUTH_SECRET` (which signs session JWTs).

## Consequences

**Positive**
- A database dump alone no longer exposes usable GitHub tokens — the
  attacker would also need `TOKEN_ENCRYPTION_KEY`, which lives only in the
  environment, not the database.
- GCM is an authenticated mode: decrypting with the wrong key, or a
  ciphertext that's been tampered with, fails loudly instead of silently
  producing corrupted-but-plausible-looking data (as an unauthenticated
  mode like plain CBC would).
- Using a distinct key from `NEXTAUTH_SECRET` means a compromise of one
  doesn't automatically compromise the other — session forgery and token
  decryption require different secrets.

**Negative / accepted trade-offs**
- The `Account.access_token`/`refresh_token` columns in `schema.prisma` are
  still plain `String` columns as far as Postgres/Prisma are concerned —
  there's no database-level type that enforces "this must be encrypted."
  The guarantee is entirely in application code (the adapter wrapper), so
  any future code path that writes to `Account` directly (bypassing the
  adapter) would silently break this invariant. Documented in the schema's
  own comment as a flag for future contributors.
- Losing `TOKEN_ENCRYPTION_KEY` (e.g. a botched env rotation) makes every
  stored token permanently undecryptable — operationally equivalent to
  every linked GitHub account needing to be re-linked. Acceptable for this
  project; would need a key-rotation strategy in a longer-lived production
  system.
