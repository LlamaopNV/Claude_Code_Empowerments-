---
name: pr-description
description: Use when opening a pull request or when the user asks to draft a PR title and description, write a PR body, or summarise a branch's changes for review. Builds the title and summary from the actual branch diff against the base branch, not from memory. Adapts to Bitbucket, GitHub, or GitLab.
---

# PR Description

Draft a pull request title and body from what the branch actually changed. The
diff is the source of truth, not your recollection of the work.

## When to Use

- The user asks to "write the PR", "draft a PR description", or "summarise this
  branch for review".
- A workflow is about to hand off a push + PR and needs the body text.

## When NOT to Use

- There is no branch diff yet (nothing committed against the base). Say so.
- The user wants the PR actually created/pushed — this skill writes the text;
  it does not push or open the PR unless the user explicitly asks.

## Procedure

1. **Find the base branch.** Read it from `CLAUDE.md` (projects often target
   `develop` or `staging`, not `main`). Fall back to the repository default
   branch.

2. **Scope the diff.**
   - `git diff --name-only <base>...HEAD` for the file list.
   - `git diff --stat <base>...HEAD` for the shape of the change.
   - `git log <base>..HEAD --oneline` for the commit narrative.
   Read the key changed files as needed to describe intent, not just mechanics.

3. **Derive the title.** Prefer the conventional-commit subject of the single
   logical change. For a multi-scope branch, synthesise one concise title. Match
   the repo's commit/PR conventions.

4. **Write the body** with these sections (drop any that do not apply):

   ```
   ## Summary
   - <what changed and why, in reviewer terms>

   ## Changes
   - <notable file/area> — <what and why>

   ## Ticket
   <TICKET-ID> — <url if known>   (omit if no ticket)

   ## Test plan
   - [ ] <how a reviewer verifies this>
   ```

   Pull acceptance criteria from a linked spec/ticket into the test plan when
   available.

5. **Emit the PR command for the project's tool** as a code block for the user
   to run (do not execute it):
   - Bitbucket: `bkt pr create --target <base> --title "..." --body "..."`
   - GitHub: `gh pr create --base <base> --title "..." --body "..."`
   - GitLab: `glab mr create --target-branch <base> --title "..." --description "..."`

   Read which tool the project uses from `CLAUDE.md`; default to `gh` if unstated.

## Notes

- Honour the house style from `CLAUDE.md` (for example, no em dashes,
  first-person voice) in the generated prose.
- Do not invent changes that are not in the diff. If the diff and the commit
  messages disagree, describe what the code actually does and flag the mismatch.
