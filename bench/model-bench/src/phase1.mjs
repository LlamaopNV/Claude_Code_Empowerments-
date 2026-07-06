// Phase 1 — single-shot baseline. One prompt template for every model (spec
// rule 4/5); only the per-model config wrapper differs. Serial execution: the
// free NVIDIA tier rate-limits aggressively, so fairness beats speed here.
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { benchChat } from './client.mjs';
import { extractSolution } from './extract.mjs';
import { loadConfig, samplingPlan } from './config.mjs';
import { buildUserPrompt } from './prompt.mjs';
import { gradeSolution } from './grade.mjs';
import { slugify } from './slug.mjs';

export function loadTasks(tasksDir) {
  return readdirSync(tasksDir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => {
      const dir = join(tasksDir, e.name);
      return {
        ...JSON.parse(readFileSync(join(dir, 'task.json'), 'utf8')),
        dir,
        prompt: readFileSync(join(dir, 'prompt.md'), 'utf8'),
      };
    })
    .sort((a, b) => a.id.localeCompare(b.id));
}

function writeRunLog(logFile, record) {
  let logged = {};
  try {
    logged = JSON.parse(readFileSync(logFile, 'utf8')); // request/response written by benchChat
  } catch {
    mkdirSync(dirname(logFile), { recursive: true }); // API_ERROR path: no client log exists
  }
  writeFileSync(logFile, JSON.stringify({ ...logged, record }, null, 2));
}

export async function runPhase1(
  { models, tasksDir, configsDir, resultsDir, nRuns = 5 },
  { chatImpl, gradeImpl, log = () => {} } = {},
) {
  const chat = chatImpl ?? ((req, opts) => benchChat(req, opts));
  const grade = gradeImpl ?? ((args) => gradeSolution(args));
  const tasks = loadTasks(tasksDir);
  const records = [];

  for (const model of models) {
    const cfg = loadConfig(model, configsDir);
    const plan = samplingPlan(cfg, nRuns);
    const system = cfg.reasoning_toggle ?? cfg.system_prompt;
    for (const task of tasks) {
      for (let i = 0; i < plan.length; i++) {
        const params = plan[i];
        const messages = [
          ...(system ? [{ role: 'system', content: system }] : []),
          { role: 'user', content: buildUserPrompt(task.prompt) },
        ];
        const logFile = join(resultsDir, 'raw', 'phase1', slugify(model), task.id, `run-${i}.json`);
        const record = { model, task: task.id, run: i, params, finishReason: null, usage: null, latencyMs: null, extraction: null, failureClass: null, passed: null, total: null, passRate: null };
        try {
          const r = await chat({ model, messages, params }, { logFile });
          record.finishReason = r.finishReason;
          record.usage = r.usage;
          record.latencyMs = r.latencyMs;
          if (r.finishReason === 'length') {
            record.failureClass = 'TRUNCATED'; // excluded from correctness scoring
          } else {
            const ex = extractSolution(r.content || r.reasoning, cfg.reasoning_field);
            record.extraction = ex.decision;
            if (ex.code === null) {
              record.failureClass = 'EXTRACTION_FAIL';
              record.passRate = 0;
            } else {
              const g = await grade({ code: ex.code, taskDir: task.dir, task });
              record.failureClass = g.failureClass;
              record.passed = g.passed;
              record.total = g.total;
              record.passRate = g.passRate;
            }
          }
        } catch (e) {
          record.failureClass = 'API_ERROR';
          record.error = e.message;
        }
        writeRunLog(logFile, record);
        records.push(record);
        log(`${model} ${task.id} run ${i}: ${record.failureClass ?? 'PASS'} (passRate=${record.passRate})`);
      }
    }
  }
  mkdirSync(resultsDir, { recursive: true });
  writeFileSync(join(resultsDir, 'phase1-records.json'), JSON.stringify(records, null, 2));
  return records;
}
