/**
 * Orchestrator interface + MockOrchestrator (Ticket 1.4).
 *
 * The scoring/run flow needs a way to (a) dispatch a runner role on a case and
 * get back its final text + a {@link RunTrace}, and (b) dispatch a judge to get
 * a verdict. In production this is implemented by in-session subagents; in tests
 * it MUST be a mock that replays recorded outputs so the whole suite runs with
 * ZERO real subagent dispatches (no quota burn — execution-plan §0.2).
 *
 * {@link MockOrchestrator} replays a fixture bundle keyed by (caseId, role).
 * See `packages/core/fixtures/orchestrator/README.md` for the refresh procedure.
 */

import type { RunTrace, JudgeVerdict } from './result.js';

/** The runner role: treatment (artifact applied) vs baseline (without). */
export type RunnerRole = 'treatment' | 'baseline';

/** Result of dispatching a runner on a case. */
export interface RunnerResult {
  finalText: string;
  trace: RunTrace;
}

/** Arguments for a runner dispatch. */
export interface RunnerDispatch {
  caseId: string;
  role: RunnerRole;
  /** The prompt to drive the run (informational for the mock). */
  prompt?: string;
  /** Repetition index (0-based) so multi-rep fixtures can vary. */
  rep?: number;
}

/** Arguments for a judge dispatch. */
export interface JudgeDispatch {
  caseId: string;
  /** Option-A payload (final text). */
  a: string;
  /** Option-B payload (final text). */
  b: string;
  /** Whether treatment was placed in slot B (position-swapped). */
  swapped: boolean;
  rep?: number;
}

/** Result of dispatching a judge. */
export interface JudgeResult {
  /** Canonical verdict in treatment/baseline/tie terms (de-positioned). */
  verdict: JudgeVerdict;
  rationale?: string;
}

/**
 * Minimal dispatch interface the run/scoring flow depends on. Real and mock
 * implementations are interchangeable. All methods are async to match the
 * in-session subagent dispatch they model.
 */
export interface Orchestrator {
  /** Dispatch a runner (treatment or baseline) for a case. */
  dispatchRunner(d: RunnerDispatch): Promise<RunnerResult>;
  /** Dispatch a pairwise judge for a case. */
  dispatchJudge(d: JudgeDispatch): Promise<JudgeResult>;
}

// ---------------------------------------------------------------------------
// Fixture bundle
// ---------------------------------------------------------------------------

/** A single recorded runner output, keyed in the bundle by (caseId, role[, rep]). */
export interface RecordedRunner {
  caseId: string;
  role: RunnerRole;
  rep?: number;
  finalText: string;
  trace: RunTrace;
}

/** A single recorded judge output, keyed by (caseId, swapped[, rep]). */
export interface RecordedJudge {
  caseId: string;
  swapped: boolean;
  rep?: number;
  verdict: JudgeVerdict;
  rationale?: string;
}

/** The on-disk fixture bundle the {@link MockOrchestrator} replays. */
export interface OrchestratorFixture {
  runners: RecordedRunner[];
  judges: RecordedJudge[];
}

function runnerKey(caseId: string, role: RunnerRole, rep?: number): string {
  return `${caseId}::${role}::${rep ?? '*'}`;
}
function judgeKey(caseId: string, swapped: boolean, rep?: number): string {
  return `${caseId}::${swapped ? 'swap' : 'noswap'}::${rep ?? '*'}`;
}

/**
 * Replays a recorded {@link OrchestratorFixture}. Lookup prefers an exact
 * (caseId, role, rep) match, then falls back to a rep-agnostic record (`rep`
 * omitted / `'*'`), so a single recorded output can serve all reps. Throws a
 * descriptive error if a dispatch has no matching fixture — tests should record
 * every (caseId, role) they exercise rather than silently get a default.
 */
export class MockOrchestrator implements Orchestrator {
  private readonly runners = new Map<string, RecordedRunner>();
  private readonly judges = new Map<string, RecordedJudge>();

  /** Counts of dispatches served, for test assertions. */
  public readonly calls = { runners: 0, judges: 0 };

  constructor(fixture: OrchestratorFixture) {
    for (const r of fixture.runners) {
      this.runners.set(runnerKey(r.caseId, r.role, r.rep), r);
    }
    for (const j of fixture.judges) {
      this.judges.set(judgeKey(j.caseId, j.swapped, j.rep), j);
    }
  }

  dispatchRunner(d: RunnerDispatch): Promise<RunnerResult> {
    this.calls.runners += 1;
    const exact = this.runners.get(runnerKey(d.caseId, d.role, d.rep));
    const fallback = this.runners.get(runnerKey(d.caseId, d.role, undefined));
    const rec = exact ?? fallback;
    if (!rec) {
      return Promise.reject(
        new Error(
          `MockOrchestrator: no recorded runner for case "${d.caseId}" role "${d.role}" rep ${d.rep ?? '(any)'}`,
        ),
      );
    }
    return Promise.resolve({ finalText: rec.finalText, trace: rec.trace });
  }

  dispatchJudge(d: JudgeDispatch): Promise<JudgeResult> {
    this.calls.judges += 1;
    const exact = this.judges.get(judgeKey(d.caseId, d.swapped, d.rep));
    const fallback = this.judges.get(judgeKey(d.caseId, d.swapped, undefined));
    const rec = exact ?? fallback;
    if (!rec) {
      return Promise.reject(
        new Error(
          `MockOrchestrator: no recorded judge for case "${d.caseId}" swapped=${d.swapped} rep ${d.rep ?? '(any)'}`,
        ),
      );
    }
    return Promise.resolve({
      verdict: rec.verdict,
      ...(rec.rationale !== undefined ? { rationale: rec.rationale } : {}),
    });
  }
}

/**
 * Build an {@link OrchestratorFixture} from a loosely-typed JSON object (e.g. a
 * `JSON.parse` of a fixture file). Validates the minimum shape and leaves the
 * embedded `trace` to be validated by the introspection layer / RunTraceSchema
 * at use sites. Throws on a structurally invalid bundle.
 */
export function loadOrchestratorFixture(raw: unknown): OrchestratorFixture {
  if (typeof raw !== 'object' || raw === null) {
    throw new Error('orchestrator fixture must be an object');
  }
  const obj = raw as Record<string, unknown>;
  const runners = Array.isArray(obj['runners']) ? (obj['runners'] as RecordedRunner[]) : [];
  const judges = Array.isArray(obj['judges']) ? (obj['judges'] as RecordedJudge[]) : [];
  return { runners, judges };
}
