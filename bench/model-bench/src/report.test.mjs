import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildSummary, toCsv, buildReportMd, writeReports } from './report.mjs';

const rec = (over) => ({
  model: 'm/a', task: 't1', run: 0, params: { temperature: 0 },
  finishReason: 'stop', usage: { prompt_tokens: 10, completion_tokens: 100 },
  latencyMs: 1000, extraction: 'last_fence', failureClass: null,
  passed: 4, total: 4, passRate: 1, ...over,
});

test('buildSummary computes per-task mean/std/pass@1 excluding null passRates', () => {
  const records = [
    rec({ run: 0, passRate: 1 }),
    rec({ run: 1, passRate: 0.5, failureClass: 'TEST_FAIL', passed: 2 }),
    rec({ run: 2, passRate: null, failureClass: 'TRUNCATED', finishReason: 'length' }),
  ];
  const s = buildSummary(records);
  const t = s.perModelTask[0];
  assert.equal(t.runs, 2);
  assert.equal(t.truncated, 1);
  assert.ok(Math.abs(t.mean - 0.75) < 1e-9);
  assert.ok(Math.abs(t.std - 0.25) < 1e-9); // population std of [1, 0.5]
  assert.ok(Math.abs(t.passAt1 - 0.5) < 1e-9);
  const m = s.perModel[0];
  assert.ok(Math.abs(m.truncationRate - 1 / 3) < 1e-9);
  assert.equal(m.failureCounts.TRUNCATED, 1);
});

test('perModel meanScore is the unweighted mean across tasks', () => {
  const records = [
    rec({ task: 't1', passRate: 1 }),
    rec({ task: 't2', passRate: 0, failureClass: 'TEST_FAIL', passed: 0 }),
  ];
  const m = buildSummary(records).perModel[0];
  assert.ok(Math.abs(m.meanScore - 0.5) < 1e-9);
});

test('toCsv emits header plus one row per record', () => {
  const csv = toCsv([rec({}), rec({ run: 1 })]);
  const lines = csv.trim().split('\n');
  assert.equal(lines.length, 3);
  assert.match(lines[0], /^model,task,run,temperature,failure_class,pass_rate/);
  assert.match(lines[1], /^m\/a,t1,0,0,,1,4,4,last_fence,stop,10,100,1000$/);
});

test('buildReportMd flags truncation above 10%', () => {
  const records = [rec({}), rec({ run: 1, passRate: null, failureClass: 'TRUNCATED' })];
  const md = buildReportMd(buildSummary(records));
  assert.match(md, /m\/a/);
  assert.match(md, /Leaderboard/);
  assert.match(md, /double max_tokens/);
});

test('writeReports writes both files', () => {
  const dir = mkdtempSync(join(tmpdir(), 'rep-'));
  writeReports([rec({})], dir);
  assert.ok(existsSync(join(dir, 'summary.csv')));
  assert.match(readFileSync(join(dir, 'report.md'), 'utf8'), /Leaderboard/);
});
