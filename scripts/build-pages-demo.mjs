// Merge the real bake-to-completion runs into the committed Pages demo dataset
// (packages/ui/public/data) so the published dashboard shows the real before/after
// alongside the illustrative synthetic runs. Idempotent: re-running re-syncs.
import { readFileSync, writeFileSync, copyFileSync, readdirSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const RESULTS = 'results';
const DATA = join('packages', 'ui', 'public', 'data');
const REAL_RUNS = ['bake-to-completion-2026-06-22', 'bake-to-completion-2026-06-21']; // newest first

const demoIndex = JSON.parse(readFileSync(join(DATA, 'index.json'), 'utf8'));

// Drop any prior copies of the real runs so re-runs don't duplicate, then prepend fresh.
const synthetic = demoIndex.runs.filter((r) => !REAL_RUNS.includes(r.runId));
const realEntries = [];

mkdirSync(join(DATA, 'traces'), { recursive: true });

for (const runId of REAL_RUNS) {
  // Copy the scorecard to public/data/<runId>.json and point resultPath at it.
  copyFileSync(join(RESULTS, `${runId}.json`), join(DATA, `${runId}.json`));
  const card = JSON.parse(readFileSync(join(RESULTS, `${runId}.json`), 'utf8'));
  const headline = {};
  const f1 = card.metrics['activation.f1']?.value;
  const qd = card.metrics['quality.delta']?.value;
  const ct = card.metrics['cost.tokens']?.value;
  if (f1 !== undefined) headline.activationF1 = f1;
  if (qd !== undefined) headline.qualityDelta = qd;
  if (ct !== undefined) headline.costTokens = ct;
  realEntries.push({
    runId: card.runId,
    suiteName: card.suiteName,
    artifactKind: card.artifact.kind,
    artifactName: card.artifact.name,
    createdAt: card.createdAt,
    headline,
    resultPath: `${runId}.json`,
  });
}

// Copy every real trace into public/data/traces/.
let traceCount = 0;
for (const file of readdirSync(join(RESULTS, 'traces')).filter((f) => f.endsWith('.json'))) {
  copyFileSync(join(RESULTS, 'traces', file), join(DATA, 'traces', file));
  traceCount++;
}

demoIndex.runs = [...realEntries, ...synthetic];
writeFileSync(join(DATA, 'index.json'), `${JSON.stringify(demoIndex, null, 2)}\n`);

console.log(`merged ${realEntries.length} real runs (+${traceCount} traces) into ${DATA}`);
console.log(`index now has ${demoIndex.runs.length} runs: ${demoIndex.runs.map((r) => r.runId).join(', ')}`);
