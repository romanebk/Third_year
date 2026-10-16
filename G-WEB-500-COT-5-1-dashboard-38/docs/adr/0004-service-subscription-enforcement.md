# ADR 0004 — Server-side service subscription enforcement

**Status**: Accepted, revisited

## Context

The brief requires that a user subscribe to a service (GitHub, Steam, …)
before using its widgets. Services with `auth: "none"` (weather, RSS) are
exempt — they're usable by any authenticated user without a prior step.

A compliance audit partway through the project found that "subscribing" was
implemented only as a client-side preference stored in `localStorage` on
the `/services` page. Nothing on the server actually checked it: a user
could add a `github_recent_commits` widget instance and have it fetch data
without ever having gone through the subscribe flow, as long as they knew
the widget/service names.

## Decision

Add a `ServiceSubscription` Prisma model (`userId`, `service`,
`@@unique([userId, service])`) and a single server-side gate,
`isSubscribed(userId, serviceName)`
(`src/server/services/subscriptions.ts`), consulted wherever a widget
instance is created or its data is fetched. Services with `auth: "none"`
always return `true` without a database read; anything else requires a
matching `ServiceSubscription` row.

## Consequences

**Positive**
- Subscription is now a real authorization boundary, not a display
  preference — closes the compliance gap found in the audit.
- Single choke point (`isSubscribed`): every caller (widget creation, data
  fetch) checks the same function against the same table, instead of each
  route re-implementing the check slightly differently.

**Negative / accepted trade-offs**
- `localStorage` on `/services` is still used for pure UI state (which
  service card is expanded, last-viewed tab) — worth remembering that
  `localStorage` on that page is no longer a security boundary of any kind,
  only a client-side convenience, so it should never be trusted again for
  anything resembling authorization.
- This was a correction mid-project, not a decision made up front — a
  reminder that "the user can toggle it in the UI" is not the same claim as
  "the server enforces it," and the two need to be checked separately
  during a review, not assumed to match.
