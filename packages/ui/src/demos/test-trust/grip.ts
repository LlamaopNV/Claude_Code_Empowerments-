/**
 * Act 1 of the test-trust demo: "a passing test can prove nothing."
 *
 * A deterministic, in-browser model of mutation testing. We never run real
 * tests — each demo test declares (precomputed) which mutants it would kill.
 * Given the currently-enabled tests, we report which mutants survive (a
 * surviving mutant = a dead spot the suite cannot catch).
 */

export interface DemoTest {
  id: string;
  name: string;
  /** ids of mutants this test detects (kills) */
  killsMutants: string[];
}

export interface Mutant {
  id: string;
  label: string;
  explanation: string;
  mutatedSource: string;
}

export interface DemoScenario {
  functionName: string;
  originalSource: string;
  tests: DemoTest[];
  mutants: Mutant[];
}

export type MutantStatus = 'killed' | 'survived';

export interface MutantResult {
  mutantId: string;
  status: MutantStatus;
  killedBy: string[];
}

export interface GripReport {
  results: MutantResult[];
  killedCount: number;
  totalCount: number;
  /** mutation score in [0, 1] */
  score: number;
  survivorIds: string[];
}

export function runMutationTesting(
  scenario: DemoScenario,
  activeTestIds: string[],
): GripReport {
  const active = new Set(activeTestIds);
  const results: MutantResult[] = scenario.mutants.map((mutant) => {
    const killedBy = scenario.tests
      .filter((t) => active.has(t.id) && t.killsMutants.includes(mutant.id))
      .map((t) => t.id);
    return {
      mutantId: mutant.id,
      status: killedBy.length > 0 ? 'killed' : 'survived',
      killedBy,
    };
  });
  const killedCount = results.filter((r) => r.status === 'killed').length;
  const totalCount = results.length;
  return {
    results,
    killedCount,
    totalCount,
    score: totalCount === 0 ? 0 : killedCount / totalCount,
    survivorIds: results.filter((r) => r.status === 'survived').map((r) => r.mutantId),
  };
}

export const BOUNDARY_TEST_ID = 't-boundary';
export const BASE_TEST_IDS = ['t-adult', 't-child'];

export const ISADULT_SCENARIO: DemoScenario = {
  functionName: 'isAdult',
  originalSource: 'const isAdult = (age: number) => age >= 18;',
  tests: [
    { id: 't-adult', name: 'accepts age 21', killsMutants: ['ge-to-lt', 'return-false'] },
    { id: 't-child', name: 'rejects age 10', killsMutants: ['ge-to-lt', 'return-true'] },
    {
      id: BOUNDARY_TEST_ID,
      name: 'accepts age 18 exactly',
      killsMutants: ['ge-to-gt', 'ge-to-lt', 'return-false'],
    },
  ],
  mutants: [
    {
      id: 'ge-to-gt',
      label: 'age >= 18  →  age > 18',
      explanation: 'Off-by-one at the boundary: an 18-year-old is wrongly rejected.',
      mutatedSource: 'const isAdult = (age: number) => age > 18;',
    },
    {
      id: 'ge-to-lt',
      label: 'age >= 18  →  age < 18',
      explanation: 'Inverted comparison: the whole rule is backwards.',
      mutatedSource: 'const isAdult = (age: number) => age < 18;',
    },
    {
      id: 'return-true',
      label: 'body  →  return true',
      explanation: 'Always adult: everyone passes.',
      mutatedSource: 'const isAdult = (_age: number) => true;',
    },
    {
      id: 'return-false',
      label: 'body  →  return false',
      explanation: 'Never adult: everyone fails.',
      mutatedSource: 'const isAdult = (_age: number) => false;',
    },
  ],
};
