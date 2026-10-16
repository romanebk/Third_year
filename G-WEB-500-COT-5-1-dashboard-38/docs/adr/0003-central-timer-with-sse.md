# ADR 0003 — Central per-instance timer, pushed over SSE, not WebSocket

**Status**: Accepted

## Context

The brief explicitly requires a "central timer": each widget instance on a
user's dashboard must refresh itself automatically, on its own configurable
interval (`refreshRateSeconds`), independently of the other instances, and
push updates to the browser — not have the browser poll on a client-side
`setInterval`.

Two sub-decisions were needed: how the server schedules refreshes, and how
it gets new data to an open browser tab.

## Decision

- **Scheduling**: one `setInterval` per widget instance
  (`src/server/timer/timer.ts`, `WidgetTimer`), tracked in a `Map<id,
  NodeJS.Timeout>`, rather than a single loop iterating over every instance.
  Each timer's callback catches its own errors so one widget's failing
  fetch (external API down, timeout) never stops another widget's timer or
  crashes the process.
- **Delivery**: Server-Sent Events (`GET /api/dashboard/[id]/stream`).
  A tick publishes to an in-process `EventEmitter`
  (`src/server/timer/events.ts`, `widgetDataEvents`); any open SSE
  connection for that instance ID receives the event and forwards it to the
  browser.

## Consequences

**Positive**
- Refresh cadence is genuinely per-instance: two widget instances with
  different `refreshRateSeconds` values never interfere with each other's
  timing.
- SSE runs over plain HTTP with the browser's built-in automatic
  reconnection (`EventSource`) — no custom reconnection logic to write, no
  second protocol (as a WebSocket would require) for a channel that is
  strictly server → client.
- Errors are never leaked to the client: a failed fetch publishes a generic
  `{ type: "error", message: "could not fetch widget data" }`, with the real
  error only logged server-side.

**Negative / accepted trade-offs**
- The timer state is in-memory only (the `Map` of intervals, the
  `EventEmitter`'s listeners). A server restart loses every scheduled timer.
  Mitigated by `instrumentation.ts`, which re-registers every existing
  `WidgetInstance` at process boot — but this means the timer cannot be
  horizontally scaled across multiple server processes without a shared
  external scheduler (e.g. a job queue), which is out of scope for this
  project's size.
- Both `widgetTimer` and `widgetDataEvents` are singletons stored on
  `globalThis`, specifically to survive Next.js's dev-mode Fast Refresh
  module reloading — without that guard, every hot reload would create a
  fresh `WidgetTimer`/`EventEmitter` and silently orphan the previous
  timers, leaking `setInterval` handles. The same pattern is used for the
  Prisma client in `src/lib/db.ts`.
