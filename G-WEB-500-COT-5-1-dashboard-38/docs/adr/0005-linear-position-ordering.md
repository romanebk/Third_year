# ADR 0005 — Linear position ordering instead of persisted grid coordinates

**Status**: Accepted

## Context

The dashboard grid uses `react-grid-layout` on the client, which lays
widgets out with `x`/`y`/`w`/`h` grid coordinates. The question was whether
`WidgetInstance` should persist those coordinates directly, or something
simpler.

## Decision

`WidgetInstance.position` is a single `Int` — a linear order, `0..n-1` per
user, maintained as a contiguous sequence by
`src/server/dashboard/reorder.ts` (`moveWidgetInstance`,
`closePositionGap`). The actual `x`/`y` grid placement is derived
client-side from that order by `findFreeSlot()` in
`src/components/dashboard-overview.tsx`, which packs new widgets into free
row gaps instead of always stacking them at `x: 0`.

## Consequences

**Positive**
- A much simpler invariant to maintain server-side: "positions are
  0..n-1, contiguous, per user" supports a straightforward move algorithm
  (only shift what's strictly between the old and new position) instead of
  accepting and re-normalizing arbitrary client-supplied coordinates.
- Reordering via drag-and-drop only needs to `PATCH` a single integer per
  moved instance, not a full `{x, y, w, h}` object.

**Negative / accepted trade-offs**
- The persisted order and the on-screen grid position are not the same
  thing — a widget's exact `x`/`y` after a page reload is recomputed by
  `findFreeSlot()`, not read back verbatim from what the user last saw. In
  practice this is stable because the packing algorithm is deterministic
  given the same order and viewport width, but it does mean a multi-column,
  freely-positioned layout (independent of visual order) isn't supported —
  acceptable for this project's scope, flagged in the schema's own comment
  for anyone considering a persisted-coordinates redesign later.
