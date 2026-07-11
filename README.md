# ai-gov-frontend-express

A GOV.UK Design System registration service built with Express.js.

Journey: homepage (start page) -> your details -> check your answers -> confirmation.

## Requirements

- Node.js 24.x (see `.nvmrc`)
- Docker + Docker Compose (optional, for containerised runs)

## Local setup

```
nvm use
npm install
cp .env.example .env   # then set SESSION_SECRET to a long random string
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

## Running with Docker Compose

```
cp .env.example .env   # optional - a dev-only default SESSION_SECRET is used otherwise
docker compose up --build
```

The app is served at http://localhost:3000. Source files are bind-mounted, so `npm run dev`
(nodemon) picks up server-side changes without rebuilding the image.

## Architecture notes

- Views are rendered with Nunjucks, using GOV.UK Frontend's component macros
  (`node_modules/govuk-frontend/dist`).
- Registration answers are held in the session (`express-session`, in-memory store) for the
  duration of the journey and cleared once a reference number is issued - there is no database.
- CSRF protection (`csrf-sync`) and a nonce-based Content-Security-Policy (`helmet`) are applied
  to all routes.
