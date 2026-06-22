---
name: improving-an-artifact
description: Close the Anvil improvement loop — run the analyst on a Scorecard to get concrete edit proposals, present them, and ONLY on explicit user confirmation apply the edits to the artifact, re-run the eval, and report the measured before/after delta. Use when the user asks to improve/fix/iterate on a skill, subagent, or plugin based on its eval results, or invokes /anvil:improve. Never edits files without confirmation.
---

# Improving an Anvil Artifact

Turn an eval result into a measured improvement. You get concrete edit proposals from the analyst, present them, and — only after the user explicitly confirms — apply the edits, re-run the eval, and prove the delta with a before/after comparison. The loop's value is the MEASURED delta, not the proposal; and no file is ever edited without confirmation.

## Reasoning mandate (Fable-5)

Reason like you are running Fable 5. Work from first principles. Before applying any edit, verify the proposal against the artifact's actual text and the offending cases — does this minimal change plausibly move the named metric without regressing a passing bucket? After re-running, compare before/after honestly: if the headline metric moved inside the CI, say "no measurable improvement" — do not spin noise as a win. Adversarially check: did widening a trigger to fix false-negatives create new false-positives? Evidence over assertion: report the delta the re-run actually produced.

## Hard rule

**No file edit without explicit user confirmation.** Present proposals, wait for a clear "yes / apply" (optionally selecting which proposals). Applying edits silently is forbidden.

## Tools you use

- `anvil_get_suite` / the stored Scorecard (the `before` run) — the inputs to the analyst.
- The **`anvil-analyst`** subagent — produces edit proposals.
- The **`running-an-eval`** skill — re-runs the eval to produce the `after` Scorecard.
- The core `computeRunDelta({before, after, appliedEdits})` helper — derives the per-metric before/after delta.

## Flow

1. **Gather inputs** — the artifact's files, the suite, and the most recent (`before`) Scorecard for it (its `runId`).
2. **Dispatch `anvil-analyst`** (`Task` tool) with the scorecard + artifact files + suite. It returns a ```json `{proposals[], needsMoreData[]}` block: each proposal has a `file`, `change`, `rationale`, `targetMetric`, `evidenceCaseIds`, `risk`.
3. **Present the proposals** to the user — for each: what changes, why, which metric it should move, which cases are the evidence, and the risk. If `needsMoreData` is non-empty, say which weaknesses are still inside the noise band and suggest more reps instead of an edit.
4. **WAIT for explicit confirmation.** The user may approve all, some, or none. Do not proceed to edits without a clear yes.
5. **Apply the confirmed edits** to the artifact files (surgical, minimal — as proposed). Record each as an `AppliedEdit {file, summary, targetMetric}`.
6. **Re-run the eval** via `running-an-eval` on the SAME suite, passing `comparedToRunId = <before runId>` so the new (`after`) Scorecard back-references the before run.
7. **Compute + report the delta** — `computeRunDelta({before, after, appliedEdits})`. Report per-metric before → after with direction (remember `cost.*` is lower-is-better), the applied edits, and an honest overall verdict (improved / no measurable change / regressed). Surface any `warnings` (e.g. the pair didn't reference each other) and any metric whose move is within its CI.

## Honest-delta discipline

- A change inside the confidence interval is **not** an improvement — report it as such.
- Watch for collateral damage: a recall fix that drops precision is a wash or a regression; report both.
- The `after` card MUST set `comparedToRunId` to the before run, or the delta record is unanchored (the helper warns if not).

## Red flags — STOP

| Thought | Reality |
|---|---|
| "The proposals look good, I'll just apply them" | No edit without explicit user confirmation. Present, then wait. |
| "quality.delta went from 0.10 to 0.14, it improved!" | If that's inside the CI, it's noise. Report "no measurable change". |
| "Recall went up, ship it" | Check precision too — widening a trigger can regress it. Report both. |
| "I'll re-run without comparedToRunId" | Then the before/after pair is unanchored. Set it to the before runId. |
| "I'll rewrite the artifact to be much better" | Apply only the minimal confirmed proposals. This is a measured loop, not a rewrite. |
