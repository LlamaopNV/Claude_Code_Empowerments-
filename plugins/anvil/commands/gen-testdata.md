---
description: Generate a balanced Anvil eval suite (should-fire / should-not-fire near-miss / task cases) for a skill, subagent, or plugin.
argument-hint: <artifact> [--reps N] [--judge-model M] [--run-model M]
---

# /anvil:gen-testdata

Generate a balanced, adversarial eval suite for a Claude Code artifact and save it for review. Thin entry point: hands off to the **`generating-test-data`** skill, which reads the artifact's files, dispatches the `anvil-testdata-generator` subagent, validates the result, runs a coverage/balance check, and persists the suite via the Anvil MCP server.

## Arguments

`$ARGUMENTS`

- **artifact** (required): the skill, subagent, or plugin to generate a suite for (by name/path). Its files are read so the cases reflect the real trigger and process, not a guess.
- **`--reps N`** (optional): repetitions to stamp into the suite (default from the skill).
- **`--judge-model M`** / **`--run-model M`** (optional): override the judge/run model ids.

## What it does

Invoke the **`generating-test-data`** skill with the parsed arguments. The skill will:
1. Read the artifact's files and pick suite metadata.
2. Dispatch `anvil-testdata-generator` to synthesize `should-fire`, adversarial `should-not-fire` near-miss, and `task` cases with rubrics, plus a coverage rationale.
3. Validate the YAML (`anvil_validate_suite`) and run the **coverage/balance check** (bucket balance, near-miss presence, rubric completeness).
4. Surface any errors/warnings — and regenerate rather than ship a weak suite.
5. Save it (`anvil_save_suite`) and report the path, so you can review/edit it in the UI before running `/anvil:eval`.
