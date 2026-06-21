/**
 * Anvil UI data layer — the interface both modes implement, and the
 * documented contract the Epic-2 server must satisfy for live mode.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * LIVE SERVER CONTRACT (what the server agent must implement)
 * ─────────────────────────────────────────────────────────────────────────────
 * Base URL: configured via `VITE_ANVIL_API` (default `/api`). All JSON.
 *
 *   GET  {base}/suites
 *        → 200  EvalSuite[]            (parsed by @anvil/core EvalSuiteSchema)
 *
 *   GET  {base}/results
 *        → 200  RunIndex               ({ schemaVersion, runs: RunIndexEntry[] })
 *
 *   GET  {base}/results/:runId
 *        → 200  Scorecard              (full @anvil/core ScorecardSchema)
 *        → 404  if unknown
 *
 *   GET  {base}/traces/:agentId
 *        → 200  RunTrace               (full @anvil/core RunTraceSchema)
 *        → 404  if the transcript is unavailable
 *
 *   WS   {base-as-ws}/ws               (e.g. ws://host/api/ws)
 *        Server → client push messages, JSON, shape:
 *          { "type": "scorecard",  "runId": string, "entry": RunIndexEntry }
 *              — a new/updated scorecard is available; UI refreshes the index
 *                and (if open) the affected run.
 *          { "type": "index",      "index": RunIndex }
 *              — full index replacement (optional convenience).
 *          { "type": "ping" }       — keep-alive, ignored by the UI.
 *
 * STATIC (GitHub Pages) MODE — no server:
 *   GET  {dataBase}/index.json                  → RunIndex
 *   GET  {dataBase}/<RunIndexEntry.resultPath>  → Scorecard   (path is relative
 *                                                  to {dataBase}, e.g. demo/x.json)
 *   GET  {dataBase}/traces/<agentId>.json       → RunTrace    (best-effort; a
 *                                                  404 is tolerated)
 *   `{dataBase}` defaults to `data` (relative), so it resolves under the Vite
 *   `base` wherever the site is hosted (domain root or a Pages project subpath).
 */
import type { RunIndex, RunIndexEntry, Scorecard, RunTrace, EvalSuite } from '@anvil/core';

export type { RunIndex, RunIndexEntry, Scorecard, RunTrace, EvalSuite };

/** Which transport answered. */
export type DataMode = 'live' | 'static';

/** A live-mode WS push, narrowed to what the UI acts on. */
export type LiveEvent =
  | { type: 'scorecard'; runId: string; entry: RunIndexEntry }
  | { type: 'index'; index: RunIndex }
  | { type: 'ping' };

/** Unsubscribe handle. */
export type Unsubscribe = () => void;

/**
 * The single interface the app talks to. `createDataSource()` returns the live
 * implementation when the server is reachable, else the static one — the app
 * code is identical for both.
 */
export interface AnvilDataSource {
  /** Which mode this instance is operating in (for a UI badge). */
  readonly mode: DataMode;
  /** The leaderboard index. */
  getRunIndex(): Promise<RunIndex>;
  /** A full scorecard. `entry` lets static mode resolve `resultPath`. */
  getScorecard(runId: string, entry?: RunIndexEntry): Promise<Scorecard>;
  /** A run trace by agentId; resolves `null` when unavailable (not an error). */
  getTrace(agentId: string): Promise<RunTrace | null>;
  /** Eval suites (live only; static returns []). */
  getSuites(): Promise<EvalSuite[]>;
  /**
   * Subscribe to live updates. Static mode invokes nothing and returns a no-op.
   * `onEvent` fires for `scorecard`/`index` pushes (pings are swallowed).
   */
  subscribe(onEvent: (event: LiveEvent) => void): Unsubscribe;
}
