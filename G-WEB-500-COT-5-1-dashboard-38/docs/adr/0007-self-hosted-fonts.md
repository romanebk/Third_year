# ADR 0007 — Self-hosted fonts instead of `next/font/google`

**Status**: Accepted, revisited

## Context

`next/font/google` was the initial choice for the site's typography (Inter,
at the time). It fetches font files from `fonts.googleapis.com` — but does
so **at build time**, not just at runtime. On the development machine used
for this project, `docker compose build` repeatedly failed with
`NextFontError: Failed to fetch ... from Google Fonts`, traced to an
unstable network path during the Docker build step (separate from, and
narrower than, the later general Docker container networking outage — this
was specifically the build stage failing to reach Google's CDN).

## Decision

Switch to `next/font/local`, self-hosting `.woff2` files for Plus Jakarta
Sans (variable, weights 200–800), Instrument Serif, and Fira Code — all
under the SIL Open Font License, which permits redistribution. The font
files ship inside `src/app/fonts/` and are loaded from disk at build time,
with no network call.

## Consequences

**Positive**
- `docker compose build` no longer depends on reaching an external font CDN
  — only the npm registry (already required for `npm install`), which
  removed a recurring, hard-to-reproduce build failure.
- Switching away from Inter to a pairing of Plus Jakarta Sans (UI) and
  Instrument Serif (marketing headings) was folded into the same change,
  since self-hosting required choosing and downloading specific font files
  either way.

**Negative / accepted trade-offs**
- Font files are committed to the repository instead of fetched on demand —
  a larger repo, and updating a font (new weight, new family) means
  manually downloading and replacing `.woff2` files rather than bumping a
  Google Fonts URL.
- License compliance is now something the project must track manually (all
  three families are confirmed SIL OFL, but that check doesn't happen
  automatically the way it implicitly would through Google's own hosting).
