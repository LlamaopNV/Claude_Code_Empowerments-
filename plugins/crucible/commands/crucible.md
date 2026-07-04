---
description: Drive a rough idea end to end to shipped, tested code through the crucible pipeline, or resume/inspect an existing run.
argument-hint: <idea in plain language | resume [run] | status> [--auto]
---

# /crucible

One rough idea in, assayed code out. This is a thin entry point: it hands off to the **`crucible`** skill, which runs the seven-stage pipeline (intake, diverge + checkpoint, spec, tests-first, subagent build, assay, deliver) with an evidence ledger no run can finish without.

## Arguments

`$ARGUMENTS`

- **idea** (default): the rough idea in plain language. Starts a new run under `crucible-runs/`.
- **`resume [run]`**: pick an unfinished run back up at its recorded phase (newest run if omitted).
- **`status`**: list runs, phases, and gate states without acting.
- **`--auto`**: skip the approach-selection checkpoint; the pipeline picks the winning approach itself and records its rationale.

## What it does

Invoke the **`crucible`** skill with the parsed arguments. New runs are initialized via the plugin's `scripts/gate.mjs` ledger; every stage writes its artifact before the next begins, the approach checkpoint pauses for your verdict unless `--auto`, and the run cannot be marked done until `gate.mjs check` reports ASSAY PASS — tests, lint, typecheck, spec review, and slop critique, each with evidence on disk.
