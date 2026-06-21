/**
 * Data-source factory. Picks live mode when the server is reachable, otherwise
 * falls back to the static committed JSON (the mode that runs on GitHub Pages).
 */
import type { AnvilDataSource } from './types.js';
import { createLiveSource } from './liveSource.js';
import { createStaticSource } from './staticSource.js';

export * from './types.js';
export { createLiveSource, deriveWsUrl } from './liveSource.js';
export { createStaticSource, joinDataPath } from './staticSource.js';

export interface CreateDataSourceOptions {
  /** Override the API base (defaults to VITE_ANVIL_API or "/api"). */
  apiBase?: string;
  /** Force a mode, skipping the probe. */
  force?: 'live' | 'static';
  fetchImpl?: typeof fetch;
  /** Probe timeout (ms). */
  probeTimeoutMs?: number;
}

/** True iff the live server answers its health/results endpoint quickly. */
export async function probeLive(
  apiBase: string,
  doFetch: typeof fetch,
  timeoutMs = 1500,
): Promise<boolean> {
  const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : undefined;
  const timer = ctrl ? setTimeout(() => ctrl.abort(), timeoutMs) : undefined;
  try {
    const res = await doFetch(`${apiBase.replace(/\/+$/, '')}/results`, {
      signal: ctrl?.signal,
    });
    return res.ok;
  } catch {
    return false;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Resolve a data source. In a browser, probes the live API and falls back to
 * static. `force` short-circuits the probe (used by tests + offline builds).
 */
export async function createDataSource(
  options: CreateDataSourceOptions = {},
): Promise<AnvilDataSource> {
  const doFetch = options.fetchImpl ?? fetch;
  const apiBase =
    options.apiBase ??
    (import.meta.env?.VITE_ANVIL_API as string | undefined) ??
    '/api';

  if (options.force === 'static') return createStaticSource({ fetchImpl: doFetch });
  if (options.force === 'live') return createLiveSource({ apiBase, fetchImpl: doFetch });

  const live = await probeLive(apiBase, doFetch, options.probeTimeoutMs);
  return live
    ? createLiveSource({ apiBase, fetchImpl: doFetch })
    : createStaticSource({ fetchImpl: doFetch });
}
