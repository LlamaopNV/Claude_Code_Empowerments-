import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import {
  MockOrchestrator,
  loadOrchestratorFixture,
  parseRunTrace,
  type OrchestratorFixture,
} from './index.js';

const here = dirname(fileURLToPath(import.meta.url));
const fixtureFile = resolve(here, '../fixtures/orchestrator/bake-to-completion.fixture.json');

function loadBundle(): OrchestratorFixture {
  return loadOrchestratorFixture(JSON.parse(readFileSync(fixtureFile, 'utf8')));
}

describe('MockOrchestrator', () => {
  it('replays a recorded treatment runner with finalText + a valid RunTrace', async () => {
    const orch = new MockOrchestrator(loadBundle());
    const res = await orch.dispatchRunner({ caseId: 'sf-vague-app-idea', role: 'treatment' });
    expect(res.finalText).toContain('Before we design');
    // Embedded trace validates against the frozen contract.
    expect(() => parseRunTrace(res.trace)).not.toThrow();
    expect(res.trace.toolUses.some((t) => t.skill === 'bake-to-completion')).toBe(true);
    expect(orch.calls.runners).toBe(1);
  });

  it('replays the baseline runner separately by role key', async () => {
    const orch = new MockOrchestrator(loadBundle());
    const res = await orch.dispatchRunner({ caseId: 'sf-vague-app-idea', role: 'baseline' });
    expect(res.finalText).toContain('features your plant app');
    expect(res.trace.toolUses).toHaveLength(0);
  });

  it('replays swapped + unswapped judge samples', async () => {
    const orch = new MockOrchestrator(loadBundle());
    const noswap = await orch.dispatchJudge({
      caseId: 'sf-vague-app-idea',
      a: 'T',
      b: 'B',
      swapped: false,
    });
    const swap = await orch.dispatchJudge({
      caseId: 'sf-vague-app-idea',
      a: 'B',
      b: 'T',
      swapped: true,
    });
    expect(noswap.verdict).toBe('treatment');
    expect(swap.verdict).toBe('treatment');
    expect(orch.calls.judges).toBe(2);
  });

  it('rep-agnostic records serve any rep', async () => {
    const orch = new MockOrchestrator(loadBundle());
    const r0 = await orch.dispatchRunner({ caseId: 'sf-vague-app-idea', role: 'treatment', rep: 0 });
    const r3 = await orch.dispatchRunner({ caseId: 'sf-vague-app-idea', role: 'treatment', rep: 3 });
    expect(r0.finalText).toBe(r3.finalText);
  });

  it('rejects a dispatch with no recorded fixture (no silent default)', async () => {
    const orch = new MockOrchestrator(loadBundle());
    await expect(
      orch.dispatchRunner({ caseId: 'unknown-case', role: 'treatment' }),
    ).rejects.toThrow(/no recorded runner/);
  });

  it('prefers an exact (caseId, role, rep) record over the rep-agnostic fallback', async () => {
    const bundle: OrchestratorFixture = {
      runners: [
        {
          caseId: 'c',
          role: 'treatment',
          finalText: 'generic',
          trace: blankTrace('agent-generic'),
        },
        {
          caseId: 'c',
          role: 'treatment',
          rep: 1,
          finalText: 'rep-1-specific',
          trace: blankTrace('agent-rep1'),
        },
      ],
      judges: [],
    };
    const orch = new MockOrchestrator(bundle);
    expect((await orch.dispatchRunner({ caseId: 'c', role: 'treatment', rep: 1 })).finalText).toBe(
      'rep-1-specific',
    );
    expect((await orch.dispatchRunner({ caseId: 'c', role: 'treatment', rep: 9 })).finalText).toBe(
      'generic',
    );
  });
});

function blankTrace(agentId: string) {
  return {
    agentId,
    isSubagent: true,
    events: [],
    toolUses: [],
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
