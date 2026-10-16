# ADR 0010 — Hipolabs Universities API over plain HTTP

**Status**: Accepted

## Context

The `unis_by_country` / `unis_search` widgets read the public Hipolabs
Universities API (`http://universities.hipolabs.com`, no key, no account).
That API does not answer on port 443 — the TLS handshake is refused
(verified), so `https://universities.hipolabs.com` is unreachable and every
request over HTTPS fails before any application logic runs.

## Decision

Call the Hipolabs API over plain HTTP, documented at the call site
(`backend/src/server/services/universities/fetch.ts`), instead of dropping
the Universities service or routing it through a third-party TLS proxy.

## Consequences

**Positive**
- The Universities service works with zero infrastructure (no proxy to run,
  no key to manage) — consistent with the other keyless public APIs
  (Open-Meteo, Nager.Date, ipapi.co).

**Negative / accepted trade-offs**
- Requests and responses travel unencrypted and could be observed or altered
  on the network path. Accepted because the payload is fully public,
  non-personal reference data (university names, countries, websites), and
  the only user-controlled input sent is a country/name filter — the same
  data the user typed into the widget. No token, password, or personal data
  ever transits on this connection.
- If Hipolabs ever enables HTTPS, switching back is a one-line change of
  the `HIPOLABS_API` constant; the existing `universities.test.ts` suite
  does not depend on the scheme.
