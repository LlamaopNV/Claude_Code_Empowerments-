---
description: Run an Anvil effectiveness eval (in-session A/B + judge) for a skill, subagent, or plugin and record a scorecard.
argument-hint: <suite-name | artifact> [--reps N] [--no-cache | --refresh]
---

# /anvil:eval

Run an effectiveness eval for a Claude Code artifact and record its scorecard. This is a thin entry point: it hands off to the **`running-an-eval`** skill, which dispatches treatment/baseline task-runner subagents and position-swapped judges for each case, recovers activation + token usage from the transcripts, scores the run, and persists it via the Anvil MCP server — all on your subscription, no external `claude -p`.

## Arguments

`$ARGUMENTS`

- **suite-name | artifact** (required): the eval suite to run (by `name`), or an artifact (skill/subagent/plugin) whose suite should be found. If several suites match, you'll be asked which one. If none exists, you'll be pointed to `/anvil:gen-testdata` to generate one first.
- **`--reps N`** (optional): override the suite's repetitions for this run (e.g. `--reps 1` for a quick smoke).
- **`--no-cache`** (optional): ignore the run cache; re-execute every case.
- **`--refresh`** (optional): force re-execution and overwrite stale cache entries.

## What it does

Invoke the **`running-an-eval`** skill with the parsed arguments. The skill will:
1. Load the suite (`anvil_get_suite` / `anvil_list_suites`).
2. Print a **pre-flight estimate** of subagent dispatches (cases × reps × runners + swapped judges, minus cache hits) and ask you to confirm before spending quota.
3. Run each case sequentially (throttled), recovering activation/usage per dispatched subagent.
4. Call `anvil_record_run` to score + persist + index the run.
5. Report the scorecard headline metrics **with confidence intervals** plus the activation confusion matrix and the run id.

If the suite is missing, the artifact can't be located, or the session-id needed for transcript introspection can't be resolved, you'll get a clear error and what to do next — never a fabricated result.
