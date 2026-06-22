/**
 * Pure transforms over the frozen @anvil/core contract — display-ready values
 * derived from `Scorecard` / `MetricResult` / `ConfusionMatrix` / `CaseResult`.
 * No React, no I/O: unit-tested in isolation.
 */
import type {
  Scorecard,
  MetricResult,
  ConfusionMatrix,
  CaseResult,
  RunIndexEntry,
} from '@anvil/core';

/** Format a metric value for display, honouring its unit. */
export function formatMetricValue(m: MetricResult): string {
  const u = m.unit ?? '';
  if (u === 'tokens') return `${Math.round(m.value).toLocaleString()} tok`;
  if (u === 'usd') return `$${m.value.toFixed(4)}`;
  if (u === 'ms') return `${Math.round(m.value).toLocaleString()} ms`;
  if (u === 'ratio') return formatRatio(m.value);
  // Unknown unit: show the raw number trimmed.
  return trimNum(m.value);
}

/** A ratio (0..1) as a percentage with one decimal. Pass-through for >1 deltas. */
export function formatRatio(v: number): string {
  return `${(v * 100).toFixed(1)}%`;
}

function trimNum(v: number): string {
  return Number.isInteger(v) ? String(v) : v.toFixed(3);
}

/**
 * Human spread string for a metric: a CI if present, else ±stdDev, else "".
 * Empty when n <= 1 (a single sample has no meaningful spread).
 */
export function formatSpread(m: MetricResult): string {
  if (m.n <= 1) return '';
  const asUnit = (x: number): string =>
    m.unit === 'ratio' ? formatRatio(x) : trimNum(x);
  if (m.ci) {
    const pct = Math.round(m.ci.level * 100);
    return `${pct}% CI [${asUnit(m.ci.lower)}, ${asUnit(m.ci.upper)}]`;
  }
  if (m.stdDev !== undefined) return `±${asUnit(m.stdDev)} sd`;
  return '';
}

/** Convenience: a metric lookup that won't throw on a missing key. */
export function getMetric(card: Scorecard, key: string): MetricResult | undefined {
  return card.metrics[key];
}

/** Derived confusion-matrix rates. Guards against divide-by-zero (→ null). */
export interface ConfusionRates {
  precision: number | null;
  recall: number | null;
  f1: number | null;
  accuracy: number | null;
  total: number;
}

export function confusionRates(c: ConfusionMatrix): ConfusionRates {
  const { truePositive: tp, falsePositive: fp, trueNegative: tn, falseNegative: fn } = c;
  const total = tp + fp + tn + fn;
  const precision = tp + fp > 0 ? tp / (tp + fp) : null;
  const recall = tp + fn > 0 ? tp / (tp + fn) : null;
  const f1 =
    precision !== null && recall !== null && precision + recall > 0
      ? (2 * precision * recall) / (precision + recall)
      : null;
  const accuracy = total > 0 ? (tp + tn) / total : null;
  return { precision, recall, f1, accuracy, total };
}

/** Tally of pairwise judge samples across all judged cases. */
export interface JudgeTally {
  treatment: number;
  baseline: number;
  tie: number;
  total: number;
  /** Net win fraction = (treatment − baseline) / total, or null if no samples. */
  net: number | null;
}

export function tallyJudgeSamples(cases: CaseResult[]): JudgeTally {
  let treatment = 0;
  let baseline = 0;
  let tie = 0;
  for (const c of cases) {
    for (const s of c.judgeSamples) {
      if (s.verdict === 'treatment') treatment++;
      else if (s.verdict === 'baseline') baseline++;
      else tie++;
    }
  }
  const total = treatment + baseline + tie;
  return {
    treatment,
    baseline,
    tie,
    total,
    net: total > 0 ? (treatment - baseline) / total : null,
  };
}

/** A one-line headline verdict for a scorecard. */
export type VerdictTone = 'good' | 'mixed' | 'bad' | 'unknown';
export interface Verdict {
  tone: VerdictTone;
  label: string;
  detail: string;
}

/**
 * Headline verdict from quality delta + activation F1 + plugin integrity.
 * Deliberately conservative: a positive, CI-above-zero quality delta with a
 * decent F1 is "good"; a negative/uncertain delta or load failure is "bad".
 */
export function headlineVerdict(card: Scorecard): Verdict {
  if (!card.pluginLoadOk) {
    return {
      tone: 'bad',
      label: 'Plugin failed to load',
      detail: 'Load errors were observed during the run; scores are unreliable.',
    };
  }
  const delta = card.metrics['quality.delta'];
  const f1 = card.metrics['activation.f1'];
  const deltaPos = delta ? delta.value > 0 : false;
  const deltaCertain = delta?.ci ? delta.ci.lower > 0 : false;
  const f1Ok = f1 ? f1.value >= 0.7 : false;

  if (deltaPos && deltaCertain && f1Ok) {
    return {
      tone: 'good',
      label: 'Helps: measurable improvement',
      detail: `Quality delta ${delta ? formatRatio(delta.value) : ''} (CI excludes 0) with F1 ${
        f1 ? formatRatio(f1.value) : ''
      }.`,
    };
  }
  if (delta && delta.value < 0) {
    return {
      tone: 'bad',
      label: 'Hurts: negative quality delta',
      detail: `Treatment scored worse than baseline (${formatRatio(delta.value)}).`,
    };
  }
  return {
    tone: 'mixed',
    label: 'Inconclusive',
    detail: deltaPos
      ? 'Positive delta but the confidence interval still includes 0, or activation is weak.'
      : 'Not enough signal to call it; gather more reps or sharpen the suite.',
  };
}

/** Per-case cost/latency overhead point for the compare chart. */
export interface OverheadPoint {
  caseId: string;
  treatmentTokens: number;
  baselineTokens: number;
  /** treatment − baseline (token overhead the artifact adds). */
  overhead: number;
}

/**
 * Build per-case overhead from a token lookup keyed by traceId. Cases without
 * both traces (or without resolvable tokens) are skipped. Pure: the caller
 * supplies the token map (resolved from traces).
 */
export function buildOverhead(
  cases: CaseResult[],
  tokensByTrace: Record<string, number>,
): OverheadPoint[] {
  const out: OverheadPoint[] = [];
  for (const c of cases) {
    if (!c.treatmentTraceId || !c.baselineTraceId) continue;
    const t = tokensByTrace[c.treatmentTraceId];
    const b = tokensByTrace[c.baselineTraceId];
    if (t === undefined || b === undefined) continue;
    out.push({
      caseId: c.caseId,
      treatmentTokens: t,
      baselineTokens: b,
      overhead: t - b,
    });
  }
  return out;
}

/** Newest-first index sort (kept from the original skeleton). */
export function sortByNewest(entries: RunIndexEntry[]): RunIndexEntry[] {
  return [...entries].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** Leaderboard sort keys. */
export type SortKey = 'createdAt' | 'qualityDelta' | 'activationF1' | 'costTokens' | 'artifactName';

/** Sort index entries by a headline key, descending by default. */
export function sortEntries(
  entries: RunIndexEntry[],
  key: SortKey,
  dir: 'asc' | 'desc' = 'desc',
): RunIndexEntry[] {
  const mul = dir === 'desc' ? -1 : 1;
  const val = (e: RunIndexEntry): number | string => {
    switch (key) {
      case 'createdAt':
        return e.createdAt;
      case 'artifactName':
        return e.artifactName;
      case 'qualityDelta':
        return e.headline.qualityDelta ?? Number.NEGATIVE_INFINITY;
      case 'activationF1':
        return e.headline.activationF1 ?? Number.NEGATIVE_INFINITY;
      case 'costTokens':
        return e.headline.costTokens ?? Number.POSITIVE_INFINITY;
    }
  };
  return [...entries].sort((a, b) => {
    const av = val(a);
    const bv = val(b);
    if (typeof av === 'string' && typeof bv === 'string') return mul * av.localeCompare(bv);
    return mul * ((av as number) - (bv as number));
  });
}

/** Filter entries by artifact kind ("all" = no filter). */
export function filterByKind(
  entries: RunIndexEntry[],
  kind: 'all' | 'skill' | 'subagent' | 'plugin',
): RunIndexEntry[] {
  if (kind === 'all') return entries;
  return entries.filter((e) => e.artifactKind === kind);
}
