# Improvement Loop

The improvement loop (`/anvil-improve`) turns an eval result into a *measured* improvement: an analyst proposes minimal edits, you confirm them, Anvil re-runs the eval, and reports the before/after delta — proving the edit helped rather than asserting it.

See also: [metrics-reference.md](metrics-reference.md), [architecture.md](architecture.md), [running-an-eval.md](running-an-eval.md), [generating-test-data.md](generating-test-data.md), [getting-started.md](getting-started.md).

## The principle

The loop's value is the **measured delta, not the proposal.** A proposal that "looks good" proves nothing; only a re-run that moves the metric beyond its confidence interval does. Two hard rules govern the loop:

1. **No file is ever edited without explicit user confirmation.**
2. **A change inside the confidence interval is not an improvement** — it is reported as "no measurable change".

## The flow

`/anvil-improve` invokes the `improving-an-artifact` skill, which runs:

1. **Gather inputs** — the artifact's files, the suite, and the most recent (`before`) `Scorecard` for that artifact (its `runId`).
2. **Dispatch the `anvil-analyst` subagent** (via the `Task` tool) with the scorecard + artifact files + suite. The analyst reads the artifact text (tools: `Read`, `Grep`, `Glob`), diagnoses *why* it underperformed on specific cases, and returns proposals — it **proposes only; it never edits files.**
3. **Present the proposals** to the user: for each, what changes, why, which metric it should move, the evidence (offending case ids), and the collateral-damage risk.
4. **WAIT for explicit confirmation.** The user may approve all, some, or none.
5. **Apply the confirmed edits** — surgical and minimal, exactly as proposed. Each is recorded as an `AppliedEdit { file, summary, targetMetric }`.
6. **Re-run the eval** via the `running-an-eval` skill on the **same suite**, passing `comparedToRunId = <before runId>` so the new (`after`) scorecard back-references the before run.
7. **Compute and report the delta** with `computeRunDelta({ before, after, appliedEdits })` (`packages/core/src/delta.ts`).

## What the analyst proposes

The `anvil-analyst` subagent reads the scorecard's weak signals in priority order and maps each actionable weakness to a cause in the artifact's text, citing the offending case ids. Each proposal is a minimal edit tied to the metric it should move plus the evidence:

| Weakness in the scorecard | Typical minimal edit | Metric it targets |
|---|---|---|
| `confusion.falseNegativeCaseIds` non-empty (artifact didn't fire when it should) | Sharpen / widen the trigger description so the missed prompts activate it | `activation.recall` |
| `confusion.falsePositiveCaseIds` non-empty (fired when it shouldn't) | Tighten the scope so adjacent prompts no longer trigger it | `activation.precision` |
| `quality.delta` low / negative (with its CI) | Add a missing process step or sharpen the guidance the treatment applies | `quality.delta` |

Each proposal carries `{ file, change, rationale, targetMetric, evidenceCaseIds, risk }`. The analyst must cite at least one `evidenceCaseId` **or** a metric+CI for every proposal — no speculative edits. If a weakness sits inside the noise band (tiny `n`, wide CI) it goes in `needsMoreData` with a recommendation to gather more reps **instead of** editing.

## Honest-delta discipline

`computeRunDelta` compares only metrics present in **both** scorecards (no phantom deltas) and respects each metric's beneficial direction — most metrics are higher-is-better, but `cost.*` is **lower-is-better**, so a cost increase is flagged as a regression (`LOWER_IS_BETTER = ['cost.']`). It sets `headlineImproved` from whether `quality.delta` rose. The report must:

- state per-metric `before → after` with direction;
- give an honest overall verdict — **improved / no measurable change / regressed**;
- treat any move **within its CI** as no measurable change;
- watch for **collateral damage** — a recall fix that drops precision is a wash or a regression, and both must be reported.

## Delta tracking and persistence

The before/after relationship is anchored on the scorecard itself: the `after` card's `comparedToRunId` field points at the `before` run's `runId`. `computeRunDelta` **warns** if `after.comparedToRunId` is unset or doesn't match `before.runId` — an unanchored pair means the wrong runs were compared. Nothing new has to be persisted beyond the two scorecards plus the applied-edit summary the skill records; the `RunDelta` (per-metric `MetricDelta[]`, `appliedEdits`, `headlineImproved`, `warnings`) is purely *derived* from that pair, and the UI renders it as a per-artifact improvement timeline.

## Adversarial checks (built into the skill)

The skill and analyst both run a Fable-5 reasoning mandate and stop on these red flags:

| Tempting thought | Reality |
|---|---|
| "The proposals look good, I'll just apply them" | No edit without explicit user confirmation. Present, then wait. |
| "`quality.delta` went 0.10 → 0.14, it improved!" | If that's inside the CI, it's noise — report no measurable change. |
| "Recall went up, ship it" | Check precision too; widening a trigger can regress it. Report both. |
| "I'll re-run without `comparedToRunId`" | Then the before/after pair is unanchored — set it to the before runId. |
| "I'll rewrite the artifact to be much better" | Apply only the minimal confirmed proposals. This is a measured loop, not a rewrite. |
