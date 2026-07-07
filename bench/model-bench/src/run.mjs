// CLI orchestrator. Thin glue only: parseCli is unit-tested, the pipeline
// pieces are tested in their own modules, and --dry-run is the end-to-end
// check (spec deliverable 5).
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { probeModel } from './probe.mjs';
import { saveConfig } from './config.mjs';
import { loadTasks, runPhase1 } from './phase1.mjs';
import { writeReports } from './report.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CONFIGS_DIR = join(ROOT, 'configs');
const TASKS_DIR = join(ROOT, 'tasks', 'p1');
const RESULTS_DIR = join(ROOT, 'results');
const DRY_RUN_MODEL = 'meta/llama-3.3-70b-instruct';

export function parseCli(argv) {
  const { values } = parseArgs({
    args: argv,
    options: {
      phase: { type: 'string' },
      models: { type: 'string' },
      n: { type: 'string' },
      'dry-run': { type: 'boolean', default: false },
      tasks: { type: 'string' },
    },
  });
  const dryRun = values['dry-run'];
  const phase = dryRun ? null : (values.phase ?? null);
  const models = dryRun ? [DRY_RUN_MODEL] : (values.models ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  if (!dryRun && phase !== 'report' && !models.length) {
    throw new Error('--models a/x,b/y is required unless --dry-run or --phase report');
  }
  const n = dryRun ? 1 : Number(values.n ?? 5);
  if (!Number.isInteger(n) || n < 1) throw new Error('--n must be a positive integer');
  const taskIds = values.tasks ? values.tasks.split(',').map((s) => s.trim()).filter(Boolean) : null;
  return { phase, models, dryRun, n, taskIds };
}

const PROBE_HEADER = '| Model | echo | system | longOutput | tools | fence | toggle | status | notes |';
const PROBE_SEP = '|---|---|---|---|---|---|---|---|---|';

// Rewrites the report with a real markdown table: header + separator once,
// one row per model, latest probe wins on rerun.
export function upsertProbeRow(reportFile, model, row) {
  let lines = [];
  try {
    lines = readFileSync(reportFile, 'utf8').split('\n').filter(Boolean);
  } catch {
    // file doesn't exist yet
  }
  lines = lines.filter((l) => !l.startsWith(`| ${model} |`));
  if (lines[0] !== PROBE_HEADER) {
    lines = [PROBE_HEADER, PROBE_SEP, ...lines];
  }
  lines.push(row);
  writeFileSync(reportFile, lines.join('\n') + '\n');
}

async function phase0(models) {
  mkdirSync(RESULTS_DIR, { recursive: true });
  const reportFile = join(RESULTS_DIR, 'probe-report.md');
  for (const model of models) {
    console.log(`probing ${model}…`);
    const { config, report } = await probeModel(model);
    if (report.excluded) {
      console.log(`${model}: EXCLUDED (endpoint issues) — no config written`);
    } else {
      saveConfig(config, CONFIGS_DIR);
    }
    const row = `| ${model} | ${['echo', 'system', 'longOutput', 'tools', 'fence', 'toggle'].map((k) => report.probes[k]).join(' | ')} | ${report.excluded ? 'EXCLUDED' : 'ok'} | ${report.notes.join('; ')} |`;
    upsertProbeRow(reportFile, model, row);
    console.log(row);
  }
  console.log(`configs written to ${CONFIGS_DIR} — review each JSON before phase 1.`);
}

async function phase1(models, n, taskIds = null) {
  const records = await runPhase1(
    { models, tasksDir: TASKS_DIR, configsDir: CONFIGS_DIR, resultsDir: RESULTS_DIR, nRuns: n, taskIds },
    { log: console.log },
  );
  writeReports(records, RESULTS_DIR);
  console.log(`wrote ${join(RESULTS_DIR, 'summary.csv')} and report.md (${records.length} runs)`);
}

export function phaseReport(resultsDir = RESULTS_DIR, tasksDir = TASKS_DIR) {
  let records;
  try {
    records = JSON.parse(readFileSync(join(resultsDir, 'phase1-records.json'), 'utf8'));
  } catch {
    throw new Error('No phase1-records.json under results/ — run --phase 1 (or --dry-run) first.');
  }
  // Legacy records (pre language/type) get the fields re-derived from the
  // task bank so old raw data never needs migration.
  let meta = new Map();
  try {
    meta = new Map(loadTasks(tasksDir).map((t) => [t.id, t]));
  } catch {
    // tasks dir unreadable: fall back to 'unknown' below
  }
  for (const r of records) {
    r.language ??= meta.get(r.task)?.language ?? 'unknown';
    r.type ??= meta.get(r.task)?.type ?? 'unknown';
  }
  writeReports(records, resultsDir);
  console.log(`rebuilt reports from ${records.length} records`);
}

async function main() {
  const cli = parseCli(process.argv.slice(2));
  if (cli.dryRun) {
    await phase0(cli.models);
    await phase1(cli.models, cli.n, cli.taskIds);
    phaseReport();
    console.log('dry run complete — inspect results/report.md before the full spend.');
    return;
  }
  if (cli.phase === '0') return phase0(cli.models);
  if (cli.phase === '1') return phase1(cli.models, cli.n, cli.taskIds);
  if (cli.phase === 'report') return phaseReport();
  throw new Error(`unknown --phase ${cli.phase}; use 0 | 1 | report or --dry-run`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
}
