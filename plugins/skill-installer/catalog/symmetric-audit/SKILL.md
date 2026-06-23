---
name: symmetric-audit
description: Audit symmetric surfaces for the current change set. Enumerate sibling files (create/edit/view triads, schema consumers, route families, shared form sections) and render a verdict for each (in sync / diverged / intentionally asymmetric). Use mid-task when the work touches a write-path, a schema, or shared form code; also use before declaring a task done. Triggers on "symmetric audit", "check siblings", "audit symmetry", "did I miss the edit form", "what else does this touch", or when the user asks to verify a change is complete across related files.
---

# Symmetric Audit

## Why This Exists

The failure mode: implement `createUser` perfectly, ship it, then realise `updateUser` was missed. Most domain processes are a _family_ of surfaces — create + edit + view; list + detail + mutation; insert + update; loader + action + form. A change to one member is rarely complete in isolation.

This skill is the holistic, end-of-task audit across _every_ changed file. It finds siblings mechanically, renders a verdict per entry, and fixes divergences inline.

## When to Use

- Mid-task at a coherent stopping point — between sub-features, or before commit.
- Before declaring a task done (also invoked as Step 1 of `/iterative-review-fix`).
- Whenever the user asks "did I miss the X side?" or "are all the related files updated?"
- After a refactor that touched a schema, a shared validator, or a shared form section.

## When NOT to Use

- Mid-implementation when work is incoherent — finish the unit first.
- For trivial single-file changes with no exports (typo fix, comment).
- When the user has explicitly scoped the change to one surface ("just update the admin view, ignore the technician view for now") — note the scope but skip the audit.

## Core Idea: Entity-Driven CRUD Grep

The skill is **entity-agnostic**. It works for any entity in any codebase — without code changes. The mechanism:

1. From the change set, extract the **entity name(s)** touched (e.g. `user`, `order`, `invoice`).
2. Grep the codebase for that entity's full CRUD lifecycle — every place it's created, read, updated, deleted, or persisted. Those matches are the sibling set.
3. Render a verdict per sibling.

### Adapting the grep to your codebase

The grep patterns below are generic starting points. Before running the audit, identify your project's naming conventions by reading a few existing files:

- **ORM/DB layer**: What does an insert/update/delete look like? (e.g. `prisma.user.create()`, `db.insert(users)`, `User.objects.create()`, `INSERT INTO users`)
- **API/RPC layer**: How are routes or procedures named? (e.g. `usersRouter`, `POST /api/users`, `UserResolver`)
- **Frontend routes**: How are pages structured? (e.g. `pages/users/`, `routes/users/`, `app/(dashboard)/users/`)
- **Components**: How are entity-specific components named? (e.g. `user-form.tsx`, `UserList.vue`, `CreateUserDialog.tsx`)

## Procedure

### 1. Establish the Change Set

```bash
git diff --name-only main...HEAD    # vs base branch
git diff --name-only                 # unstaged
git diff --cached --name-only        # staged
```

Union the three, drop `*.test.*` and docs/lockfiles. The remainder is the change set.

If the change set is against a different base branch (e.g. `develop`, `staging`), substitute accordingly.

If the user is working from an explicit ticket scope rather than a branch, ask which files they consider in-scope before proceeding.

### 2. Identify Entities Touched

For each changed file, extract the entity name(s) it deals with. Use whichever signal is clearest:

| Source | Extract |
| --- | --- |
| Schema/model files (`schema/*.ts`, `models/*.py`, `*.prisma`) | The model/table identifier(s) |
| API route files (`routers/*.ts`, `routes/*.py`, `controllers/*.ts`) | The entity the route serves (from imports, path, or name) |
| Frontend route directories (`routes/<entity>/`, `pages/<entity>/`) | The folder name (singularise if plural) |
| Component files (`*-form.tsx`, `*-list.tsx`, `*-detail.tsx`) | The entity prefix in the filename |
| Any file with DB write operations | The table/model being written to |

You may have multiple entities per change set. Run the rest of the procedure for each independently, then union the results.

### 3. Grep the CRUD Lifecycle

For each entity, run searches to find every file that reads, writes, or renders it. Adapt the patterns to your project's stack:

```bash
# A. Database reads — every query of this entity
grep -rn "<entity>" src/ --include="*.ts" --include="*.tsx" | grep -i "find\|query\|select\|get\|fetch\|read"

# B. Database writes — every mutation of this entity
grep -rn "<entity>" src/ --include="*.ts" --include="*.tsx" | grep -i "create\|insert\|update\|delete\|upsert\|save\|remove"

# C. API/RPC calls — every place the frontend calls this entity's endpoints
grep -rn "<entityPlural>" src/ --include="*.ts" --include="*.tsx" | grep -i "api\|rpc\|fetch\|mutation\|query"

# D. Route/page files for this entity
find src/ -type d -iname "<entityPlural>" -exec find {} -type f \( -name "*.tsx" -o -name "*.ts" -o -name "*.vue" \) ! -name "*.test.*" \;

# E. Components named after this entity
find src/ -type f -iname "*<entity-kebab>*" ! -name "*.test.*"
```

Filter the union: drop test files, `dist/`, `node_modules/`, `.turbo/`, build output. What remains is the sibling set for this entity.

**High-frequency entities** (e.g. `user`, `session`, `auth`) are imported by middleware across the entire codebase. Skip overly broad grep patterns for these — rely on the tighter entity-specific searches.

### 4. Consolidate Siblings

Merge sibling lists across all entities into a single deduplicated set. For each sibling, track:

- Which entity it came from.
- Which CRUD bucket (A/B/C/D/E) flagged it.

A sibling flagged from multiple buckets is a **high-priority intersection** — these are the files most likely to contain the asymmetric bug. Audit them first.

Cap the consolidated list at ~30 siblings. If it's longer, the change set is too broad for one audit — recommend splitting the work into smaller PRs.

### 5. Render a Verdict per Sibling — and Fix the Diverged Ones

For each sibling in the consolidated list, produce one of three verdicts and **act on the verdict in this same step** — don't defer fixes back to the user.

| Verdict | Action (taken now, not deferred) |
| --- | --- |
| **In sync** | No change. Note _why_ (e.g. "edit form already spreads the schema, so the new field flows through automatically"). |
| **Diverged** | **APPLY THE EQUIVALENT CHANGE TO THE SIBLING** — do not ask the user, do not defer to a follow-up PR. Inline if the change is < 50 lines; dispatch a subagent if larger or if it spans multiple files. Then re-verify. |
| **Intentionally asymmetric** | Leave it. Note the reason (e.g. "edit doesn't accept `password`", "list view omits internal notes by design"). |

**The gate to "Diverged" is strict.** Update IF AND ONLY IF the sibling genuinely diverged — reflexively mirroring is worse than missing one. To evaluate divergence, read the sibling file and compare against the changed file's diff. Look specifically for:

- Schema field added / removed / renamed — does the sibling read or write that field?
- Validator changed — does the sibling apply the same validator?
- Status enum extended — does the sibling handle the new value?
- Permission / role check added — does the sibling have an equivalent guard?
- Mutation contract changed (new required arg, removed arg) — does the sibling call the mutation?
- New field added to a write-path — does the symmetric write-path (the create/update twin) accept the same field?

#### How to apply a symmetric fix

Once a sibling is classified **Diverged**, fix it without asking. The fix is not a literal copy-paste of the original diff — it's the _equivalent_ change, adapted to the sibling's context.

Procedure:

1. **Identify the missing piece.** What part of the original change did this sibling fail to absorb? (A field on the input schema? A row in the form layout? A mapping in the submit handler? A column in the SELECT?)
2. **Find the analogous location** in the sibling. The create form's "form layout" maps to the edit form's "form layout"; the create procedure's "input schema" maps to the update procedure's "input schema"; etc.
3. **Apply the change**, adapting names and surrounding code where necessary. Common adaptations:
   - Create -> Update: default values come from existing data, not literal initial values.
   - Update -> Create: no `id` field on the input; no lookup for existing record.
   - Write-path -> Read-path: the field needs to appear in the query projection or the returned shape.
   - Procedure input -> Form: the form needs a field for the new input.
4. **Re-read the sibling after the edit.** Confirm the change actually closes the gap. If not, iterate.
5. **Record the fix in the audit summary** with a one-line description of what changed.

This is not optional. The skill exists to close the gap, not just identify it.

### 6. Output the Audit Summary

Present the result as a single block. Format:

```
Symmetric audit — <N> changed files, <M> siblings considered

In sync (<X>):
  - <file> — <one-line reason>
  ...

Diverged (<Y>) — fixed in this audit:
  - <file> — <one-line description of what changed>
  ...

Intentionally asymmetric (<Z>):
  - <file> — <one-line reason for the asymmetry>
  ...
```

This summary is the work product. Hand it to the user before declaring the task done — including the "in sync" and "intentionally asymmetric" entries. Silence on a sibling is how gaps slip through.

## Red Flags — You Are About to Violate the Process

| Thought | Reality |
| --- | --- |
| "I'll just check siblings in my head" | The whole point is mechanical enumeration. Walk every file. |
| "Most siblings are obviously fine, skip the verdict" | Every sibling needs a written verdict. Silence is how the bug slips through. |
| "If the sibling diverged, mirror the change automatically" | No — many divergences are intentional. Verify _why_ the change is needed in this sibling before applying. |
| "There are 50 siblings, I'll skim them quickly" | 50 siblings means the change set is too broad. Recommend splitting before auditing. |
| "I'll skip the audit summary, the user will read the diff" | The diff doesn't show what you _considered and rejected_. The summary makes "no change" an explicit decision. |

## Common Mistakes

| Mistake | Fix |
| --- | --- |
| Auditing only the obvious siblings | Use mechanical grep enumeration — don't rely on memory. |
| Reflexively mirroring changes to siblings | Update IF AND ONLY IF the sibling genuinely diverged. |
| Finding divergence but not fixing it | The skill is find-AND-fix. Diverged sibling -> apply the equivalent change _now_, not in a follow-up. |
| Asking the user before fixing a diverged sibling | Don't. The audit summary makes every fix visible — they can push back after the fact. |
| Not writing the audit summary | The summary is the work product. No summary, no audit. |
| Treating "intentionally asymmetric" as a skip | Write the reason. Without it, the next person can't tell intent from oversight. |
| Running the audit too early | Wait until the change set is coherent. Mid-implementation audits produce noise. |

## Relationship to Other Skills

- **`/iterative-review-fix` Step 1** — delegates to this skill. The review loop then layers a multi-agent PR review on top.
- This skill is standalone for mid-task checks. `/iterative-review-fix` is the full pre-PR loop.
