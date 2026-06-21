/**
 * Run delta tracking (Ticket 5.3) — the improvement loop's before/after record.
 *
 * The whole point of Anvil is to PROVE an edit helped, not assert it. After the
 * `improving-an-artifact` skill applies an analyst's proposal and re-runs the
 * eval, it has two scorecards: the `before` run and the `after` run (whose
 * {@link Scorecard.comparedToRunId} back-references the before run). This helper
 * turns that pair + the applied-edit summary into a {@link RunDelta} the UI can
 * render as an improvement timeline.
 *
 * Pure + I/O-free. It reuses the existing `comparedToRunId` field on the
 * Scorecard (no schema change needed) and is purely DERIVED from two cards, so
 * nothing new has to be persisted beyond the two scorecards + the edit summary
 * the skill records alongside them.
 *
 * Metric direction: most metrics are "higher is better" (activation.*,
 * quality.delta). `cost.*` is "lower is better" — an increase is a regression.
 * {@link computeRunDelta} encodes that so `improved` is meaningful per metric.
 */

import type { Scorecard } from './result.js';

/** One file edit the improvement loop applied, tied to the metric it targets. */
export interface AppliedEdit {
  /** Repo-relative path of the edited artifact file. */
  file: string;
  /** Human-readable summary of the change. */
  summary: string;
  /** The metric this edit was intended to move (e.g. "activation.recall"). */
  targetMetric?: string;
}

/** Per-metric before/after comparison. */
export interface MetricDelta {
  metric: string;
  before: number;
  after: number;
  /** after − before (raw). */
  delta: number;
  /** True iff the change is in the BENEFICIAL direction for this metric. */
  improved: boolean;
}

/** The full improvement-delta record between two runs. */
export interface RunDelta {
  beforeRunId: string;
  afterRunId: string;
  /** Per-metric deltas, for metrics present in BOTH cards. */
  metrics: MetricDelta[];
  /** The edits applied between the two runs. */
  appliedEdits: AppliedEdit[];
  /** True iff the headline `quality.delta` rose (the loop's primary objective). */
  headlineImproved: boolean;
  /** Consistency warnings (e.g. the after card doesn't reference the before run). */
  warnings: string[];
}

/** Metric-id prefixes for which a LOWER value is better. */
const LOWER_IS_BETTER = ['cost.'];

/** Whether a metric improves when its value goes DOWN. */
function lowerIsBetter(metricId: string): boolean {
  return LOWER_IS_BETTER.some((p) => metricId.startsWith(p));
}

/** Arguments to {@link computeRunDelta}. */
export interface ComputeRunDeltaArgs {
  before: Scorecard;
  after: Scorecard;
  appliedEdits: AppliedEdit[];
}

/**
 * Compute the {@link RunDelta} between a before and after scorecard.
 *
 * Only metrics present in BOTH cards are compared (no phantom deltas from a
 * metric that appeared/disappeared). `improved` respects each metric's
 * beneficial direction. A `headlineImproved` flag tracks the primary objective
 * (`quality.delta` rising). A warning is emitted if the `after` card's
 * `comparedToRunId` doesn't point at the `before` run, which signals the caller
 * paired the wrong runs.
 */
export function computeRunDelta(args: ComputeRunDeltaArgs): RunDelta {
  const { before, after, appliedEdits } = args;
  const warnings: string[] = [];

  if (after.comparedToRunId !== undefined && after.comparedToRunId !== before.runId) {
    warnings.push(
      `after.comparedToRunId ("${after.comparedToRunId}") does not match before.runId ("${before.runId}") — ` +
        'these may not be a valid before/after pair',
    );
  } else if (after.comparedToRunId === undefined) {
    warnings.push(
      'after scorecard has no comparedToRunId set — the improvement loop should set it to the before runId',
    );
  }

  const metrics: MetricDelta[] = [];
  // Deterministic order: sort metric ids.
  const sharedIds = Object.keys(after.metrics)
    .filter((id) => id in before.metrics)
    .sort();

  for (const id of sharedIds) {
    const b = before.metrics[id]?.value;
    const a = after.metrics[id]?.value;
    if (b === undefined || a === undefined) continue;
    const delta = a - b;
    const improved = lowerIsBetter(id) ? delta < 0 : delta > 0;
    metrics.push({ metric: id, before: b, after: a, delta, improved });
  }

  const qd = metrics.find((m) => m.metric === 'quality.delta');
  const headlineImproved = qd !== undefined ? qd.improved : false;

  return {
    beforeRunId: before.runId,
    afterRunId: after.runId,
    metrics,
    appliedEdits,
    headlineImproved,
    warnings,
  };
}
