import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { referenceCodes, validateTasks } from './validate-tasks.mjs';

function makeBank() {
  const tasksDir = mkdtempSync(join(tmpdir(), 'bank-'));
  const single = join(tasksDir, '01-single');
  mkdirSync(join(single, 'tests'), { recursive: true });
  writeFileSync(join(single, 'task.json'), JSON.stringify({
    id: '01-single', language: 'python', type: 'implement', difficulty: 'easy',
    image: 'model-bench-python', solutionFile: 'solution.py',
    testCommand: ['python', '/work/tests/run_tests.py'],
  }));
  writeFileSync(join(single, 'prompt.md'), 'p');
  writeFileSync(join(single, 'reference.py'), 'PY-REF\n');
  const poly = join(tasksDir, '16-poly');
  mkdirSync(join(poly, 'tests'), { recursive: true });
  writeFileSync(join(poly, 'task.json'), JSON.stringify({
    id: '16-poly', language: 'polyglot', type: 'spec-following', difficulty: 'hard',
    image: 'model-bench-polyglot', solutionFile: 'solution.go', blocks: 2,
    solutionFiles: ['solution.py', 'solution.go'],
    testCommand: ['sh', '/work/tests/run_tests.sh'],
  }));
  writeFileSync(join(poly, 'prompt.md'), 'p');
  writeFileSync(join(poly, 'reference.py'), 'POLY-PY\n');
  writeFileSync(join(poly, 'reference.go'), 'POLY-GO\n');
  return tasksDir;
}

test('referenceCodes matches reference files to solutionFiles by extension', async () => {
  const tasksDir = makeBank();
  const { loadTasks } = await import('./phase1.mjs');
  const tasks = loadTasks(tasksDir);
  const poly = tasks.find((t) => t.id === '16-poly');
  assert.deepEqual(referenceCodes(poly), ['POLY-PY\n', 'POLY-GO\n']);
  const single = tasks.find((t) => t.id === '01-single');
  assert.deepEqual(referenceCodes(single), ['PY-REF\n']);
});

test('validateTasks grades every reference and reports non-perfect tasks', async () => {
  const tasksDir = makeBank();
  const seen = [];
  const gradeImpl = async ({ code, codes, task }) => {
    seen.push({ id: task.id, code, codes });
    if (task.id === '16-poly') return { passed: 3, total: 4, passRate: 0.75, failureClass: 'TEST_FAIL', cases: [], output: '' };
    return { passed: 2, total: 2, passRate: 1, failureClass: null, cases: [], output: '' };
  };
  const failures = await validateTasks({ tasksDir }, { gradeImpl, log: () => {} });
  assert.deepEqual(failures, ['16-poly']);
  const single = seen.find((s) => s.id === '01-single');
  assert.equal(single.code, 'PY-REF\n');
  assert.deepEqual(single.codes, ['PY-REF\n']);
  const poly = seen.find((s) => s.id === '16-poly');
  assert.deepEqual(poly.codes, ['POLY-PY\n', 'POLY-GO\n']);
  assert.equal(poly.code, 'POLY-GO\n');
});

test('validateTasks honors a task-id filter and fails on zero-case runs', async () => {
  const tasksDir = makeBank();
  const gradeImpl = async () => ({ passed: 0, total: 0, passRate: 0, failureClass: 'COMPILE_FAIL', cases: [], output: '' });
  const failures = await validateTasks({ tasksDir, taskIds: ['01-single'] }, { gradeImpl, log: () => {} });
  assert.deepEqual(failures, ['01-single']);
});
