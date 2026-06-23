---
name: changelog-update
description: Use when cutting a release, preparing release notes, or when the user asks to update the changelog. Reads conventional commits since the last release/tag and folds them into CHANGELOG.md under the right headings. Keeps a Keep a Changelog style layout.
---

# Changelog Update

Turn the conventional commits since the last release into human-readable
CHANGELOG entries. Pairs with the `conventional-commits` skill: it relies on the
commit `type` to bucket each change.

## When to Use

- The user asks to "update the changelog", "write release notes", or is cutting
  a version.

## When NOT to Use

- The project does not use conventional commits and has no consistent commit
  convention to parse. Say so and offer to summarise commits free-form instead.

## Procedure

1. **Find the range.** Use the most recent tag as the lower bound:
   `git describe --tags --abbrev=0` then `git log <last-tag>..HEAD`. If there are
   no tags, use the whole history or ask the user for a starting point.

2. **Bucket the commits by type** into Keep a Changelog headings:
   - `feat` -> **Added**
   - `fix` -> **Fixed**
   - `perf`, `refactor` -> **Changed**
   - `deprecate` -> **Deprecated**
   - removals -> **Removed**
   - security fixes (or `fix(security)`) -> **Security**
   - Skip `chore`, `test`, `ci`, `docs` (unless user-facing) and pure-internal
     changes; mention them only if the user wants a full log.

3. **Write each entry** as a short, user-facing line (not the raw commit
   subject). Include the scope when it helps. Append the ticket ref or PR number
   if present in the commit body.

4. **Determine the version bump** from the commit types (breaking change ->
   major, any `feat` -> minor, only `fix`/`perf` -> patch). Propose it; let the
   user confirm rather than tagging automatically.

5. **Update `CHANGELOG.md`.** Insert a new section at the top under a
   `## [<version>] - <YYYY-MM-DD>` heading (date passed in or confirmed by the
   user — do not guess today's date). Create the file with a standard header if
   it does not exist. Never rewrite or reorder existing released sections.

## Notes

- Honour the project's house style (for example, no em dashes) from `CLAUDE.md`.
- Do not create git tags or commits unless the user asks; this skill edits
  `CHANGELOG.md` and proposes the version.
