import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { createStaticSource, joinDataPath } from './staticSource.js';
import { createLiveSource, deriveWsUrl } from './liveSource.js';
import { createDataSource, probeLive } from './index.js';

const here = dirname(fileURLToPath(import.meta.url));
const fixtures = resolve(here, '../../../core/fixtures');
const read = (n: string) => JSON.parse(readFileSync(resolve(fixtures, n), 'utf8'));

/** A fetch stub that routes by URL substring. */
function stubFetch(
  routes: Record<string, unknown>,
  opts: { fail?: string[]; contentType?: string } = {},
): typeof fetch {
  const headers = (ct: string) => ({
    get: (h: string) => (h.toLowerCase() === 'content-type' ? ct : null),
  });
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (opts.fail?.some((f) => url.includes(f))) {
      return { ok: false, status: 500, headers: headers('application/json'), json: async () => ({}) } as Response;
    }
    const key = Object.keys(routes).find((k) => url.includes(k));
    if (!key) return { ok: false, status: 404, headers: headers('text/html'), json: async () => ({}) } as Response;
    return {
      ok: true,
      status: 200,
      headers: headers(opts.contentType ?? 'application/json; charset=utf-8'),
      json: async () => routes[key],
    } as Response;
  }) as unknown as typeof fetch;
}

describe('joinDataPath', () => {
  it('keeps a relative base relative', () => {
    expect(joinDataPath('./', 'data', 'index.json')).toBe('data/index.json');
  });
  it('honours a Pages project subpath base', () => {
    expect(joinDataPath('/anvil/', 'data', 'demo/x.json')).toBe('/anvil/data/demo/x.json');
  });
});

describe('static source', () => {
  const src = createStaticSource({
    base: './',
    fetchImpl: stubFetch({
      'data/index.json': read('index.json'),
      'data/demo/run-2026-06-21-bake-001.json': read('result.scorecard.json'),
      'data/traces/agent-aa11bb22cc33dd44.json': read('runtrace.subagent.json'),
    }),
  });

  it('loads + validates the run index', async () => {
    const idx = await src.getRunIndex();
    expect(idx.runs).toHaveLength(1);
  });
  it('resolves a scorecard via the entry resultPath', async () => {
    const idx = await src.getRunIndex();
    const card = await src.getScorecard(idx.runs[0]!.runId, idx.runs[0]);
    expect(card.suiteName).toBe('bake-to-completion effectiveness');
  });
  it('loads a trace and returns null for a missing one', async () => {
    expect(await src.getTrace('agent-aa11bb22cc33dd44')).not.toBeNull();
    expect(await src.getTrace('agent-does-not-exist')).toBeNull();
  });
  it('has no suites and a no-op subscribe', async () => {
    expect(await src.getSuites()).toEqual([]);
    expect(typeof src.subscribe(() => {})).toBe('function');
  });
});

describe('live source', () => {
  it('reads results/scorecard/traces from the REST contract', async () => {
    const src = createLiveSource({
      apiBase: '/api',
      fetchImpl: stubFetch({
        '/api/results/run-2026-06-21-bake-001': read('result.scorecard.json'),
        '/api/results': read('index.json'),
        '/api/traces/agent-aa11bb22cc33dd44': read('runtrace.subagent.json'),
      }),
    });
    expect((await src.getRunIndex()).runs).toHaveLength(1);
    expect((await src.getScorecard('run-2026-06-21-bake-001')).runId).toBe(
      'run-2026-06-21-bake-001',
    );
    expect(await src.getTrace('agent-aa11bb22cc33dd44')).not.toBeNull();
  });

  it('derives the ws url from an absolute api base', () => {
    expect(deriveWsUrl('http://localhost:4319/api')).toBe('ws://localhost:4319/api/ws');
    expect(deriveWsUrl('https://h/api')).toBe('wss://h/api/ws');
  });

  it('subscribe forwards scorecard/index messages and ignores pings', () => {
    const handlers: Record<string, ((ev: { data: string }) => void) | undefined> = {};
    class FakeWS {
      onmessage?: (ev: { data: string }) => void;
      constructor(public url: string) {}
      set _h(_: unknown) {}
      close() {}
    }
    // capture instance
    let inst: FakeWS | undefined;
    const Impl = function (this: FakeWS, url: string) {
      inst = new FakeWS(url);
      Object.defineProperty(inst, 'onmessage', {
        set(fn) {
          handlers.msg = fn;
        },
        configurable: true,
      });
      return inst;
    } as unknown as typeof WebSocket;

    const src = createLiveSource({ apiBase: '/api', webSocketImpl: Impl });
    const events: unknown[] = [];
    const unsub = src.subscribe((e) => events.push(e));
    handlers.msg?.({ data: JSON.stringify({ type: 'ping' }) });
    handlers.msg?.({
      data: JSON.stringify({ type: 'scorecard', runId: 'r1', entry: {} }),
    });
    expect(events).toHaveLength(1);
    expect((events[0] as { type: string }).type).toBe('scorecard');
    expect(typeof unsub).toBe('function');
    unsub();
  });
});

describe('createDataSource probe + fallback', () => {
  it('probeLive is true when /results answers ok', async () => {
    expect(await probeLive('/api', stubFetch({ '/api/results': read('index.json') }))).toBe(true);
  });
  it('probeLive is false when a 200 SPA-fallback returns text/html, not JSON', async () => {
    // Regression: `vite preview` / GitHub Pages answer unknown paths with index.html
    // (200 but text/html). Treating that as "live" makes the app parse HTML as JSON.
    expect(
      await probeLive('/api', stubFetch({ '/api/results': read('index.json') }, { contentType: 'text/html; charset=utf-8' })),
    ).toBe(false);
  });
  it('probeLive is false when the server fails', async () => {
    expect(await probeLive('/api', stubFetch({}, { fail: ['/api/results'] }))).toBe(false);
  });
  it('falls back to static when the live probe fails', async () => {
    const src = await createDataSource({
      apiBase: '/api',
      fetchImpl: stubFetch(
        { 'data/index.json': read('index.json') },
        { fail: ['/api/results'] },
      ),
    });
    expect(src.mode).toBe('static');
    expect((await src.getRunIndex()).runs).toHaveLength(1);
  });
  it('uses live when the probe succeeds', async () => {
    const src = await createDataSource({
      apiBase: '/api',
      fetchImpl: stubFetch({ '/api/results': read('index.json') }),
    });
    expect(src.mode).toBe('live');
  });
});
