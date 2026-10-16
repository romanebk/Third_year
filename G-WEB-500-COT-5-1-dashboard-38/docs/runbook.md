# Hubly — Runbook

How to install, run, verify, stop and troubleshoot the project.
Two supported ways to run: **Docker Compose** (production-like, required at
the defense) and **local dev** (faster iteration, no rebuild).

## 1. Prerequisites

- Docker Engine + Docker Compose v2 (`docker compose version`)
- Node.js 22+ and npm (local dev only)
- Ports free: **8080** (docker frontend), or **3001/3002** (local dev).
  The stack also needs **5433** (db), **8025** (mailpit UI) and **1025** (SMTP).

## 2. Service map

| Service   | Docker              | Local dev            | Published on host      |
|-----------|---------------------|----------------------|------------------------|
| frontend  | `frontend:3000`     | `npm run dev` `:3001`| `8080` (docker) / `3001` (dev) |
| backend   | `backend:3002`      | `npm run dev` `:3002`| never (docker) / `3002` (dev)  |
| db        | `db:5432`           | same container       | `5433`                 |
| mailpit   | SMTP `:1025`, UI `:8025` | same container  | `1025`, `8025`         |

The browser only ever talks to the **frontend**. The frontend proxies
`/api/*` and `/about.json` to the backend internally
(`BACKEND_INTERNAL_URL`: `http://backend:3002` in Docker,
`http://localhost:3002` in local dev via `frontend/.env`).

## 3. Launch with Docker (defense mode)

```bash
git clone <repo>
cd G-WEB-500-COT-5-1-dashboard-38

docker compose up --build   # first run (builds backend/frontend images)
docker compose up -d        # next runs
```

- The app is at **http://localhost:8080**.
- Prisma migrations run automatically at backend startup — nothing to do
  by hand, even on a fresh database.
- All env vars have working dev defaults in `docker-compose.yml`
  (`docker compose up` works with zero setup). Override for production
  via real environment (never commit secrets — see §7).

Verify:

```bash
curl -s -o /dev/null -w "root:%{http_code}\n" http://localhost:8080/
curl -s http://localhost:8080/about.json | head -c 300; echo
docker compose ps            # all services Up (db healthy)
docker compose logs --tail=20 backend
```

## 4. Launch in local dev (without Docker)

```bash
docker compose up -d db mailpit   # DB (localhost:5433) + mailbox (UI :8025, SMTP :1025)

cd backend && npm install && npx prisma migrate deploy && npm run dev   # :3002
cd frontend && npm install && npm run dev                               # :3001
```

- Browse **http://localhost:3001**.
- `backend/.env` must point at the host-mapped services:
  `DATABASE_URL="postgresql://dashboard:dashboard@localhost:5433/…"`,
  `NEXTAUTH_URL="http://localhost:3001"`. For email, either point
  `SMTP_HOST` at Mailpit (`localhost`, mails land in `:8025`) or at a real
  provider (mails go to the real inbox, nothing in `:8025`).
- After a schema change, regenerate the client: `npx prisma generate`
  (otherwise `tsc` fails with missing fields, e.g. `rssInterests`).
- First admin account (no UI self-promotion by design):

```bash
# docker mode:
docker compose exec backend npm run admin:promote -- you@example.com
# local dev (from backend/):
npm run admin:promote -- you@example.com
```

## 5. Sign-up flow (both modes)

1. Register at `/register` → confirmation email sent.
2. Open **http://localhost:8025** (Mailpit) and click the link
   (no external email provider needed).
3. Clicking the link confirms **and** starts the session (lands on
   `/dashboard`, no second sign-in).
4. No mail in Mailpit? Check server logs:
   `docker compose logs backend | grep mailer`
   (without SMTP, the link is printed to logs as fallback).

## 6. Stop / restart

```bash
docker compose stop          # stop, keep containers + data
docker compose up -d         # start again
docker compose down          # remove containers (named volume postgres-data keeps the DB)
docker compose down -v       # ⚠️ also deletes the database
```

Local dev servers run in the foreground: stop with `Ctrl+C`.
Stale process holding a port:

```bash
ss -tlnp | grep -E ':3001|:3002|:8080'
kill <pid>   # your own processes only
```

## 7. Secrets — rules

- Real secrets live **only** in `backend/.env` / `frontend/.env`
  (gitignored, never committed) or as host environment in production.
- `docker-compose.yml` ships dev defaults (including dev-only OAuth
  credentials with `localhost` callbacks) so a fresh clone runs with zero
  setup. They are documented as dev-only: **change them in production**.
- Verify nothing sensitive ever reached git before a defense:

```bash
git check-ignore -v backend/.env frontend/.env   # must be ignored
git log --all --oneline -- backend/.env frontend/.env  # must be empty
```

## 8. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `failed to bind host port 0.0.0.0:8080` | Another app on 8080 (e.g. `open-webui` runs in host network mode, outside Compose) | `docker stop open-webui` — if it comes back (restart policy `always`), run `docker update --restart=no open-webui` first, then stop it |
| `docker stop/kill: permission denied` (snap Docker) | Daemon confinement issue | `sudo snap restart docker` (or `sudo systemctl restart docker`), then `up` again |
| Backend `P1001: Can't reach database at db:5432`, restart loop | DB not ready / broken container network after daemon issue | `docker compose ps` (db must be `healthy`); restart daemon (§above) then `docker compose up -d --force-recreate backend` |
| Container starts with **no published ports** | Stale network sandbox from a failed start | `docker compose up -d --force-recreate <service>` |
| `Removing <container> … permission denied`, `Error while Stopping` (even with `sudo`) | Wedged container: daemon-side runtime state corrupted, usually after a failed stop or bridge-network corruption | Daemon restart (see clean-slate sequence below), then remove orphans, then `up -d` again — `rm -f` alone cannot kill it |
| Local dev `EADDRINUSE :::3001/3002` | Stale `next dev` process | Find and `kill` it (see §6) |
| Widget shows error / `refresh failed` | Check params first: GitHub repo must be `owner/repo`, RSS `feed_url` must be reachable `http(s)://` | Test the fetcher directly: `curl "http://localhost:3002/api/widgets/rss/rss_article_list?feed_url=<url>&max_items=2"` (auth:none services need no session) |
| GitHub widget 401/expired token | Linked OAuth token expired | Re-link the account; public reads fall back to anonymous, `security_alerts` needs a valid token |
| No confirmation email | Normal if SMTP down — check Mailpit `:8025`, then backend logs `grep mailer` | Point `SMTP_HOST` at Mailpit (`mailpit` in Docker, `localhost` in dev) |
| GitHub/Google OAuth `redirect_uri_mismatch` | Callback URL not registered for the port you use | Register `http://localhost:8080/api/auth/callback/<github|google>` (docker) or `http://localhost:3001/...` (dev) in the provider console |
| `tsc` error `Property 'X' does not exist` after pull | Stale generated Prisma client | `npx prisma generate` in `backend/`, then `npx prisma migrate deploy` if a migration is pending |
| Blank page right after `up` | Frontend still booting (`next start` needs ~10 s) | Wait, then hard-refresh (`Ctrl+Shift+R`) to drop a cached error page |

## 9. Clean-slate reset (when nothing else works)

Symptoms: `stop`/`kill` refused, wedged containers, backend `P1001` loop,
`open-webui` (or anything else) squatting port 8080. Root cause is always
daemon-side — fix it daemon-side:

```bash
sudo snap restart docker
# (non-snap install: sudo systemctl restart docker)

cd G-WEB-500-COT-5-1-dashboard-38
docker ps -a   # spot orphans from previous workarounds (if any)
docker rm -f <orphan> 2>/dev/null
docker compose up --build -d
sleep 30 && curl -s -o /dev/null -w "8080 HTTP:%{http_code}\n" http://localhost:8080/
```

The restart also clears a corrupted bridge network (container→container
traffic blackholed while published ports still answer) and frees port 8080
if the squatter had `restart: always` (apply `docker update --restart=no`
to it first if it keeps coming back).

Note: if plain `docker` commands answer `permission denied` on the socket
itself (not from the daemon), prefix with `sudo` or add your user to the
`docker` group — unrelated to the daemon bugs above.

## 10. Quick health checklist (before a demo/defense)

```bash
docker compose ps                                  # 4 services Up, db healthy
curl -s -o /dev/null -w "8080:%{http_code}\n" http://localhost:8080/
curl -s http://localhost:8080/about.json | python3 -c "import json,sys; d=json.load(sys.stdin); print(len(d['server']['services']),'services')"
docker compose logs --tail=5 backend | grep -i error || echo "no backend errors"
```

Come with the project **already running** — build takes several minutes
(`npm install` inside images), never build live in front of the jury.
