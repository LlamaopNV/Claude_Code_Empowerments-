---
description: Get concrete edit proposals from an Anvil scorecard and, on your confirmation, apply them, re-run the eval, and report the measured before/after delta.
argument-hint: <artifact | run-id>
---

# /anvil-improve

Close the Anvil improvement loop for an artifact. Thin entry point: hands off to the **`improving-an-artifact`** skill, which runs the `anvil-analyst` subagent on the artifact's scorecard to produce concrete, minimal edit proposals, presents them, and — **only after you explicitly confirm** — applies the edits, re-runs the eval, and reports the measured before/after delta.

## Arguments

`$ARGUMENTS`

- **artifact | run-id** (required): the artifact to improve, or a specific `run-id` whose scorecard to analyze. The most recent scorecard for the artifact is used as the `before` run.

## What it does

Invoke the **`improving-an-artifact`** skill with the parsed argument. The skill will:
1. Gather the artifact files, the suite, and the `before` scorecard.
2. Dispatch `anvil-analyst` for edit proposals — each tied to the metric it should move and the offending cases (evidence).
3. **Present the proposals and wait for your explicit confirmation.** No file is edited without it.
4. On confirmation, apply the (minimal, surgical) edits, then re-run `running-an-eval` on the same suite with `comparedToRunId` set to the before run.
5. Compute and report the before → after delta per metric (honoring cost = lower-is-better), the applied edits, and an honest verdict — including "no measurable change" when a move is inside the confidence interval.

## Guarantee

This command never edits your artifact files without an explicit confirmation, and it never reports an improvement that is within the noise band as a win.
