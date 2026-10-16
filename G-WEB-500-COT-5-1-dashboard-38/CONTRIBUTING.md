# Contributing to Hubly

Short guide for working on this repo (Epitech PGE3, G-WEB-500). Two apps, one
Docker Compose stack: `backend/` (API, Prisma, auth, widget timer — internal
only) and `frontend/` (pages, UI — the only container published on port 8080).

## Quick start

```bash
docker compose build   # first run: compiles backend/frontend images
docker compose up      # next runs (images already built)
```

- App: http://localhost:8080 — Mailpit inbox: http://localhost:8025
- Prisma migrations run automatically on container start; nothing to run by
  hand on a fresh database.
- Never commit secrets: OAuth keys, API keys and SMTP credentials go in `.env`
  (see `.env.example`). `client_secret_*.json` files from Google are ignored.

## Workflow

1. Work on a branch named `feat/<topic>`, `fix/<topic>`, `docs/<topic>`,
   `chore/<topic>` or `refactor/<topic>`, opened from `main` (or `develop`
   when it exists).
2. Commit with [Conventional Commits](https://www.conventionalcommits.org/):
   `feat(weather): …`, `fix(auth): …`, `docs(readme): …`, `test(backend): …`,
   `chore(…)`, `refactor(…)`, `style(…)` — imperative, lowercase scope.
3. Open a pull request, get it reviewed, then merge.

## Backend rules

- Every widget fetcher throws typed errors from
  `backend/src/server/widgets/errors.ts`: `WidgetValidationError` (bad user
  params, fixable in the UI), `WidgetRateLimitError` (quotas), anything else as
  `WidgetFetchError`. Never leak upstream messages raw.
- Any fetcher calling a user-provided URL must go through `safeFetch`
  (`backend/src/server/widgets/ssrf-guard.ts`), never plain `fetch`.
- New service? Add it to the catalog, set its minimum refresh interval in
  `refresh-rates.ts`, document it in `README.md`, and cover its fetchers with
  vitest tests in `backend/tests/services/`.
- Run the tests before pushing: `cd backend && npx vitest run`.

## Frontend rules

- Pages go through the internal proxy (`/api/*` → backend); the browser never
  talks to the backend container directly.
- Keep components small: extract previews, dialogs and hooks into their own
  files instead of growing a component past ~500 lines.
- No emojis in the UI unless the design calls for it.
