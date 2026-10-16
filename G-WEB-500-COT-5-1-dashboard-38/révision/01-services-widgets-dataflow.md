# Hubly — Revision File 1/2: Services, Widgets, Data Flow
Defense in English — simple sentences, only verified facts (code paths included).
Truth (Oct 2026): **14 services, 30 widgets** — github×3, steam×2,
youtube×3, google-calendar×2, weather×2, rss×2, crypto×2, maps×2,
devises×2, wikipedia×2, nasa×2, holidays×2, ipgeo×2, universities×2.
(Old note kept below: 7/13 with Spotify, removed since.)

## 1. The big picture (30-second pitch)

Hubly is a personal dashboard. The user subscribes to **services**
(GitHub, Google Calendar, Steam, YouTube, Weather, News/RSS, Crypto, Maps,
Currency, Wikipedia, NASA, Holidays, IP Location, Universities) and places **widget
instances** on a grid. Each instance has its own settings and its own
refresh rate (≥ 5 s). A central server-side timer refetches each instance
and pushes fresh data through Server-Sent Events (SSE). No client polling.

Run: `docker compose up --build` → **http://localhost:8080**.
Only the frontend container is published (8080→3000). The backend lives
inside the compose network at `http://backend:3002`.

## 2. How a widget goes from click to pixels

1. **Choose + configure**: *Add Widget* → pick service → pick widget →
   fill typed params + refresh rate → `POST /api/dashboard` (201).
   Params are validated server-side by `validateInstanceParams()`
   (`backend/src/server/dashboard/validate-params.ts`): allowlist, type
   coercion, ranges. Bad input → 400.
2. **Store**: one row per instance in `WidgetInstance`
   (`id, userId, service, widget, params JSON, refreshRateSeconds,
   position`). Two identical widgets with different params = two rows,
   two independent results (e.g. Paris + Tokyo weather at the same time).
3. **Refresh**: `registerInstanceTimer()` starts one `setInterval` per
   instance (`backend/src/server/timer/`). Each tick calls the fetcher
   from the registry (`backend/src/server/widgets/data.ts`), publishes to
   an in-process `EventEmitter` keyed by instance id.
4. **Display**: the browser holds one `EventSource` per instance
   (`/api/dashboard/[id]/stream`) and re-renders on push.
5. **Reconfigure / move / delete**: menu → `PATCH /api/dashboard/[id]`
   (params and/or refresh rate and/or position) ; drag-and-drop
   (react-grid-layout) syncs `position` via PATCH ; *Remove* →
   `DELETE /api/dashboard/[id]`. Positions are a contiguous order
   (`moveWidgetInstance`, `closePositionGap`). Concurrent reorders are
   retried on Postgres deadlock 40P01 (3 attempts, then 500).
6. **Survives reload**: instances in PostgreSQL ; grid geometry
   (x,y,w,h) in `localStorage` (`hubly.dashboard.layout.v3`).

## 3. Service by service (what to say for each)

### github — OAuth (`backend/src/server/services/github/`)
- **Credentials**: GitHub OAuth App (Settings → Developer settings).
  Callback `http://localhost:8080/api/auth/callback/github`
  (or `:3001` in dev). Scopes: `read:user user:email repo`.
  `GITHUB_CLIENT_ID/SECRET` in env (dev defaults in compose).
- **Linking**: NextAuth `signIn()` callback links the GitHub account to
  the logged-in user, matching by verified email
  (`backend/src/server/auth/auth.ts`). Tokens encrypted at rest
  (AES-256-GCM, `token-encryption.ts`).
- **Widgets**:
  - `github_recent_commits` — params: `repository` (string,
    `owner/repo`), `max_commits` (integer). Calls
    `api.github.com/repos/{repo}/commits`. Bad repo → 400
    ("invalid configuration"). Expired token → falls back to anonymous
    (only `security_alerts` truly needs a token).
  - `github_user_profile` — params: `username` (string). Calls
    `api.github.com/users/{username}` + scrapes
    `github.com/users/{username}/contributions` for the heatmap
    (best-effort: parsed from HTML, never fails the widget).
  - `github_security_alerts` — params: `repository` (string). Calls
    Dependabot alerts API. **Requires** a valid linked token (401/403
    otherwise).

### spotify — REMOVED (`services/spotify/` deleted, replaced by YouTube)
- **Honest answer (history)**: until Oct 2026 the service was listed (auth
  `oauth`, 1 widget) but **no Spotify NextAuth provider was registered**,
  so `spotify_currently_playing` could not fetch. The service was then
  removed and replaced by `youtube` (3 widgets, API-key auth). If asked
  about old notes mentioning Spotify: outdated, superseded.

### steam — API key (`services/steam/`)
- **Credentials**: free key at `steamcommunity.com/dev/apikey`
  (`STEAM_API_KEY` env, or per-widget `api_key` param).
- **Widgets**:
  - `steam_most_played` — `steam_id` (string), `period_days`
    (integer). Calls `api.steampowered.com` player stats. Needs a key.
  - `steam_game_news` — `app_id` (integer), `max_items` (integer).
    Public endpoint, **no key needed**.

### weather — no auth (`services/weather/`)
- **API**: `api.open-meteo.com` (+ geocoding + air-quality hosts). Free,
  no key. Works on a fresh account (default seed).
- **Widgets**: `weather_city_current` (`city`, `unit`) ;
  `weather_city_forecast` (`city`, `days`, `unit`).

### rss — no auth (`services/rss/`)
- **How it works**: `fetchArticleList()` (`services/rss/fetch.ts`)
  fetches ANY user URL through `safeFetch()` (`ssrf-guard.ts`): DNS is
  resolved and private/loopback/link-local IPs are rejected, redirects
  re-validated (max 3), 8 s timeout, custom User-Agent. Parses RSS
  (`<item>`) and Atom (`<entry>`) with a dependency-free regex parser.
- **Widget**: `rss_article_list` (`feed_url` string, `max_items`
  integer). 4xx → 400 "feed not found", network → 502.

### crypto — no auth (`services/crypto/`)
- **API**: `api.coingecko.com` (free, rate-limited → 429 mapped).
- **Widgets**: `crypto_price` (`coin`, `currency`) ;
  `crypto_top_coins` (`currency`, `limit` integer).

### maps — no auth (`services/maps/`)
- **APIs**: OpenStreetMap Nominatim (geocoding) + OSRM (routing).
  Respect usage policy (usage docs referenced in code).
- **Widgets**: `map_location` (`address` string, `zoom` integer) ;
  `map_distance` (`origin`, `destination` strings).

## 4. Auth flows (accounts)
- **Register**: `POST /api/auth/register` → email format + password
  strength (8+, upper, lower, digit, special) → bcrypt (12 rounds) →
  `User` + `EmailVerificationToken` (24 h) → mail via Mailpit
  (`:8025`). Passwords never logged, only hashes stored.
- **Confirm**: link → `POST /api/auth/confirm` → sets
  `emailVerified`, **auto-login** (NextAuth `encode()` session cookie),
  lands on `/dashboard`.
- **Login**: CredentialsProvider (`auth.ts`): bcrypt check +
  `emailVerified` set + account not disabled → JWT session, re-checked
  (incl. disabled flag) on **every** request (DB revocation check).
- **OAuth login**: GitHub/Google providers → email-match linking →
  same session. Disabled accounts rejected in `signIn()` too.

## 5. HTTP codes (why each)
200 OK · 201 Created (`POST /api/dashboard`) · 400 Bad Request
(params/refreshRate invalid) · 401 Unauthorized (no session, bad login,
unverified) · 403 Forbidden (not subscribed / unsubscribed service) ·
404 Not Found (instance not yours — deliberate, hides existence) · 409
Conflict (email taken) · 429 Rate limited (upstream quota) · 502 Bad
Gateway (upstream down) · 500 (unexpected; deadlock retried 3× first).

## 6. Who did what (say it in English)
- **Rayann' Bachabi** (frontend lead, git master): UI, widget panels,
  drag-and-drop, polish, accessibility, landing, TimerCard.
- **Ariel Boko** (backend lead): auth, token encryption, service
  registry + fetchers, central timer/SSE, subscriptions enforcement,
  dashboard API, deadlock retry, runbook.
- 244 commits: Rayann 136, Ariel 108. 70+ PRs, cross-reviewed.
