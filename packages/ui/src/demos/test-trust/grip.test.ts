import { describe, it, expect } from 'vitest';
import {
  runMutationTesting,
  ISADULT_SCENARIO,
  BASE_TEST_IDS,
  BOUNDARY_TEST_ID,
  type DemoScenario,
} from './grip.js';

const toy: DemoScenario = {
  functionName: 'f',
  originalSource: 'f',
  tests: [
    { id: 't1', name: 'kills m1', killsMutants: ['m1'] },
    { id: 't2', name: 'kills m2', killsMutants: ['m2'] },
  ],
  mutants: [
    { id: 'm1', label: 'm1', explanation: '', mutatedSource: '' },
    { id: 'm2', label: 'm2', explanation: '', mutatedSource: '' },
    { id: 'm3', label: 'm3', explanation: '', mutatedSource: '' },
  ],
};

describe('runMutationTesting', () => {
  it('marks a mutant killed when an active test detects it', () => {
    const report = runMutationTesting(toy, ['t1']);
    expect(report.results.find((r) => r.mutantId === 'm1')?.status).toBe('killed');
  });

  it('marks a mutant survived when no active test detects it', () => {
    const report = runMutationTesting(toy, ['t1']);
    expect(report.results.find((r) => r.mutantId === 'm3')?.status).toBe('survived');
    expect(report.survivorIds).toContain('m3');
  });

  it('ignores inactive tests', () => {
    const report = runMutationTesting(toy, ['t1']);
    expect(report.results.find((r) => r.mutantId === 'm2')?.status).toBe('survived');
  });

  it('computes the mutation score as killed / total', () => {
    expect(runMutationTesting(toy, []).score).toBe(0);
    expect(runMutationTesting(toy, ['t1', 't2']).score).toBeCloseTo(2 / 3);
  });
});

describe('isAdult scenario (the payoff)', () => {
  it('leaves the boundary mutant alive with only the base tests', () => {
    const report = runMutationTesting(ISADULT_SCENARIO, BASE_TEST_IDS);
    expect(report.survivorIds).toEqual(['ge-to-gt']);
    expect(report.score).toBeCloseTo(0.75);
  });

  it('kills every mutant once the boundary test is added', () => {
    const report = runMutationTesting(ISADULT_SCENARIO, [...BASE_TEST_IDS, BOUNDARY_TEST_ID]);
    expect(report.survivorIds).toEqual([]);
    expect(report.score).toBe(1);
  });
});
