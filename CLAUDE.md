# Conventions

## Comments

Prefer readable code over commentary. A comment earns its place only when it says
something the code cannot: a non-obvious contract, a deliberate divergence, or a
constraint that would otherwise be refactored away.

Do not write comments that restate the code, narrate history (that belongs in the
Linear ticket or PR), or justify a decision at paragraph length. If a block of
comment is longer than the code it describes, cut it.

```js
// Good - a contract you cannot infer from the code:
// FIFO, one response per call. Push an Error to make that call throw.

// Bad - restates the code, and the ticket already records why:
// Counts user turns and reports whether the round cap requires the model to
// conclude now. Pulled out into its own function purely so tests can exercise
// the round-counting mechanics directly, because CBLT-88 showed that ...
```

## Code

- Plain functions. No classes, no ORM, hand-written SQL in `src/db/`.
- Validators return `{ values, errors, fieldErrors, isValid }` and never throw.
  Mirror `src/validation/applyValidation.js`.
- Read request-body fields through `toStr` so a duplicated parameter can't throw.
- Compute display values in the route into a view model, not in templates.
- Render user input with Nunjucks `text:`, never `html:`.
- All AI-provider code stays in `src/services/routeApplicationFlow.js`.
- UK English in user-facing copy.

## Tests

Jest + Supertest, pg-mem in test env. A test must fail if the behaviour it covers
breaks — check by reverting the code and watching it go red. A test that passes
either way is worse than none, because it reads as coverage.

## Process

- Work is tracked in Linear (team Cobalt, `CBLT`). Docs and specs live there, not
  in markdown files in this repo.
- No code without an approved `Todo` issue. Moving `Backlog` → `Todo` is a
  human-only action.
- `main` is branch-protected; everything goes through a PR.
- Migrations run in the Vercel build on production deploys — see the README.
  `npm run migrate:up` is for local development only.
