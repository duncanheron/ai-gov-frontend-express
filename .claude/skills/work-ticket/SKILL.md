---
name: work-ticket
description: Pick up or create a Linear ticket for this repo, implement it on its own branch, and open a PR linked back to the ticket. Use whenever starting work on a specific, ticket-sized piece of functionality here.
---

This repo tracks work as Linear issues in the **ai-gov-frontend-express** project
(team: **Tpximpact**, key `TPX`). There is no native GitHub<->Linear integration
installed, so status changes and PR linking are done explicitly through the
Linear MCP tools rather than relying on "Closes TPX-123" auto-detection.

## Workflow

1. **Get a ticket.**
   - Picking up existing work: use `mcp__claude_ai_Linear__list_issues` (project:
     `ai-gov-frontend-express`, state: Todo/Backlog) or ask the user which one.
   - New work: agree the scope with the user first, then create it with
     `mcp__claude_ai_Linear__save_issue` (team `Tpximpact`, project
     `ai-gov-frontend-express`). Keep tickets small — one reviewable PR's worth of
     work. Only group multiple sub-issues into a single PR when they are so
     tightly coupled that splitting them would produce artificial, broken
     intermediate diffs (e.g. several changes to the same file that only make
     sense together) — the default is one ticket, one branch, one PR.

2. **Move it to In Progress** via `save_issue` (`state: "In Progress"`) before
   writing any code.

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

7. **On merge**, move the Linear issue(s) to `Done` via `save_issue` and add a
   comment (`save_comment`) linking the merged PR. If a parent issue's
   sub-issues are all Done, move the parent to Done too.

## Notes

- Team's issue states: `Backlog`, `Todo`, `In Progress`, `Done`, `Canceled`,
  `Duplicate` — there is no "In Review" state, so a ticket stays `In Progress`
  for the whole PR-open/review period.
- `main` requires PRs — don't push directly to it except for genuine one-off
  repo bootstrapping (e.g. the very first commit of an empty repo).
