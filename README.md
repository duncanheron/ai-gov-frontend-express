# ai-gov-frontend-express

A GOV.UK Design System registration service built with Express.js.

Journey: homepage (start page) -> your details -> check your answers -> confirmation.

## Requirements

- Node.js 24.x (see `.nvmrc`)
- PostgreSQL (for submitted registrations - see `.env.example` for the `DATABASE_URL` shape)
- Docker running - required to run tests (`npm test` starts a real Postgres in a Testcontainers
  container, no manual database setup needed) and optional otherwise, for containerised runs via
  Docker Compose (brings up Postgres for you)

## Local setup

```
nvm use
npm install
cp .env.example .env   # set SESSION_SECRET, and point DATABASE_URL at a reachable Postgres
npm run migrate:up     # applies schema migrations (local only - deploys do this themselves)
npm run dev
```

The app is served at http://localhost:3000.

## Scripts

- `npm run dev` - build assets, then start the app with nodemon (auto-restart on server-side changes)
- `npm start` - build assets, then start the app for production
- `npm test` - build assets, then run the Jest test suite (integration + accessibility). File
  order is randomised each run and the seed is printed at the start; replay a run that failed
  with `JEST_SEQUENCER_SEED=<seed> npm test` - this reproduces the file order, not timing, so it
  won't reliably reproduce a race
- `npm run lint` / `npm run lint:fix` - ESLint
- `npm run format` / `npm run format:check` - Prettier
- `npm run build:assets` - compile GOV.UK Frontend Sass/JS/static assets into `public/`
- `npm run migrate:up` / `npm run migrate:down` - apply/roll back Postgres schema migrations

## Running with Docker Compose

```
cp .env.example .env   # optional - dev-only defaults are used otherwise
docker compose up --build
```

Brings up the app alongside a Postgres container (with a persistent volume) and applies
migrations automatically before starting the dev server. The app is served at
http://localhost:3000. Source files are bind-mounted, so `npm run dev` (nodemon) picks up
server-side changes without rebuilding the image.

The `web` service also loads an optional `.env.local` file if present. For the AI-assisted service
picker (`/choose-service`) to return real recommendations rather than its graceful fallback error
page, make sure an `AI_GATEWAY_API_KEY` or a `vercel env pull`-sourced `VERCEL_OIDC_TOKEN` is
available there.

## Deployment

Vercel deploys `main` to production. Note that pull requests also get Preview deployments, despite
the `git.deploymentEnabled` block in `vercel.json` - that setting is not currently taking effect.

Schema migrations are applied by the build itself: `vercel-build` runs `migrate:deploy` before
compiling assets, so a migration-bearing commit reaches the database before the new code serves
traffic. If a migration fails, the build fails and the previous deployment keeps serving.

Three things worth knowing about that:

- **`migrate:deploy` only migrates when `VERCEL_ENV=production`.** This guard matters because the
  Preview and Production environments currently share one Neon database (same endpoint, same
  `neondb`) - Neon's preview branching is not enabled. Without the guard, opening a PR containing
  a migration would apply it to the production database at preview-build time, before review and
  before merge. If preview branching is ever enabled, the guard can be relaxed so previews migrate
  their own branch, which is what Neon recommends.
- Migrations run against `DATABASE_URL_UNPOOLED` (Neon's direct endpoint), falling back to
  `DATABASE_URL` when it isn't set. `node-pg-migrate` takes a session-level advisory lock so two
  migrations can't race, and Neon's pooled endpoint is PgBouncer in transaction-pooling mode,
  which doesn't reliably preserve session state between statements. The app itself still uses the
  pooled `DATABASE_URL` at runtime.
- A code rollback does not roll back schema. Additive, nullable columns are safe, because the
  older code simply ignores them. Anything destructive - dropping or renaming a column, adding
  `NOT NULL` - needs phasing across two deploys (expand, then contract), since the build applies
  the change after the old code was live and before the new code is.

## Architecture notes

- Views are rendered with Nunjucks, using GOV.UK Frontend's component macros
  (`node_modules/govuk-frontend/dist`).
- Registration answers are held in the session (`express-session`, backed by Postgres via
  `connect-pg-simple`) for the duration of the journey and cleared once a reference number is
  issued. A submitted application is written separately, at the moment the user submits
  (see `src/db/applications.js`).
- Postgres access goes through a single hand-written-SQL data layer (`src/db/pool.js` and
  friends) - no ORM. Schema changes are tracked with `node-pg-migrate` (`migrations/`).
- CSRF protection (`csrf-sync`) and a nonce-based Content-Security-Policy (`helmet`) are applied
  to all routes.
