import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import {
  parseEvalSuite,
  parseEvalSuiteYaml,
  safeParseEvalSuite,
  ArtifactRefSchema,
  ExpectationSchema,
  EVAL_SCHEMA_VERSION,
} from './index.js';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '../../..');

function baseSuite() {
  return {
    schemaVersion: EVAL_SCHEMA_VERSION,
    name: 'demo',
    artifact: { kind: 'skill', name: 'bake-to-completion' },
    judgeModel: 'claude-opus-4-20250514',
    runModel: 'claude-sonnet-4-20250514',
    repetitions: 3,
    cases: [
      {
        id: 'c1',
        prompt: 'sharpen my half-baked idea',
        bucket: 'should-fire',
        shouldActivate: true,
        expectations: [],
      },
    ],
  };
}

describe('EvalSuite', () => {
  it('parses a valid suite', () => {
    const suite = parseEvalSuite(baseSuite());
    expect(suite.name).toBe('demo');
    expect(suite.artifact.kind).toBe('skill');
    // repetitions default applies when omitted
    const noReps = { ...baseSuite(), repetitions: undefined };
    expect(parseEvalSuite(noReps).repetitions).toBe(1);
  });

  it('parses the example evals/*.yaml suite (round-trip via the public API)', () => {
    const yaml = readFileSync(
      resolve(repoRoot, 'evals/bake-to-completion.skill.yaml'),
      'utf8',
    );
    const suite = parseEvalSuiteYaml(yaml);
    expect(suite.name).toBe('bake-to-completion effectiveness');
    expect(suite.cases.length).toBeGreaterThanOrEqual(5);
    const buckets = new Set(suite.cases.map((c) => c.bucket));
    expect(buckets).toEqual(new Set(['should-fire', 'should-not-fire', 'task']));
  });

  it('round-trips: parsed suite re-serialised to YAML re-parses identically', async () => {
    const { stringify } = await import('yaml');
    const yaml = readFileSync(
      resolve(repoRoot, 'evals/bake-to-completion.skill.yaml'),
      'utf8',
    );
    const first = parseEvalSuiteYaml(yaml);
    const second = parseEvalSuiteYaml(stringify(first));
    expect(second).toEqual(first);
  });

  it('rejects an unknown schemaVersion with a clear message', () => {
    const bad = { ...baseSuite(), schemaVersion: 999 };
    const res = safeParseEvalSuite(bad);
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error.issues.some((i) => i.path.includes('schemaVersion'))).toBe(true);
    }
  });

  it('rejects a suite with zero cases', () => {
    const bad = { ...baseSuite(), cases: [] };
    expect(() => parseEvalSuite(bad)).toThrowError(/at least one case/);
  });

  it('rejects duplicate case ids', () => {
    const s = baseSuite();
    const dup = { ...s, cases: [s.cases[0], { ...s.cases[0] }] };
    expect(() => parseEvalSuite(dup)).toThrowError(/duplicate case id/);
  });

  it('rejects bucket / shouldActivate inconsistency', () => {
    const s = baseSuite();
    const bad = {
      ...s,
      cases: [{ ...s.cases[0], bucket: 'should-not-fire', shouldActivate: true }],
    };
    expect(() => parseEvalSuite(bad)).toThrowError(/should-not-fire.*shouldActivate is true/);
  });

  it('rejects unknown extra keys (strict)', () => {
    const bad = { ...baseSuite(), surprise: 'nope' };
    expect(() => parseEvalSuite(bad)).toThrowError();
  });
});

describe('ArtifactRef discriminated union', () => {
  it('accepts each kind', () => {
    expect(ArtifactRefSchema.parse({ kind: 'skill', name: 's' }).kind).toBe('skill');
    expect(ArtifactRefSchema.parse({ kind: 'subagent', name: 'a' }).baselineSubagent).toBe(
      'general-purpose',
    );
    expect(ArtifactRefSchema.parse({ kind: 'plugin', name: 'p' }).kind).toBe('plugin');
  });

  it('rejects an unknown kind', () => {
    expect(() => ArtifactRefSchema.parse({ kind: 'mcp', name: 'x' })).toThrowError();
  });
});

describe('Expectation discriminated union', () => {
  it('accepts all six expectation types', () => {
    expect(ExpectationSchema.parse({ type: 'regex', pattern: 'x' }).type).toBe('regex');
    expect(ExpectationSchema.parse({ type: 'contains', value: 'x' }).caseSensitive).toBe(true);
    expect(ExpectationSchema.parse({ type: 'not-contains', value: 'x' }).type).toBe('not-contains');
    expect(ExpectationSchema.parse({ type: 'file-exists', path: 'a.txt' }).type).toBe('file-exists');
    expect(ExpectationSchema.parse({ type: 'file-contains', path: 'a', value: 'b' }).type).toBe(
      'file-contains',
    );
    expect(ExpectationSchema.parse({ type: 'exit-code', code: 0 }).code).toBe(0);
  });

  it('rejects an unknown expectation type', () => {
    expect(() => ExpectationSchema.parse({ type: 'screenshot' })).toThrowError();
  });
});
