import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import WebSocket from 'ws';
import { parseRunIndex, parseScorecard, type Scorecard } from '@anvil/core';
import { Storage } from './storage.js';
import { AnvilHttpServer } from './http.js';

const here = dirname(fileURLToPath(import.meta.url));
const coreFixtures = resolve(here, '../../core/fixtures');

async function loadCard(): Promise<Scorecard> {
  const raw = await fs.readFile(join(coreFixtures, 'result.scorecard.json'), 'utf8');
  return parseScorecard(JSON.parse(raw));
}

/** Wait for the next message on a WS, with a timeout. */
function nextMessage(ws: WebSocket, timeoutMs = 3000): Promise<unknown> {
  return new Promise((resolveMsg, reject) => {
    const timer = setTimeout(() => reject(new Error('ws message timeout')), timeoutMs);
    const onMsg = (data: WebSocket.RawData): void => {
      const parsed = JSON.parse(data.toString());
      // Ignore keep-alive pings; wait for a real event.
      if (parsed.type === 'ping') return;
      clearTimeout(timer);
      ws.off('message', onMsg);
      resolveMsg(parsed);
    };
    ws.on('message', onMsg);
  });
}

describe('Companion HTTP/WS API (acceptance #6)', () => {
  let dir: string;
  let storage: Storage;
  let server: AnvilHttpServer;
  let base: string;
  let wsUrl: string;

  beforeAll(async () => {
    dir = await fs.mkdtemp(join(tmpdir(), 'anvil-http-'));
    // Seed evals dir with one suite to exercise GET /api/suites.
    await fs.mkdir(join(dir, 'evals'), { recursive: true });
    await fs.writeFile(
      join(dir, 'evals', 's.yaml'),
      [
        'schemaVersion: 1',
        'name: http suite',
        'artifact: { kind: skill, name: x }',
        'judgeModel: j',
        'runModel: r',
        'cases:',
        '  - id: c',
        '    prompt: p',
        '    bucket: task',
        '    shouldActivate: true',
      ].join('\n'),
      'utf8',
    );

    storage = new Storage({ resultsDir: join(dir, 'results'), evalsDir: join(dir, 'evals') });
    server = new AnvilHttpServer({ storage });
    const port = await server.listen(0, '127.0.0.1'); // ephemeral port
    base = `http://127.0.0.1:${port}/api`;
    wsUrl = `ws://127.0.0.1:${port}/api/ws`;
  });

  afterAll(async () => {
    await server.close();
    await fs.rm(dir, { recursive: true, force: true });
  });

  it('GET /api/results returns 200 + a valid (initially empty) RunIndex (liveness probe)', async () => {
    const res = await fetch(`${base}/results`);
    expect(res.status).toBe(200);
    const index = parseRunIndex(await res.json());
    expect(index.runs).toEqual([]);
  });

  it('GET /api/results/:runId returns 404 for an unknown run', async () => {
    const res = await fetch(`${base}/results/unknown-run`);
    expect(res.status).toBe(404);
  });

  it('GET /api/suites returns the parsed suites array', async () => {
    const res = await fetch(`${base}/suites`);
    expect(res.status).toBe(200);
    const suites = (await res.json()) as { name: string }[];
    expect(suites.map((s) => s.name)).toContain('http suite');
  });

  it('sets permissive CORS headers', async () => {
    const res = await fetch(`${base}/results`);
    expect(res.headers.get('access-control-allow-origin')).toBe('*');
  });

  it('saving a scorecard pushes {type:"scorecard"} over WS, then it is fetchable', async () => {
    const card = await loadCard();
    const ws = new WebSocket(wsUrl);
    await new Promise<void>((r, rej) => {
      ws.once('open', () => r());
      ws.once('error', rej);
    });

    const messagePromise = nextMessage(ws);
    const entry = await server.saveScorecard(card);
    const msg = (await messagePromise) as { type: string; runId: string; entry: { runId: string } };
    expect(msg.type).toBe('scorecard');
    expect(msg.runId).toBe(card.runId);
    expect(msg.entry.runId).toBe(entry.runId);
    ws.close();

    // The saved scorecard is now fetchable + valid.
    const res = await fetch(`${base}/results/${card.runId}`);
    expect(res.status).toBe(200);
    const fetched = parseScorecard(await res.json());
    expect(fetched.runId).toBe(card.runId);

    // And the index now lists it.
    const idxRes = await fetch(`${base}/results`);
    const index = parseRunIndex(await idxRes.json());
    expect(index.runs.map((r) => r.runId)).toContain(card.runId);
  });

  it('GET /api/traces/:agentId 404s when absent, 200s after a trace is saved', async () => {
    const miss = await fetch(`${base}/traces/agent-missing`);
    expect(miss.status).toBe(404);

    const raw = await fs.readFile(join(coreFixtures, 'runtrace.subagent.json'), 'utf8');
    const trace = await storage.saveTrace(JSON.parse(raw));
    const hit = await fetch(`${base}/traces/${trace.agentId}`);
    expect(hit.status).toBe(200);
    const body = (await hit.json()) as { agentId: string };
    expect(body.agentId).toBe(trace.agentId);
  });
});
