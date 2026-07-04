#!/usr/bin/env node
// Forgemaster gate ledger: the single writer of run.json.
// Library + CLI. Root resolves from FORGEMASTER_ROOT or cwd; state lives in
// forgemaster-runs/<slug>/run.json, gate evidence under
// forgemaster-runs/<slug>/gates/. Hook modes read Claude Code hook JSON on
// stdin and speak the hook protocol on stdout/stderr.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const STAGES = ['intake', 'diverge', 'spec', 'plan', 'build', 'gates', 'deliver'];
export const STATUSES = ['active', 'paused', 'done', 'abandoned'];
export const GATES = ['tests', 'lint', 'types', 'spec_review', 'code_review', 'self_critique'];
export const WEIGHTS = ['light', 'standard', 'heavy'];
// Stops are only contested where "done" could be claimed without proof.
const GUARDED_STAGES = ['gates', 'deliver'];

export function runDir(root, slug) {
  return path.join(root, 'forgemaster-runs', slug);
}

function manifestPath(root, slug) {
  return path.join(runDir(root, slug), 'run.json');
}

export function readRun(root, slug) {
  return JSON.parse(fs.readFileSync(manifestPath(root, slug), 'utf8'));
}

function writeRun(root, slug, run) {
  run.updated = new Date().toISOString();
  fs.writeFileSync(manifestPath(root, slug), JSON.stringify(run, null, 2) + '\n');
  return run;
}

export function initRun(root, slug, opts = {}) {
  const dir = runDir(root, slug);
  if (fs.existsSync(manifestPath(root, slug))) {
    throw new Error(`run "${slug}" already exists at ${dir}`);
  }
  const weight = opts.weight || 'standard';
  if (!WEIGHTS.includes(weight)) {
    throw new Error(`unknown weight "${weight}" (valid: ${WEIGHTS.join(', ')})`);
  }
  fs.mkdirSync(path.join(dir, 'gates'), { recursive: true });
  const gates = {};
  for (const gate of GATES) gates[gate] = { status: 'pending' };
  const run = {
    idea: opts.idea || '',
    slug,
    weight,
    stage: 'intake',
    status: 'active',
    checkpoint: opts.auto ? 'auto' : 'pause',
    artifacts: {},
    skips: [],
    gates,
    created: new Date().toISOString(),
  };
  return writeRun(root, slug, run);
}

export function setStage(root, slug, stage) {
  if (!STAGES.includes(stage)) {
    throw new Error(`unknown stage "${stage}" (valid: ${STAGES.join(', ')})`);
  }
  const run = readRun(root, slug);
  run.stage = stage;
  return writeRun(root, slug, run);
}

export function setStatus(root, slug, status) {
  if (!STATUSES.includes(status)) {
    throw new Error(`unknown status "${status}" (valid: ${STATUSES.join(', ')})`);
  }
  const run = readRun(root, slug);
  if (status === 'done') {
    const { ok, unmet } = checkRun(root, slug);
    if (!ok) {
      const names = unmet.map((u) => u.gate).join(', ');
      throw new Error(`cannot mark done: gate(s) unmet: ${names}`);
    }
  }
  run.status = status;
  return writeRun(root, slug, run);
}

export function recordSkip(root, slug, stage, reason) {
  if (!STAGES.includes(stage)) {
    throw new Error(`unknown stage "${stage}" (valid: ${STAGES.join(', ')})`);
  }
  if (!reason) throw new Error('a skip without a reason is a silent scale-down; give the reason');
  const run = readRun(root, slug);
  run.skips.push({ stage, reason });
  return writeRun(root, slug, run);
}

export function recordArtifact(root, slug, stage, filename) {
  if (!STAGES.includes(stage)) {
    throw new Error(`unknown stage "${stage}" (valid: ${STAGES.join(', ')})`);
  }
  const run = readRun(root, slug);
  run.artifacts[stage] = filename;
  return writeRun(root, slug, run);
}

export function recordGate(root, slug, gate, exitOrNa, evidencePath) {
  const abs = path.isAbsolute(evidencePath) ? evidencePath : path.join(root, evidencePath);
  if (!fs.existsSync(abs) || fs.statSync(abs).size === 0) {
    throw new Error(
      `evidence file missing or empty: ${abs} (a gate without evidence is a claim, not a result; na needs its reason on file too)`,
    );
  }
  const run = readRun(root, slug);
  const entry = { evidence: path.relative(root, abs) || abs, at: new Date().toISOString() };
  if (String(exitOrNa) === 'na') {
    entry.status = 'na';
  } else {
    entry.status = Number(exitOrNa) === 0 ? 'pass' : 'fail';
    entry.exit = Number(exitOrNa);
  }
  run.gates[gate] = entry;
  return writeRun(root, slug, run);
}

export function checkRun(root, slug) {
  const run = readRun(root, slug);
  const unmet = [];
  for (const gate of GATES) {
    const g = run.gates[gate];
    if (!g || (g.status !== 'pass' && g.status !== 'na')) {
      unmet.push({ gate, reason: g ? g.status : 'missing' });
    }
  }
  for (const [gate, g] of Object.entries(run.gates)) {
    if (!GATES.includes(gate) && g.status === 'fail') {
      unmet.push({ gate, reason: 'fail' });
    }
  }
  return { ok: unmet.length === 0, unmet };
}

function listRuns(root) {
  const runsRoot = path.join(root, 'forgemaster-runs');
  if (!fs.existsSync(runsRoot)) return [];
  return fs
    .readdirSync(runsRoot)
    .filter((slug) => fs.existsSync(manifestPath(root, slug)))
    .map((slug) => readRun(root, slug));
}

export function stopDecision(root, hookInput = {}) {
  if (hookInput.stop_hook_active) return null;
  for (const run of listRuns(root)) {
    if (run.status !== 'active' || !GUARDED_STAGES.includes(run.stage)) continue;
    const { ok, unmet } = checkRun(root, run.slug);
    if (ok) continue;
    const lines = unmet.map((u) => `  - ${u.gate}: ${u.reason}`).join('\n');
    return {
      decision: 'block',
      reason:
        `Forgemaster run "${run.slug}" is in the ${run.stage} stage with unmet gates:\n${lines}\n` +
        `Record evidence with: node gate.mjs record ${run.slug} <gate> <exit-code|na> <evidence-file>\n` +
        `If the user asked to stop here, pause instead: node gate.mjs status-set ${run.slug} paused`,
    };
  }
  return null;
}

export function sessionContext(root) {
  const open = listRuns(root).filter((r) => r.status === 'active' || r.status === 'paused');
  if (open.length === 0) return null;
  const lines = open.map((r) => `- ${r.slug} (${r.status}, stage: ${r.stage})`).join('\n');
  return `Unfinished forgemaster run(s) in this project:\n${lines}\nResume with /forgemaster resume <slug>, or inspect with /forgemaster status.`;
}

export function guardWrite(hookInput = {}) {
  const filePath = hookInput.tool_input && hookInput.tool_input.file_path;
  if (!filePath) return null;
  const normalized = String(filePath).replace(/\\/g, '/');
  if (!/(^|\/)forgemaster-runs\/[^/]+\/run\.json$/.test(normalized)) return null;
  return (
    `run.json is the gate ledger and is written only by gate.mjs. ` +
    `Use: node "<plugin>/scripts/gate.mjs" init|stage|status-set|skip|artifact|record|check instead of editing ${normalized} directly.`
  );
}

function readStdinJson() {
  try {
    return JSON.parse(fs.readFileSync(0, 'utf8'));
  } catch {
    return {};
  }
}

function main(argv) {
  const root = process.env.FORGEMASTER_ROOT || process.cwd();
  const [cmd, ...rest] = argv;
  switch (cmd) {
    case 'init': {
      const auto = rest.includes('--auto');
      const positional = rest.filter((a) => !a.startsWith('--'));
      const weightFlag = rest.find((a) => a.startsWith('--weight='));
      const slug = positional[0];
      const idea = positional.slice(1).join(' ');
      initRun(root, slug, {
        auto,
        idea,
        weight: weightFlag ? weightFlag.split('=')[1] : undefined,
      });
      console.log(`initialized run "${slug}" (checkpoint: ${auto ? 'auto' : 'pause'})`);
      return 0;
    }
    case 'stage': {
      const run = setStage(root, rest[0], rest[1]);
      console.log(`run "${rest[0]}" -> stage ${run.stage}`);
      return 0;
    }
    case 'status-set': {
      const run = setStatus(root, rest[0], rest[1]);
      console.log(`run "${rest[0]}" -> status ${run.status}`);
      return 0;
    }
    case 'skip': {
      recordSkip(root, rest[0], rest[1], rest.slice(2).join(' '));
      console.log(`run "${rest[0]}": recorded skip of ${rest[1]}`);
      return 0;
    }
    case 'artifact': {
      recordArtifact(root, rest[0], rest[1], rest[2]);
      console.log(`run "${rest[0]}": artifact ${rest[1]} -> ${rest[2]}`);
      return 0;
    }
    case 'record': {
      const [slug, gate, exitOrNa, evidencePath] = rest;
      const run = recordGate(root, slug, gate, exitOrNa, evidencePath);
      console.log(
        `gate ${gate}: ${run.gates[gate].status} (evidence: ${run.gates[gate].evidence})`,
      );
      return 0;
    }
    case 'check': {
      const { ok, unmet } = checkRun(root, rest[0]);
      if (ok) {
        console.log('GATES GREEN: all gates pass/na with evidence on disk');
        return 0;
      }
      console.log('GATES UNMET:');
      for (const u of unmet) console.log(`  - ${u.gate}: ${u.reason}`);
      return 1;
    }
    case 'status': {
      const runs = rest[0] ? [readRun(root, rest[0])] : listRuns(root);
      for (const r of runs) {
        const gates = Object.entries(r.gates)
          .map(([name, g]) => `${name}=${g.status}`)
          .join(' ');
        console.log(
          `${r.slug}: ${r.status} stage=${r.stage} weight=${r.weight} checkpoint=${r.checkpoint} ${gates}`,
        );
      }
      if (runs.length === 0) console.log('no forgemaster runs in this project');
      return 0;
    }
    case 'hook-guard': {
      const reason = guardWrite(readStdinJson());
      if (reason) {
        console.error(`[forgemaster] Blocked: ${reason}`);
        return 2;
      }
      return 0;
    }
    case 'hook-stop': {
      const decision = stopDecision(root, readStdinJson());
      if (decision) console.log(JSON.stringify(decision));
      return 0;
    }
    case 'hook-session': {
      const ctx = sessionContext(root);
      if (ctx) console.log(ctx);
      return 0;
    }
    default:
      console.log(
        'usage: gate.mjs init <slug> [<idea...>] [--auto] [--weight=light|standard|heavy] | stage <slug> <stage> | status-set <slug> <status> | skip <slug> <stage> <reason...> | artifact <slug> <stage> <file> | record <slug> <gate> <exit|na> <evidence> | check <slug> | status [slug] | hook-guard | hook-stop | hook-session',
      );
      return cmd ? 1 : 0;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    process.exitCode = main(process.argv.slice(2));
  } catch (err) {
    console.error(String(err && err.message ? err.message : err));
    process.exitCode = 1;
  }
}
