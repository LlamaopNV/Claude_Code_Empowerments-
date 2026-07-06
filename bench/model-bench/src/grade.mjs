// Sandboxed grading (spec rule 8): same pinned image per language, network
// disabled, CPU/memory capped, host-side kill. Grading contract: the task's
// test command prints `CASE <name> PASS|FAIL` lines; nothing else is trusted.
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, cpSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

export function parseCaseLines(output) {
  const cases = [];
  for (const m of output.matchAll(/^CASE (\S+) (PASS|FAIL)\s*$/gm)) {
    cases.push({ name: m[1], pass: m[2] === 'PASS' });
  }
  return { cases, passed: cases.filter((c) => c.pass).length, total: cases.length };
}

export function classifyRun({ timedOut, cases }) {
  if (timedOut) return 'TIMEOUT';
  if (cases.length === 0) return 'COMPILE_FAIL';
  if (cases.some((c) => !c.pass)) return 'TEST_FAIL';
  return null;
}

function dockerRun({ args, timeoutMs, name }) {
  return new Promise((resolve, reject) => {
    const child = spawn('docker', args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      const killer = spawn('docker', ['kill', name], { stdio: 'ignore' }); // the CLI dying does not stop the container
      killer.on('error', () => {}); // best effort; --rm reaps the container
      child.kill('SIGKILL');
    }, timeoutMs);
    child.on('error', (e) => {
      clearTimeout(timer);
      reject(new Error(`docker could not be spawned: ${e.message}`));
    });
    child.stdout.on('data', (d) => (output += d));
    child.stderr.on('data', (d) => (output += d));
    child.on('close', () => {
      clearTimeout(timer);
      resolve({ output, timedOut });
    });
  });
}

export async function gradeSolution({ code, taskDir, task }, { runImpl, timeoutMs = 35_000, workRoot = join(tmpdir(), 'model-bench') } = {}) {
  const workDir = join(workRoot, `${task.id}-${randomUUID().slice(0, 8)}`);
  mkdirSync(workDir, { recursive: true });
  writeFileSync(join(workDir, task.solutionFile), code);
  cpSync(join(taskDir, 'tests'), join(workDir, 'tests'), { recursive: true });

  const name = `mb-${randomUUID().slice(0, 12)}`;
  const args = [
    'run', '--rm', '--name', name,
    '--network', 'none', '--cpus', '1', '--memory', '512m',
    '-v', `${workDir}:/work`, '-w', '/work',
    task.image, ...task.testCommand,
  ];
  const run = runImpl ?? (() => dockerRun({ args, timeoutMs, name }));
  let output;
  let timedOut;
  try {
    ({ output, timedOut } = await run({ args, workDir, timeoutMs, name }));
  } finally {
    try {
      rmSync(workDir, { recursive: true, force: true });
    } catch {
      // best effort: a dying container can hold the mount briefly on Windows
    }
  }

  const { cases, passed, total } = parseCaseLines(output);
  const failureClass = classifyRun({ timedOut, cases });
  return { passed, total, passRate: total ? passed / total : 0, failureClass, cases, output };
}
