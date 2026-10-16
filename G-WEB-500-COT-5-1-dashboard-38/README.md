# Hubly — Dashboard

Epitech PGE3 project (G-WEB-500-COT-5-1). A full-stack app for creating an
account, signing in, subscribing to external **services** (GitHub, Google
Calendar, Steam, Weather, RSS, Crypto, Maps, YouTube, Currency, Wikipedia,
NASA, Holidays, IP Location, Universities — 14 in total), and composing a
personalized **dashboard** made of configurable **widget** instances — each
refreshed automatically by a central, server-side timer, independently of the
others.

**Team**: Rayann' Bachabi (git master, lead frontend) · Ariel Boko (lead
backend)

Two separate apps, one Docker Compose stack: [`backend/`](backend/) (API
routes, Prisma, auth, the central widget timer + SSE — never exposed
directly) and [`frontend/`](frontend/) (pages, UI — the only container
published on port 8080, proxying `/api/*` and `/about.json` to the backend
internally). See [ADR 0009](docs/adr/0009-split-backend-frontend-apps.md)
for why and how.

For system design, the data model and the full API reference, see
[`docs/architecture.md`](docs/architecture.md). For why each technology was
chosen, see [`docs/tech-stack.md`](docs/tech-stack.md) and the
[architecture decision records](docs/adr/).

## Features

- Sign-up + email confirmation — the confirmation email is delivered to the
  bundled self-hosted Mailpit inbox (`http://localhost:8025`), no external
  email provider required. See [Troubleshooting](#troubleshooting) for the
  no-SMTP fallback
- Sign-in by email/password, GitHub OAuth, or Google OAuth — both OAuth
  providers link automatically to an existing account sharing the same email
- Password reset by email (`/forgot-password`): single-use link valid for one
  hour, stored only as a hash
- Service catalog (`/services`): subscribe, configure widgets
- Customizable dashboard: drag-and-drop grid (move, resize), add, reconfigure
  (params + refresh rate) and remove widget instances from the catalog
- Central timer: every widget instance refreshes server-side on its own
  interval (`refreshRateSeconds`, configurable, with a per-service minimum —
  60s for GitHub/weather/crypto/currency, 120s for RSS/maps/Steam, 5 min for
  YouTube/Google Calendar/IP Location, 1 h for NASA/Holidays/Universities,
  to stay within free API quotas) and pushes new data to
  the browser via Server-Sent Events — no client-side polling
- A new account ships with **real** default widget instances (current
  weather, weather forecast, RSS — services that need no external account),
  seeded from the account's settings: the dashboard is never a set of fake
  panels
- Centralized, server-side preferences (`/settings`): default weather city,
  temperature unit, tracked GitHub repository, RSS feed — applied to the
  default widget instances
- Two instances of the same widget with different configurations display
  independent data (e.g. weather for Paris and Tokyo at the same time)
- Admin section (`/admin`): list of accounts, enable/disable (near-immediate
  effect, including on an already-open session), delete, and promote/demote
  other accounts to admin
- `GET /about.json`: machine-readable introspection of the exposed
  services/widgets

## Services and widgets

| Service   | Auth      | Widget                    | Parameters                              | Description |
|-----------|-----------|----------------------------|------------------------------------------|-------------|
| `github`  | OAuth     | `github_recent_commits`   | `repository` (string), `max_commits` (integer) | Latest commits on a repository |
| `github`  | OAuth     | `github_user_profile`     | `username` (string)                      | A user's public profile |
| `github`  | OAuth     | `github_security_alerts`  | `repository` (string)                    | Open Dependabot alerts (requires a linked GitHub account) |
| `steam`   | API key   | `steam_most_played`       | `steam_id` (string), `period_days` (integer) | Most-played games over a period |
| `steam`   | API key   | `steam_game_news`         | `app_id` (integer), `max_items` (integer) | News for a game (public endpoint, no key required) |
| `weather` | None      | `weather_city_current`    | `city` (string), `unit` (string)         | Current weather for a city |
| `weather` | None      | `weather_city_forecast`   | `city` (string), `days` (integer), `unit` (string) | Multi-day forecast |
| `rss`     | None      | `rss_article_list`        | `feed_url` (string), `max_items` (integer) | Latest articles from an RSS/Atom feed |
| `rss`     | None      | `rss_interest_feed`       | `interests` (string), `max_items` (integer) | Aggregated news from chosen interest topics |
| `crypto`  | None      | `crypto_price`            | `coin` (string), `currency` (string)     | Current price of a cryptocurrency and its 24h change |
| `crypto`  | None      | `crypto_top_coins`        | `currency` (string), `limit` (integer)   | Top cryptocurrencies by market cap |
| `maps`    | None      | `map_location`            | `address` (string), `zoom` (integer)     | Small map centered on an address (OpenStreetMap) |
| `maps`    | None      | `map_distance`            | `origin` (string), `destination` (string) | Driving distance/duration between two addresses |
| `youtube` | API key   | `youtube_channel_stats`   | `channel` (string)                       | Subscribers, total views and video count of a channel |
| `youtube` | API key   | `youtube_latest_videos`   | `channel` (string), `max_items` (integer) | Latest videos of a channel, with thumbnails and views |
| `youtube` | API key   | `youtube_trending`        | `region` (string), `max_items` (integer) | Trending videos in a country (e.g. `FR`, `US`) |
| `devises` | None      | `devise_rate`             | `base` (string), `target` (string)       | Current exchange rate of a currency pair (ECB) |
| `devises` | None      | `devise_history`          | `base` (string), `target` (string), `days` (integer) | Rate history over N days |
| `wikipedia` | None    | `wiki_onthisday`          | `lang` (string), `limit` (integer)       | « On this day » historical events |
| `wikipedia` | None    | `wiki_top_read`           | `lang` (string), `limit` (integer)       | Most-read articles by language |
| `google-calendar` | OAuth | `gcal_upcoming`       | `max_items` (integer), `days_ahead` (integer) | Upcoming events from the linked Google Calendar |
| `google-calendar` | OAuth | `gcal_today`         | `max_items` (integer)                    | Events scheduled for today |
| `nasa`    | None      | `nasa_apod`               | `date` (string), `hd` (integer)          | Astronomy Picture of the Day with explanation |
| `nasa`    | None      | `nasa_apod_random`        | —                                        | A random image from the APOD archive |
| `holidays` | None     | `holidays_upcoming`       | `country` (string), `region` (string), `max_items` (integer) | Next public holidays for a country (and region) |
| `holidays` | None     | `holidays_year`           | `country` (string), `year` (integer)     | All public holidays of a country for a year |
| `ipgeo`   | None      | `ipgeo_current`           | —                                        | Your location based on your IP address |
| `ipgeo`   | None      | `ipgeo_lookup`            | `ip` (string)                            | Geolocation details for a specific IP |
| `universities` | None  | `unis_by_country`         | `country` (string), `max_items` (integer) | Universities of a country (Hipolabs) |
| `universities` | None  | `unis_search`             | `name` (string), `country` (string), `max_items` (integer) | Search universities by name and/or country |

14 services, 30 widgets — above the minimum required for a two-person team
(1+X=3 services, 3×X=6 widgets).

GitHub and Steam only require an account/key for some features: the public
reads (GitHub commits/profile, Steam news) work without any configuration.
YouTube reads public data only, with a server-side key (`YOUTUBE_API_KEY`);
`channel` accepts `@handle`, a channel id (`UC…`) or a channel URL.
Crypto, Maps, NASA, Holidays, IP Location and Universities use public APIs
(CoinGecko, OpenStreetMap, NASA APOD, Nager.Date, ipapi.co, Hipolabs) that
need no key or account at all. Google Calendar requires a linked Google
account with the `calendar.readonly` scope (granted when you connect Google
on the Services page).

## Quick start

```bash
git clone <repo>
cd G-WEB-500-COT-5-1-dashboard-38

docker compose build   # premier lancement : build compile les images backend/frontend
docker compose up           # lancements suivants (images déjà construites)
```

The app is available at **http://localhost:8080**. Prisma migrations are
applied automatically when the container starts — nothing to run by hand
on a fresh database. A bundled Mailpit inbox (`http://localhost:8025`)
receives the confirmation emails, so sign-up works end-to-end with no
external email provider.

```bash
# Sanity check: list of exposed services/widgets
curl http://localhost:8080/about.json
```

### Environment variables

`docker compose up` works with zero setup and **no secret is stored in the
repository**: the two internal secrets are generated on first start and kept in
the `backend-secrets` Docker volume (see `backend/docker-entrypoint.sh`).
Third-party credentials (GitHub/Google OAuth apps, API keys) go in a root `.env`
file, which is git-ignored — copy `.env.example` and fill in what you need. For
local (non-Docker) development, see `backend/.env.example` and
`frontend/.env.example`.

| Variable | App | Required | Description |
|----------|-----|----------|--------------|
| `DATABASE_URL` | backend | provided | PostgreSQL connection (the compose `db` service) |
| `NEXTAUTH_URL` | backend | provided | **Public** URL of the app (the one the browser sees, served by `frontend`) — used to generate OAuth/redirect URLs, not to reach the backend container itself |
| `NEXTAUTH_SECRET` | backend | generated | Signs JWT sessions. Generated on first start in Docker; set it only to force a value (`openssl rand -base64 32`) |
| `TOKEN_ENCRYPTION_KEY` | backend | generated | Encrypts third-party OAuth tokens at rest. Generated on first start in Docker (`openssl rand -base64 32` otherwise) |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | backend | no (`.env`) | Enables GitHub OAuth (absent: GitHub login disabled, the rest of the service still works) |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | backend | no (`.env`) | Enables Google OAuth (absent: Google login disabled, the rest of the service still works) |
| `YOUTUBE_API_KEY` | backend | no (`.env`) | Optional server key for the YouTube widgets ([YouTube Data API v3](https://console.cloud.google.com/apis/library/youtube.googleapis.com), free quota 10,000 units/day). Absent: each user enters their own key when connecting YouTube on the Services page |
| `STEAM_API_KEY` | backend | no (`.env`) | Optional server key for `steam_most_played`. Absent: each user enters their own [Steam Web API key](https://steamcommunity.com/dev/apikey) when connecting Steam |
| `BACKEND_INTERNAL_URL` | frontend | provided | Internal address of the backend (`http://backend:3002` in Docker) — never reachable from the browser |
| `SMTP_HOST` / `SMTP_PORT` | backend | no (Mailpit default) | Self-hosted SMTP for the confirmation email (`mailpit` service by default). SMTP_USER/PASS optional, `SMTP_SECURE` only for TLS (starttls otherwise) |
| `MAIL_FROM` | backend | no (Mailpit default) | Sender address of the confirmation email |
| `CONTACT_EMAIL` | backend | no (`rayannbachabi0@gmail.com` in docker-compose, else `MAIL_FROM`) | Recipient of the `/contact` form messages |

### First admin account

There is no UI to self-promote to admin (by design) — needed only once, for
the very first admin of a deployment. After registering a first account:

```bash
docker compose exec backend npm run admin:promote -- your.email@example.com
```

From there, that admin can promote other accounts directly from `/admin` —
no need to run this script again.

## Usage

1. **Sign up** (`/register`) — the confirmation email is delivered to the
   bundled Mailpit inbox, open **http://localhost:8025** and click the link
   (or paste it). If no SMTP is configured, the link is printed to the
   server logs instead and `/api/auth/register` returns the token directly:
   ```bash
   docker compose logs -f backend | grep mailer
   ```
2. **Confirm** — clicking the confirmation link also **starts your session**:
   after confirming you land directly on the dashboard, no second sign-in.
3. **Sign in** (`/login`) — only needed after confirming from another device,
   or if your session expired. Email/password, or "Continue with GitHub" /
   "Continue with Google" if OAuth is configured. Forgot your password?
   **Forgot password?** emails you a reset link (in Mailpit by default:
   http://localhost:8025).
4. **Services** (`/services`) — subscribe to a service, configure a widget
   for the catalog preview. For an OAuth service (GitHub, Google Calendar),
   **Connect** first opens the provider's consent screen and links that
   account to the current Hubly account — whatever way it was created (email,
   Google...) — then subscribes. *Link account* / *Re-authorize* on the
   service card (re)grants access later, e.g. after a scope change (Google
   Calendar needs the `calendar.readonly` scope, so an account linked before
   it was added must re-authorize).
5. **Dashboard** (`/dashboard`) — a new account starts with three **real**
   default widget instances (current weather, weather forecast, RSS — the
   services that need no account; one `isDefault` instance of each, seeded
   from `/settings`). Each panel can be removed from its menu, and the *Add
   Widget* button opens the catalog to add your own configured widget
   instances (stored in the backend DB, fetched by the backend and refreshed
   by a timer over SSE). Drag-and-drop to rearrange; the grid geometry is
   persisted in the browser, widget instances live in the database.
6. **Settings** (`/settings`) — centralized, per-account preferences (default
   weather city, temperature unit, tracked GitHub repo, RSS feed URL), stored
   server-side and applied to the default widget instances. Changing them
   updates those widgets on their next server-side refresh.
7. **Admin** (`/admin`, admin only) — list of accounts, enable/disable.

## Local development (without Docker)

Each app is a separate process; run both.

```bash
docker compose up -d db mailpit  # DB (localhost:5433) + boîte mail (UI :8025, SMTP :1025)

cd backend && npm install && npm run prisma:migrate && npm run dev   # http://localhost:3002 (internal)
cd frontend && npm install && npm run dev                            # http://localhost:3001
```

For confirmation emails in local dev, point the backend's `SMTP_HOST` at
`localhost` (Mailpit), e.g. via `backend/.env`.

Browse `http://localhost:3001` — the frontend's proxy forwards `/api/*` and
`/about.json` to the backend on `3002` automatically
(`frontend/.env`'s `BACKEND_INTERNAL_URL`). The GitHub/Google OAuth callbacks
need to be registered for `http://localhost:3001` (the frontend's port —
same as before the backend/frontend split, since the browser only ever talks
to the frontend).

## Troubleshooting

**I'm not receiving a confirmation email.**
First check the bundled Mailpit inbox at **http://localhost:8025** — that's
where the confirmation email is delivered by default (self-hosted SMTP, no
external provider). If nothing shows up, check the server logs:
`docker compose logs -f backend | grep mailer`. Without any SMTP configured,
the backend has no delivery channel and falls back to printing the link to
those logs (`[mailer] (fallback) …`).

**A GitHub widget shows "invalid configuration" / repository not found.**
Check that the repository name uses the `owner/repo` form (e.g.
`vercel/next.js`). If a GitHub account is linked and its OAuth token has
expired, `github_recent_commits`/`github_user_profile` automatically fall
back to anonymous access — only `github_security_alerts` truly requires a
valid token (re-link the account if needed).

**Steam widgets return nothing.**
Two possible causes: no `STEAM_API_KEY` configured
(`steam_most_played` needs one, via env variable or per widget instance —
see the environment variables table above; `steam_game_news` doesn't need
one), or the network in use can't reach `api.steampowered.com` (firewall,
corporate proxy…).

**Crypto or Maps widgets fail intermittently.**
Both use free, keyless public APIs (CoinGecko, OpenStreetMap Nominatim/OSRM)
with rate limits — under heavy testing you may hit a temporary 429, shown as
a clear error on the widget rather than a crash. Wait a few seconds and
refresh.

**`docker compose up` fails with `address already in use` (port 8080).**
Something else on the machine already occupies that port. Either free it,
or temporarily change the mapping in `docker-compose.yml`
(`"8080:3000"` → another host port) — for local testing only, the fix
should still target port 8080.

**An empty database after `docker compose up`.**
Shouldn't happen anymore: the `backend` container runs `prisma migrate
deploy` before starting (see `backend/Dockerfile`). If it persists, check
that the `postgres-data` volume isn't shared with an incompatible schema
from an older run.

**Notes**
- A session already open when an admin disables the account is cut off on
  the next server call (re-checked on every request), not via an instant
  push notification.
- The central timer lives in memory: a server restart automatically
  re-registers every existing instance (`instrumentation.ts`), nothing to
  restart by hand.

## Further documentation

- [`docs/architecture.md`](docs/architecture.md) — system diagram, module
  map, data model, full API reference
- [`docs/tech-stack.md`](docs/tech-stack.md) — why each backend and
  frontend technology was chosen
- [`docs/adr/`](docs/adr/) — architecture decision records: the context and
  trade-offs behind specific engineering decisions

## Bonus

Bonus files in `bonus/`.
