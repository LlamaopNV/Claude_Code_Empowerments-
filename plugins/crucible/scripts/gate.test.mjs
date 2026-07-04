// Tests for the crucible gate ledger. Run with: node --test plugins/crucible/scripts/
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  CORE_GATES,
  checkRun,
  initRun,
  readState,
  recordGate,
  sessionContext,
  setPhase,
  stopDecision,
} from './gate.mjs';

let root;
beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'crucible-gate-'));
});

function evidence(name = 'proof.txt', body = 'exit 0\nall green') {
  const p = path.join(root, name);
  fs.writeFileSync(p, body);
  return p;
}

function passAllCoreGates(slug) {
  for (const gate of CORE_GATES) {
    recordGate(root, slug, gate, 0, evidence(`${gate}.txt`));
  }
}

test('initRun scaffolds a run with pending core gates and an ask checkpoint', () => {
  initRun(root, 'demo');
  const state = readState(root, 'demo');
  assert.equal(state.phase, 'intake');
  assert.equal(state.checkpoint.mode, 'ask');
  assert.deepEqual(Object.keys(state.gates).sort(), [...CORE_GATES].sort());
  for (const gate of CORE_GATES) assert.equal(state.gates[gate].status, 'pending');
  assert.ok(fs.existsSync(path.join(root, 'crucible-runs', 'demo', '60-gates')));
});

test('initRun honors auto mode and refuses to clobber an existing run', () => {
  initRun(root, 'demo', { auto: true });
  assert.equal(readState(root, 'demo').checkpoint.mode, 'auto');
  assert.throws(() => initRun(root, 'demo'), /exists/);
});

test('setPhase moves through valid phases and rejects unknown ones', () => {
  initRun(root, 'demo');
  setPhase(root, 'demo', 'diverge');
  assert.equal(readState(root, 'demo').phase, 'diverge');
  assert.throws(() => setPhase(root, 'demo', 'shipping'), /phase/i);
});

test('setPhase refuses done while gates are unmet, allows it once assay passes', () => {
  initRun(root, 'demo');
  setPhase(root, 'demo', 'deliver');
  assert.throws(() => setPhase(root, 'demo', 'done'), /gate/i);
  passAllCoreGates('demo');
  setPhase(root, 'demo', 'done');
  assert.equal(readState(root, 'demo').phase, 'done');
});

test('recordGate stores pass on exit 0 with evidence on disk', () => {
  initRun(root, 'demo');
  recordGate(root, 'demo', 'tests', 0, evidence());
  const g = readState(root, 'demo').gates.tests;
  assert.equal(g.status, 'pass');
  assert.equal(g.exit, 0);
  assert.ok(g.evidence.length > 0);
});

test('recordGate stores fail on nonzero exit and rejects missing or empty evidence', () => {
  initRun(root, 'demo');
  recordGate(root, 'demo', 'lint', 2, evidence('lint.txt', '3 errors'));
  assert.equal(readState(root, 'demo').gates.lint.status, 'fail');
  assert.throws(
    () => recordGate(root, 'demo', 'tests', 0, path.join(root, 'nope.txt')),
    /evidence/i,
  );
  assert.throws(() => recordGate(root, 'demo', 'tests', 0, evidence('empty.txt', '')), /evidence/i);
});

test('checkRun lists unmet gates, passes when core gates pass, fails on any failed extra gate', () => {
  initRun(root, 'demo');
  assert.equal(checkRun(root, 'demo').ok, false);
  assert.equal(checkRun(root, 'demo').unmet.length, CORE_GATES.length);
  passAllCoreGates('demo');
  assert.equal(checkRun(root, 'demo').ok, true);
  recordGate(root, 'demo', 'e2e', 1, evidence('e2e.txt', 'boom'));
  const res = checkRun(root, 'demo');
  assert.equal(res.ok, false);
  assert.ok(res.unmet.some((u) => u.gate === 'e2e'));
});

test('stopDecision is null with no runs, mid-build, when paused, or when re-entered', () => {
  assert.equal(stopDecision(root, {}), null);
  initRun(root, 'demo');
  setPhase(root, 'demo', 'build');
  assert.equal(stopDecision(root, {}), null);
  setPhase(root, 'demo', 'assay');
  assert.equal(stopDecision(root, { stop_hook_active: true }), null);
  setPhase(root, 'demo', 'paused');
  assert.equal(stopDecision(root, {}), null);
});

test('stopDecision blocks a stop during assay/deliver with unmet gates, names them, and clears after pass', () => {
  initRun(root, 'demo');
  setPhase(root, 'demo', 'assay');
  const d = stopDecision(root, {});
  assert.equal(d.decision, 'block');
  assert.match(d.reason, /demo/);
  for (const gate of CORE_GATES) assert.match(d.reason, new RegExp(gate));
  passAllCoreGates('demo');
  assert.equal(stopDecision(root, {}), null);
});

test('sessionContext names unfinished runs and stays quiet otherwise', () => {
  assert.equal(sessionContext(root), null);
  initRun(root, 'demo');
  setPhase(root, 'demo', 'spec');
  const ctx = sessionContext(root);
  assert.match(ctx, /demo/);
  assert.match(ctx, /spec/);
  passAllCoreGates('demo');
  setPhase(root, 'demo', 'done');
  assert.equal(sessionContext(root), null);
});
