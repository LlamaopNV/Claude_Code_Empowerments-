import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import {
  parseTranscriptLines,
  detectActivation,
  computeConfusion,
  confusionMetrics,
  type ArtifactRef,
  type RunTrace,
} from './index.js';

const here = dirname(fileURLToPath(import.meta.url));
const fixtures = resolve(here, '../fixtures/transcripts');

const skillRef: ArtifactRef = { kind: 'skill', name: 'bake-to-completion' };
const subagentRef: ArtifactRef = {
  kind: 'subagent',
  name: 'anvil-task-runner',
  baselineSubagent: 'general-purpose',
};

/** Build a minimal RunTrace carrying just the given tool uses. */
function traceWith(toolUses: RunTrace['toolUses']): RunTrace {
  return {
    agentId: 'agent-test',
    isSubagent: true,
    events: [],
    toolUses,
    totalUsage: {
      inputTokens: 0,
      outputTokens: 0,
      cacheCreationInputTokens: 0,
      cacheReadInputTokens: 0,
    },
    finalText: '',
    pluginErrors: [],
  };
}

describe('detectActivation — skill target', () => {
  it('classifies a should-fire case from a parsed subagent transcript (ACCEPTANCE #4)', () => {
    const fired = parseTranscriptLines(
      readFileSync(resolve(fixtures, 'subagent-skill-fired.jsonl'), 'utf8'),
      { agentId: 'agent-aa11bb22cc33dd44' },
    );
    const decision = detectActivation(fired, skillRef);
    expect(decision.fired).toBe(true);
    expect(decision.kind).toBe('skill-fired');
    expect(decision.firedSkill).toBe('bake-to-completion');
  });

  it('classifies a should-not-fire case (no Skill use) as not-fired', () => {
    const notFired = traceWith([{ name: 'Read', input: { file_path: 'x.ts' } }]);
    const decision = detectActivation(notFired, skillRef);
    expect(decision.fired).toBe(false);
    expect(decision.kind).toBe('not-fired');
  });

  it('distinguishes a WRONG skill firing', () => {
    const wrong = traceWith([
      { name: 'Skill', input: { skill: 'some-other-skill' }, skill: 'some-other-skill' },
    ]);
    const decision = detectActivation(wrong, skillRef);
    expect(decision.fired).toBe(false);
    expect(decision.kind).toBe('wrong-skill');
    expect(decision.firedSkill).toBe('some-other-skill');
  });

  it('recognises activation via a plugin command (SlashCommand naming the artifact)', () => {
    const cmd = traceWith([
      { name: 'SlashCommand', input: { command: '/bake-to-completion start' } },
    ]);
    const decision = detectActivation(cmd, skillRef);
    expect(decision.fired).toBe(true);
    expect(decision.kind).toBe('plugin-command');
  });
});

describe('detectActivation — subagent target', () => {
  it('detects a subagent dispatch from the main transcript', () => {
    const main = parseTranscriptLines(
      readFileSync(resolve(fixtures, 'main-dispatch-and-pluginerror.jsonl'), 'utf8'),
    );
    const decision = detectActivation(main, subagentRef);
    expect(decision.fired).toBe(true);
    expect(decision.kind).toBe('subagent-fired');
    expect(decision.firedSubagentType).toBe('anvil-task-runner');
  });

  it('does not fire for a different subagent type', () => {
    const other = traceWith([
      { name: 'Agent', input: { subagent_type: 'general-purpose' }, subagentType: 'general-purpose' },
    ]);
    expect(detectActivation(other, subagentRef).fired).toBe(false);
  });

  it('accepts an array of traces and fires if ANY contains the dispatch', () => {
    const a = traceWith([{ name: 'Read', input: {} }]);
    const b = traceWith([
      { name: 'Task', input: { subagent_type: 'anvil-task-runner' }, subagentType: 'anvil-task-runner' },
    ]);
    expect(detectActivation([a, b], subagentRef).fired).toBe(true);
  });
});

describe('computeConfusion + confusionMetrics', () => {
  it('builds a confusion matrix with offending case ids', () => {
    const cases = [
      // should fire + fired => TP
      {
        caseId: 'tp1',
        shouldActivate: true,
        traces: traceWith([{ name: 'Skill', input: { skill: 'bake-to-completion' }, skill: 'bake-to-completion' }]),
      },
      // should fire + NOT fired => FN (offending)
      { caseId: 'fn1', shouldActivate: true, traces: traceWith([{ name: 'Read', input: {} }]) },
      // should NOT fire + fired => FP (offending)
      {
        caseId: 'fp1',
        shouldActivate: false,
        traces: traceWith([{ name: 'Skill', input: { skill: 'bake-to-completion' }, skill: 'bake-to-completion' }]),
      },
      // should NOT fire + not fired => TN
      { caseId: 'tn1', shouldActivate: false, traces: traceWith([{ name: 'Read', input: {} }]) },
    ];
    const { confusion, perCase } = computeConfusion(cases, skillRef);
    expect(confusion.truePositive).toBe(1);
    expect(confusion.falseNegative).toBe(1);
    expect(confusion.falsePositive).toBe(1);
    expect(confusion.trueNegative).toBe(1);
    expect(confusion.falseNegativeCaseIds).toEqual(['fn1']);
    expect(confusion.falsePositiveCaseIds).toEqual(['fp1']);
    expect(perCase.find((c) => c.caseId === 'tp1')?.correct).toBe(true);

    const m = confusionMetrics(confusion);
    expect(m.precision).toBeCloseTo(0.5, 10); // 1/(1+1)
    expect(m.recall).toBeCloseTo(0.5, 10); // 1/(1+1)
    expect(m.f1).toBeCloseTo(0.5, 10);
  });

  it('reports vacuous precision/recall = 1 when no predicted/actual positives', () => {
    const m = confusionMetrics({
      truePositive: 0,
      falsePositive: 0,
      trueNegative: 3,
      falseNegative: 0,
      falsePositiveCaseIds: [],
      falseNegativeCaseIds: [],
    });
    expect(m.precision).toBe(1);
    expect(m.recall).toBe(1);
    expect(m.f1).toBeCloseTo(1, 10);
  });
});
