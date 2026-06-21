/**
 * Live data source: the Epic-2 server's REST + WS API. Shapes are validated
 * through the same @anvil/core parse helpers as static mode, so a server that
 * drifts from the frozen contract fails loudly here.
 *
 * See `types.ts` for the exact endpoint + WS-message contract the server agent
 * must satisfy.
 */
import {
  parseRunIndex,
  parseScorecard,
  safeParseRunTrace,
  safeParseEvalSuite,
} from '@anvil/core';
import type {
  AnvilDataSource,
  RunIndex,
  RunIndexEntry,
  Scorecard,
  RunTrace,
  EvalSuite,
  LiveEvent,
  Unsubscribe,
} from './types.js';

export interface LiveSourceOptions {
  /** API base, e.g. "/api" or "http://localhost:4319/api". */
  apiBase: string;
  fetchImpl?: typeof fetch;
  /** Injectable WS ctor for tests; defaults to global WebSocket. */
  webSocketImpl?: typeof WebSocket;
}

/** Derive the ws:// URL for the push channel from the http(s) API base. */
export function deriveWsUrl(apiBase: string): string {
  // Absolute http(s) base → swap scheme. Relative base → use page origin.
  let absolute = apiBase;
  if (!/^https?:\/\//i.test(apiBase)) {
    const origin =
      typeof window !== 'undefined' && window.location ? window.location.origin : 'http://localhost';
    absolute = origin.replace(/\/+$/, '') + '/' + apiBase.replace(/^\/+/, '');
  }
  return absolute.replace(/^http/i, 'ws').replace(/\/+$/, '') + '/ws';
}

export function createLiveSource(options: LiveSourceOptions): AnvilDataSource {
  const apiBase = options.apiBase.replace(/\/+$/, '');
  const doFetch = options.fetchImpl ?? fetch;
  const WSImpl = options.webSocketImpl ?? (typeof WebSocket !== 'undefined' ? WebSocket : undefined);

  async function fetchJson(path: string): Promise<unknown> {
    const res = await doFetch(`${apiBase}${path}`);
    if (!res.ok) throw new Error(`live API ${path} → HTTP ${res.status}`);
    return (await res.json()) as unknown;
  }

  return {
    mode: 'live',

    async getRunIndex(): Promise<RunIndex> {
      return parseRunIndex(await fetchJson('/results'));
    },

    async getScorecard(runId: string, _entry?: RunIndexEntry): Promise<Scorecard> {
      return parseScorecard(await fetchJson(`/results/${encodeURIComponent(runId)}`));
    },

    async getTrace(agentId: string): Promise<RunTrace | null> {
      try {
        const raw = await fetchJson(`/traces/${encodeURIComponent(agentId)}`);
        const parsed = safeParseRunTrace(raw);
        return parsed.success ? parsed.data : null;
      } catch {
        return null;
      }
    },

    async getSuites(): Promise<EvalSuite[]> {
      const raw = await fetchJson('/suites');
      if (!Array.isArray(raw)) return [];
      const out: EvalSuite[] = [];
      for (const item of raw) {
        const parsed = safeParseEvalSuite(item);
        if (parsed.success) out.push(parsed.data);
      }
      return out;
    },

    subscribe(onEvent: (event: LiveEvent) => void): Unsubscribe {
      if (!WSImpl) return () => {};
      let closed = false;
      let socket: WebSocket | null = null;
      try {
        socket = new WSImpl(deriveWsUrl(apiBase));
      } catch {
        return () => {};
      }
      socket.onmessage = (ev: MessageEvent) => {
        let msg: LiveEvent;
        try {
          msg = JSON.parse(typeof ev.data === 'string' ? ev.data : '') as LiveEvent;
        } catch {
          return;
        }
        if (msg && (msg.type === 'scorecard' || msg.type === 'index')) onEvent(msg);
      };
      return () => {
        if (closed) return;
        closed = true;
        try {
          socket?.close();
        } catch {
          /* ignore */
        }
      };
    },
  };
}
