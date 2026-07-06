import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseCli, upsertProbeRow, phaseReport } from './run.mjs';

test('parseCli parses phases, model lists, n and dry-run', () => {
  assert.deepEqual(parseCli(['--phase', '0', '--models', 'a/x,b/y']), { phase: '0', models: ['a/x', 'b/y'], dryRun: false, n: 5 });
  assert.deepEqual(parseCli(['--phase', '1', '--models', 'a/x', '--n', '3']), { phase: '1', models: ['a/x'], dryRun: false, n: 3 });
  assert.deepEqual(parseCli(['--dry-run']), { phase: null, models: ['meta/llama-3.3-70b-instruct'], dryRun: true, n: 1 });
  assert.throws(() => parseCli(['--phase', '1']), /--models/);
  assert.deepEqual(parseCli(['--phase', 'report']), { phase: 'report', models: [], dryRun: false, n: 5 });
  assert.throws(() => parseCli(['--phase', '1', '--models', 'a/x', '--n', 'abc']), /--n/);
  assert.throws(() => parseCli(['--phase', '1', '--models', 'a/x', '--n', '0']), /--n/);
});

test('upsertProbeRow writes a header + separator on a fresh file', () => {
  const dir = mkdtempSync(join(tmpdir(), 'probe-report-'));
  const reportFile = join(dir, 'probe-report.md');
  upsertProbeRow(reportFile, 'a/x', '| a/x | pass | pass | pass | pass | pass | skip | ok |  |');
  const lines = readFileSync(reportFile, 'utf8').trim().split('\n');
  assert.equal(lines[0], '| Model | echo | system | longOutput | tools | fence | toggle | status | notes |');
  assert.equal(lines[1], '|---|---|---|---|---|---|---|---|---|');
  assert.equal(lines.length, 3);
  assert.match(lines[2], /^\| a\/x \|/);
});

test('upsertProbeRow replaces an existing row for the same model instead of duplicating it', () => {
  const dir = mkdtempSync(join(tmpdir(), 'probe-report-'));
  const reportFile = join(dir, 'probe-report.md');
  upsertProbeRow(reportFile, 'a/x', '| a/x | pass | pass | pass | pass | pass | skip | ok | first probe |');
  upsertProbeRow(reportFile, 'b/y', '| b/y | pass | pass | pass | pass | pass | skip | ok |  |');
  upsertProbeRow(reportFile, 'a/x', '| a/x | pass | pass | fail | pass | pass | skip | EXCLUDED | rerun |');
  const lines = readFileSync(reportFile, 'utf8').trim().split('\n');
  const aRows = lines.filter((l) => l.startsWith('| a/x |'));
  assert.equal(aRows.length, 1);
  assert.match(aRows[0], /rerun/);
  assert.ok(lines.some((l) => l.startsWith('| b/y |')));
  assert.equal(lines[0], '| Model | echo | system | longOutput | tools | fence | toggle | status | notes |');
});

test('phaseReport throws a friendly error when phase1-records.json is missing', () => {
  const resultsDir = mkdtempSync(join(tmpdir(), 'no-records-'));
  assert.throws(() => phaseReport(resultsDir), /No phase1-records\.json under results\/ — run --phase 1/);
});

test('phaseReport rebuilds summary.csv and report.md from an existing phase1-records.json', () => {
  const resultsDir = mkdtempSync(join(tmpdir(), 'has-records-'));
  const records = [{ model: 'a/x', task: 't1', run: 0, params: { temperature: 0 }, failureClass: null, passRate: 1, passed: 1, total: 1, extraction: 'last_fence', finishReason: 'stop', usage: { completion_tokens: 10 }, latencyMs: 5 }];
  writeFileSync(join(resultsDir, 'phase1-records.json'), JSON.stringify(records));
  phaseReport(resultsDir);
  assert.match(readFileSync(join(resultsDir, 'summary.csv'), 'utf8'), /a\/x/);
  assert.match(readFileSync(join(resultsDir, 'report.md'), 'utf8'), /Model Bench/);
});
