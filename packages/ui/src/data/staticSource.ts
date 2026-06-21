/**
 * Static (GitHub Pages) data source: reads committed JSON from a relative
 * `data/` path, validated through the frozen @anvil/core parse helpers. This is
 * the mode that actually runs today — no server required.
 */
import { parseRunIndex, parseScorecard, safeParseRunTrace } from '@anvil/core';
import type { AnvilDataSource, RunIndex, RunIndexEntry, Scorecard, RunTrace } from './types.js';

/**
 * Join the site base (Vite `import.meta.env.BASE_URL`, e.g. `/` or `/anvil/`)
 * with the data dir and a relative path, collapsing duplicate slashes. Keeping
 * it relative is what makes the build Pages-project-site compatible.
 */
export function joinDataPath(base: string, dataDir: string, rel: string): string {
  const parts = [base, dataDir, rel]
    .map((p) => p.replace(/^\/+|\/+$/g, ''))
    // Drop empty and bare-"." segments (a relative "./" base contributes nothing).
    .filter((p) => p.length > 0 && p !== '.');
  // Preserve a leading slash if the base had one (absolute base), else relative.
  const lead = base.startsWith('/') ? '/' : '';
  return lead + parts.join('/');
}

export interface StaticSourceOptions {
  /** Vite base (defaults to import.meta.env.BASE_URL). */
  base?: string;
  /** Data directory under the base. Defaults to "data". */
  dataDir?: string;
  /** Injectable fetch for tests. Defaults to global fetch. */
  fetchImpl?: typeof fetch;
}

export function createStaticSource(options: StaticSourceOptions = {}): AnvilDataSource {
  const base = options.base ?? (import.meta.env?.BASE_URL ?? './');
  const dataDir = options.dataDir ?? 'data';
  const doFetch = options.fetchImpl ?? fetch;

  async function fetchJson(rel: string): Promise<unknown> {
    const url = joinDataPath(base, dataDir, rel);
    const res = await doFetch(url);
    if (!res.ok) {
      throw new Error(`static data fetch failed: ${url} → HTTP ${res.status}`);
    }
    return (await res.json()) as unknown;
  }

  return {
    mode: 'static',

    async getRunIndex(): Promise<RunIndex> {
      return parseRunIndex(await fetchJson('index.json'));
    },

    async getScorecard(runId: string, entry?: RunIndexEntry): Promise<Scorecard> {
      // Prefer the index entry's resultPath; fall back to demo/<runId>.json.
      const rel = entry?.resultPath ?? `demo/${runId}.json`;
      return parseScorecard(await fetchJson(rel));
    },

    async getTrace(agentId: string): Promise<RunTrace | null> {
      try {
        const raw = await fetchJson(`traces/${agentId}.json`);
        const parsed = safeParseRunTrace(raw);
        return parsed.success ? parsed.data : null;
      } catch {
        // A missing trace file is expected for demo data — not an error.
        return null;
      }
    },

    async getSuites() {
      // Static mode ships no editable suites.
      return [];
    },

    subscribe() {
      // No live channel in static mode.
      return () => {};
    },
  };
}
