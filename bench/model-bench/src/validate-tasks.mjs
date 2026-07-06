// Grades every task's committed reference solution(s) inside the real Docker
// sandbox. A task is only shippable when its reference scores 100% — the
// whole-bank version of Plan 1 Task 7's validation discipline.
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { loadTasks } from './phase1.mjs';
import { gradeSolution } from './grade.mjs';

export function referenceCodes(task) {
  const refs = readdirSync(task.dir).filter((f) => f.startsWith('reference.'));
  const files = task.solutionFiles ?? [task.solutionFile];
  return files.map((f) => {
    const ref = refs.find((r) => extname(r) === extname(f));
    if (!ref) throw new Error(`${task.id}: no reference.* matching ${f}`);
    return readFileSync(join(task.dir, ref), 'utf8');
  });
}

export async function validateTasks({ tasksDir, taskIds = null }, { gradeImpl, log = console.log } = {}) {
  const grade = gradeImpl ?? ((args) => gradeSolution(args));
  const tasks = loadTasks(tasksDir).filter((t) => !taskIds || taskIds.includes(t.id));
  const failures = [];
  for (const task of tasks) {
    const codes = referenceCodes(task);
    const r = await grade({ code: codes.at(-1), codes, taskDir: task.dir, task });
    const ok = r.total > 0 && r.passed === r.total;
    log(`${task.id}: ${r.passed}/${r.total}${ok ? '' : `  <-- ${r.failureClass ?? 'NO CASES'}`}`);
    if (!ok) failures.push(task.id);
  }
  return failures;
}

async function main() {
  const { values } = parseArgs({ args: process.argv.slice(2), options: { tasks: { type: 'string' } } });
  const tasksDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'tasks', 'p1');
  const taskIds = values.tasks ? values.tasks.split(',').map((s) => s.trim()).filter(Boolean) : null;
  const failures = await validateTasks({ tasksDir, taskIds });
  if (failures.length) {
    console.error(`REFERENCE FAILURES: ${failures.join(', ')}`);
    process.exit(1);
  }
  console.log('all references pass');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
}
