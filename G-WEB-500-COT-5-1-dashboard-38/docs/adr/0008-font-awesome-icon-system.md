# ADR 0008 — Font Awesome as the single icon system

**Status**: Accepted

## Context

Icons across the app were originally a mix of hand-copied inline SVGs from
different sources, with subtly inconsistent stroke widths and corner
styles. The team explicitly asked for a single, consistent icon system
instead.

## Decision

Adopt Font Awesome (`@fortawesome/*` packages), wrapped behind the exact
same component API the app already used: each exported icon component in
`src/components/icons.tsx` keeps its original name and accepts the same
props (`className`, `style`, …) as before, internally rendering
`FontAwesomeIcon`. Font Awesome's own CSS is imported once, globally, in
`layout.tsx`, with automatic CSS injection disabled to avoid a duplicate
stylesheet.

## Consequences

**Positive**
- One icon set, one stroke weight, one visual language across the entire
  app — the original goal.
- Zero call-site changes: because the wrapper preserves the previous
  component names and prop shapes, every place that rendered `<GithubIcon
  className="size-5" />` before continues to work unchanged after the
  swap — the migration was purely internal to `icons.tsx`.

**Negative / accepted trade-offs**
- An added dependency (several `@fortawesome/*` packages) versus inline SVG,
  which had zero runtime dependency. Accepted given the explicit team
  request for visual consistency over dependency minimalism.
- Icon sizing defaults to Font Awesome's own `1em` behavior; Tailwind
  `size-*`/`h-* w-*` classes passed via `className` are kept as the
  overriding priority so existing call sites didn't need their sizing
  classes rewritten.
