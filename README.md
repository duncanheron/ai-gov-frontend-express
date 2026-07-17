# ai-gov-frontend-express

A GOV.UK Design System registration service built with Express.js.

Journey: homepage (start page) -> your details -> check your answers -> confirmation.

## Requirements

- Node.js 24.x (see `.nvmrc`)
- PostgreSQL (for submitted registrations - see `.env.example` for the `DATABASE_URL` shape)
- Docker + Docker Compose (optional, for containerised runs - brings up Postgres for you)

## Local setup

```
nvm use
npm install
cp .env.example .env   # set SESSION_SECRET, and point DATABASE_URL at a reachable Postgres
npm run migrate:up     # applies schema migrations
npm run dev
```

The app is served at http://localhost:3000.

## Scripts

- `npm run dev` - build assets, then start the app with nodemon (auto-restart on server-side changes)
- `npm start` - build assets, then start the app for production
- `npm test` - build assets, then run the Jest test suite (integration + accessibility)
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

## Architecture notes

- Views are rendered with Nunjucks, using GOV.UK Frontend's component macros
  (`node_modules/govuk-frontend/dist`).
- Registration answers are held in the session (`express-session`, in-memory store) for the
  duration of the journey and cleared once a reference number is issued. Sessions are never
  persisted to Postgres - only a submitted registration is, at the moment the user submits
  (see `src/db/registrations.js`).
- Postgres access goes through a single hand-written-SQL data layer (`src/db/pool.js` and
  friends) - no ORM. Schema changes are tracked with `node-pg-migrate` (`migrations/`).
- CSRF protection (`csrf-sync`) and a nonce-based Content-Security-Policy (`helmet`) are applied
  to all routes.
