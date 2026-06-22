// One-off: recover the real subagent transcripts referenced by a scorecard and
// archive them as results/traces/<agentId>.json so the live server's
// GET /api/traces/:id (and thus the UI drill-down) can serve them.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { readTranscriptById } from '@anvil/core';

const CONFIG_ROOT = 'C:/Users/Llama/.claude';
const PROJECT_HASH = 'C--Code-Agent-Eval-pipeline';
const runId = process.argv[2] ?? 'bake-to-completion-2026-06-21';

const card = JSON.parse(readFileSync(join('results', `${runId}.json`), 'utf8'));
const tracesDir = join('results', 'traces');
mkdirSync(tracesDir, { recursive: true });

const ids = [];
for (const c of card.cases) {
  if (c.treatmentTraceId) ids.push(c.treatmentTraceId);
  if (c.baselineTraceId) ids.push(c.baselineTraceId);
}

let ok = 0;
const missing = [];
for (const agentId of ids) {
  const trace = readTranscriptById({ configRoot: CONFIG_ROOT, projectHash: PROJECT_HASH, agentId });
  if (!trace) {
    missing.push(agentId);
    continue;
  }
  writeFileSync(join(tracesDir, `${agentId}.json`), `${JSON.stringify(trace, null, 2)}\n`);
  ok++;
}

console.log(`recovered ${ok}/${ids.length} traces into ${tracesDir}`);
if (missing.length) console.log(`MISSING (${missing.length}): ${missing.join(', ')}`);
