import { describe, it, expect } from 'vitest';
import { computeRunDelta, type AppliedEdit, type RunDelta } from './delta.js';
import type { Scorecard, MetricResult } from './result.js';

function metric(metricId: string, value: number, n = 5): MetricResult {
  return n > 1
    ? { metric: metricId, value, n, stdDev: 0.1, unit: 'ratio' }
    : { metric: metricId, value, n };
}

function card(runId: string, metrics: Record<string, MetricResult>, comparedToRunId?: string): Scorecard {
  return {
    schemaVersion: 1,
    runId,
    suiteName: 'demo',
    artifact: { kind: 'skill', name: 'demo' },
    createdAt: '2026-06-21T00:00:00.000Z',
    judgeModel: 'claude-opus-4-20250514',
    runModel: 'claude-sonnet-4-20250514',
    repetitions: 5,
    metrics,
    confusion: {
      truePositive: 1,
      falsePositive: 0,
      trueNegative: 1,
      falseNegative: 0,
      falsePositiveCaseIds: [],
      falseNegativeCaseIds: [],
    },
    cases: [],
    pluginLoadOk: true,
    pluginErrors: [],
    ...(comparedToRunId !== undefined ? { comparedToRunId } : {}),
  };
}

describe('computeRunDelta', () => {
  const before = card('run-before', {
    'activation.f1': metric('activation.f1', 0.6),
    'quality.delta': metric('quality.delta', 0.1),
    'cost.tokens': metric('cost.tokens', 1000),
  });
  const after = card(
    'run-after',
    {
      'activation.f1': metric('activation.f1', 0.9),
      'quality.delta': metric('quality.delta', 0.4),
      'cost.tokens': metric('cost.tokens', 1100),
    },
    'run-before',
  );

  const edits: AppliedEdit[] = [
    {
      file: 'plugins/anvil/skills/demo/SKILL.md',
      summary: 'sharpened the trigger description to kill false-negatives',
      targetMetric: 'activation.recall',
    },
  ];

  it('computes per-metric before/after/delta for metrics present in both', () => {
    const d: RunDelta = computeRunDelta({ before, after, appliedEdits: edits });
    const f1 = d.metrics.find((m) => m.metric === 'activation.f1');
    expect(f1).toBeDefined();
    expect(f1?.before).toBe(0.6);
    expect(f1?.after).toBe(0.9);
    expect(f1?.delta).toBeCloseTo(0.3, 6);
    expect(f1?.improved).toBe(true);
  });

  it('treats cost as "lower is better" — a cost increase is NOT an improvement', () => {
    const d = computeRunDelta({ before, after, appliedEdits: edits });
    const cost = d.metrics.find((m) => m.metric === 'cost.tokens');
    expect(cost?.delta).toBeCloseTo(100, 6);
    expect(cost?.improved).toBe(false); // cost went up
  });

  it('records the before/after run ids and the applied edits', () => {
    const d = computeRunDelta({ before, after, appliedEdits: edits });
    expect(d.beforeRunId).toBe('run-before');
    expect(d.afterRunId).toBe('run-after');
    expect(d.appliedEdits).toEqual(edits);
  });

  it('flags an inconsistency when after.comparedToRunId does not match before.runId', () => {
    const mismatched = card('run-after', after.metrics, 'some-other-run');
    const d = computeRunDelta({ before, after: mismatched, appliedEdits: edits });
    expect(d.warnings.some((w) => /comparedToRunId/i.test(w))).toBe(true);
  });

  it('skips metrics absent from either card (no phantom deltas)', () => {
    const partial = card('run-after', { 'activation.f1': metric('activation.f1', 0.7) }, 'run-before');
    const d = computeRunDelta({ before, after: partial, appliedEdits: [] });
    expect(d.metrics.map((m) => m.metric)).toEqual(['activation.f1']);
  });

  it('summarizes overall direction: improved if the headline quality.delta rose', () => {
    const d = computeRunDelta({ before, after, appliedEdits: edits });
    expect(d.headlineImproved).toBe(true);
  });
});
