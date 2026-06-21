---
name: bitbucket-pipeline
description: Manage Bitbucket CI/CD pipelines — list, inspect, trigger, and stop pipeline runs. Use when the user needs to check build status, view logs, or trigger pipelines.
argument-hint: "<operation> [args...]"
disable-model-invocation: false
allowed-tools:
  - Bash
  - AskUserQuestion
---

# Bitbucket Pipeline

Parse `$ARGUMENTS` and execute the matching operation now. Scripts in `${CLAUDE_SKILL_DIR}/scripts/` handle auth, URLs, and formatting. Auth loads from `BB_USER`/`BB_TOKEN` env vars or `~/.bitbucket`. Pipeline UUIDs include curly braces: `{uuid-here}`.

## Dispatch table

| First word | Script | Positional args |
|---|---|---|
| `list` | `pipeline-list.sh` | `[page] [pagelen]` |
| `status` | `pipeline-status.sh` | `<pipeline_uuid>` |
| `steps` | `pipeline-steps.sh` | `<pipeline_uuid>` |
| `log` | `pipeline-log.sh` | `<pipeline_uuid> <step_uuid>` |
| `trigger` | `pipeline-trigger.sh` | `<branch> [custom_pipeline] [variables_json]` — variables_json: `'[{"key":"FOO","value":"bar","secured":false}]'` |
| `stop` | `pipeline-stop.sh` | `<pipeline_uuid>` |

## Steps

1. Match the first word of `$ARGUMENTS` to an operation above.
2. For write operations (trigger, stop): confirm with user before running.
3. Run the script:
   ```
   ${CLAUDE_SKILL_DIR}/scripts/<script> <args...>
   ```
4. Present the output. Format tabular results as a table.
