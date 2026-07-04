#!/usr/bin/env node
// Crucible gate ledger: the evidence-or-it-didn't-happen backbone of a run.
// Library + CLI. Root resolves from CRUCIBLE_ROOT or cwd; state lives in
// crucible-runs/<slug>/state.json. Hook modes read Claude Code hook JSON on
// stdin and speak the hook protocol on stdout.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const PHASES = [
  'intake',
  'diverge',
  'spec',
  'tests',
  'build',
  'assay',
  'deliver',
  'done',
  'paused',
];
export const CORE_GATES = ['tests', 'lint', 'typecheck', 'review', 'critique'];
// Stops are only contested where "done" could be claimed without proof.
const GUARDED_PHASES = ['assay', 'deliver'];

export function runDir(root, slug) {
  return path.join(root, 'crucible-runs', slug);
}

function statePath(root, slug) {
  return path.join(runDir(root, slug), 'state.json');
}

export function readState(root, slug) {
  return JSON.parse(fs.readFileSync(statePath(root, slug), 'utf8'));
}

function writeState(root, slug, state) {
  state.updated = new Date().toISOString();
  fs.writeFileSync(statePath(root, slug), JSON.stringify(state, null, 2) + '\n');
  return state;
}

export function initRun(root, slug, opts = {}) {
  const dir = runDir(root, slug);
  if (fs.existsSync(statePath(root, slug))) {
    throw new Error(`run "${slug}" already exists at ${dir}`);
  }
  fs.mkdirSync(path.join(dir, '60-gates'), { recursive: true });
  const gates = {};
  for (const gate of CORE_GATES) gates[gate] = { status: 'pending' };
  const state = {
    run: slug,
    phase: 'intake',
    checkpoint: { mode: opts.auto ? 'auto' : 'ask', decision: null },
    gates,
    created: new Date().toISOString(),
  };
  return writeState(root, slug, state);
}

export function setPhase(root, slug, phase) {
  if (!PHASES.includes(phase)) {
    throw new Error(`unknown phase "${phase}" (valid: ${PHASES.join(', ')})`);
  }
  const state = readState(root, slug);
  if (phase === 'done') {
    const { ok, unmet } = checkRun(root, slug);
    if (!ok) {
      const names = unmet.map((u) => u.gate).join(', ');
      throw new Error(`cannot mark done: gate(s) unmet: ${names}`);
    }
  }
  state.phase = phase;
  return writeState(root, slug, state);
}

export function recordGate(root, slug, gate, exitCode, evidencePath) {
  const abs = path.isAbsolute(evidencePath) ? evidencePath : path.join(root, evidencePath);
  if (!fs.existsSync(abs) || fs.statSync(abs).size === 0) {
    throw new Error(
      `evidence file missing or empty: ${abs} (a gate without evidence is a claim, not a result)`,
    );
  }
  const state = readState(root, slug);
  state.gates[gate] = {
    status: Number(exitCode) === 0 ? 'pass' : 'fail',
    exit: Number(exitCode),
    evidence: path.relative(root, abs) || abs,
    at: new Date().toISOString(),
  };
  return writeState(root, slug, state);
}

export function checkRun(root, slug) {
  const state = readState(root, slug);
  const unmet = [];
  for (const gate of CORE_GATES) {
    const g = state.gates[gate];
    if (!g || g.status !== 'pass') {
      unmet.push({ gate, reason: g ? g.status : 'missing' });
    }
  }
  for (const [gate, g] of Object.entries(state.gates)) {
    if (!CORE_GATES.includes(gate) && g.status === 'fail') {
      unmet.push({ gate, reason: 'fail' });
    }
  }
  return { ok: unmet.length === 0, unmet };
}

function listRuns(root) {
  const runsRoot = path.join(root, 'crucible-runs');
  if (!fs.existsSync(runsRoot)) return [];
  return fs
    .readdirSync(runsRoot)
    .filter((slug) => fs.existsSync(statePath(root, slug)))
    .map((slug) => readState(root, slug));
}

export function stopDecision(root, hookInput = {}) {
  if (hookInput.stop_hook_active) return null;
  for (const state of listRuns(root)) {
    if (!GUARDED_PHASES.includes(state.phase)) continue;
    const { ok, unmet } = checkRun(root, state.run);
    if (ok) continue;
    const lines = unmet.map((u) => `  - ${u.gate}: ${u.reason}`).join('\n');
    return {
      decision: 'block',
      reason:
        `Crucible run "${state.run}" is in the ${state.phase} phase with unmet gates:\n${lines}\n` +
        `Record evidence with: node gate.mjs record ${state.run} <gate> <exit-code> <evidence-file>\n` +
        `If the user asked to stop here, pause instead: node gate.mjs phase ${state.run} paused`,
    };
  }
  return null;
}

export function sessionContext(root) {
  const unfinished = listRuns(root).filter((s) => s.phase !== 'done');
  if (unfinished.length === 0) return null;
  const lines = unfinished.map((s) => `- ${s.run} (phase: ${s.phase})`).join('\n');
  return `Unfinished crucible run(s) in this project:\n${lines}\nResume with /crucible resume <run>, or inspect with /crucible status.`;
}

function readStdinJson() {
  try {
    return JSON.parse(fs.readFileSync(0, 'utf8'));
  } catch {
    return {};
  }
}

function main(argv) {
  const root = process.env.CRUCIBLE_ROOT || process.cwd();
  const [cmd, ...rest] = argv;
  switch (cmd) {
    case 'init': {
      const auto = rest.includes('--auto');
      const slug = rest.filter((a) => a !== '--auto')[0];
      initRun(root, slug, { auto });
      console.log(`initialized run "${slug}" (checkpoint: ${auto ? 'auto' : 'ask'})`);
      return 0;
    }
    case 'phase': {
      const state = setPhase(root, rest[0], rest[1]);
      console.log(`run "${rest[0]}" -> phase ${state.phase}`);
      return 0;
    }
    case 'record': {
      const [slug, gate, exitCode, evidencePath] = rest;
      const state = recordGate(root, slug, gate, exitCode, evidencePath);
      console.log(
        `gate ${gate}: ${state.gates[gate].status} (evidence: ${state.gates[gate].evidence})`,
      );
      return 0;
    }
    case 'check': {
      const { ok, unmet } = checkRun(root, rest[0]);
      if (ok) {
        console.log('ASSAY PASS: all gates green with evidence on disk');
        return 0;
      }
      console.log('ASSAY FAIL:');
      for (const u of unmet) console.log(`  - ${u.gate}: ${u.reason}`);
      return 1;
    }
    case 'status': {
      const runs = rest[0] ? [readState(root, rest[0])] : listRuns(root);
      for (const s of runs) {
        const gates = Object.entries(s.gates)
          .map(([name, g]) => `${name}=${g.status}`)
          .join(' ');
        console.log(`${s.run}: phase=${s.phase} checkpoint=${s.checkpoint.mode} ${gates}`);
      }
      if (runs.length === 0) console.log('no crucible runs in this project');
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
        'usage: gate.mjs init <slug> [--auto] | phase <slug> <phase> | record <slug> <gate> <exit> <evidence> | check <slug> | status [slug] | hook-stop | hook-session',
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
