/**
 * Validate every committed demo data file (the illustrative sample dataset the
 * Pages site ships) against the FROZEN @anvil/core schemas. Fails non-zero if
 * any file is missing, malformed, or schema-invalid — so a bad demo file can
 * never reach the published dashboard.
 *
 * Validates:
 *   - public/data/index.json                  → RunIndexSchema
 *   - every entry.resultPath                   → ScorecardSchema (and runId/path agree)
 *   - public/data/traces/agent-*.json          → RunTraceSchema
 *
 * Run: `npm run validate:data -w @anvil/ui`
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseRunIndex, parseScorecard, parseRunTrace } from '@anvil/core';

const here = dirname(fileURLToPath(import.meta.url));
const dataDir = join(here, '..', 'public', 'data');

let errors = 0;
const ok = (msg) => console.log(`  ok   ${msg}`);
const bad = (msg) => {
  console.error(`  FAIL ${msg}`);
  errors += 1;
};

function readJson(rel) {
  return JSON.parse(readFileSync(join(dataDir, rel), 'utf8'));
}

console.log(`Validating demo data under ${dataDir}`);

// 1. index.json
let index;
try {
  index = parseRunIndex(readJson('index.json'));
  ok(`index.json (${index.runs.length} runs)`);
} catch (err) {
  bad(`index.json — ${err.message}`);
  process.exit(1);
}

// 2. each scorecard referenced by the index
const kinds = new Set();
for (const entry of index.runs) {
  const rel = entry.resultPath;
  if (!existsSync(join(dataDir, rel))) {
    bad(`${entry.runId}: resultPath "${rel}" does not exist`);
    continue;
  }
  try {
    const card = parseScorecard(readJson(rel));
    if (card.runId !== entry.runId) {
      bad(`${rel}: runId "${card.runId}" != index entry runId "${entry.runId}"`);
    } else if (card.artifact.kind !== entry.artifactKind) {
      bad(`${rel}: artifact.kind "${card.artifact.kind}" != index "${entry.artifactKind}"`);
    } else {
      kinds.add(card.artifact.kind);
      ok(`${rel} (${card.artifact.kind}: ${card.artifact.name})`);
    }
  } catch (err) {
    bad(`${rel} — ${err.message}`);
  }
}

// 3. traces
const tracesDir = join(dataDir, 'traces');
if (existsSync(tracesDir)) {
  for (const file of readdirSync(tracesDir).filter((f) => f.endsWith('.json'))) {
    try {
      parseRunTrace(readJson(join('traces', file)));
      ok(`traces/${file}`);
    } catch (err) {
      bad(`traces/${file} — ${err.message}`);
    }
  }
}

// 4. coverage: the dataset must demonstrate at least one skill (subagent/plugin ideal)
for (const required of ['skill']) {
  if (!kinds.has(required)) bad(`coverage: no "${required}" example in the demo dataset`);
}
for (const ideal of ['subagent', 'plugin']) {
  if (!kinds.has(ideal)) console.log(`  note demo dataset has no "${ideal}" example (ideal, not required)`);
}

if (errors > 0) {
  console.error(`\n${errors} validation error(s).`);
  process.exit(1);
}
console.log(`\nAll demo data valid. Kinds covered: ${[...kinds].sort().join(', ')}.`);
