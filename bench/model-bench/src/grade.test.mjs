import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseCaseLines, classifyRun, gradeSolution } from './grade.mjs';

test('parseCaseLines reads only CASE lines', () => {
  const out = 'booting\nCASE simple PASS\nnoise CASE not-a-case\nCASE negative FAIL\nCASE unicode-input PASS\n';
  const r = parseCaseLines(out);
  assert.equal(r.total, 3);
  assert.equal(r.passed, 2);
  assert.deepEqual(r.cases[1], { name: 'negative', pass: false });
});

test('classifyRun precedence: timeout, compile, test, clean', () => {
  assert.equal(classifyRun({ timedOut: true, cases: [] }), 'TIMEOUT');
  assert.equal(classifyRun({ timedOut: false, cases: [] }), 'COMPILE_FAIL');
  assert.equal(classifyRun({ timedOut: false, cases: [{ name: 'a', pass: false }] }), 'TEST_FAIL');
  assert.equal(classifyRun({ timedOut: false, cases: [{ name: 'a', pass: true }] }), null);
});

test('gradeSolution stages files, invokes docker with the sandbox flags, scores output', async () => {
  const taskDir = mkdtempSync(join(tmpdir(), 'task-'));
  mkdirSync(join(taskDir, 'tests'));
  writeFileSync(join(taskDir, 'tests', 'run_tests.py'), 'print("CASE a PASS")');
  const task = { id: 't1', language: 'python', image: 'model-bench-python', solutionFile: 'solution.py', testCommand: ['python', '/work/tests/run_tests.py'] };
  let seen;
  const runImpl = async ({ args, workDir }) => {
    seen = { args, workDir };
    assert.ok(existsSync(join(workDir, 'solution.py')));
    assert.equal(readFileSync(join(workDir, 'solution.py'), 'utf8'), 'x = 1\n');
    assert.ok(existsSync(join(workDir, 'tests', 'run_tests.py')));
    return { output: 'CASE a PASS\nCASE b PASS\nCASE c FAIL\n', timedOut: false };
  };
  const r = await gradeSolution({ code: 'x = 1\n', taskDir, task }, { runImpl, workRoot: mkdtempSync(join(tmpdir(), 'work-')) });
  assert.equal(r.total, 3);
  assert.equal(r.passed, 2);
  assert.ok(Math.abs(r.passRate - 2 / 3) < 1e-9);
  assert.equal(r.failureClass, 'TEST_FAIL');
  for (const flag of ['--network', 'none', '--cpus', '1', '--memory', '512m']) assert.ok(seen.args.includes(flag), flag);
  assert.ok(seen.args.includes('model-bench-python'));
});

test('gradeSolution classifies a timeout', async () => {
  const taskDir = mkdtempSync(join(tmpdir(), 'task-'));
  mkdirSync(join(taskDir, 'tests'));
  writeFileSync(join(taskDir, 'tests', 'run_tests.py'), '');
  const task = { id: 't1', language: 'python', image: 'model-bench-python', solutionFile: 'solution.py', testCommand: ['python', '/work/tests/run_tests.py'] };
  const runImpl = async () => ({ output: '', timedOut: true });
  const r = await gradeSolution({ code: 'while True: pass', taskDir, task }, { runImpl, workRoot: mkdtempSync(join(tmpdir(), 'work-')) });
  assert.equal(r.failureClass, 'TIMEOUT');
  assert.equal(r.passRate, 0);
});

test('gradeSolution cleans up its staged workDir', async () => {
  const taskDir = mkdtempSync(join(tmpdir(), 'task-'));
  mkdirSync(join(taskDir, 'tests'));
  writeFileSync(join(taskDir, 'tests', 'run_tests.py'), '');
  const task = { id: 't1', language: 'python', image: 'model-bench-python', solutionFile: 'solution.py', testCommand: ['python', '/work/tests/run_tests.py'] };
  const workRoot = mkdtempSync(join(tmpdir(), 'work-'));
  await gradeSolution({ code: 'x = 1\n', taskDir, task }, { runImpl: async () => ({ output: 'CASE a PASS\n', timedOut: false }), workRoot });
  assert.deepEqual(readdirSync(workRoot), []);
});

test('gradeSolution cleans up even when the runner throws, and propagates the error', async () => {
  const taskDir = mkdtempSync(join(tmpdir(), 'task-'));
  mkdirSync(join(taskDir, 'tests'));
  writeFileSync(join(taskDir, 'tests', 'run_tests.py'), '');
  const task = { id: 't1', language: 'python', image: 'model-bench-python', solutionFile: 'solution.py', testCommand: ['python', '/work/tests/run_tests.py'] };
  const workRoot = mkdtempSync(join(tmpdir(), 'work-'));
  await assert.rejects(
    () => gradeSolution({ code: 'x', taskDir, task }, { runImpl: async () => { throw new Error('docker could not be spawned: ENOENT'); }, workRoot }),
    /docker could not be spawned/,
  );
  assert.deepEqual(readdirSync(workRoot), []);
});

test('gradeSolution stages multiple files from codes when task.solutionFiles is set', async () => {
  const taskDir = mkdtempSync(join(tmpdir(), 'task-'));
  mkdirSync(join(taskDir, 'tests'));
  writeFileSync(join(taskDir, 'tests', 'run_tests.sh'), 'echo CASE a PASS');
  const task = { id: 'poly', language: 'polyglot', image: 'model-bench-polyglot', solutionFile: 'solution.go', solutionFiles: ['solution.py', 'solution.go'], testCommand: ['sh', '/work/tests/run_tests.sh'] };
  let staged;
  const runImpl = async ({ workDir }) => {
    staged = {
      py: readFileSync(join(workDir, 'solution.py'), 'utf8'),
      go: readFileSync(join(workDir, 'solution.go'), 'utf8'),
    };
    return { output: 'CASE a PASS\n', timedOut: false };
  };
  await gradeSolution({ code: 'GO\n', codes: ['PY\n', 'GO\n'], taskDir, task }, { runImpl, workRoot: mkdtempSync(join(tmpdir(), 'work-')) });
  assert.deepEqual(staged, { py: 'PY\n', go: 'GO\n' });
});

test('gradeSolution right-aligns short codes: one block fills only the LAST file', async () => {
  const taskDir = mkdtempSync(join(tmpdir(), 'task-'));
  mkdirSync(join(taskDir, 'tests'));
  writeFileSync(join(taskDir, 'tests', 'run_tests.sh'), '');
  const task = { id: 'poly', language: 'polyglot', image: 'model-bench-polyglot', solutionFiles: ['solution.py', 'solution.go'], testCommand: ['sh', '/work/tests/run_tests.sh'] };
  let staged;
  const runImpl = async ({ workDir }) => {
    staged = {
      py: readFileSync(join(workDir, 'solution.py'), 'utf8'),
      go: readFileSync(join(workDir, 'solution.go'), 'utf8'),
    };
    return { output: 'CASE go-1 PASS\nCASE py-1 FAIL\n', timedOut: false };
  };
  const r = await gradeSolution({ code: 'GO\n', codes: ['GO\n'], taskDir, task }, { runImpl, workRoot: mkdtempSync(join(tmpdir(), 'work-')) });
  assert.deepEqual(staged, { py: '', go: 'GO\n' });
  assert.equal(r.failureClass, 'TEST_FAIL'); // the empty half fails its cases; no crash
});
