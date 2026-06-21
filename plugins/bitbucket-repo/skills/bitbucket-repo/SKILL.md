---
name: bitbucket-repo
description: Browse Bitbucket repositories — list repos, branches, commits, and read files at any ref. Use when needing repository context, branch info, or file contents from Bitbucket.
argument-hint: "<operation> [args...]"
disable-model-invocation: false
allowed-tools:
  - Bash
---

# Bitbucket Repo

Parse `$ARGUMENTS` and execute the matching operation now. Scripts in `${CLAUDE_SKILL_DIR}/scripts/` handle auth, URLs, and formatting. Auth loads from `BB_USER`/`BB_TOKEN` env vars or `~/.bitbucket`. All operations are read-only.

## Dispatch table

| First word | Script | Positional args |
|---|---|---|
| `repos` | `repo-list.sh` | `[workspace] [filter] [pagelen]` |
| `branches` | `branch-list.sh` | `[filter] [page] [pagelen]` |
| `commits` | `commit-log.sh` | `[branch] [path] [limit]` — pass `""` to skip branch or path |
| `file` | `repo-file-read.sh` | `<ref> <path>` — ref: branch name, tag, or commit hash |

## Steps

1. Match the first word of `$ARGUMENTS` to an operation above.
2. Run the script:
   ```
   ${CLAUDE_SKILL_DIR}/scripts/<script> <args...>
   ```
3. Present the output.
