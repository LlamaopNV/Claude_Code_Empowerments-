# Metrics Reference

This document defines every metric on an Anvil Scorecard, the methodology behind it, and the two documented threats to validity you must read before trusting a number.

See also: [architecture.md](architecture.md), [improvement-loop.md](improvement-loop.md), [running-an-eval.md](running-an-eval.md), [generating-test-data.md](generating-test-data.md), [getting-started.md](getting-started.md).

## What Anvil measures

Anvil scores a Claude Code artifact (a **skill**, a **subagent**, or a whole **plugin**) on how much it actually helps, by running each test case twice — **treatment** (the artifact applied / available) versus **baseline** (without it) — across `repetitions` reps, then reading the session transcript JSONL for ground truth. The output is a `Scorecard` whose every metric is a `MetricResult`: a point `value`, a sample size `n`, and — whenever `n > 1` — **spread** (`ci` and/or `stdDev`). The contract refuses a bare number with no uncertainty (`MetricResultSchema` enforces `n <= 1 || ci || stdDev`).

| Metric id | Meaning | Unit | Higher is better? |
|---|---|---|---|
| `activation.precision` | Of the cases where the artifact fired, how many should have | ratio | yes |
| `activation.recall` | Of the cases where it should have fired, how many did | ratio | yes |
| `activation.f1` | Harmonic mean of precision and recall | ratio | yes |
| `quality.delta` | Pairwise treatment-vs-baseline judge advantage | ratio | yes |
| `cost.tokens` | Mean treatment tokens per case | tokens | no (lower is better) |
| `cost.usd` | Estimated metered-API cost of those tokens | usd | no (lower is better) |

`pluginLoadOk` / `pluginErrors` and the activation `confusion` matrix round out the card.

## Activation: precision, recall, F1, and the confusion matrix

Activation answers: *did the right artifact fire on the right prompts?* The **ground truth is the transcript, not a heuristic.** A fired skill is a `tool_use` with `name: "Skill"` and a matching `skill` field; a dispatched subagent is a `tool_use` with `name: "Agent"`/`"Task"` and a matching `subagent_type` (verified in [spike-findings.md](spike-findings.md)). The detector (`detectActivation` in `packages/core/src/activation.ts`) matches the target `ArtifactRef.name` exactly against those fields and classifies the outcome (`skill-fired`, `wrong-skill`, `subagent-fired`, `plugin-command`, `not-fired`).

Each case carries a `shouldActivate` ground-truth flag. Comparing fired-vs-should-fire across the suite yields the **confusion matrix** (`ConfusionMatrix`), which records counts **and the offending case ids** so you can drill straight to the failures:

| | should fire | should not fire |
|---|---|---|
| **fired** | True Positive (TP) | False Positive (FP) — id in `falsePositiveCaseIds` |
| **did not fire** | False Negative (FN) — id in `falseNegativeCaseIds` | True Negative (TN) |

From the matrix (`confusionMetrics`):

- **precision** = TP / (TP + FP) — when it fires, is it justified? (low precision ⇒ it over-triggers)
- **recall** = TP / (TP + FN) — when it should fire, does it? (low recall ⇒ trigger too narrow)
- **F1** = 2 · precision · recall / (precision + recall) — the harmonic mean.

Edge cases follow the standard convention: a 0/0 ratio is reported as **1** (vacuously perfect — no errors of that type) and F1 is **0** when precision + recall is 0. Spread on these point estimates is a binomial-style stdDev over the relevant denominator (`metricFromPoint`): precision over predicted-positive count, recall over actual-positive count, F1 over total cases.

> Activation precision is only measurable if the suite contains **should-not-fire near-misses**. A suite with none cannot detect over-triggering; the coverage check (`checkSuiteCoverage`) errors on a missing `should-not-fire` bucket before you ever run. See [generating-test-data.md](generating-test-data.md).

## quality.delta: pairwise treatment-vs-baseline

`quality.delta` is the headline "did the artifact make the answer better?" metric. For each judged case it is computed by `aggregateJudgeSamples` over the case's judge samples as:

```
qualityDelta = (treatmentWins − baselineWins) / n        ∈ [−1, 1]
```

`+1` = treatment always won, `−1` = baseline always won, `0` = tie or fully position-biased. The scorecard's `quality.delta` is the **mean of the per-case deltas over judged cases**, and — being `n > 1` — it is **always reported with a confidence interval and `n`, never a bare number** (`metricFromSamples` → `meanConfidenceInterval`). A `quality.delta` of `0.14` is meaningless without its CI: if the interval straddles 0, the artifact has not been shown to help.

## Judge methodology and position-swap reconciliation

The judge is the `anvil-judge` subagent: a rigorous, impartial **pairwise** judge that receives two outputs labelled only **A** and **B** plus a rubric, and returns `winner: "A" | "B" | "tie"`. It does **not** know which slot is treatment and is instructed not to guess.

To cancel the well-known position bias of LLM judges, the orchestrator dispatches the judge **twice per rep with treatment and baseline shown in swapped slots** (`buildSwappedPair` constructs the canonical `{a: treatment, b: baseline}` and swapped `{a: baseline, b: treatment}` payloads).

The critical reconciliation rule — verified against `aggregateJudgeSamples` and its doc comment in `packages/core/src/scoring.ts`:

- **Verdicts are recorded DE-POSITIONED.** The orchestrator knows which slot held treatment for each dispatch and translates the judge's `A`/`B` into `treatment`/`baseline`/`tie` **at record time**. Each `JudgeSample.verdict` is therefore already canonical.
- **The `swapped` flag is never used to re-interpret a verdict.** `aggregateJudgeSamples` tallies wins purely from `verdict`; it uses `swapped` only to **measure** calibration:

  ```
  positionBias = |winRate(unswapped) − winRate(swapped)|     ∈ [0, 1]
  ```

  computed only when both subsets are non-empty (else 0). A high `positionBias` is a **calibration warning** — it flags a position-sensitive judge — **not** an instruction to flip any verdict.

In short: the swap is plumbing that flips the *inputs*; the verdict semantics are fixed at record time and the swap flag is a diagnostic on top.

## Threat to validity #1 — the role-isolation tradeoff (CRITICAL)

This is a **documented limitation**, not an implementation detail you can ignore. In Anvil, "baseline = without the artifact" is achieved by **subagent instruction / role** — a treatment runner prompted to apply the artifact's guidance versus a baseline runner prompted without it (or a specialized subagent versus `general-purpose`). It is **not** a clean separate process with config separation (no `claude -p`, no separate session). This is documented as risk #2 in [spike-findings.md](spike-findings.md) and in the idea brief.

**The threat:** treatment and baseline runners share the same session/model context. Isolation is **instruction-level**, which is weaker than process-level isolation — the baseline could in principle be contaminated by, or leak from, the shared context, so a measured `quality.delta` is a slightly optimistic-to-noisy estimate of the true with/without difference.

**The mitigations Anvil applies:**

- Lean on **clean comparisons** (well-separated treatment/baseline prompts; specialized-vs-`general-purpose` where it gives the sharpest contrast).
- **Position-swapped judging** so judge bias is measured and cancelled rather than assumed away.
- **Report CIs and variance** on every metric so a difference smaller than the noise band is never sold as a win.
- A **stricter isolation mode** (cleaner process separation) is acknowledged **future work**.

Read `quality.delta` as a directional, CI-bounded signal under instruction-level isolation — not as a clean-room A/B.

## Threat to validity #2 — the subscription cost caveat (CRITICAL)

When Anvil runs in-session on a Claude subscription, **`cost.usd` is an ESTIMATE, not a bill.** The exact wording of the caveat, from the header of `packages/core/src/pricing.ts`:

> When Anvil runs in-session on a Claude subscription, the transcript's `total_cost_usd` (when present) is an ESTIMATE the CLI computes; it is NOT what the subscription is billed (a subscription is a flat fee, not metered). Anvil therefore reports cost from **token math against this pinned table**, which is a deterministic, reproducible "what an equivalent metered API call would have cost" figure — explicitly a comparison/estimate, not a bill.

Concretely:

- **`cost.tokens` is the real, deterministic figure** — the actual billable token counts (input + output + cache-creation + cache-read) recovered from the transcript `usage` records.
- **`cost.usd` is derived** by multiplying those tokens against a **pinned, versioned pricing table** (`PRICING_VERSION`, USD per 1,000,000 tokens, per model family) via `costUsage` → `priceFor`. It answers *"what an equivalent metered API call would have cost"* — it is **not** what your flat-fee subscription is charged.
- The table is **versioned data**: a `PRICING_VERSION` date stamp and per-family prices, bumped (never mutated) so historical scorecards stay reproducible. Unknown model ids fall back to `DEFAULT_PRICING`.

Use `cost.tokens` as the hard, reproducible cost figure and `cost.usd` only as a comparable USD-equivalent estimate.

## Variance, confidence intervals, and reps

Every aggregate metric is computed over `repetitions` samples. `sampleStats` gives the mean, a Bessel-corrected (n−1) sample stdDev, and the standard error; `meanConfidenceInterval` builds a t-distribution CI (default 95%) from a small pinned t-table (`tCritical`), falling back to the normal-approx z for large/unlisted df — documented as an approximation adequate for Anvil's small rep counts. `MetricResult` carries `ci` and/or `stdDev` whenever `n > 1`. **More reps narrow the CI**; a single rep yields no spread and no CI.

## Plugin load integrity

`pluginIntegrity` aggregates `pluginErrors` across all traces. The scorecard's `pluginLoadOk` is `true` iff **no** plugin load error was observed during the run, and `pluginErrors` lists any that were. For a plugin artifact this is a first-class signal: a plugin that fails to load cleanly is broken regardless of its other scores.
