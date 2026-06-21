import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { parseScorecard, type Scorecard, type MetricResult } from '@anvil/core';
import {
  formatMetricValue,
  formatSpread,
  confusionRates,
  tallyJudgeSamples,
  headlineVerdict,
  buildOverhead,
  sortEntries,
  filterByKind,
  getMetric,
} from './transforms.js';

const here = dirname(fileURLToPath(import.meta.url));
const fixtures = resolve(here, '../../../core/fixtures');
const card: Scorecard = parseScorecard(
  JSON.parse(readFileSync(resolve(fixtures, 'result.scorecard.json'), 'utf8')),
);

const metric = (over: Partial<MetricResult> = {}): MetricResult => ({
  metric: 'm',
  value: 0.5,
  n: 10,
  unit: 'ratio',
  ...over,
});

describe('formatMetricValue', () => {
  it('formats ratios as percentages', () => {
    expect(formatMetricValue(metric({ value: 0.42 }))).toBe('42.0%');
  });
  it('formats tokens with separators', () => {
    expect(formatMetricValue(metric({ value: 18342, unit: 'tokens' }))).toBe('18,342 tok');
  });
  it('formats usd and ms', () => {
    expect(formatMetricValue(metric({ value: 0.1234, unit: 'usd' }))).toBe('$0.1234');
    expect(formatMetricValue(metric({ value: 1200, unit: 'ms' }))).toBe('1,200 ms');
  });
});

describe('formatSpread', () => {
  it('renders a CI for a ratio metric', () => {
    const m = getMetric(card, 'quality.delta')!;
    expect(formatSpread(m)).toBe('95% CI [18.0%, 66.0%]');
  });
  it('is empty for n <= 1 (no spread to show)', () => {
    expect(formatSpread(metric({ n: 1, ci: undefined }))).toBe('');
  });
  it('falls back to stdDev when no CI', () => {
    expect(formatSpread(metric({ stdDev: 0.1, ci: undefined }))).toBe('±10.0% sd');
  });
});

describe('confusionRates', () => {
  it('computes precision/recall/f1 from the fixture matrix', () => {
    const r = confusionRates(card.confusion);
    // tp=12 fp=0 fn=3 tn=10
    expect(r.precision).toBe(1);
    expect(r.recall).toBeCloseTo(0.8, 5);
    expect(r.f1).toBeCloseTo(0.8889, 3);
    expect(r.total).toBe(25);
  });
  it('guards divide-by-zero with nulls (empty matrix)', () => {
    const r = confusionRates({
      truePositive: 0,
      falsePositive: 0,
      trueNegative: 0,
      falseNegative: 0,
      falsePositiveCaseIds: [],
      falseNegativeCaseIds: [],
    });
    expect(r.precision).toBeNull();
    expect(r.recall).toBeNull();
    expect(r.f1).toBeNull();
    expect(r.accuracy).toBeNull();
  });
});

describe('tallyJudgeSamples', () => {
  it('tallies treatment/baseline/tie and net win fraction', () => {
    const t = tallyJudgeSamples(card.cases);
    // fixture: 4 treatment + 1 tie across cases
    expect(t.treatment).toBe(4);
    expect(t.baseline).toBe(0);
    expect(t.tie).toBe(1);
    expect(t.total).toBe(5);
    expect(t.net).toBeCloseTo(0.8, 5);
  });
  it('net is null with no samples', () => {
    expect(tallyJudgeSamples([]).net).toBeNull();
  });
});

describe('headlineVerdict', () => {
  it('calls the fixture "good" (positive CI-clear delta, decent F1)', () => {
    expect(headlineVerdict(card).tone).toBe('good');
  });
  it('flags plugin load failure as bad', () => {
    expect(headlineVerdict({ ...card, pluginLoadOk: false }).tone).toBe('bad');
  });
  it('flags a negative delta as bad', () => {
    const bad = {
      ...card,
      metrics: { ...card.metrics, 'quality.delta': metric({ value: -0.2 }) },
    };
    expect(headlineVerdict(bad).tone).toBe('bad');
  });
});

describe('buildOverhead', () => {
  it('builds per-case overhead from a token map and skips unresolved cases', () => {
    const tokens: Record<string, number> = {
      'agent-aa11bb22cc33dd44': 4412,
      'agent-ee55ff66aa77bb88': 3000,
      'agent-7777888899990000': 5000,
      'agent-0000111122223333': 4500,
    };
    const pts = buildOverhead(card.cases, tokens);
    // Only cases with BOTH trace ids present in the map are included.
    expect(pts.map((p) => p.caseId)).toEqual(['sf-vague-app-idea', 'task-sharpen-and-summarize']);
    expect(pts[0]!.overhead).toBe(1412);
  });
});

describe('sortEntries / filterByKind', () => {
  const entries = [
    { artifactKind: 'skill', artifactName: 'b', createdAt: '2026-01-01', headline: { qualityDelta: 0.1, costTokens: 100 } },
    { artifactKind: 'subagent', artifactName: 'a', createdAt: '2026-02-01', headline: { qualityDelta: 0.5, costTokens: 50 } },
  ] as never[];

  it('sorts by quality delta desc', () => {
    const s = sortEntries(entries, 'qualityDelta');
    expect((s[0] as { artifactName: string }).artifactName).toBe('a');
  });
  it('sorts by cost asc puts cheapest first', () => {
    const s = sortEntries(entries, 'costTokens', 'asc');
    expect((s[0] as { headline: { costTokens: number } }).headline.costTokens).toBe(50);
  });
  it('filters by kind', () => {
    expect(filterByKind(entries, 'skill').length).toBe(1);
    expect(filterByKind(entries, 'all').length).toBe(2);
  });
});
