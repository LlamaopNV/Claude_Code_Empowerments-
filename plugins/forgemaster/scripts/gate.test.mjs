// Tests for the forgemaster gate ledger. Run with: node --test plugins/forgemaster/scripts/gate.test.mjs
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  GATES,
  checkRun,
  guardWrite,
  initRun,
  readRun,
  recordArtifact,
  recordGate,
  recordSkip,
  sessionContext,
  setStage,
  setStatus,
  stopDecision,
} from './gate.mjs';

let root;
beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'forgemaster-gate-'));
});

function evidence(name = 'proof.txt', body = 'exit 0\nall green') {
  const p = path.join(root, name);
  fs.writeFileSync(p, body);
  return p;
}

function passAllGates(slug) {
  for (const gate of GATES) {
    recordGate(root, slug, gate, 0, evidence(`${gate}.txt`));
  }
}

test('initRun scaffolds a manifest: active, intake, pause checkpoint, six pending gates', () => {
  initRun(root, 'demo', { idea: 'a csv chart CLI', weight: 'light' });
  const run = readRun(root, 'demo');
  assert.equal(run.status, 'active');
  assert.equal(run.stage, 'intake');
  assert.equal(run.checkpoint, 'pause');
  assert.equal(run.weight, 'light');
  assert.equal(run.idea, 'a csv chart CLI');
  assert.deepEqual(Object.keys(run.gates).sort(), [...GATES].sort());
  for (const gate of GATES) assert.equal(run.gates[gate].status, 'pending');
  assert.ok(fs.existsSync(path.join(root, 'forgemaster-runs', 'demo', 'gates')));
});

test('initRun honors auto checkpoint, defaults weight standard, refuses to clobber', () => {
  initRun(root, 'demo', { auto: true });
  const run = readRun(root, 'demo');
  assert.equal(run.checkpoint, 'auto');
  assert.equal(run.weight, 'standard');
  assert.throws(() => initRun(root, 'demo'), /exists/);
});

test('setStage walks the pipeline and rejects unknown stages', () => {
  initRun(root, 'demo');
  setStage(root, 'demo', 'diverge');
  assert.equal(readRun(root, 'demo').stage, 'diverge');
  assert.throws(() => setStage(root, 'demo', 'shipping'), /stage/i);
});

test('setStatus refuses done while gates are unmet, allows it when all six pass or na', () => {
  initRun(root, 'demo');
  setStage(root, 'demo', 'deliver');
  assert.throws(() => setStatus(root, 'demo', 'done'), /gate/i);
  for (const gate of GATES.slice(0, -1)) recordGate(root, 'demo', gate, 0, evidence(`${gate}.txt`));
  recordGate(
    root,
    'demo',
    GATES[GATES.length - 1],
    'na',
    evidence('na.txt', 'plain bash deliverable, no typechecker'),
  );
  setStatus(root, 'demo', 'done');
  assert.equal(readRun(root, 'demo').status, 'done');
  assert.throws(() => setStatus(root, 'demo', 'shipped'), /status/i);
});

test('recordGate stores pass/fail/na with evidence, rejects missing or empty evidence', () => {
  initRun(root, 'demo');
  recordGate(root, 'demo', 'tests', 0, evidence());
  const g = readRun(root, 'demo').gates.tests;
  assert.equal(g.status, 'pass');
  assert.equal(g.exit, 0);
  assert.ok(g.evidence.length > 0);
  recordGate(root, 'demo', 'lint', 2, evidence('lint.txt', '3 errors'));
  assert.equal(readRun(root, 'demo').gates.lint.status, 'fail');
  recordGate(root, 'demo', 'types', 'na', evidence('types.txt', 'no typechecker: bash'));
  assert.equal(readRun(root, 'demo').gates.types.status, 'na');
  assert.throws(
    () => recordGate(root, 'demo', 'tests', 0, path.join(root, 'nope.txt')),
    /evidence/i,
  );
  assert.throws(() => recordGate(root, 'demo', 'tests', 0, evidence('empty.txt', '')), /evidence/i);
});

test('checkRun lists unmet gates, accepts na, fails on a failed extra gate (e.g. proofmark)', () => {
  initRun(root, 'demo');
  assert.equal(checkRun(root, 'demo').ok, false);
  assert.equal(checkRun(root, 'demo').unmet.length, GATES.length);
  passAllGates('demo');
  assert.equal(checkRun(root, 'demo').ok, true);
  recordGate(root, 'demo', 'proofmark', 1, evidence('proofmark.txt', 'hold: weak trigger'));
  const res = checkRun(root, 'demo');
  assert.equal(res.ok, false);
  assert.ok(res.unmet.some((u) => u.gate === 'proofmark'));
  recordGate(root, 'demo', 'proofmark', 0, evidence('proofmark2.txt', 'ship'));
  assert.equal(checkRun(root, 'demo').ok, true);
});

test('recordSkip and recordArtifact keep the scale-down ledger and artifact map', () => {
  initRun(root, 'demo');
  recordSkip(root, 'demo', 'diverge', 'light run: inline mini-diverge');
  recordArtifact(root, 'demo', 'intake', '00-intake.md');
  const run = readRun(root, 'demo');
  assert.deepEqual(run.skips, [{ stage: 'diverge', reason: 'light run: inline mini-diverge' }]);
  assert.equal(run.artifacts.intake, '00-intake.md');
});

test('stopDecision is null with no runs, early stages, when paused, or when re-entered', () => {
  assert.equal(stopDecision(root, {}), null);
  initRun(root, 'demo');
  setStage(root, 'demo', 'build');
  assert.equal(stopDecision(root, {}), null);
  setStage(root, 'demo', 'gates');
  assert.equal(stopDecision(root, { stop_hook_active: true }), null);
  setStatus(root, 'demo', 'paused');
  assert.equal(stopDecision(root, {}), null);
});

test('stopDecision blocks an active run in gates/deliver with unmet gates, names them, clears after', () => {
  initRun(root, 'demo');
  setStage(root, 'demo', 'gates');
  const d = stopDecision(root, {});
  assert.equal(d.decision, 'block');
  assert.match(d.reason, /demo/);
  for (const gate of GATES) assert.match(d.reason, new RegExp(gate));
  passAllGates('demo');
  assert.equal(stopDecision(root, {}), null);
});

test('guardWrite blocks Write/Edit to any run.json under forgemaster-runs, allows everything else', () => {
  const block = guardWrite({
    tool_name: 'Edit',
    tool_input: { file_path: 'C:\\repo\\forgemaster-runs\\2026-07-04-demo\\run.json' },
  });
  assert.ok(block && /gate\.mjs/.test(block));
  const blockPosix = guardWrite({
    tool_name: 'Write',
    tool_input: { file_path: '/repo/forgemaster-runs/2026-07-04-demo/run.json' },
  });
  assert.ok(blockPosix);
  assert.equal(
    guardWrite({ tool_name: 'Write', tool_input: { file_path: '/repo/src/index.ts' } }),
    null,
  );
  assert.equal(
    guardWrite({
      tool_name: 'Write',
      tool_input: { file_path: '/repo/forgemaster-runs/demo/00-intake.md' },
    }),
    null,
  );
  assert.equal(guardWrite({}), null);
});

test('sessionContext names active and paused runs, stays quiet when all runs are done', () => {
  assert.equal(sessionContext(root), null);
  initRun(root, 'demo');
  setStage(root, 'demo', 'spec');
  const ctx = sessionContext(root);
  assert.match(ctx, /demo/);
  assert.match(ctx, /spec/);
  passAllGates('demo');
  setStatus(root, 'demo', 'done');
  assert.equal(sessionContext(root), null);
});
