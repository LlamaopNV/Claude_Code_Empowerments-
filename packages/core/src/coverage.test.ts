import { describe, it, expect } from 'vitest';
import { checkSuiteCoverage, type CoverageReport } from './coverage.js';
import type { EvalSuite, EvalCase } from './eval.js';

function suiteWith(cases: EvalCase[]): EvalSuite {
  return {
    schemaVersion: 1,
    name: 'test suite',
    artifact: { kind: 'skill', name: 'demo' },
    judgeModel: 'claude-opus-4-20250514',
    runModel: 'claude-sonnet-4-20250514',
    repetitions: 1,
    cases,
  };
}

function c(over: Partial<EvalCase> & Pick<EvalCase, 'id' | 'bucket' | 'shouldActivate'>): EvalCase {
  return {
    prompt: 'a prompt long enough to be meaningful for the case',
    expectations: [],
    ...over,
  };
}

describe('checkSuiteCoverage', () => {
  it('passes a balanced suite with all three buckets, near-misses, and rubrics on judged cases', () => {
    const suite = suiteWith([
      c({ id: 'sf1', bucket: 'should-fire', shouldActivate: true, rubric: 'judge this well' }),
      c({ id: 'sf2', bucket: 'should-fire', shouldActivate: true, rubric: 'judge this well' }),
      c({ id: 'snf1', bucket: 'should-not-fire', shouldActivate: false }),
      c({ id: 'snf2', bucket: 'should-not-fire', shouldActivate: false }),
      c({ id: 'task1', bucket: 'task', shouldActivate: true, rubric: 'a good rubric here' }),
    ]);
    const report: CoverageReport = checkSuiteCoverage(suite);
    expect(report.ok).toBe(true);
    expect(report.errors).toHaveLength(0);
    expect(report.buckets).toEqual({ 'should-fire': 2, 'should-not-fire': 2, task: 1 });
  });

  it('flags a missing should-not-fire bucket as an ERROR (no trigger-precision signal)', () => {
    const suite = suiteWith([
      c({ id: 'sf1', bucket: 'should-fire', shouldActivate: true, rubric: 'r' }),
      c({ id: 'task1', bucket: 'task', shouldActivate: true, rubric: 'r' }),
    ]);
    const report = checkSuiteCoverage(suite);
    expect(report.ok).toBe(false);
    expect(report.errors.some((e) => /should-not-fire/i.test(e))).toBe(true);
  });

  it('flags an absent should-fire bucket as an error', () => {
    const suite = suiteWith([
      c({ id: 'snf1', bucket: 'should-not-fire', shouldActivate: false }),
      c({ id: 'snf2', bucket: 'should-not-fire', shouldActivate: false }),
    ]);
    const report = checkSuiteCoverage(suite);
    expect(report.ok).toBe(false);
    expect(report.errors.some((e) => /should-fire/i.test(e))).toBe(true);
  });

  it('warns on severe bucket imbalance (one bucket dwarfs another)', () => {
    const many = Array.from({ length: 10 }, (_, i) =>
      c({ id: `sf${i}`, bucket: 'should-fire', shouldActivate: true, rubric: 'r' }),
    );
    const suite = suiteWith([
      ...many,
      c({ id: 'snf1', bucket: 'should-not-fire', shouldActivate: false }),
    ]);
    const report = checkSuiteCoverage(suite);
    expect(report.warnings.some((w) => /imbalance|balance/i.test(w))).toBe(true);
  });

  it('warns when should-fire / task cases lack a rubric (judge has nothing to anchor on)', () => {
    const suite = suiteWith([
      c({ id: 'sf1', bucket: 'should-fire', shouldActivate: true }), // no rubric
      c({ id: 'snf1', bucket: 'should-not-fire', shouldActivate: false }),
      c({ id: 'task1', bucket: 'task', shouldActivate: true }), // no rubric, no expectations
    ]);
    const report = checkSuiteCoverage(suite);
    expect(report.warnings.some((w) => /rubric/i.test(w))).toBe(true);
    // task1 has neither rubric nor expectations → it can never fail; that's an error.
    expect(report.errors.some((e) => /task1/.test(e))).toBe(true);
  });

  it('is deterministic — same suite yields identical report', () => {
    const suite = suiteWith([
      c({ id: 'sf1', bucket: 'should-fire', shouldActivate: true, rubric: 'r' }),
      c({ id: 'snf1', bucket: 'should-not-fire', shouldActivate: false }),
      c({ id: 'task1', bucket: 'task', shouldActivate: true, rubric: 'r' }),
    ]);
    expect(checkSuiteCoverage(suite)).toEqual(checkSuiteCoverage(suite));
  });
});
