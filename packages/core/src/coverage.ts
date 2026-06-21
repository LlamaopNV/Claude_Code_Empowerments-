/**
 * Suite coverage & balance check (Ticket 4.3).
 *
 * A scorecard is only as trustworthy as the suite behind it. A suite with no
 * should-not-fire near-misses can't measure trigger precision; one with a single
 * lopsided bucket biases the activation F1; a judged case with no rubric gives
 * the LLM judge nothing to anchor on; a case with neither a rubric nor a
 * deterministic expectation can NEVER fail and is dead weight.
 *
 * This deterministic, I/O-free check inspects an {@link EvalSuite} and returns
 * an advisory {@link CoverageReport} — ERRORS (the suite is untrustworthy as-is)
 * and WARNINGS (it would be stronger if…). The `generating-test-data` skill runs
 * it after generation and surfaces it for human review before any eval is run.
 *
 * Adversarial design notes (what would make this mis-fire, and how it's guarded):
 *   - An all-should-fire suite looks "complete" but measures only recall → ERROR
 *     on a missing should-not-fire bucket.
 *   - A judge with no rubric defaults to vibes → WARN per judged case missing a
 *     rubric. (We don't ERROR: a deterministic-only task case is legitimate.)
 *   - A case with no rubric AND no expectations is unfalsifiable → ERROR.
 *   - Bucket imbalance is a spectrum; we WARN past a ratio threshold rather than
 *     hard-fail, since some artifacts legitimately have more positives.
 */

import type { EvalSuite, EvalCase, CaseBucket } from './eval.js';

/** Per-bucket case counts. */
export type BucketCounts = Record<CaseBucket, number>;

/** The advisory result of {@link checkSuiteCoverage}. */
export interface CoverageReport {
  /** True iff there are no ERRORS (warnings alone don't fail the suite). */
  ok: boolean;
  /** Case counts per bucket. */
  buckets: BucketCounts;
  /** Conditions that make the suite untrustworthy — fix before trusting scores. */
  errors: string[];
  /** Conditions that would strengthen the suite but don't invalidate it. */
  warnings: string[];
}

/**
 * The ratio past which two buckets are considered severely imbalanced. With a
 * 5:1 (or worse) ratio between the largest and smallest present bucket, the
 * activation metrics start to be dominated by one side; we warn.
 */
const IMBALANCE_RATIO = 5;

/** Count cases per bucket. */
function countBuckets(cases: EvalCase[]): BucketCounts {
  const counts: BucketCounts = { 'should-fire': 0, 'should-not-fire': 0, task: 0 };
  for (const c of cases) counts[c.bucket] += 1;
  return counts;
}

/** A case is "judged" (needs a rubric to anchor the LLM judge) when it can fire. */
function isJudgedBucket(bucket: CaseBucket): boolean {
  return bucket === 'should-fire' || bucket === 'task';
}

/**
 * Run the deterministic coverage/balance check over a suite. Pure: same input →
 * same report. Never throws (assumes a schema-valid suite; callers parse first).
 */
export function checkSuiteCoverage(suite: EvalSuite): CoverageReport {
  const buckets = countBuckets(suite.cases);
  const errors: string[] = [];
  const warnings: string[] = [];

  // 1. Required buckets — should-fire AND should-not-fire are both mandatory for
  //    a meaningful activation signal (recall AND precision).
  if (buckets['should-fire'] === 0) {
    errors.push(
      'no "should-fire" cases: cannot measure activation recall (does the artifact fire when it should?)',
    );
  }
  if (buckets['should-not-fire'] === 0) {
    errors.push(
      'no "should-not-fire" near-miss cases: cannot measure trigger precision (does it wrongly fire on adjacent prompts?)',
    );
  }

  // 2. Bucket balance — warn on a severe imbalance among PRESENT buckets.
  const present = (Object.values(buckets) as number[]).filter((n) => n > 0);
  if (present.length >= 2) {
    const max = Math.max(...present);
    const min = Math.min(...present);
    if (min > 0 && max / min >= IMBALANCE_RATIO) {
      warnings.push(
        `bucket imbalance (largest:smallest = ${max}:${min} ≥ ${IMBALANCE_RATIO}:1) — ` +
          'metrics will be dominated by the larger bucket; consider rebalancing',
      );
    }
  }

  // 3. Per-case rubric / falsifiability checks.
  for (const c of suite.cases) {
    const hasRubric = typeof c.rubric === 'string' && c.rubric.trim().length > 0;
    const hasExpectations = c.expectations.length > 0;

    if (isJudgedBucket(c.bucket) && !hasRubric) {
      warnings.push(
        `case "${c.id}" (${c.bucket}) has no rubric — the LLM judge has nothing to anchor on; ` +
          'add a rubric describing what a strong answer looks like',
      );
    }

    // A should-fire / task case that can NEITHER be judged NOR deterministically
    // checked is unfalsifiable: beyond activation it can never contribute a fail,
    // so it's dead weight. A should-not-fire case is exempt — its falsifiability
    // comes from the activation outcome itself (it just must not fire).
    if (isJudgedBucket(c.bucket) && !hasRubric && !hasExpectations) {
      errors.push(
        `case "${c.id}" (${c.bucket}) has neither a rubric nor expectations — beyond activation it can never fail; ` +
          'add a rubric (for the judge) or a deterministic expectation',
      );
    }
  }

  return { ok: errors.length === 0, buckets, errors, warnings };
}
