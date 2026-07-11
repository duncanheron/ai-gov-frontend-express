---
name: work-ticket
description: Pick up or create a Linear ticket for this repo, implement it on its own branch, and open a PR linked back to the ticket. Use whenever starting work on a specific, ticket-sized piece of functionality here.
---

This repo tracks work as Linear issues in the **ai-gov-frontend-express** project
(team: **Tpximpact**, key `TPX`). The native GitHub<->Linear integration is
installed for this repo, so branch/PR linking and most status transitions
happen automatically (branch named after an issue auto-attaches to it; PRs
referencing an issue link automatically; merging typically auto-completes the
issue). Treat that as the primary mechanism, but verify it actually fired
(check the issue's status/attachments after pushing/merging) and fall back to
the Linear MCP tools (`save_issue`, `save_comment`) to fix it by hand if it
didn't — the automation has been inconsistent before (some issues transitioned
automatically, others needed a manual nudge).

## No implementation without an approved, `Todo` issue

Never write code, branch, or otherwise start implementation for work that
doesn't have a Linear issue in **`Todo`** state. This is a hard rule, not a
suggestion.

- Moving an issue from `Backlog` to `Todo` is a **human-only action** — it is
  the review/approval step. Claude must never perform that transition itself,
  no matter how confident it is the scope is right or how small the change
  looks.
- An issue Claude creates always lands in `Backlog` and stays there until the
  user moves it. If the user asks to fast-track something, Claude still may
  not move it to `Todo` on their behalf — say so and wait for them to do it.
- If asked to build or fix something with no matching issue: stop, draft the
  issue (see the detail bar below), create it in Linear (`Backlog`), share its
  content and link, and wait. Do not start implementation in the same turn.
- Before picking up any issue, confirm its state really is `Todo` (via
  `list_issues`/`get_issue`) — don't rely on a stale earlier check.

### What counts as "solid detail" in an issue

A ticket is ready for a human to move to `Todo` when its description covers:

- **Problem / context** — why this is needed, not just what to build.
- **Scope** — what's in and explicitly what's out.
- **Acceptance criteria** — a short checklist of what "done" looks like.
- **Technical notes** — anything Claude would otherwise have to re-derive or
  ask about mid-implementation (files/patterns to reuse, constraints).

A one-line title with no description is not enough, even for small changes.

## Workflow

1. **Get a ticket.**
   - Picking up existing work: use `mcp__claude_ai_Linear__list_issues`
     (project: `ai-gov-frontend-express`, `state: "Todo"`) or ask the user
     which one. Issues still in `Backlog` are not eligible for pickup.
   - New work: draft the issue to the detail bar above, create it with
     `mcp__claude_ai_Linear__save_issue` (team `Tpximpact`, project
     `ai-gov-frontend-express`) — it lands in `Backlog` — then stop and wait
     for the user to move it to `Todo` (see the rule above). Keep tickets
     small — one reviewable PR's worth of work. Only group multiple
     sub-issues into a single PR when they are so tightly coupled that
     splitting them would produce artificial, broken intermediate diffs
     (e.g. several changes to the same file that only make sense together) —
     the default is one ticket, one branch, one PR.

2. **Move it to In Progress** via `save_issue` (`state: "In Progress"`) before
   writing any code. Only do this for an issue already in `Todo`.

3. **Branch.** Use the issue's Linear-suggested `gitBranchName` (returned by
   `save_issue`/`get_issue`) rather than inventing a name, so the branch name
   stays traceable to the ticket. Branch from an up-to-date `main`.

4. **Implement**, running lint/tests/build locally (see this repo's own
   `package.json` scripts) before moving on.

5. **Commit and push the branch**, then open a PR with `gh pr create` (ready
   for review, not draft, unless told otherwise). The PR body must include:
   - The Linear issue key(s) and URL(s) it covers.
   - A one-line summary of what changed and why.
   - A test plan / how it was verified.

6. **Stop for review.** Do not merge the PR yourself unless explicitly asked —
   hand back to the user once it's open.

7. **On merge**, check whether the GitHub integration already moved the
   issue(s) to `Done` and attached the PR. If it did, nothing to do. If not
   (or only partially — e.g. a parent moved but a sub-issue didn't), fix it
   manually: `save_issue` (`state: "Done"`) and `save_comment` linking the
   merged PR.

## Notes

- Team's issue states: `Backlog`, `Todo`, `In Progress`, `Done`, `Canceled`,
  `Duplicate` — there is no "In Review" state, so a ticket stays `In Progress`
  for the whole PR-open/review period.
- `main` has GitHub branch protection enabled and rejects direct pushes — all
  changes, with no exceptions, go through a PR.
