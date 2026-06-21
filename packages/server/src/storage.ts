/**
 * Storage layer (Ticket 2.1).
 *
 * JSON persistence under a configurable results dir (default repo `results/`):
 *   - `results/<runId>.json`  — the full {@link Scorecard} (schema-validated on save).
 *   - `results/index.json`    — the {@link RunIndex}; idempotent append/update by runId.
 *
 * Also lists/loads eval suites from the configured `evals/` dir.
 *
 * Design choices, justified:
 *   - **Atomic writes**: write to a unique temp file in the SAME dir, then
 *     `rename` over the target. `rename` is atomic on a single filesystem, so a
 *     reader never observes a half-written file and a crash mid-write leaves the
 *     previous file intact. (Windows `rename` can fail with EEXIST/EPERM if the
 *     target exists; we use `fs.rename` which on Node replaces the destination,
 *     and fall back to unlink+rename on EEXIST/EPERM for older platforms.)
 *   - **Idempotent index**: an index is keyed by `runId`. Re-saving the same
 *     runId UPDATES its entry in place (no duplicate); a new runId is prepended
 *     (newest-first, per the UI contract). The full index is then atomically
 *     rewritten.
 *   - **Serialized index updates**: concurrent `saveScorecard` calls within one
 *     process are serialized through an in-process promise chain so a read-
 *     modify-write of `index.json` can't interleave and lose an entry. This is
 *     "concurrency-safe enough for sequential eval runs" (the ticket's bar); it
 *     is NOT a cross-process lock.
 *   - **Graceful missing dir**: reads of an absent results dir return an empty
 *     index / null rather than throwing; the dir is created lazily on first write.
 */

import { promises as fs } from 'node:fs';
import { join, isAbsolute } from 'node:path';
import { randomBytes } from 'node:crypto';
import {
  parseScorecard,
  parseRunIndex,
  parseRunTrace,
  parseEvalSuiteYaml,
  type Scorecard,
  type RunIndex,
  type RunIndexEntry,
  type RunTrace,
  type EvalSuite,
  RESULT_SCHEMA_VERSION,
} from '@anvil/core';

/** The index filename within the results dir. */
const INDEX_FILE = 'index.json';

function isNotFound(err: unknown): boolean {
  return (err as NodeJS.ErrnoException)?.code === 'ENOENT';
}

/**
 * Atomically write `data` to `target`: write a sibling temp file, fsync-free
 * (durability across crashes is not a requirement here — atomicity of the
 * visible file is), then rename over the target.
 */
async function atomicWriteFile(target: string, data: string): Promise<void> {
  const dir = target.slice(0, Math.max(target.lastIndexOf('/'), target.lastIndexOf('\\')));
  const tmp = `${target}.${process.pid}.${randomBytes(6).toString('hex')}.tmp`;
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(tmp, data, 'utf8');
  try {
    await fs.rename(tmp, target);
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    // Some Windows/older platforms reject rename onto an existing file.
    if (code === 'EEXIST' || code === 'EPERM') {
      await fs.rm(target, { force: true });
      await fs.rename(tmp, target);
    } else {
      // Best-effort cleanup of the temp file, then surface the original error.
      await fs.rm(tmp, { force: true }).catch(() => undefined);
      throw err;
    }
  }
}

/** Derive a lightweight {@link RunIndexEntry} from a full {@link Scorecard}. */
export function indexEntryFromScorecard(card: Scorecard): RunIndexEntry {
  const headline: RunIndexEntry['headline'] = {};
  const f1 = card.metrics['activation.f1']?.value;
  const qd = card.metrics['quality.delta']?.value;
  const ct = card.metrics['cost.tokens']?.value;
  if (f1 !== undefined) headline.activationF1 = f1;
  if (qd !== undefined) headline.qualityDelta = qd;
  if (ct !== undefined) headline.costTokens = ct;
  return {
    runId: card.runId,
    suiteName: card.suiteName,
    artifactKind: card.artifact.kind,
    artifactName: card.artifact.name,
    createdAt: card.createdAt,
    headline,
    // Path is relative to the results dir (the UI's static mode resolves it
    // under {dataBase}); live mode ignores it and fetches /api/results/:runId.
    resultPath: `${card.runId}.json`,
  };
}

/** Upsert `entry` into `runs` by runId (idempotent); newest-first ordering. */
function upsertEntry(runs: RunIndexEntry[], entry: RunIndexEntry): RunIndexEntry[] {
  const idx = runs.findIndex((r) => r.runId === entry.runId);
  if (idx >= 0) {
    // Update in place — preserve position so a re-save doesn't reorder.
    const next = runs.slice();
    next[idx] = entry;
    return next;
  }
  // New run: prepend (newest-first).
  return [entry, ...runs];
}

/**
 * The storage facade. One instance per results+evals configuration. All public
 * methods are async. Index writes are serialized through {@link withIndexLock}.
 */
export class Storage {
  readonly resultsDir: string;
  readonly evalsDir: string;
  /** Serializes read-modify-write of index.json within this process. */
  private indexChain: Promise<unknown> = Promise.resolve();

  constructor(args: { resultsDir: string; evalsDir: string }) {
    this.resultsDir = args.resultsDir;
    this.evalsDir = args.evalsDir;
  }

  private get indexPath(): string {
    return join(this.resultsDir, INDEX_FILE);
  }

  private scorecardPath(runId: string): string {
    return join(this.resultsDir, `${runId}.json`);
  }

  private tracePath(agentId: string): string {
    return join(this.resultsDir, 'traces', `${agentId}.json`);
  }

  /**
   * Persist a {@link RunTrace} under `results/traces/<agentId>.json` so the
   * companion API can serve it by agentId (the UI's `GET /api/traces/:agentId`).
   * Live introspection from ids happens via the MCP `anvil_introspect_transcript`
   * tool; this lets the orchestration flow archive the trace it recovered for
   * later UI drill-down.
   */
  async saveTrace(input: unknown): Promise<RunTrace> {
    const trace = parseRunTrace(input);
    await atomicWriteFile(this.tracePath(trace.agentId), `${JSON.stringify(trace, null, 2)}\n`);
    return trace;
  }

  /** Load a persisted {@link RunTrace} by agentId. Returns `null` if absent. */
  async loadTrace(agentId: string): Promise<RunTrace | null> {
    let raw: string;
    try {
      raw = await fs.readFile(this.tracePath(agentId), 'utf8');
    } catch (err) {
      if (isNotFound(err)) return null;
      throw err;
    }
    return parseRunTrace(JSON.parse(raw));
  }

  /** Run `fn` after any in-flight index mutation completes (serialize writes). */
  private withIndexLock<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.indexChain.then(fn, fn);
    // Keep the chain alive regardless of fn's outcome, but don't swallow errors
    // for the caller.
    this.indexChain = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  /**
   * Read the current {@link RunIndex}. Returns an empty index (no runs) when the
   * file or dir is absent. Throws a {@link ParseError} if the file is corrupt.
   */
  async readIndex(): Promise<RunIndex> {
    let raw: string;
    try {
      raw = await fs.readFile(this.indexPath, 'utf8');
    } catch (err) {
      if (isNotFound(err)) {
        return { schemaVersion: RESULT_SCHEMA_VERSION, runs: [] };
      }
      throw err;
    }
    return parseRunIndex(JSON.parse(raw));
  }

  /**
   * Persist a {@link Scorecard}: validate it, atomically write
   * `results/<runId>.json`, then idempotently upsert its index entry and
   * atomically rewrite `results/index.json`. Returns the resulting index entry.
   *
   * Re-saving the SAME runId overwrites the file and updates (does not
   * duplicate) the index entry.
   */
  async saveScorecard(input: unknown): Promise<{ scorecard: Scorecard; entry: RunIndexEntry }> {
    // Validate up-front so a bad scorecard never reaches disk or the index.
    const card = parseScorecard(input);
    const entry = indexEntryFromScorecard(card);

    await atomicWriteFile(this.scorecardPath(card.runId), `${JSON.stringify(card, null, 2)}\n`);

    await this.withIndexLock(async () => {
      const index = await this.readIndex();
      const next: RunIndex = {
        schemaVersion: RESULT_SCHEMA_VERSION,
        runs: upsertEntry(index.runs, entry),
      };
      await atomicWriteFile(this.indexPath, `${JSON.stringify(next, null, 2)}\n`);
    });

    return { scorecard: card, entry };
  }

  /**
   * Load a {@link Scorecard} by runId. Returns `null` when no such result file
   * exists. Throws a {@link ParseError} if the stored file is corrupt.
   */
  async loadScorecard(runId: string): Promise<Scorecard | null> {
    let raw: string;
    try {
      raw = await fs.readFile(this.scorecardPath(runId), 'utf8');
    } catch (err) {
      if (isNotFound(err)) return null;
      throw err;
    }
    return parseScorecard(JSON.parse(raw));
  }

  /**
   * List + parse all `*.yaml`/`*.yml` eval suites under the evals dir. Files
   * that fail to parse are SKIPPED (with their error returned for surfacing)
   * rather than failing the whole listing — one bad suite shouldn't blind the
   * UI to the good ones. Returns `[]` when the evals dir is absent.
   */
  async listSuites(): Promise<{ suites: EvalSuite[]; errors: { file: string; message: string }[] }> {
    let names: string[];
    try {
      names = await fs.readdir(this.evalsDir);
    } catch (err) {
      if (isNotFound(err)) return { suites: [], errors: [] };
      throw err;
    }
    const yamlFiles = names.filter((n) => n.endsWith('.yaml') || n.endsWith('.yml')).sort();
    const suites: EvalSuite[] = [];
    const errors: { file: string; message: string }[] = [];
    for (const file of yamlFiles) {
      const full = join(this.evalsDir, file);
      try {
        const text = await fs.readFile(full, 'utf8');
        suites.push(parseEvalSuiteYaml(text));
      } catch (err) {
        errors.push({ file, message: (err as Error).message });
      }
    }
    return { suites, errors };
  }

  /**
   * Save an {@link EvalSuite} to the evals dir as YAML-less JSON-in-YAML is
   * lossy; we round-trip through the validated object and write canonical YAML.
   * Returns the absolute path written. `fileName` defaults to a slug of the
   * suite name; an explicit name is used verbatim (must end in .yaml/.yml).
   */
  async saveSuiteYaml(yaml: string, fileName: string): Promise<string> {
    // Validate before writing so the evals dir only holds valid suites.
    parseEvalSuiteYaml(yaml);
    const safeName =
      fileName.endsWith('.yaml') || fileName.endsWith('.yml') ? fileName : `${fileName}.yaml`;
    const target = isAbsolute(safeName) ? safeName : join(this.evalsDir, safeName);
    await atomicWriteFile(target, yaml.endsWith('\n') ? yaml : `${yaml}\n`);
    return target;
  }
}
