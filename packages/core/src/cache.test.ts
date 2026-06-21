import { describe, it, expect } from 'vitest';
import {
  artifactVersion,
  runCacheKey,
  RunCache,
  type CachedRun,
} from './cache.js';
import type { RunTrace } from './result.js';

function trace(agentId: string): RunTrace {
  return {
    agentId,
    isSubagent: true,
    events: [],
    toolUses: [],
    totalUsage: {
      inputTokens: 1,
      outputTokens: 1,
      cacheCreationInputTokens: 0,
      cacheReadInputTokens: 0,
    },
    finalText: `final-${agentId}`,
    pluginErrors: [],
  };
}

function cached(caseId: string, role: 'treatment' | 'baseline'): CachedRun {
  return { finalText: `ft-${caseId}-${role}`, trace: trace(`${caseId}-${role}`) };
}

describe('artifactVersion', () => {
  it('is a stable hash of the same content regardless of file order', () => {
    const a = artifactVersion([
      { path: 'SKILL.md', content: 'hello' },
      { path: 'ref.md', content: 'world' },
    ]);
    const b = artifactVersion([
      { path: 'ref.md', content: 'world' },
      { path: 'SKILL.md', content: 'hello' },
    ]);
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{16,}$/);
  });

  it('changes when any file content changes', () => {
    const a = artifactVersion([{ path: 'SKILL.md', content: 'hello' }]);
    const b = artifactVersion([{ path: 'SKILL.md', content: 'hello!' }]);
    expect(a).not.toBe(b);
  });

  it('changes when a file path changes (rename is a different version)', () => {
    const a = artifactVersion([{ path: 'SKILL.md', content: 'x' }]);
    const b = artifactVersion([{ path: 'OTHER.md', content: 'x' }]);
    expect(a).not.toBe(b);
  });
});

describe('runCacheKey', () => {
  it('is deterministic over (caseId, role, model, artifactVersion, rep)', () => {
    const k1 = runCacheKey({ caseId: 'c1', role: 'treatment', model: 'm', artifactVersion: 'v1', rep: 0 });
    const k2 = runCacheKey({ caseId: 'c1', role: 'treatment', model: 'm', artifactVersion: 'v1', rep: 0 });
    expect(k1).toBe(k2);
  });

  it('differs on any field change — caseId/role/model/version/rep are all part of the key', () => {
    const base = { caseId: 'c1', role: 'treatment' as const, model: 'm', artifactVersion: 'v1', rep: 0 };
    const k = runCacheKey(base);
    expect(runCacheKey({ ...base, caseId: 'c2' })).not.toBe(k);
    expect(runCacheKey({ ...base, role: 'baseline' })).not.toBe(k);
    expect(runCacheKey({ ...base, model: 'm2' })).not.toBe(k);
    expect(runCacheKey({ ...base, artifactVersion: 'v2' })).not.toBe(k);
    expect(runCacheKey({ ...base, rep: 1 })).not.toBe(k);
  });

  it('treats an omitted rep distinctly from rep 0 (so a rep-agnostic entry is its own key)', () => {
    const withRep = runCacheKey({ caseId: 'c', role: 'treatment', model: 'm', artifactVersion: 'v', rep: 0 });
    const noRep = runCacheKey({ caseId: 'c', role: 'treatment', model: 'm', artifactVersion: 'v' });
    expect(withRep).not.toBe(noRep);
  });
});

describe('RunCache', () => {
  const key = { caseId: 'c1', role: 'treatment' as const, model: 'm', artifactVersion: 'v1', rep: 0 };

  it('misses on an empty cache, hits after store', () => {
    const cache = new RunCache();
    expect(cache.get(key)).toBeUndefined();
    cache.set(key, cached('c1', 'treatment'));
    expect(cache.get(key)?.finalText).toBe('ft-c1-treatment');
  });

  it('invalidates the entry when the artifactVersion changes', () => {
    const cache = new RunCache();
    cache.set(key, cached('c1', 'treatment'));
    expect(cache.get({ ...key, artifactVersion: 'v2' })).toBeUndefined();
  });

  it('honors mode "no-cache": get always misses and set is a no-op', () => {
    const cache = new RunCache({ mode: 'no-cache' });
    cache.set(key, cached('c1', 'treatment'));
    expect(cache.get(key)).toBeUndefined();
  });

  it('honors mode "refresh": get misses (forcing a re-run) but set still writes for downstream reads', () => {
    const cache = new RunCache({ mode: 'refresh' });
    cache.set(key, cached('c1', 'treatment'));
    // refresh forces the dispatcher to re-run (get returns undefined)...
    expect(cache.get(key)).toBeUndefined();
    // ...but the freshly-set value is observable (so a re-run within the same
    // pass can be reused, and stats reflect a write).
    expect(cache.peek(key)?.finalText).toBe('ft-c1-treatment');
  });

  it('round-trips through a serializable bundle (for on-disk persistence)', () => {
    const cache = new RunCache();
    cache.set(key, cached('c1', 'treatment'));
    cache.set({ ...key, role: 'baseline' }, cached('c1', 'baseline'));
    const bundle = cache.toBundle();
    const reloaded = RunCache.fromBundle(bundle);
    expect(reloaded.get(key)?.finalText).toBe('ft-c1-treatment');
    expect(reloaded.get({ ...key, role: 'baseline' })?.finalText).toBe('ft-c1-baseline');
  });

  it('reports hit/miss stats for the pre-flight estimate', () => {
    const cache = new RunCache();
    cache.set(key, cached('c1', 'treatment'));
    cache.get(key); // hit
    cache.get({ ...key, rep: 1 }); // miss
    expect(cache.stats).toEqual({ hits: 1, misses: 1, writes: 1 });
  });
});
