import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { defaultConfig, saveConfig } from './config.mjs';
import { loadTasks, runPhase1 } from './phase1.mjs';

function makeFixture() {
  const root = mkdtempSync(join(tmpdir(), 'p1-'));
  const tasksDir = join(root, 'tasks');
  const taskDir = join(tasksDir, '01-demo');
  mkdirSync(taskDir, { recursive: true });
  writeFileSync(join(taskDir, 'task.json'), JSON.stringify({
    id: '01-demo', language: 'python', type: 'implement', difficulty: 'easy',
    image: 'model-bench-python', solutionFile: 'solution.py',
    testCommand: ['python', '/work/tests/run_tests.py'],
  }));
  writeFileSync(join(taskDir, 'prompt.md'), 'Write a thing.');
  const configsDir = join(root, 'configs');
  saveConfig(defaultConfig('test/model', { reasoning: false }), configsDir);
  return { root, tasksDir, configsDir, resultsDir: join(root, 'results') };
}

test('loadTasks reads manifest + prompt', () => {
  const { tasksDir } = makeFixture();
  const tasks = loadTasks(tasksDir);
  assert.equal(tasks.length, 1);
  assert.equal(tasks[0].id, '01-demo');
  assert.match(tasks[0].prompt, /Write a thing/);
  assert.ok(existsSync(tasks[0].dir));
});

test('runPhase1: samples per plan, appends closing line, grades, records, logs', async () => {
  const { tasksDir, configsDir, resultsDir } = makeFixture();
  const chatCalls = [];
  const chatImpl = async (req, opts) => {
    chatCalls.push({ req, opts });
    return { content: '```python\nx = 1\n```', reasoning: '', toolCalls: [], finishReason: 'stop', usage: { prompt_tokens: 5, completion_tokens: 9 }, latencyMs: 42, httpStatus: 200 };
  };
  let graded = 0;
  const gradeImpl = async ({ code }) => {
    graded++;
    assert.equal(code, 'x = 1\n');
    return { passed: 2, total: 2, passRate: 1, failureClass: null, cases: [], output: '' };
  };
  const records = await runPhase1(
    { models: ['test/model'], tasksDir, configsDir, resultsDir, nRuns: 3 },
    { chatImpl, gradeImpl },
  );
  assert.equal(records.length, 3);
  assert.equal(graded, 3);
  // greedy sampling plan: run 0 at temp 0, the rest at 0.2
  assert.equal(chatCalls[0].req.params.temperature, 0);
  assert.equal(chatCalls[1].req.params.temperature, 0.2);
  // universal closing line present, prompt content identical for every run
  assert.match(chatCalls[0].req.messages.at(-1).content, /last fenced code block in your reply/);
  assert.ok(records.every((r) => r.passRate === 1 && r.failureClass === null));
  // per-run raw log merged with the record
  const logFile = join(resultsDir, 'raw', 'phase1', 'test-model', '01-demo', 'run-0.json');
  assert.ok(existsSync(logFile));
  assert.equal(JSON.parse(readFileSync(logFile, 'utf8')).record.task, '01-demo');
  assert.ok(existsSync(join(resultsDir, 'phase1-records.json')));
});

test('runPhase1 marks truncation and never grades a truncated sample', async () => {
  const { tasksDir, configsDir, resultsDir } = makeFixture();
  const chatImpl = async () => ({ content: '```python\npartial', reasoning: '', toolCalls: [], finishReason: 'length', usage: { completion_tokens: 8192 }, latencyMs: 1, httpStatus: 200 });
  const gradeImpl = async () => { throw new Error('must not grade truncated output'); };
  const records = await runPhase1({ models: ['test/model'], tasksDir, configsDir, resultsDir, nRuns: 1 }, { chatImpl, gradeImpl });
  assert.equal(records[0].failureClass, 'TRUNCATED');
  assert.equal(records[0].passRate, null);
});

test('runPhase1 throws before any API call when a model has no usable config', async () => {
  const { tasksDir, configsDir, resultsDir } = makeFixture();
  const chatImpl = async () => {
    throw new Error('must not be called');
  };
  await assert.rejects(
    () => runPhase1({ models: ['no/such-model'], tasksDir, configsDir, resultsDir, nRuns: 1 }, { chatImpl }),
    /Run phase 0 first/,
  );
});

test('runPhase1 flushes phase1-records.json after each model completes, not just at the end', async () => {
  const { tasksDir, configsDir, resultsDir } = makeFixture();
  saveConfig(defaultConfig('test/model2', { reasoning: false }), configsDir);
  const chatImpl = async () => ({ content: '```python\nx = 1\n```', reasoning: '', toolCalls: [], finishReason: 'stop', usage: { completion_tokens: 1 }, latencyMs: 1, httpStatus: 200 });
  const gradeImpl = async () => ({ passed: 1, total: 1, passRate: 1, failureClass: null, cases: [], output: '' });
  const recordCountsWhenModel2Starts = [];
  const log = (msg) => {
    if (msg.startsWith('test/model2 ')) {
      const recordsFile = join(resultsDir, 'phase1-records.json');
      recordCountsWhenModel2Starts.push(JSON.parse(readFileSync(recordsFile, 'utf8')).length);
    }
  };
  const records = await runPhase1(
    { models: ['test/model', 'test/model2'], tasksDir, configsDir, resultsDir, nRuns: 1 },
    { chatImpl, gradeImpl, log },
  );
  // by the time model 2's first run is logged, model 1's flush must already be on disk
  assert.deepEqual(recordCountsWhenModel2Starts, [1]);
  assert.equal(records.length, 2);
  const finalOnDisk = JSON.parse(readFileSync(join(resultsDir, 'phase1-records.json'), 'utf8'));
  assert.equal(finalOnDisk.length, 2);
});

test('runPhase1 records API errors without aborting the sweep', async () => {
  const { tasksDir, configsDir, resultsDir } = makeFixture();
  let n = 0;
  const chatImpl = async () => {
    if (++n === 1) throw new Error('502 flaky');
    return { content: '```python\nx = 1\n```', reasoning: '', toolCalls: [], finishReason: 'stop', usage: {}, latencyMs: 1, httpStatus: 200 };
  };
  const gradeImpl = async () => ({ passed: 1, total: 1, passRate: 1, failureClass: null, cases: [], output: '' });
  const records = await runPhase1({ models: ['test/model'], tasksDir, configsDir, resultsDir, nRuns: 2 }, { chatImpl, gradeImpl });
  assert.equal(records[0].failureClass, 'API_ERROR');
  assert.equal(records[0].passRate, null);
  assert.match(records[0].error, /502/);
  assert.equal(records[1].failureClass, null);
});
