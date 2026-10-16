# Changelog

All notable changes to Hubly are documented here. Format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versioning is
manual (`0.x` while in development).

## [Unreleased]

### Added

- MIT `LICENSE`, `CONTRIBUTING.md` and this changelog.
- Backend tests for the remaining fetchers: `weather`, `rss`, `steam`,
  `github`, `maps`, `youtube`, plus `refresh-rates` (129 tests, 15 files).

### Fixed

- Connecting an OAuth service (GitHub) goes through the provider's consent
  screen when the link is missing or stale; an already-linked account with a
  valid token subscribes directly without asking authorization again. A stale
  link (token undecryptable after a secret rotation) no longer skips consent,
  and the post-consent subscription no longer re-triggers consent (OAuth loop
  fixed).
- Google Calendar linking uses the shared Google provider (`google-calendar`
  → `google`): Connect and Re-authorize now open Google's authorization,
  and link status/unlink target the real `Account` row.

## [0.1.0] — 2026-10-11

### Added

- 14 services, 30 widgets: GitHub, Google Calendar, Steam, Weather, RSS,
  Crypto, Maps, YouTube, Currency, Wikipedia, NASA, Holidays, IP Location,
  Universities.
- Sign-up with email confirmation (Mailpit inbox), sign-in by
  email/password, GitHub OAuth or Google OAuth, password reset (single-use
  1-hour link).
- Customizable dashboard: drag-and-drop grid, add/reconfigure/remove widget
  instances, central server-side timer with per-service minimum refresh
  intervals, Server-Sent Events updates.
- Service catalog with OAuth link/unlink and per-user encrypted API keys for
  Steam and YouTube.
- Admin section: list, enable/disable, delete and promote/demote accounts.
- `GET /about.json` service/widget introspection.
- Legal pages (Privacy Policy, Terms of Service), contact form, self-service
  account deletion.

### Fixed

- GitHub heatmap and repository counts matching the real profile; expired
  GitHub tokens refreshed before widget calls.
- Weather forecast coherence (selected day in detail, clickable tiles, AQI
  for today only); current weather with feels-like, humidity, wind, day
  max/min.
- Widget errors surfaced with the backend message and one retry on transient
  failures.
- Registration no longer crashes when email delivery fails.

### Security

- No secrets in git: internal secrets generated on first boot, per-user API
  keys stored encrypted, session required for all widget data, SSRF guard on
  user-provided feed URLs, per-IP rate limiting on public routes.
