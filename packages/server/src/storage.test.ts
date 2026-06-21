import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { parseScorecard, parseRunIndex, type Scorecard } from '@anvil/core';
import { Storage, indexEntryFromScorecard } from './storage.js';
import { serverInfo } from './index.js';

const here = dirname(fileURLToPath(import.meta.url));
const coreFixtures = resolve(here, '../../core/fixtures');

async function tempDir(): Promise<string> {
  return fs.mkdtemp(join(tmpdir(), 'anvil-store-'));
}

/** Load the committed core scorecard fixture as the basis for tests. */
async function loadCard(): Promise<Scorecard> {
  const raw = await fs.readFile(join(coreFixtures, 'result.scorecard.json'), 'utf8');
  return parseScorecard(JSON.parse(raw));
}

describe('serverInfo (wiring sanity)', () => {
  it('reports the core schema versions', () => {
    const info = serverInfo();
    expect(info.name).toBe('anvil-server');
    expect(info.evalSchemaVersion).toBe(1);
    expect(info.resultSchemaVersion).toBe(1);
  });
});

describe('Storage — missing/empty dir is graceful', () => {
  let dir: string;
  beforeEach(async () => {
    dir = await tempDir();
  });
  afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  it('readIndex on an absent results dir returns an empty index', async () => {
    const storage = new Storage({
      resultsDir: join(dir, 'does-not-exist'),
      evalsDir: join(dir, 'no-evals'),
    });
    const index = await storage.readIndex();
    expect(index).toEqual({ schemaVersion: 1, runs: [] });
  });

  it('loadScorecard on an unknown runId returns null', async () => {
    const storage = new Storage({ resultsDir: join(dir, 'r'), evalsDir: join(dir, 'e') });
    expect(await storage.loadScorecard('nope')).toBeNull();
  });

  it('listSuites on an absent evals dir returns []', async () => {
    const storage = new Storage({ resultsDir: join(dir, 'r'), evalsDir: join(dir, 'e') });
    expect(await storage.listSuites()).toEqual({ suites: [], errors: [] });
  });
});

describe('Storage — save + idempotent index (acceptance #4)', () => {
  let dir: string;
  let storage: Storage;
  beforeEach(async () => {
    dir = await tempDir();
    storage = new Storage({ resultsDir: join(dir, 'results'), evalsDir: join(dir, 'evals') });
  });
  afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  it('writes a schema-valid <runId>.json and a valid index.json', async () => {
    const card = await loadCard();
    const { entry } = await storage.saveScorecard(card);
    expect(entry.runId).toBe(card.runId);

    // The written scorecard file is valid + round-trips.
    const onDisk = await storage.loadScorecard(card.runId);
    expect(onDisk).not.toBeNull();
    expect(() => parseScorecard(onDisk)).not.toThrow();

    // The index validates and lists exactly one run.
    const idx = await storage.readIndex();
    expect(() => parseRunIndex(idx)).not.toThrow();
    expect(idx.runs.map((r) => r.runId)).toEqual([card.runId]);
    // Headline derived from metrics.
    expect(idx.runs[0]?.headline.activationF1).toBeCloseTo(0.89);
  });

  it('re-saving the SAME runId does not duplicate the index entry', async () => {
    const card = await loadCard();
    await storage.saveScorecard(card);
    await storage.saveScorecard(card); // idempotent re-save
    const idx = await storage.readIndex();
    expect(idx.runs.filter((r) => r.runId === card.runId)).toHaveLength(1);
  });

  it('two distinct scorecards yield two index entries, newest-first', async () => {
    const card = await loadCard();
    const second: Scorecard = { ...card, runId: 'run-second-002' };
    await storage.saveScorecard(card);
    await storage.saveScorecard(second);
    const idx = await storage.readIndex();
    expect(idx.runs.map((r) => r.runId)).toEqual(['run-second-002', card.runId]);
  });

  it('atomic write: no .tmp files remain and content is complete JSON', async () => {
    const card = await loadCard();
    await storage.saveScorecard(card);
    const files = await fs.readdir(join(dir, 'results'));
    expect(files.some((f) => f.endsWith('.tmp'))).toBe(false);
    // The file parses fully (not truncated).
    const text = await fs.readFile(join(dir, 'results', `${card.runId}.json`), 'utf8');
    expect(() => JSON.parse(text)).not.toThrow();
    expect(text.endsWith('\n')).toBe(true);
  });

  it('concurrent saves of distinct runIds all land in the index (no lost update)', async () => {
    const card = await loadCard();
    const cards: Scorecard[] = Array.from({ length: 8 }, (_, i) => ({
      ...card,
      runId: `run-concurrent-${i}`,
    }));
    await Promise.all(cards.map((c) => storage.saveScorecard(c)));
    const idx = await storage.readIndex();
    const ids = new Set(idx.runs.map((r) => r.runId));
    for (const c of cards) expect(ids.has(c.runId)).toBe(true);
    expect(idx.runs).toHaveLength(8);
  });

  it('rejects an invalid scorecard before any disk write', async () => {
    await expect(storage.saveScorecard({ not: 'a scorecard' })).rejects.toThrow();
    // Nothing was written.
    const idx = await storage.readIndex();
    expect(idx.runs).toHaveLength(0);
  });
});

describe('indexEntryFromScorecard', () => {
  it('lifts headline metrics + sets a relative resultPath', async () => {
    const card = await loadCard();
    const entry = indexEntryFromScorecard(card);
    expect(entry.resultPath).toBe(`${card.runId}.json`);
    expect(entry.artifactKind).toBe('skill');
    expect(entry.artifactName).toBe('bake-to-completion');
    expect(entry.headline.qualityDelta).toBeCloseTo(0.42);
  });
});

describe('Storage — suites + traces', () => {
  let dir: string;
  let storage: Storage;
  beforeEach(async () => {
    dir = await tempDir();
    storage = new Storage({ resultsDir: join(dir, 'results'), evalsDir: join(dir, 'evals') });
    await fs.mkdir(join(dir, 'evals'), { recursive: true });
  });
  afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  it('lists valid suites and reports parse errors for bad ones', async () => {
    const good = [
      'schemaVersion: 1',
      'name: tiny suite',
      'artifact: { kind: skill, name: tiny }',
      'judgeModel: claude-x',
      'runModel: claude-y',
      'cases:',
      '  - id: c1',
      '    prompt: hello',
      '    bucket: should-fire',
      '    shouldActivate: true',
    ].join('\n');
    await fs.writeFile(join(dir, 'evals', 'good.yaml'), good, 'utf8');
    await fs.writeFile(join(dir, 'evals', 'bad.yaml'), 'name: missing everything', 'utf8');

    const { suites, errors } = await storage.listSuites();
    expect(suites.map((s) => s.name)).toContain('tiny suite');
    expect(errors.map((e) => e.file)).toContain('bad.yaml');
  });

  it('saveSuiteYaml validates then persists, and round-trips via listSuites', async () => {
    const yaml = [
      'schemaVersion: 1',
      'name: saved suite',
      'artifact: { kind: subagent, name: sub-a }',
      'judgeModel: j',
      'runModel: r',
      'cases:',
      '  - id: x',
      '    prompt: p',
      '    bucket: task',
      '    shouldActivate: true',
    ].join('\n');
    const path = await storage.saveSuiteYaml(yaml, 'saved');
    expect(path.endsWith('saved.yaml')).toBe(true);
    const { suites } = await storage.listSuites();
    expect(suites.some((s) => s.name === 'saved suite')).toBe(true);
  });

  it('persists + loads a RunTrace by agentId; unknown id is null', async () => {
    const raw = await fs.readFile(join(coreFixtures, 'runtrace.subagent.json'), 'utf8');
    const trace = await storage.saveTrace(JSON.parse(raw));
    const loaded = await storage.loadTrace(trace.agentId);
    expect(loaded?.agentId).toBe(trace.agentId);
    expect(await storage.loadTrace('no-such-agent')).toBeNull();
  });
});
