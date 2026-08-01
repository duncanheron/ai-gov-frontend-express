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
- Two design systems, split by audience. `/applications` is a caseworker view and
  may use MoJ Frontend components; the citizen journeys (`/`, `/apply`,
  `/apply-housing`, `/apply-housing-benefit`, `/choose-service`,
  `/pay-council-tax`, `/pay-garden-waste`) are GOV.UK only. MoJ components are
  built on GOV.UK ones, so GOV.UK components remain available everywhere — it is
  reaching for an MoJ component on a citizen page that is wrong.

## Tests

Jest + Supertest, against a real Postgres started by Testcontainers (requires Docker
running locally; CI already has it). A test must fail if the behaviour it covers
breaks — check by reverting the code and watching it go red. A test that passes
either way is worse than none, because it reads as coverage.

Assert on the element, not the page. `expect(response.text).toContain('href="/x")`
passes if _any_ element on the page has that href — the layout alone carries 14
of them. Select the element (JSDOM is available), then assert on its attributes
and text. Whole-page matching is how five tests in this repo came to pass while
the behaviour they named was broken.

Assert on behaviour, not mechanism. Rows returned, elements rendered, status
codes. If a test needs the SQL text, the bound parameters, a monkey-patched
module, or an export that exists only for it, then it cannot observe the
behaviour it claims to cover — fix the setup rather than working around it. A
test that reimplements the logic it is testing proves only that it agrees with
itself: CBLT-129 asserted `params` equalled a hardcoded escaped string, so
changing the escape character would have kept the suite green while the filter
broke in production.

Test our software, not our dependencies. Postgres, Express and govuk-frontend
behaving as documented is not ours to assert. Test our use of them — a test that
proves `LIKE ... ESCAPE` works is testing Postgres, while one that proves a
search for `%` returns only the applicant whose name contains `%` tests our
query and demonstrates the same thing for free.

## Process

- Work is tracked in Linear (team Cobalt, `CBLT`). Docs and specs live there, not
  in markdown files in this repo.
- Set `project: "ai-gov-frontend-express"` on every issue. Team Cobalt serves
  other products too, and a project-less issue is invisible in the project view.
- Describe attack payloads in prose, not literally — a `<script>` tag or a
  `DROP TABLE` string in an issue body gets the write blocked by Cloudflare.
- No code without an approved `Todo` issue. Moving `Backlog` → `Todo` is a
  human-only action.
- Don't work or restate a parent/epic issue. Leave it where it is, work the
  sub-issues one at a time, and move the parent to `Done` once all are finished.
- `main` is branch-protected; everything goes through a PR.
- Migrations run in the Vercel build on production deploys — see the README.
  `npm run migrate:up` is for local development only.

## Agents & skills

This repo runs on a two-stage pipeline: `spec-planner` turns a request into
Linear tickets (`Backlog`, always — a human moves them to `Todo`); `engineer`
picks up a `Todo` ticket and takes it through branch, code, tests, and PR.
Verification by the `agent-skills` plugin's `test-engineer`, `code-reviewer`
and `security-auditor` happens after that, triggered by the caller rather
than by `engineer` itself.

- Definitions: `.claude/agents/spec-planner.md`, `.claude/agents/engineer.md`.
- Repo-specific mechanics (branch naming, PR contents, Linear state
  transitions) live in `.claude/skills/work-ticket/SKILL.md` — treat it as
  the source of truth over anything an agent file says, since it's kept
  current with this repo.
- General engineering practice (TDD, incremental implementation, git
  hygiene, etc.) comes from the `agent-skills` plugin
  (`addyosmani/agent-skills`, enabled as `agent-skills@addy-agent-skills`).
  Don't re-implement what it already provides.
- `test-engineer`, `code-reviewer`, and `security-auditor` are independent
  personas — `engineer` never invokes them itself (it has no Agent/Task tool,
  and personas calling personas is a hard Claude Code platform constraint,
  not just a convention). Trigger verification from the top-level session when
  the change warrants it — the caller's judgement, scaled to the change, not a
  fixed gate on every PR. When you do, run them in parallel in one turn
  (mirroring the plugin's `/ship` command), giving each only the PR diff and the
  ticket's acceptance criteria — not `engineer`'s own summary or test-plan
  narrative — so each forms an independent judgement instead of inheriting the
  implementer's framing.
