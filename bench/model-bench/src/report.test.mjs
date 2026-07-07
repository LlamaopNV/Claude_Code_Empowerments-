import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildSummary, toCsv, buildReportMd, writeReports } from './report.mjs';

const rec = (over) => ({
  model: 'm/a', task: 't1', language: 'python', type: 'implement', run: 0,
  params: { temperature: 0 },
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
  assert.match(lines[0], /^model,task,language,type,run,temperature,failure_class,pass_rate/);
  assert.match(lines[1], /^m\/a,t1,python,implement,0,0,,1,4,4,last_fence,stop,10,100,1000$/);
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

test('buildSummary breaks out per language and per type (unweighted over task means)', () => {
  const records = [
    rec({ task: 't1', language: 'python', type: 'implement', passRate: 1 }),
    rec({ task: 't2', language: 'python', type: 'bug fix', passRate: 0.5, failureClass: 'TEST_FAIL', passed: 2 }),
    rec({ task: 't3', language: 'go', type: 'implement', passRate: 0, failureClass: 'TEST_FAIL', passed: 0 }),
  ];
  const s = buildSummary(records);
  const py = s.perLanguage.find((l) => l.language === 'python');
  assert.ok(Math.abs(py.meanScore - 0.75) < 1e-9);
  assert.equal(py.tasks, 2);
  const go = s.perLanguage.find((l) => l.language === 'go');
  assert.equal(go.meanScore, 0);
  const impl = s.perType.find((t) => t.type === 'implement');
  assert.ok(Math.abs(impl.meanScore - 0.5) < 1e-9);
  assert.equal(impl.tasks, 2);
  const bug = s.perType.find((t) => t.type === 'bug fix');
  assert.ok(Math.abs(bug.meanScore - 0.5) < 1e-9);
});

test('records without language/type fall back to unknown and never crash', () => {
  const legacy = rec({});
  delete legacy.language;
  delete legacy.type;
  const s = buildSummary([legacy]);
  assert.equal(s.perLanguage[0].language, 'unknown');
  assert.equal(s.perType[0].type, 'unknown');
  assert.match(toCsv([legacy]).split('\n')[1], /^m\/a,t1,unknown,unknown,0,/);
});

test('toCsv includes language/type columns and RFC-4180-escapes cells', () => {
  const csv = toCsv([rec({ model: 'weird "m",inc', task: 't,1' })]);
  const lines = csv.trim().split('\n');
  assert.equal(lines[0], 'model,task,language,type,run,temperature,failure_class,pass_rate,passed,total,extraction,finish_reason,prompt_tokens,completion_tokens,latency_ms');
  assert.match(lines[1], /^"weird ""m"",inc","t,1",python,implement,0,/);
});

test('buildReportMd renders per-language and per-type tables', () => {
  const md = buildReportMd(buildSummary([
    rec({ task: 't1', language: 'python', type: 'implement' }),
    rec({ task: 't2', language: 'go', type: 'bug fix', passRate: 0.5, failureClass: 'TEST_FAIL', passed: 2 }),
  ]));
  assert.match(md, /## Per language/);
  assert.match(md, /\| m\/a \| python \|/);
  assert.match(md, /## Per type/);
  assert.match(md, /\| m\/a \| bug fix \|/);
});
