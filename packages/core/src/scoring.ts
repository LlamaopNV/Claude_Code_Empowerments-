/**
 * Scoring math (Ticket 1.5) — pure functions.
 *
 * Five concerns, each independently unit-tested:
 *   1. Deterministic expectation evaluation (regex/contains/not-contains/
 *      file-exists/file-contains/exit-code) → pass/fail + matched evidence.
 *   2. Pairwise judge aggregation with position-swap reconciliation → a
 *      calibrated quality-delta + win/lose/tie.
 *   3. Cost from token math against the pinned pricing table.
 *   4. Variance / confidence intervals over repetitions.
 *   5. Plugin load integrity from `pluginErrors`.
 * Plus {@link buildScorecard} which rolls case results into a {@link Scorecard},
 * always populating {@link MetricResult} spread (n>1 ⇒ ci or stdDev).
 */

import { existsSync, readFileSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';
import type { ArtifactRef, Expectation } from './eval.js';
import type {
  RunTrace,
  Usage,
  MetricResult,
  ConfidenceInterval,
  JudgeSample,
  JudgeVerdict,
  CaseResult,
  ConfusionMatrix,
  Scorecard,
  PluginError,
} from './result.js';
import { priceFor } from './pricing.js';
import { confusionMetrics } from './activation.js';

// ===========================================================================
// 1. Deterministic expectation evaluation
// ===========================================================================

/** Outcome of evaluating a single {@link Expectation}. */
export interface ExpectationOutcome {
  /** The expectation's discriminant (its `type`). */
  type: Expectation['type'];
  passed: boolean;
  /** Human-readable evidence for the pass/fail (the matched text, the reason). */
  evidence: string;
}

/** Context the deterministic checks evaluate against. */
export interface ExpectationContext {
  /** The run's final assistant text (for regex/contains/not-contains). */
  finalText: string;
  /**
   * Sandbox root for file-exists / file-contains checks. Relative expectation
   * paths resolve under this dir. REQUIRED for file checks; if absent, a file
   * check fails with an explanatory evidence string rather than throwing.
   */
  sandboxDir?: string;
  /** Exit code captured for an exit-code expectation, if the case ran a command. */
  exitCode?: number;
}

function evalContains(haystack: string, needle: string, caseSensitive: boolean): boolean {
  return caseSensitive
    ? haystack.includes(needle)
    : haystack.toLowerCase().includes(needle.toLowerCase());
}

function resolveSandboxPath(sandboxDir: string, p: string): string {
  return isAbsolute(p) ? p : join(sandboxDir, p);
}

/** Evaluate one expectation against the context. Never throws. */
export function evaluateExpectation(
  exp: Expectation,
  ctx: ExpectationContext,
): ExpectationOutcome {
  switch (exp.type) {
    case 'regex': {
      let re: RegExp;
      try {
        re = new RegExp(exp.pattern, exp.flags);
      } catch (err) {
        return {
          type: exp.type,
          passed: false,
          evidence: `invalid regex /${exp.pattern}/${exp.flags ?? ''}: ${(err as Error).message}`,
        };
      }
      const m = re.exec(ctx.finalText);
      return {
        type: exp.type,
        passed: m !== null,
        evidence: m !== null ? `matched "${m[0]}"` : `no match for /${exp.pattern}/${exp.flags ?? ''}`,
      };
    }
    case 'contains': {
      const ok = evalContains(ctx.finalText, exp.value, exp.caseSensitive);
      return {
        type: exp.type,
        passed: ok,
        evidence: ok ? `found "${exp.value}"` : `missing "${exp.value}"`,
      };
    }
    case 'not-contains': {
      const present = evalContains(ctx.finalText, exp.value, exp.caseSensitive);
      return {
        type: exp.type,
        passed: !present,
        evidence: present ? `unexpectedly found "${exp.value}"` : `absent "${exp.value}"`,
      };
    }
    case 'file-exists': {
      if (ctx.sandboxDir === undefined) {
        return { type: exp.type, passed: false, evidence: 'no sandboxDir provided for file check' };
      }
      const full = resolveSandboxPath(ctx.sandboxDir, exp.path);
      const ok = existsSync(full);
      return { type: exp.type, passed: ok, evidence: ok ? `exists: ${exp.path}` : `missing: ${exp.path}` };
    }
    case 'file-contains': {
      if (ctx.sandboxDir === undefined) {
        return { type: exp.type, passed: false, evidence: 'no sandboxDir provided for file check' };
      }
      const full = resolveSandboxPath(ctx.sandboxDir, exp.path);
      if (!existsSync(full)) {
        return { type: exp.type, passed: false, evidence: `missing: ${exp.path}` };
      }
      let content: string;
      try {
        content = readFileSync(full, 'utf8');
      } catch (err) {
        return { type: exp.type, passed: false, evidence: `unreadable ${exp.path}: ${(err as Error).message}` };
      }
      const ok = evalContains(content, exp.value, exp.caseSensitive);
      return {
        type: exp.type,
        passed: ok,
        evidence: ok ? `${exp.path} contains "${exp.value}"` : `${exp.path} missing "${exp.value}"`,
      };
    }
    case 'exit-code': {
      if (ctx.exitCode === undefined) {
        return { type: exp.type, passed: false, evidence: 'no exitCode captured for this case' };
      }
      const ok = ctx.exitCode === exp.code;
      return {
        type: exp.type,
        passed: ok,
        evidence: ok ? `exit ${exp.code}` : `exit ${ctx.exitCode}, expected ${exp.code}`,
      };
    }
  }
}

/** Evaluate every expectation; returns per-expectation outcomes + overall pass. */
export function evaluateExpectations(
  expectations: Expectation[],
  ctx: ExpectationContext,
): { outcomes: ExpectationOutcome[]; passed: boolean } {
  const outcomes = expectations.map((e) => evaluateExpectation(e, ctx));
  return { outcomes, passed: outcomes.every((o) => o.passed) };
}

// ===========================================================================
// 2. Pairwise judge aggregation (position-swap reconciliation)
// ===========================================================================

/**
 * Aggregated pairwise judgment for one case.
 *   - `winner` is the calibrated outcome after reconciling position bias.
 *   - `qualityDelta` ∈ [-1, 1]: +1 = treatment always wins, -1 = baseline
 *     always wins, 0 = tie / fully position-biased. Computed as
 *     (treatmentWins - baselineWins) / n over de-biased samples.
 *   - `positionBias` ∈ [0, 1]: fraction of swapped/unswapped pairs that
 *     DISAGREED purely by position (a calibration warning), where derivable.
 */
export interface JudgeAggregate {
  winner: JudgeVerdict;
  qualityDelta: number;
  treatmentWins: number;
  baselineWins: number;
  ties: number;
  n: number;
  positionBias: number;
}

/**
 * Reconcile pairwise judge samples into a calibrated verdict + quality-delta.
 *
 * Each {@link JudgeSample} reports a verdict in TREATMENT/BASELINE/TIE terms
 * (already de-positioned: the orchestrator records who actually won, accounting
 * for which slot they were shown in). The `swapped` flag records whether the
 * treatment was presented as option B; we use it only to MEASURE position bias,
 * not to re-interpret the verdict (the verdict is canonical).
 *
 * qualityDelta = (treatmentWins − baselineWins) / n.
 * positionBias = |winRate(unswapped) − winRate(swapped)| where both subsets are
 * non-empty (0 otherwise) — a high value flags a position-sensitive judge.
 */
export function aggregateJudgeSamples(samples: JudgeSample[]): JudgeAggregate {
  const n = samples.length;
  let treatmentWins = 0;
  let baselineWins = 0;
  let ties = 0;
  for (const s of samples) {
    if (s.verdict === 'treatment') treatmentWins += 1;
    else if (s.verdict === 'baseline') baselineWins += 1;
    else ties += 1;
  }

  const qualityDelta = n === 0 ? 0 : (treatmentWins - baselineWins) / n;

  let winner: JudgeVerdict;
  if (treatmentWins > baselineWins) winner = 'treatment';
  else if (baselineWins > treatmentWins) winner = 'baseline';
  else winner = 'tie';

  // Position-bias signal: compare treatment win-rate across swapped subsets.
  const unswapped = samples.filter((s) => !s.swapped);
  const swapped = samples.filter((s) => s.swapped);
  let positionBias = 0;
  if (unswapped.length > 0 && swapped.length > 0) {
    const rate = (subset: JudgeSample[]): number => {
      const wins = subset.filter((s) => s.verdict === 'treatment').length;
      const losses = subset.filter((s) => s.verdict === 'baseline').length;
      const decided = wins + losses;
      return decided === 0 ? 0 : wins / decided;
    };
    positionBias = Math.abs(rate(unswapped) - rate(swapped));
  }

  return { winner, qualityDelta, treatmentWins, baselineWins, ties, n, positionBias };
}

/**
 * Construct the two position-swapped judge prompts for a pair, proving the swap
 * flips the INPUTS not the verdict semantics. Returns `{a, b, swapped}` twice:
 * the canonical order and the swapped order. The orchestrator dispatches the
 * judge once per ordering; the verdict it records is always in treatment/
 * baseline terms (de-positioned at record time). Pure + deterministic so a test
 * can prove `swapped` truly exchanges the two payloads.
 */
export function buildSwappedPair<T>(
  treatment: T,
  baseline: T,
): { canonical: { a: T; b: T; swapped: false }; swapped: { a: T; b: T; swapped: true } } {
  return {
    canonical: { a: treatment, b: baseline, swapped: false },
    swapped: { a: baseline, b: treatment, swapped: true },
  };
}

// ===========================================================================
// 3. Cost (token × pinned pricing)
// ===========================================================================

/** A cost breakdown in USD for one trace (or a sum of traces). */
export interface CostBreakdown {
  /** Total billable tokens (input + output + cache write + cache read). */
  totalTokens: number;
  /** Estimated USD using the pinned pricing table. */
  usd: number;
  /** Per-component USD, for display. */
  components: {
    inputUsd: number;
    outputUsd: number;
    cacheWriteUsd: number;
    cacheReadUsd: number;
  };
}

/**
 * Cost a {@link Usage} against the pinned pricing for `modelId`.
 *
 * NOTE (subscription caveat, see pricing.ts): on a subscription this USD figure
 * is an ESTIMATE of the equivalent metered-API cost — it is NOT what the
 * subscription is billed. Anvil reports token-derived cost deliberately rather
 * than the transcript's `total_cost_usd`.
 */
export function costUsage(usage: Usage, modelId: string): CostBreakdown {
  const p = priceFor(modelId);
  const inputUsd = (usage.inputTokens / 1_000_000) * p.inputPerMTok;
  const outputUsd = (usage.outputTokens / 1_000_000) * p.outputPerMTok;
  const cacheWriteUsd = (usage.cacheCreationInputTokens / 1_000_000) * p.cacheWritePerMTok;
  const cacheReadUsd = (usage.cacheReadInputTokens / 1_000_000) * p.cacheReadPerMTok;
  return {
    totalTokens:
      usage.inputTokens +
      usage.outputTokens +
      usage.cacheCreationInputTokens +
      usage.cacheReadInputTokens,
    usd: inputUsd + outputUsd + cacheWriteUsd + cacheReadUsd,
    components: { inputUsd, outputUsd, cacheWriteUsd, cacheReadUsd },
  };
}

/** Sum usage across traces into one {@link Usage}. */
export function sumUsage(usages: Usage[]): Usage {
  return usages.reduce<Usage>(
    (acc, u) => ({
      inputTokens: acc.inputTokens + u.inputTokens,
      outputTokens: acc.outputTokens + u.outputTokens,
      cacheCreationInputTokens: acc.cacheCreationInputTokens + u.cacheCreationInputTokens,
      cacheReadInputTokens: acc.cacheReadInputTokens + u.cacheReadInputTokens,
    }),
    { inputTokens: 0, outputTokens: 0, cacheCreationInputTokens: 0, cacheReadInputTokens: 0 },
  );
}

// ===========================================================================
// 4. Variance / confidence intervals
// ===========================================================================

/** Summary statistics over a sample of numbers. */
export interface SampleStats {
  n: number;
  mean: number;
  /** Sample standard deviation (Bessel-corrected, n−1). 0 when n < 2. */
  stdDev: number;
  /** Standard error of the mean. 0 when n < 2. */
  stdErr: number;
}

/** Compute mean + sample stdDev + stdErr over `xs`. */
export function sampleStats(xs: number[]): SampleStats {
  const n = xs.length;
  if (n === 0) return { n: 0, mean: 0, stdDev: 0, stdErr: 0 };
  const mean = xs.reduce((a, b) => a + b, 0) / n;
  if (n < 2) return { n, mean, stdDev: 0, stdErr: 0 };
  const variance = xs.reduce((a, b) => a + (b - mean) * (b - mean), 0) / (n - 1);
  const stdDev = Math.sqrt(variance);
  return { n, mean, stdDev, stdErr: stdDev / Math.sqrt(n) };
}

/**
 * Two-tailed t critical value for a confidence `level` and `df` degrees of
 * freedom, from a small pinned lookup table (avoids a stats dependency). Falls
 * back to the normal-approx z for large df / unlisted levels. Adequate for the
 * small rep counts Anvil uses; documented as an approximation.
 */
export function tCritical(level: number, df: number): number {
  // 95% two-tailed t by df (1..30), then ∞.
  const t95: Record<number, number> = {
    1: 12.706, 2: 4.303, 3: 3.182, 4: 2.776, 5: 2.571, 6: 2.447, 7: 2.365,
    8: 2.306, 9: 2.262, 10: 2.228, 12: 2.179, 15: 2.131, 20: 2.086, 25: 2.06, 30: 2.042,
  };
  const z: Record<number, number> = { 0.9: 1.645, 0.95: 1.96, 0.99: 2.576 };
  if (level === 0.95) {
    if (df <= 0) return t95[1] ?? 12.706;
    if (t95[df] !== undefined) return t95[df];
    // pick the nearest lower listed df, else z.
    const keys = Object.keys(t95)
      .map(Number)
      .sort((a, b) => a - b);
    let chosen = z[0.95] ?? 1.96;
    for (const k of keys) if (k <= df) chosen = t95[k] as number;
    return chosen;
  }
  return z[level] ?? 1.96;
}

/**
 * Confidence interval for the MEAN of `xs` at `level` (default 0.95) using the
 * t-distribution. Returns `undefined` when n < 2 (no spread derivable).
 */
export function meanConfidenceInterval(
  xs: number[],
  level = 0.95,
): ConfidenceInterval | undefined {
  const s = sampleStats(xs);
  if (s.n < 2) return undefined;
  const t = tCritical(level, s.n - 1);
  const margin = t * s.stdErr;
  return { level, lower: s.mean - margin, upper: s.mean + margin };
}

/**
 * Build a {@link MetricResult} from raw samples, ALWAYS populating spread when
 * n>1 (the contract's hard refinement). When n<=1 spread is omitted (and the
 * schema allows it). `metric`/`unit` label the result.
 */
export function metricFromSamples(
  metric: string,
  xs: number[],
  opts: { unit?: string; level?: number } = {},
): MetricResult {
  const s = sampleStats(xs);
  const level = opts.level ?? 0.95;
  const base: MetricResult = {
    metric,
    value: s.mean,
    n: s.n,
    ...(opts.unit !== undefined ? { unit: opts.unit } : {}),
  };
  if (s.n > 1) {
    base.stdDev = s.stdDev;
    const ci = meanConfidenceInterval(xs, level);
    if (ci) base.ci = ci;
  }
  return base;
}

/**
 * Build a {@link MetricResult} for a single point estimate whose `n` reflects an
 * underlying sample count, with an explicit stdDev (e.g. a proportion's
 * binomial spread) so the n>1 spread contract is honored.
 */
export function metricFromPoint(
  metric: string,
  value: number,
  n: number,
  opts: { unit?: string; stdDev?: number; ci?: ConfidenceInterval } = {},
): MetricResult {
  const base: MetricResult = {
    metric,
    value,
    n,
    ...(opts.unit !== undefined ? { unit: opts.unit } : {}),
  };
  if (n > 1) {
    // Honor the spread contract: prefer an explicit stdDev/ci; else derive a
    // binomial-style stdDev for a proportion in [0,1].
    if (opts.stdDev !== undefined) base.stdDev = opts.stdDev;
    if (opts.ci !== undefined) base.ci = opts.ci;
    if (base.stdDev === undefined && base.ci === undefined) {
      if (value >= 0 && value <= 1) {
        base.stdDev = Math.sqrt((value * (1 - value)) / n);
      } else {
        base.stdDev = 0;
      }
    }
  }
  return base;
}

// ===========================================================================
// 5. Plugin load integrity
// ===========================================================================

/** Plugin-load integrity rollup across traces. */
export interface PluginIntegrity {
  ok: boolean;
  errors: PluginError[];
}

/** Aggregate plugin load errors across traces; `ok` iff none observed. */
export function pluginIntegrity(traces: RunTrace[]): PluginIntegrity {
  const errors: PluginError[] = [];
  for (const t of traces) errors.push(...t.pluginErrors);
  return { ok: errors.length === 0, errors };
}

// ===========================================================================
// buildScorecard — roll case results into a Scorecard
// ===========================================================================

/** Per-case input to {@link buildScorecard}. */
export interface ScoringCaseInput {
  caseId: string;
  /** Ground truth: should the artifact have fired? */
  shouldActivate: boolean;
  /** Whether it actually fired (from the activation detector). */
  activated: boolean;
  /** Deterministic expectation outcomes (already evaluated). */
  expectationResults: boolean[];
  /** Pairwise judge samples for this case (may be empty). */
  judgeSamples: JudgeSample[];
  /** Token usage summed for this case's TREATMENT runs (for cost). */
  treatmentUsage?: Usage;
  treatmentTraceId?: string;
  baselineTraceId?: string;
}

/** Everything {@link buildScorecard} needs beyond the per-case inputs. */
export interface BuildScorecardArgs {
  runId: string;
  suiteName: string;
  artifact: ArtifactRef;
  createdAt: string;
  judgeModel: string;
  runModel: string;
  repetitions: number;
  cases: ScoringCaseInput[];
  /** Traces gathered for plugin-integrity + (optionally) extra cost context. */
  traces?: RunTrace[];
  /** CI confidence level (default 0.95). */
  level?: number;
  comparedToRunId?: string;
}

/** Build the activation {@link ConfusionMatrix} directly from scoring inputs. */
function confusionFromCases(cases: ScoringCaseInput[]): ConfusionMatrix {
  let truePositive = 0;
  let falsePositive = 0;
  let trueNegative = 0;
  let falseNegative = 0;
  const falsePositiveCaseIds: string[] = [];
  const falseNegativeCaseIds: string[] = [];
  for (const c of cases) {
    if (c.shouldActivate && c.activated) truePositive += 1;
    else if (!c.shouldActivate && c.activated) {
      falsePositive += 1;
      falsePositiveCaseIds.push(c.caseId);
    } else if (!c.shouldActivate && !c.activated) trueNegative += 1;
    else {
      falseNegative += 1;
      falseNegativeCaseIds.push(c.caseId);
    }
  }
  return {
    truePositive,
    falsePositive,
    trueNegative,
    falseNegative,
    falsePositiveCaseIds,
    falseNegativeCaseIds,
  };
}

/**
 * Roll per-case scoring inputs into a complete {@link Scorecard}.
 *
 * Metrics produced (each carrying spread when n>1):
 *   - `activation.precision` / `.recall` / `.f1` (n = relevant case count)
 *   - `quality.delta` (mean per-case judge delta over judged cases)
 *   - `cost.tokens` (mean treatment tokens per case)
 * The result validates against the frozen {@link Scorecard} schema.
 */
export function buildScorecard(args: BuildScorecardArgs): Scorecard {
  const level = args.level ?? 0.95;
  const confusion = confusionFromCases(args.cases);
  const m = confusionMetrics(confusion);

  // Per-case rollup.
  const caseResults: CaseResult[] = args.cases.map((c) => ({
    caseId: c.caseId,
    activated: c.activated,
    activationCorrect: c.activated === c.shouldActivate,
    expectationsPassed: c.expectationResults.every((x) => x),
    expectationResults: c.expectationResults,
    judgeSamples: c.judgeSamples,
    ...(c.treatmentTraceId !== undefined ? { treatmentTraceId: c.treatmentTraceId } : {}),
    ...(c.baselineTraceId !== undefined ? { baselineTraceId: c.baselineTraceId } : {}),
  }));

  const metrics: Record<string, MetricResult> = {};

  // Activation metrics — n is the relevant denominator; spread via binomial.
  metrics['activation.precision'] = metricFromPoint(
    'activation.precision',
    m.precision,
    Math.max(m.predictedPositive, 1),
    { unit: 'ratio' },
  );
  metrics['activation.recall'] = metricFromPoint(
    'activation.recall',
    m.recall,
    Math.max(m.actualPositive, 1),
    { unit: 'ratio' },
  );
  const totalCases = args.cases.length;
  metrics['activation.f1'] = metricFromPoint('activation.f1', m.f1, Math.max(totalCases, 1), {
    unit: 'ratio',
  });

  // Quality delta — mean of per-case judge deltas over judged cases.
  const perCaseDeltas: number[] = args.cases
    .filter((c) => c.judgeSamples.length > 0)
    .map((c) => aggregateJudgeSamples(c.judgeSamples).qualityDelta);
  if (perCaseDeltas.length > 0) {
    metrics['quality.delta'] = metricFromSamples('quality.delta', perCaseDeltas, {
      unit: 'ratio',
      level,
    });
  }

  // Cost — mean treatment tokens per case (only cases that recorded usage).
  const perCaseTokens: number[] = args.cases
    .filter((c) => c.treatmentUsage !== undefined)
    .map((c) => costUsage(c.treatmentUsage as Usage, args.runModel).totalTokens);
  if (perCaseTokens.length > 0) {
    metrics['cost.tokens'] = metricFromSamples('cost.tokens', perCaseTokens, {
      unit: 'tokens',
      level,
    });
    const perCaseUsd: number[] = args.cases
      .filter((c) => c.treatmentUsage !== undefined)
      .map((c) => costUsage(c.treatmentUsage as Usage, args.runModel).usd);
    metrics['cost.usd'] = metricFromSamples('cost.usd', perCaseUsd, { unit: 'usd', level });
  }

  const integrity = pluginIntegrity(args.traces ?? []);

  const scorecard: Scorecard = {
    schemaVersion: 1,
    runId: args.runId,
    suiteName: args.suiteName,
    artifact: args.artifact,
    createdAt: args.createdAt,
    judgeModel: args.judgeModel,
    runModel: args.runModel,
    repetitions: args.repetitions,
    metrics,
    confusion,
    cases: caseResults,
    pluginLoadOk: integrity.ok,
    pluginErrors: integrity.errors,
    ...(args.comparedToRunId !== undefined ? { comparedToRunId: args.comparedToRunId } : {}),
  };
  return scorecard;
}
