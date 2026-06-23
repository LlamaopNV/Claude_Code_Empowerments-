---
name: jira-ticket
description: Use when starting work on a Jira ticket — fetches the ticket via Atlassian MCP, runs a full end-to-end workflow (brainstorm, plan, branch, TDD, audit, review, verify, commit, handoff), pausing at design, plan, and push gates. Takes a ticket ID like PROJ-141. Triggers on "complete this ticket", "let's start PROJ-XXX", "work on PROJ-XXX", or the slash command.
---

# Jira Ticket

Guided end-to-end pilot for completing a single Jira ticket. This skill orchestrates other skills — it does not re-implement what they do. The pilot's job is to keep the workflow consistent, encode non-negotiable conventions, and respect the natural user-approval gates the underlying skills already have.

## Prerequisites

This skill requires:

- **Atlassian MCP** — for fetching Jira tickets. Without it, Phase 2 (Discover) cannot run. If the MCP is not connected, refuse with a message explaining how to set it up.
- **superpowers plugin** — for brainstorming, planning, TDD, verification, and other workflow skills.
- **symmetric-audit skill** — for Phase 7.
- **iterative-review-fix skill** — for Phase 8.
- **conventional-commits skill** — for Phase 11.

## Inputs

Invoked as `/jira-ticket <ticket-id>` (e.g. `/jira-ticket PROJ-141`) or via natural-language equivalents ("complete PROJ-141", "let's start PROJ-141").

The ticket ID must match a Jira issue key pattern: `[A-Z]+-\d+`.

Optional flags after the ticket ID:

- `restart` — archive any existing spec/plan for this ticket (rename `<filename>.archived`, do NOT delete) and start fresh from Phase 1.
- `skip-smoke` — skip Phase 9 even if the `ui` tag fires in Phase 2 classification.

## Announce at start

Print exactly: `Using jira-ticket to complete <ticket-id>.`

## Configuration

This skill adapts to your project's conventions. It reads from CLAUDE.md (or equivalent project instructions) for:

- **Branch naming convention** — defaults to `<user>/<type>/<ticket-id>-<slug>` if not specified.
- **Base branch** — defaults to `main`. Override in CLAUDE.md if your project uses `develop`, `staging`, etc.
- **PR tool** — defaults to `gh pr create`. Override if using Bitbucket (`bkt`), GitLab (`glab`), etc.
- **Build/test/lint commands** — reads from project scripts (e.g. `package.json`, `Makefile`, `Cargo.toml`).
- **PR target branch** — defaults to the base branch. Override in CLAUDE.md if PRs target a different branch.

## Resume detection (run BEFORE Phase 1)

Before doing anything else, observe the workspace and decide where to enter the workflow.

### Inspect, in this order

1. **Current branch** — `git rev-parse --abbrev-ref HEAD`. If it matches `*/<type>/<ticket-id>-*`, you have a ticket ID candidate; cross-check against the invocation arg.
2. **Spec file** — Glob `docs/superpowers/specs/*<ticket-id-lower>*.md` (case-insensitive).
3. **Plan file** — Glob `docs/superpowers/plans/*<ticket-id-lower>*.md`.
4. **Commits ahead of base** — `git log <base-branch>..HEAD --oneline`.
5. **Working tree** — `git status --porcelain`. Non-empty = dirty.

### Decision table

| State observed | Action |
| --- | --- |
| Working tree dirty | Refuse. Ask user to commit or stash. Do NOT silently stash for them. |
| On base branch, no spec, no plan, no feature branch | Proceed to Phase 1 (fresh start) |
| On base branch, spec exists, no plan | Skip to Phase 4; reuse the spec |
| On base branch, spec + plan exist | Skip to Phase 5; reuse both |
| On feature branch for this ticket, 0 commits ahead | Skip to Phase 6; verify spec + plan exist first, fail loudly if missing |
| On feature branch for this ticket, commits exist | Ask the user: audit / review / replan? |
| On feature branch for a DIFFERENT ticket | Refuse. Surface the conflict; user decides whether to switch |
| Branch for this ticket already exists locally | Refuse. Suggest `restart` flag or manual cleanup |

If `restart` was passed, archive any existing spec/plan by renaming with `.archived` suffix (never delete), then proceed at Phase 1.

### What the user sees

Print the resume decision, e.g.:

```
Detected existing work for PROJ-141:
  + Spec   docs/superpowers/specs/2026-05-19-proj-141-add-build-year-design.md
  + Plan   docs/superpowers/plans/2026-05-19-proj-141-add-build-year-plan.md
  + Branch user/feat/PROJ-141-add-build-year-field (3 commits ahead)

Resuming at: Phase 7 (Symmetric Audit). Continue? [yes / restart / cancel]
```

## Phase 1 — Setup

**Goal:** Known-good starting state on the base branch with the latest changes pulled and a clean working tree.

1. Run `git status --porcelain` — must be empty. If not, refuse.
2. Run `git rev-parse --abbrev-ref HEAD`. Should already be the base branch per resume rules; if not, `git checkout <base-branch>`.
3. Run `git pull --ff-only`. Handle each failure mode distinctly:
   - **Non-fast-forward**: Refuse and ask. Do NOT force or rebase.
   - **Transport failure** (SSH `Permission denied`, network unreachable): compare `git rev-parse HEAD` against `git rev-parse origin/<base-branch>`. If they match, proceed with a warning. If they differ, ask the user to fetch manually.
   - **Other** (corrupted ref, lockfile, unexpected exit): Pause, surface the exact stderr, do not retry.
4. Verify the ticket ID matches a valid Jira key pattern.

Never bypass with `--force`, `--no-verify`, or `git reset --hard` to "fix" a problem in this phase.

## Phase 2 — Discover

**Goal:** Fetch the Jira ticket + comments + linked issues. Classify what kind of work this is.

### MCP calls (in order)

1. `mcp__claude_ai_Atlassian__getJiraIssue` with the ticket key. Capture: summary, description, status, labels, components, issue type, fix versions, reporter, assignee, custom fields, **and comments** (at `fields.comment.comments`).
2. Comments are normally inline in (1). **Only make a second call if the `comment` field is missing entirely**, not when it's present-but-empty. When comments exist, they often contain the real requirements, so always read them.
3. `mcp__claude_ai_Atlassian__getJiraIssueRemoteIssueLinks` — Confluence pages, external URLs, related issue links.
4. Regex-scan description + comments for ticket references (e.g. `PROJ-\d+`). For each new key, call `getJiraIssue` for summary only.

Do NOT write the fetched bundle to a file. Keep it in working memory only. Jira is the source of truth; cached dumps go stale.

### Classification heuristics

Scan combined ticket text + linked summaries. Apply each tag below if any of its triggers match (case-insensitive). Multiple tags can fire.

| Tag | Triggers (any match — case-insensitive) |
| --- | --- |
| `ui` | form, button, dialog, modal, input, picker, select, tab, page, route, layout, mobile, responsive, dashboard, component, styling, UI, design, CSS |
| `schema` | column, table, migration, FK, index, schema, model, "save X" / "store X" / "persist X" implying durable storage |
| `api` | procedure, router, mutation, query, endpoint, auth-gated, "fetch X" / "load X" from server, request, response, REST, GraphQL, RPC |
| `auth` | session, login, signup, password, role, permission, sign-in, sign-up, RBAC, OAuth |
| `infra` | CI, CD, pipeline, build, deploy, Docker, config, package manager, workspace |
| `docs` | Jira issue type=Documentation OR only `.md` files referenced |
| `bug` | Jira issue type=Bug OR text contains "fix" / "broken" / "regression" / "doesn't work" / "crash" / "error" |

These tags are for reporting and scope estimation. **They do NOT by themselves load technical skills.** Technical skills load per-task in Phase 6, based on the files each task actually touches — file paths don't lie.

### Mandatory baseline skills (loaded for every ticket)

- `superpowers:brainstorming`
- `superpowers:writing-plans`
- `superpowers:test-driven-development`
- `symmetric-audit`
- `iterative-review-fix`
- `superpowers:verification-before-completion`
- `conventional-commits`

When the `bug` tag fires, also load `superpowers:systematic-debugging`.

### Soft checkpoint after classification

Print a one-screen summary then proceed:

```
Ticket:   PROJ-141 — Add build year field
Type:     Story . Priority: Medium . Status: In Progress
Parent:   PROJ-12 (Epic) . Labels: backend, ui

Classification tags:    schema + ui
Acceptance criteria:    3
Open questions in comments: 1 ("Should this be required or optional?")
Related ticket references: PROJ-110

Pre-brainstorming concerns:
  - "Should this be required or optional?" — unanswered question in comments
  - No range constraint stated — likely needs decision

Proceeding to design phase...
```

This is NOT a gate — the skill proceeds unless interrupted.

## Phase 3 — Design

**Goal:** Produce a design spec via brainstorming. **GATE 1.**

1. Invoke `superpowers:brainstorming` via the Skill tool. Brainstorming has its own user-approval flow — do NOT add a redundant gate.
2. Hand brainstorming: the fetched ticket bundle (summary, description, comments, linked tickets), the classification tags, and the acceptance criteria.
3. Brainstorming will ask its own clarifying questions, propose approaches, write the spec, and request user approval. Do not bypass any of that.
4. Spec file location: `docs/superpowers/specs/YYYY-MM-DD-<ticket-id-lower>-<slug>-design.md`.
5. After spec approval, proceed to Phase 4.

## Phase 4 — Plan

**Goal:** Produce an implementation plan via writing-plans. **GATE 2.**

1. Invoke `superpowers:writing-plans` via the Skill tool, handing it the approved spec from Phase 3.
2. Writing-plans has its own approval flow. Respect it.
3. Plan file location: `docs/superpowers/plans/YYYY-MM-DD-<ticket-id-lower>-<slug>-plan.md`.
4. After plan approval, count parallel-safe tasks. If >=2, mark `superpowers:subagent-driven-development` as the implementation driver. Otherwise use `superpowers:executing-plans`.
5. Proceed to Phase 5.

If the plan estimate exceeds ~1 day total, OR has >10 tasks, OR touches >6 packages/modules, pause and propose decomposition before proceeding.

## Phase 5 — Branch

**Goal:** Create the feature branch from the base branch.

### Branch name format

Default: `<user>/<type>/<ticket-id>-<slug>`

If the project's CLAUDE.md specifies a different convention, use that instead. The branch naming convention is project-specific — always check CLAUDE.md first.

### `<type>` derivation

| Signal | Type |
| --- | --- |
| Jira issue type = Bug | `fix` |
| Jira issue type = Documentation | `docs` |
| Text says "refactor" / "cleanup" with no behaviour change | `refactor` |
| Test-only changes | `test` |
| Labels include CI / build / dependency tags | `chore` |
| Anything else (default) | `feat` |

### `<slug>` derivation

1. Start with the Jira summary.
2. Strip leading ticket-prefix or bracket prefixes.
3. Lowercase everything.
4. Replace any non-alphanumeric character with `-`.
5. Collapse `--+` to single `-`.
6. Trim leading / trailing `-`.
7. Cap at 40 characters. Cut at the last `-` before 40 to avoid mid-word splits.

### Steps

1. Compute the branch name. Print it before creating.
2. Verify `git rev-parse --verify <branch>` returns non-zero (no collision).
3. Create and check out: `git checkout -b <branch> <base-branch>`.
4. Confirm `git rev-parse --abbrev-ref HEAD` matches the computed name.

## Phase 6 — Implement

**Goal:** Execute the approved plan task by task, TDD by default.

### Driver selection (from Phase 4)

- >=2 parallel-safe tasks -> `superpowers:subagent-driven-development`
- Otherwise -> `superpowers:executing-plans`

### Per-task discipline

For each plan task:

1. **Load relevant skills** based on the files the task touches. If the project's CLAUDE.md has a skills-by-task-type mapping, follow it. Otherwise load whatever domain-specific skills are available and relevant (form builders, component libraries, database best practices, etc.).
2. Invoke `superpowers:test-driven-development`. Follow red -> green -> refactor strictly. Override TDD ONLY if the user has explicitly said so for this ticket.
3. After the task is green, note progress.
4. **Do not commit per-task here.** Commits are batched in Phase 11.

### Pause triggers inside this phase

- **3+ red iterations** on the same task without progress — pause, print the last 3 failures, code under test, test, and a hypothesis. Ask for direction.
- **Plan task cannot be completed as written** (assumption wrong, dependency missing) — pause, surface the gap. Do NOT improvise outside the plan; loop back to update the plan instead.

## Phase 7 — Symmetric Audit

**Goal:** Catch sibling-surface divergences before they reach review.

1. Invoke `symmetric-audit` via the Skill tool.
2. The skill enumerates sibling surfaces (create/edit/view triads, schema consumers, route families, shared form sections) and renders a verdict per sibling: **in sync** / **diverged** / **intentionally asymmetric**.
3. For any **diverged** sibling, fix the divergence inline. Loop back through TDD for the fix if needed.
4. Record the audit summary in working memory; it goes into the PR body's test plan later.

Do not skip this phase, even on small tickets — small changes are exactly where symmetry bugs hide.

## Phase 8 — Iterative Review-Fix

**Goal:** Run the automated review loop until clean.

1. Invoke `iterative-review-fix` via the Skill tool.
2. The skill runs review, evaluates findings critically, fixes valid issues, re-reviews. It loops until clean.
3. If the loop stalls (same issue keeps surfacing across 3+ iterations), pause and ask.
4. After the loop terminates clean, proceed to Phase 9.

## Phase 9 — Smoke (conditional)

**Goal:** If the ticket has UI changes, drive a real browser through the affected paths.

**Skip this phase if:**

- The `ui` tag did NOT fire in Phase 2 classification, OR
- The `skip-smoke` flag was passed at invocation, OR
- The user explicitly said "no smoke" during this run, OR
- No browser testing skill/tool is available in this project.

**Steps:**

1. Invoke the project's smoke test skill via the Skill tool — a project-specific one if it exists, otherwise the generic `web-smoke-test` skill. If no smoke skill is available, note it and continue.
2. If smoke surfaces failures, loop back to Phase 6 to fix, then re-run Phases 7-9.
3. If it passes (or if no smoke test is available), proceed to Phase 10.

## Phase 10 — Verify

**Goal:** Final guard before commit.

1. Invoke `superpowers:verification-before-completion`.
2. Run the project's standard verification commands (lint, type-check, test). Read these from CLAUDE.md, `package.json` scripts, `Makefile`, or equivalent.
3. Each command must exit 0. If any fail, pause and surface output. Do NOT proceed to commit on failures. Do NOT use `--no-verify` or any bypass.
4. If everything passes, proceed to Phase 11.

## Phase 11 — Commit

**Goal:** Group all changes into conventional commits.

1. Invoke `conventional-commits` via the Skill tool.
2. The skill groups staged changes by scope and produces one or more commits.
3. After each commit message is generated, append `Refs: <ticket-id>` to the commit body — BEFORE the `Co-Authored-By` line.
4. Verify `git status` shows a clean working tree after all commits.
5. Verify `git log <base-branch>..HEAD --oneline` shows the expected commits.

### Hard refusals for this phase

- `git commit --no-verify` — refuse, fix the hook failure instead
- `git commit --amend` on a pushed commit — refuse, create a new commit
- `git config` edits — refuse

## Phase 12 — Handoff

**Goal:** Print the exact commands for the user to push and open the PR. **GATE 3.** Do NOT execute them.

### Gather

- Branch name from Phase 5
- Commit count, scopes, file count from `git log` / `git diff --stat`
- Spec path from Phase 3
- Plan path from Phase 4
- Acceptance criteria from the spec -> PR test plan checkboxes
- PR title — first commit's subject, or synthesised from multi-scope commits
- Jira ticket URL

### Print verbatim as a code block

```
Ready to ship: <ticket-id>

Branch:   <branch>
Commits:  <N> (<scope1>, <scope2>, ...)
Files:    <M> changed (+<a> -<b>)
Spec:     <spec path>
Plan:     <plan path>

Run from your terminal:

  git push -u origin <branch>

  <pr-create-command> \
    --target <pr-target-branch> \
    --title "<PR title>" \
    --body "$(cat <<'EOF'
## Summary
- <bullet from spec>
- <bullet from spec>

## Ticket
<ticket-id> — <jira url>

## Test plan
- [ ] <acceptance criterion 1>
- [ ] <acceptance criterion 2>
- [ ] <acceptance criterion 3>

Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

### Absolute rules for handoff

- NEVER run `git push` from inside the skill. The user pushes from their own terminal.
- NEVER run the PR create command. The skill prints the command; the user runs it.
- The handoff block is printed as text inside a markdown code fence — it is NOT a tool call.

---

## Cross-cutting: Failure handling

The skill stops and asks rather than guessing.

| Trigger | What to print | How to resume |
| --- | --- | --- |
| Ambiguous ticket (unclear AC, contradictory description) | List each ambiguity, ask one targeted question per ambiguity | User answers -> proceed |
| Scope > ~1 day / >10 tasks / >6 modules | Print plan summary, propose decomposition | User confirms or splits |
| 3+ red iterations on the same task | Print last 3 failures, code, test, hypothesis | User redirects |
| Missing access (MCP 403, env var missing) | Exact error + what would unblock it | User fixes, re-invokes |
| Sub-skill not installed | Print which skill is needed + suggest sync | User syncs, re-invokes |
| Pre-commit hook fails | Print stderr verbatim. Do NOT skip the hook. | User fixes; skill retries |
| `git pull --ff-only` fails | Surface the divergence. Do NOT rebase or force. | User resolves manually |

## Cross-cutting: Hard refusals (no pause-and-ask; just refuse)

- `git push --no-verify` or any flag bypassing hooks
- `git commit --no-verify`
- Interactive git commands (`rebase -i`, `add -i`) — harness is non-interactive
- Force-push to the base branch
- Editing `git config`
- Writing to Jira (no comments posted, no status transitions) — the skill is read-only on Jira
- Running `git push` or PR create from inside the pilot

## Cross-cutting: Escape hatches

The user can always:

- Pass `restart` — archive existing spec/plan, start fresh from Phase 1
- Pass `skip-smoke` — skip Phase 9
- Override at any pause with explicit instructions
