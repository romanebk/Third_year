# Hubly — Revision File 3/3: Demo-Day Playbook
English only — these are the exact sentences to SAY at the defense.
Timings for a 15-minute demo. Commands are copy-paste ready.

## 0. Before the jury arrives (checklist)

```bash
docker compose ps                    # 4 Up, db healthy
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8080/   # 200
curl -s http://localhost:8080/about.json | head -c 200
# Browser: http://localhost:8080 open, Mailpit http://localhost:8025 open
# in a second tab. Test account ready (or register live).
```

Say: *"The project is already running — the Docker build takes about ten
minutes, so we started it beforehand."*

## 1. Minute-by-minute demo script

**Min 0–2 — Start & about.json.**
Say: *"Hubly is a personal dashboard: users subscribe to external services
and compose widgets that refresh independently. It runs with one command,
docker compose up --build, on port 8080."*
Do: terminal `curl http://localhost:8080/about.json` → point at
`client.host`, `server.current_time`, the 14 services with typed params.
Say: *"This file always matches the app — it is generated from the same
service registry the API uses."*

**Min 2–5 — Account.**
Do: Register a fresh email → open Mailpit `:8025` → click the link →
land on `/dashboard` logged in.
Say: *"Registration validates email and password strength server-side,
hashes with bcrypt, sends the link to our self-hosted Mailpit — no
external provider needed. Clicking confirms AND logs in."*

**Min 5–9 — Widgets (the core).**
Do: Add `weather_city_current` Paris (rate 30 s) + same widget Tokyo
(rate 60 s) → different data side by side.
Say: *"Same widget twice, different settings, different results at the
same time — each instance is its own database row with its own timer."*
Do: Add `github_recent_commits` (`vercel/next.js`, 5) + `rss_article_list`
(`https://hnrss.org/frontpage`).
Say: *"Every parameter is typed — integers get number inputs — and the
server re-validates everything: wrong input is a 400, never a crash."*

**Min 9–11 — Reconfigure / move / delete.**
Do: drag a panel, keyboard-move one, edit Tokyo → London, delete one.
Say: *"Move is drag-and-drop or keyboard. Positions sync to the server;
concurrent moves retry on database deadlocks."* Reload the page:
*"Instances live in Postgres, so the dashboard survives reload."*

**Min 11–13 — Fresh data proof + admin.**
Do: set one widget rate to 5 s, watch it update via SSE (no page reload).
Say: *"Each widget refreshes at its own rate — server-side timers push
over Server-Sent Events, the client never polls."*
Do (admin account): `/admin` → disable test user → its session dies on
next request. Say: *"JWT sessions are re-checked against the database on
every request, so revocation is near-immediate."*

**Min 13–15 — Services & close.**
Do: `/services` → show subscribe/unsubscribe; `weather`/`rss` need no
account. Close: *"14 services, 30 widgets — 20 work with no account at
all. Every listed widget fetches for real."

## 2. One-liners per widget (if they point at one)

- `github_recent_commits`: *"Latest commits of owner/repo via the GitHub
  REST API; bad repo is a 400; expired tokens fall back to anonymous."*
- `github_user_profile`: *"Public profile plus a contribution heatmap we
  scrape best-effort — it never fails the widget."*
- `github_security_alerts`: *"Dependabot alerts — the only widget that
  truly requires a valid linked token."*
- `youtube_channel_stats` / `youtube_latest_videos` / `youtube_trending`:
  *"Public YouTube data with a free API key — replaced Spotify in Oct 2026."*
- `steam_most_played` / `steam_game_news`: *"Player stats need a free
  Steam key; game news is public, no key."*
- `weather_city_current` / `weather_city_forecast`: *"Open-Meteo, free,
  no key — these seed every new account."*
- `rss_article_list`: *"Any feed URL through our SSRF guard: DNS
  resolved, private IPs rejected, redirects re-checked, 8-second
  timeout, dependency-free RSS/Atom parser."*
- `crypto_price` / `crypto_top_coins`: *"CoinGecko; quotas surface as
  429."*
- `map_location` / `map_distance`: *"Nominatim geocoding + OSRM routing,
  OpenStreetMap."*

## 3. Mock jury Q&A (20 questions)

1. *"Show me two identical widgets with different results."* → Paris +
   Tokyo weather side by side.
2. *"What happens with a bad repository name?"* → Type `Bénin` → 400
   "invalid configuration", error state stays visible (role=alert).
3. *"Where is validation done?"* → Client for UX, server for truth:
   `validateInstanceParams()`, single choke point, 400.
4. *"List your HTTP codes and why."* → 200/201/400/401/403/404 (owner
   hidden)/409/429/502/500. Deadlock retried 3× before 500.
5. *"How does data travel?"* → Browser → frontend:3000 → proxy
   `[...path]` → backend:3002 → handler → Prisma → back. SSE same path
   as event stream.
6. *"How did you get the GitHub client ID and secret?"* → GitHub →
   Settings → Developer settings → OAuth App, callback
   `http://localhost:8080/api/auth/callback/github` registered there.
7. *"Where are tokens stored?"* → `Account` table, AES-256-GCM
   encrypted, key separate from session secret.
8. *"Prove passwords are unreadable."* → Show DB: only bcrypt hashes;
   `SELECT password FROM "User"` → `$2b$12$…`.
9. *"What if I unsubscribe then reconfigure?"* → 403, enforced in
   PATCH (found during audit).
10. *"What if the GitHub token expires?"* → Public reads fall back to
    anonymous; only security alerts fail (re-link needed).
11. *"Why SSE and not WebSocket?"* → One-way push + native reconnect;
    WebSocket = protocol + hand-rolled reconnect for nothing (ADR 0003).
12. *"Why Next.js on both sides?"* → One language/pipeline, handlers
    moved verbatim at split (ADR 0001/0009).
13. *"Why Postgres over Mongo?"* → Relational data + real constraints
    (unique providerAccountId); migrations; typed client.
14. *"Why JWT if revocation is hard?"* → DB re-check on every request
    (ADR 0002) — demo the admin-disable kill.
15. *"POCs?"* → Throwaway spikes (SSE proxy, fonts, AES-GCM), not
    committed; font failure forced self-hosting (ADR 0007).
16. *"What did each of you know beforehand?"* → Rayann: Next/React/
    Tailwind → UI. Ariel: Prisma/NextAuth/Docker → backend.
17. *"The Spotify widget?"* → Removed in Oct 2026, replaced by YouTube
    (3 widgets). Old notes mentioning Spotify are outdated.
18. *"Secrets in docker-compose.yml?"* → Use the 30-second script (§4).
19. *"No tests?"* → Outdated question: Vitest suite, 136 tests on all
    fetchers (`npx vitest run`, ~4 s). E2E (OAuth, SSE, drag & drop)
    still manual.
20. *"Empty dashboard?"* → Admit: no empty-state message (minor gap).

## 4. The 30-second secrets speech (learn by heart)

*"Good catch — those are real dev-only credentials, and we know it. Three
facts: one, the OAuth apps only allow localhost callbacks, so the leaked
values are useless outside local development. Two, production overrides
them through untracked environment — the committed file is a fresh-clone
convenience, documented as dev-only. Three, real user data is still safe:
passwords are bcrypt hashes, OAuth tokens are AES-GCM encrypted with a
separate key. Rotation and history purge are scheduled right after the
defense."*

## 5. English glossary (say THESE words)

subscription / refresh rate / revoke / deadlock / allowlist / choke point
/ fallback / stateless / revocation check / SSRF guard / typed params /
event stream / sincerely admit a gap (*"honest gap"*).

## 6. Never say

- *"It works on my machine."* → Show curl + about.json instead.
- *"No secrets in git."* → False. Use §4.
- *"14 widgets."* → Outdated: it is **30** (14 services). Old counts
  (7/13) refer to Sept 2026.
- *"Spotify works."* → Removed; YouTube replaced it. Say it first, yourself.
- Reading code aloud → Explain logic, whiteboard the flow.
