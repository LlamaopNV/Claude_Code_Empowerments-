import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import {
  parseScorecard,
  parseRunIndex,
  parseRunTrace,
  MetricResultSchema,
  ConfidenceIntervalSchema,
  RunTraceSchema,
} from './index.js';

const here = dirname(fileURLToPath(import.meta.url));
const fixtures = resolve(here, '../fixtures');

function readFixture(name: string): unknown {
  return JSON.parse(readFileSync(resolve(fixtures, name), 'utf8'));
}

describe('result fixtures validate against the frozen contract', () => {
  it('the full result Scorecard fixture parses', () => {
    const card = parseScorecard(readFixture('result.scorecard.json'));
    expect(card.runId).toBe('run-2026-06-21-bake-001');
    expect(card.metrics['activation.f1']?.value).toBe(0.89);
    expect(card.confusion.falseNegativeCaseIds).toContain('sf-pressure-test-concept');
    expect(card.cases.length).toBe(5);
  });

  it('the index.json fixture parses', () => {
    const idx = parseRunIndex(readFixture('index.json'));
    expect(idx.runs.length).toBe(1);
    expect(idx.runs[0]?.headline.activationF1).toBe(0.89);
    expect(idx.runs[0]?.resultPath).toMatch(/\.json$/);
  });

  it('the subagent RunTrace fixture parses and preserves spike-findings shapes', () => {
    const trace = parseRunTrace(readFixture('runtrace.subagent.json'));
    // Skill activation recoverable directly (spike finding).
    const skillUse = trace.toolUses.find((t) => t.name === 'Skill');
    expect(skillUse?.skill).toBe('bake-to-completion');
    // Cache token fields preserved (spike finding).
    expect(trace.totalUsage.cacheReadInputTokens).toBe(24060);
    expect(trace.totalUsage.cacheCreationInputTokens).toBe(1840);
    expect(trace.isSubagent).toBe(true);
  });
});

describe('MetricResult never carries a bare number', () => {
  it('accepts n=1 without spread', () => {
    expect(() => MetricResultSchema.parse({ metric: 'm', value: 1, n: 1 })).not.toThrow();
  });

  it('rejects n>1 with no ci and no stdDev', () => {
    const res = MetricResultSchema.safeParse({ metric: 'm', value: 0.5, n: 10 });
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error.issues[0]?.message).toMatch(/never a bare number/);
    }
  });

  it('accepts n>1 when spread is present', () => {
    expect(() =>
      MetricResultSchema.parse({
        metric: 'm',
        value: 0.5,
        n: 10,
        ci: { level: 0.95, lower: 0.4, upper: 0.6 },
      }),
    ).not.toThrow();
  });
});

describe('ConfidenceInterval', () => {
  it('rejects lower > upper', () => {
    expect(() =>
      ConfidenceIntervalSchema.parse({ level: 0.95, lower: 0.9, upper: 0.1 }),
    ).toThrowError(/lower must be <= upper/);
  });

  it('rejects an out-of-range level', () => {
    expect(() => ConfidenceIntervalSchema.parse({ level: 1.5, lower: 0, upper: 1 })).toThrowError();
  });
});

describe('RunTrace defaults', () => {
  it('applies array/string defaults for a minimal trace', () => {
    const trace = RunTraceSchema.parse({
      agentId: 'main',
      totalUsage: { inputTokens: 0, outputTokens: 0 },
    });
    expect(trace.events).toEqual([]);
    expect(trace.toolUses).toEqual([]);
    expect(trace.finalText).toBe('');
    expect(trace.pluginErrors).toEqual([]);
    expect(trace.isSubagent).toBe(false);
  });
});
