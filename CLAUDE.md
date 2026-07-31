# Conventions

## What this is

A prototype for exploring AI-assisted service routing on GOV.UK patterns — not a
live service. Nothing here handles real applicants, real money, or real data.

Deliberate deviations, so they don't get "fixed":

- `/applications` has no authentication. It exposes every submission, and that is
  accepted for now — do not add auth without asking.
- No payment is ever taken. The council tax and garden waste journeys exist to
  give the AI service picker more than two options to choose between, so amounts
  are fixed placeholders.
- The GOV.UK crown links to this service's homepage, not `https://www.gov.uk`, so
  a demo never drops the user out.
- Preview and Production deployments share one Neon database; Neon preview
  branching is not enabled. Migrations run only on production builds.

Being a prototype lowers the bar on scope, not on craft. Tests must fail when
behaviour breaks, pages must pass axe, and GOV.UK patterns are followed as
written — the point of a prototype is to learn whether the real thing would work.

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

## Agents & skills

This repo runs on a two-stage pipeline: `spec-planner` turns a request into
Linear tickets (`Backlog`, always — a human moves them to `Todo`); `engineer`
picks up a `Todo` ticket and takes it through branch, code, tests, and PR,
then hands off to the `agent-skills` plugin's `test-engineer`,
`code-reviewer`, and `security-auditor` for verification before merge.

- Definitions: `.claude/agents/spec-planner.md`, `.claude/agents/engineer.md`.
- Repo-specific mechanics (branch naming, PR contents, Linear state
  transitions) live in `.claude/skills/work-ticket/SKILL.md` — treat it as
  the source of truth over anything an agent file says, since it's kept
  current with this repo.
- General engineering practice (TDD, incremental implementation, git
  hygiene, etc.) comes from the `agent-skills` plugin
  (`addyosmani/agent-skills`, enabled as `agent-skills@addy-agent-skills`).
  Don't re-implement what it already provides.
