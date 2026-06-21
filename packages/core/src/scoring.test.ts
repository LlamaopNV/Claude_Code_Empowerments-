import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  evaluateExpectation,
  evaluateExpectations,
  aggregateJudgeSamples,
  buildSwappedPair,
  costUsage,
  sumUsage,
  sampleStats,
  meanConfidenceInterval,
  metricFromSamples,
  metricFromPoint,
  pluginIntegrity,
  buildScorecard,
  priceFor,
  PRICING_VERSION,
  parseScorecard,
  type Expectation,
  type JudgeSample,
  type Usage,
  type RunTrace,
  type ArtifactRef,
} from './index.js';

// ===========================================================================
// 1. Deterministic expectation evaluation
// ===========================================================================

describe('evaluateExpectation — text checks', () => {
  const ctx = { finalText: 'The Quick Brown Fox jumps.' };

  it('regex pass + matched evidence', () => {
    const r = evaluateExpectation({ type: 'regex', pattern: 'Qu\\w+', flags: '' }, ctx);
    expect(r.passed).toBe(true);
    expect(r.evidence).toContain('Quick');
  });

  it('regex with bad pattern fails gracefully (no throw)', () => {
    const r = evaluateExpectation({ type: 'regex', pattern: '(' }, ctx);
    expect(r.passed).toBe(false);
    expect(r.evidence).toMatch(/invalid regex/);
  });

  it('contains honours caseSensitive', () => {
    expect(evaluateExpectation({ type: 'contains', value: 'quick', caseSensitive: true }, ctx).passed).toBe(false);
    expect(evaluateExpectation({ type: 'contains', value: 'quick', caseSensitive: false }, ctx).passed).toBe(true);
  });

  it('not-contains passes when the substring is absent', () => {
    expect(evaluateExpectation({ type: 'not-contains', value: 'cat', caseSensitive: true }, ctx).passed).toBe(true);
    expect(evaluateExpectation({ type: 'not-contains', value: 'Fox', caseSensitive: true }, ctx).passed).toBe(false);
  });

  it('exit-code matches', () => {
    expect(evaluateExpectation({ type: 'exit-code', code: 0 }, { ...ctx, exitCode: 0 }).passed).toBe(true);
    expect(evaluateExpectation({ type: 'exit-code', code: 0 }, { ...ctx, exitCode: 1 }).passed).toBe(false);
    expect(evaluateExpectation({ type: 'exit-code', code: 0 }, ctx).passed).toBe(false); // no code captured
  });
});

describe('evaluateExpectation — sandbox file checks', () => {
  let dir: string;
  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'anvil-scoring-'));
    mkdirSync(join(dir, 'out'), { recursive: true });
    writeFileSync(join(dir, 'out', 'report.md'), '# Report\nstatus: PASS\n', 'utf8');
  });
  afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('file-exists true/false', () => {
    expect(evaluateExpectation({ type: 'file-exists', path: 'out/report.md' }, { finalText: '', sandboxDir: dir }).passed).toBe(true);
    expect(evaluateExpectation({ type: 'file-exists', path: 'out/missing.md' }, { finalText: '', sandboxDir: dir }).passed).toBe(false);
  });

  it('file-contains true/false', () => {
    expect(evaluateExpectation({ type: 'file-contains', path: 'out/report.md', value: 'PASS', caseSensitive: true }, { finalText: '', sandboxDir: dir }).passed).toBe(true);
    expect(evaluateExpectation({ type: 'file-contains', path: 'out/report.md', value: 'FAIL', caseSensitive: true }, { finalText: '', sandboxDir: dir }).passed).toBe(false);
  });

  it('file checks fail (not throw) when no sandboxDir is provided', () => {
    const r = evaluateExpectation({ type: 'file-exists', path: 'x' }, { finalText: '' });
    expect(r.passed).toBe(false);
    expect(r.evidence).toMatch(/no sandboxDir/);
  });

  it('evaluateExpectations aggregates overall pass', () => {
    const exps: Expectation[] = [
      { type: 'file-exists', path: 'out/report.md' },
      { type: 'file-contains', path: 'out/report.md', value: 'PASS', caseSensitive: true },
    ];
    const { passed, outcomes } = evaluateExpectations(exps, { finalText: '', sandboxDir: dir });
    expect(passed).toBe(true);
    expect(outcomes).toHaveLength(2);
  });
});

// ===========================================================================
// 2. Pairwise judge aggregation + position swap
// ===========================================================================

describe('aggregateJudgeSamples', () => {
  it('treatment wins the majority => winner treatment, positive delta', () => {
    const samples: JudgeSample[] = [
      { verdict: 'treatment', swapped: false },
      { verdict: 'treatment', swapped: true },
      { verdict: 'baseline', swapped: false },
    ];
    const agg = aggregateJudgeSamples(samples);
    expect(agg.winner).toBe('treatment');
    expect(agg.qualityDelta).toBeCloseTo((2 - 1) / 3, 10);
  });

  it('ties net to zero delta', () => {
    const agg = aggregateJudgeSamples([
      { verdict: 'tie', swapped: false },
      { verdict: 'tie', swapped: true },
    ]);
    expect(agg.winner).toBe('tie');
    expect(agg.qualityDelta).toBe(0);
  });

  it('flags position bias when swapped vs unswapped disagree', () => {
    // unswapped always treatment, swapped always baseline => max bias.
    const agg = aggregateJudgeSamples([
      { verdict: 'treatment', swapped: false },
      { verdict: 'baseline', swapped: true },
    ]);
    expect(agg.positionBias).toBeCloseTo(1, 10);
    expect(agg.winner).toBe('tie'); // 1 vs 1
  });

  it('empty samples => zero delta, tie, n=0', () => {
    const agg = aggregateJudgeSamples([]);
    expect(agg).toMatchObject({ winner: 'tie', qualityDelta: 0, n: 0 });
  });
});

describe('buildSwappedPair — position swap flips INPUTS not outputs (ACCEPTANCE #5)', () => {
  it('canonical shows treatment in slot A; swapped shows it in slot B; verdict semantics unchanged', () => {
    const treatment = { id: 'T', text: 'interview-led' };
    const baseline = { id: 'B', text: 'feature-dump' };
    const { canonical, swapped } = buildSwappedPair(treatment, baseline);

    // The swap exchanges the two payloads' positions...
    expect(canonical.a).toBe(treatment);
    expect(canonical.b).toBe(baseline);
    expect(swapped.a).toBe(baseline);
    expect(swapped.b).toBe(treatment);
    expect(canonical.swapped).toBe(false);
    expect(swapped.swapped).toBe(true);

    // ...but the recorded verdict is canonical (treatment/baseline terms), so an
    // unbiased judge that prefers treatment yields verdict "treatment" in BOTH
    // orderings — proving the swap changes the prompt inputs, not the outcome.
    const samples: JudgeSample[] = [
      { verdict: 'treatment', swapped: canonical.swapped },
      { verdict: 'treatment', swapped: swapped.swapped },
    ];
    const agg = aggregateJudgeSamples(samples);
    expect(agg.winner).toBe('treatment');
    expect(agg.qualityDelta).toBe(1);
    expect(agg.positionBias).toBe(0); // consistent across positions => no bias
  });
});

// ===========================================================================
// 3. Cost
// ===========================================================================

describe('cost (token × pinned pricing)', () => {
  it('pins a pricing version (versioned data)', () => {
    expect(PRICING_VERSION).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('resolves dated model ids to the family by longest prefix', () => {
    expect(priceFor('claude-opus-4-20250514')).toBe(priceFor('claude-opus-4'));
    expect(priceFor('claude-sonnet-4-20250514').inputPerMTok).toBe(3);
  });

  it('computes USD from a usage object', () => {
    const usage: Usage = {
      inputTokens: 1_000_000,
      outputTokens: 1_000_000,
      cacheCreationInputTokens: 0,
      cacheReadInputTokens: 0,
    };
    const c = costUsage(usage, 'claude-sonnet-4');
    // 1M input @ $3 + 1M output @ $15 = $18
    expect(c.usd).toBeCloseTo(18, 6);
    expect(c.totalTokens).toBe(2_000_000);
  });

  it('sumUsage adds component-wise', () => {
    const u = sumUsage([
      { inputTokens: 1, outputTokens: 2, cacheCreationInputTokens: 3, cacheReadInputTokens: 4 },
      { inputTokens: 10, outputTokens: 20, cacheCreationInputTokens: 30, cacheReadInputTokens: 40 },
    ]);
    expect(u).toEqual({ inputTokens: 11, outputTokens: 22, cacheCreationInputTokens: 33, cacheReadInputTokens: 44 });
  });
});

// ===========================================================================
// 4. Variance / CIs
// ===========================================================================

describe('variance + confidence intervals', () => {
  it('sampleStats computes Bessel-corrected stdDev', () => {
    const s = sampleStats([2, 4, 4, 4, 5, 5, 7, 9]); // mean 5, sample sd ~2.138
    expect(s.mean).toBeCloseTo(5, 10);
    expect(s.stdDev).toBeCloseTo(2.13809, 4);
  });

  it('single sample => no spread', () => {
    expect(sampleStats([42])).toMatchObject({ n: 1, mean: 42, stdDev: 0, stdErr: 0 });
    expect(meanConfidenceInterval([42])).toBeUndefined();
  });

  it('CI brackets the mean and respects lower<=upper', () => {
    const ci = meanConfidenceInterval([10, 12, 14, 16], 0.95);
    expect(ci).toBeDefined();
    if (ci) {
      expect(ci.level).toBe(0.95);
      expect(ci.lower).toBeLessThanOrEqual(13);
      expect(ci.upper).toBeGreaterThanOrEqual(13);
      expect(ci.lower).toBeLessThanOrEqual(ci.upper);
    }
  });

  it('metricFromSamples always carries spread when n>1', () => {
    const m = metricFromSamples('quality.delta', [0.2, 0.4, 0.6], { unit: 'ratio' });
    expect(m.n).toBe(3);
    expect(m.value).toBeCloseTo(0.4, 10);
    expect(m.stdDev !== undefined || m.ci !== undefined).toBe(true);
  });

  it('metricFromPoint derives binomial spread for a proportion when n>1', () => {
    const m = metricFromPoint('activation.precision', 0.8, 10, { unit: 'ratio' });
    expect(m.stdDev).toBeCloseTo(Math.sqrt((0.8 * 0.2) / 10), 10);
  });

  it('metricFromPoint omits spread when n<=1 (schema allows it)', () => {
    const m = metricFromPoint('x', 0.5, 1);
    expect(m.stdDev).toBeUndefined();
    expect(m.ci).toBeUndefined();
  });
});

// ===========================================================================
// 5. Plugin integrity
// ===========================================================================

describe('pluginIntegrity', () => {
  const clean = blankTrace();
  const broken: RunTrace = { ...blankTrace(), pluginErrors: [{ plugin: 'p', message: 'boom' }] };

  it('ok when no errors', () => {
    expect(pluginIntegrity([clean, clean])).toEqual({ ok: true, errors: [] });
  });
  it('not ok and collects errors', () => {
    const r = pluginIntegrity([clean, broken]);
    expect(r.ok).toBe(false);
    expect(r.errors).toHaveLength(1);
  });
});

// ===========================================================================
// buildScorecard
// ===========================================================================

describe('buildScorecard', () => {
  const artifact: ArtifactRef = { kind: 'skill', name: 'bake-to-completion' };

  it('rolls case results into a schema-valid Scorecard with spread on n>1 metrics', () => {
    const usage: Usage = {
      inputTokens: 1000,
      outputTokens: 500,
      cacheCreationInputTokens: 0,
      cacheReadInputTokens: 2000,
    };
    const sc = buildScorecard({
      runId: 'run-test-1',
      suiteName: 'demo suite',
      artifact,
      createdAt: '2026-06-21T17:00:00.000Z',
      judgeModel: 'claude-opus-4',
      runModel: 'claude-sonnet-4',
      repetitions: 2,
      traces: [blankTrace()],
      cases: [
        {
          caseId: 'sf1',
          shouldActivate: true,
          activated: true,
          expectationResults: [true],
          judgeSamples: [
            { verdict: 'treatment', swapped: false },
            { verdict: 'treatment', swapped: true },
          ],
          treatmentUsage: usage,
        },
        {
          caseId: 'sf2',
          shouldActivate: true,
          activated: false, // false negative
          expectationResults: [],
          judgeSamples: [{ verdict: 'tie', swapped: false }],
          treatmentUsage: usage,
        },
        {
          caseId: 'snf1',
          shouldActivate: false,
          activated: false,
          expectationResults: [true],
          judgeSamples: [],
          treatmentUsage: usage,
        },
      ],
    });

    // Validates against the frozen contract.
    expect(() => parseScorecard(sc)).not.toThrow();

    // Confusion: TP=1 (sf1), FN=1 (sf2), TN=1 (snf1), FP=0.
    expect(sc.confusion.truePositive).toBe(1);
    expect(sc.confusion.falseNegative).toBe(1);
    expect(sc.confusion.falseNegativeCaseIds).toEqual(['sf2']);
    expect(sc.confusion.trueNegative).toBe(1);

    // recall = 1/2 = 0.5
    expect(sc.metrics['activation.recall']?.value).toBeCloseTo(0.5, 10);
    // n>1 metrics carry spread (the hard contract refinement)
    for (const [, m] of Object.entries(sc.metrics)) {
      if (m.n > 1) {
        expect(m.ci !== undefined || m.stdDev !== undefined).toBe(true);
      }
    }
    // quality.delta present (cases were judged)
    expect(sc.metrics['quality.delta']).toBeDefined();
    // cost.tokens present
    expect(sc.metrics['cost.tokens']?.value).toBe(3500); // 1000+500+0+2000
  });

  it('marks pluginLoadOk false when a trace carried a plugin error', () => {
    const sc = buildScorecard({
      runId: 'run-test-2',
      suiteName: 's',
      artifact,
      createdAt: '2026-06-21T17:00:00.000Z',
      judgeModel: 'claude-opus-4',
      runModel: 'claude-sonnet-4',
      repetitions: 1,
      traces: [{ ...blankTrace(), pluginErrors: [{ plugin: 'p', message: 'boom' }] }],
      cases: [
        { caseId: 'c1', shouldActivate: true, activated: true, expectationResults: [], judgeSamples: [] },
      ],
    });
    expect(sc.pluginLoadOk).toBe(false);
    expect(sc.pluginErrors).toHaveLength(1);
    expect(() => parseScorecard(sc)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------

function blankTrace(): RunTrace {
  return {
    agentId: 'agent-blank',
    isSubagent: false,
    events: [],
    toolUses: [],
    totalUsage: { inputTokens: 0, outputTokens: 0, cacheCreationInputTokens: 0, cacheReadInputTokens: 0 },
    finalText: '',
    pluginErrors: [],
  };
}
