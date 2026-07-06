// CLI orchestrator. Thin glue only: parseCli is unit-tested, the pipeline
// pieces are tested in their own modules, and --dry-run is the end-to-end
// check (spec deliverable 5).
import { appendFileSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { probeModel } from './probe.mjs';
import { saveConfig } from './config.mjs';
import { runPhase1 } from './phase1.mjs';
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
    },
  });
  const dryRun = values['dry-run'];
  const models = dryRun ? [DRY_RUN_MODEL] : (values.models ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  if (!dryRun && !models.length) throw new Error('--models a/x,b/y is required unless --dry-run');
  return { phase: dryRun ? null : (values.phase ?? null), models, dryRun, n: dryRun ? 1 : Number(values.n ?? 5) };
}

async function phase0(models) {
  mkdirSync(RESULTS_DIR, { recursive: true });
  const reportFile = join(RESULTS_DIR, 'probe-report.md');
  for (const model of models) {
    console.log(`probing ${model}…`);
    const { config, report } = await probeModel(model);
    saveConfig(config, CONFIGS_DIR);
    const row = `| ${model} | ${['echo', 'system', 'longOutput', 'tools', 'fence', 'toggle'].map((k) => report.probes[k]).join(' | ')} | ${report.excluded ? 'EXCLUDED' : 'ok'} | ${report.notes.join('; ')} |`;
    appendFileSync(reportFile, row + '\n');
    console.log(row);
  }
  console.log(`configs written to ${CONFIGS_DIR} — review each JSON before phase 1.`);
}

async function phase1(models, n) {
  const records = await runPhase1(
    { models, tasksDir: TASKS_DIR, configsDir: CONFIGS_DIR, resultsDir: RESULTS_DIR, nRuns: n },
    { log: console.log },
  );
  writeReports(records, RESULTS_DIR);
  console.log(`wrote ${join(RESULTS_DIR, 'summary.csv')} and report.md (${records.length} runs)`);
}

function phaseReport() {
  const records = JSON.parse(readFileSync(join(RESULTS_DIR, 'phase1-records.json'), 'utf8'));
  writeReports(records, RESULTS_DIR);
  console.log(`rebuilt reports from ${records.length} records`);
}

async function main() {
  const cli = parseCli(process.argv.slice(2));
  if (cli.dryRun) {
    await phase0(cli.models);
    await phase1(cli.models, cli.n);
    phaseReport();
    console.log('dry run complete — inspect results/report.md before the full spend.');
    return;
  }
  if (cli.phase === '0') return phase0(cli.models);
  if (cli.phase === '1') return phase1(cli.models, cli.n);
  if (cli.phase === 'report') return phaseReport();
  throw new Error(`unknown --phase ${cli.phase}; use 0 | 1 | report or --dry-run`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
}
