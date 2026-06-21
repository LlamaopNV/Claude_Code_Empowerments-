---
name: bitbucket-pr
description: Manage Bitbucket pull requests — list, view, create, update, review, merge, and comment. Use when the user needs to interact with Bitbucket PRs.
argument-hint: "<operation> [args...]"
disable-model-invocation: false
allowed-tools:
  - Bash
  - AskUserQuestion
---

# Bitbucket PR

Parse `$ARGUMENTS` and execute the matching operation now. Scripts in `${CLAUDE_SKILL_DIR}/scripts/` handle auth, URLs, and formatting. Auth loads from `BB_USER`/`BB_TOKEN` env vars or `~/.bitbucket`. Workspace/repo default to `BB_WORKSPACE`/`BB_REPO`.

Normalise flag-style args to positional: `--state merged` becomes positional `MERGED`.

## Dispatch table

| First word | Script | Positional args |
|---|---|---|
| `list` | `pr-list.sh` | `[state] [page]` — state: OPEN (default), MERGED, DECLINED, SUPERSEDED |
| `view` | `pr-view.sh` | `<id>` |
| `diff` | `pr-diff.sh` | `<id>` |
| `comments` | `pr-comments-list.sh` | `<id> [page] [pagelen]` |
| `create` | `pr-create.sh` | `<title> <source_branch> [dest_branch] [description] [reviewers_csv] [close_source_branch]` |
| `update` | `pr-update.sh` | `<id> '<json_body>'` — fields: title, description, destination, reviewers, close_source_branch |
| `comment` | `pr-comment.sh` | `<id> <body> [file_path] [line]` — omit file/line for general, provide both for inline |
| `comment-delete` | `pr-comment-delete.sh` | `<pr_id> <comment_id>` |
| `approve` | `pr-approve.sh` | `<id>` |
| `request-changes` | `pr-request-changes.sh` | `<id>` |
| `merge` | `pr-merge.sh` | `<id> [strategy] [message] [close_source_branch]` — strategy: merge_commit (default), squash, fast_forward |

## Steps

1. Match the first word of `$ARGUMENTS` to an operation above.
2. For write operations (create, update, comment, comment-delete, approve, request-changes, merge): confirm with user before running.
3. Run the script:
   ```
   ${CLAUDE_SKILL_DIR}/scripts/<script> <args...>
   ```
4. Present the output. Format tabular results as a table.
