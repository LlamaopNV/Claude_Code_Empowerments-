// Fold phase-1 records into the spec's deliverables: summary.csv (one row per
// model × task × run) and report.md (leaderboard + failure-class breakdown).
// Runs with passRate null (TRUNCATED / API_ERROR) are excluded from
// correctness stats and reported as rates instead.
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
const std = (xs) => (xs.length ? Math.sqrt(mean(xs.map((x) => (x - mean(xs)) ** 2))) : 0);
const median = (xs) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};
const groupBy = (xs, key) => {
  const m = new Map();
  for (const x of xs) {
    const k = key(x);
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(x);
  }
  return m;
};

// Per-language / per-type breakout: unweighted mean over the per-task means,
// consistent with perModel.meanScore (spec: "broken out per language and per
// type"). Only tasks with a non-null mean participate.
function breakout(perModelTask, dim) {
  const rows = [];
  for (const [, entries] of groupBy(perModelTask.filter((t) => t.mean !== null), (t) => `${t.model} ${t[dim]}`)) {
    rows.push({
      model: entries[0].model,
      [dim]: entries[0][dim],
      meanScore: mean(entries.map((t) => t.mean)),
      passAt1: mean(entries.map((t) => t.passAt1)),
      tasks: entries.length,
    });
  }
  rows.sort((a, b) => a.model.localeCompare(b.model) || b.meanScore - a.meanScore);
  return rows;
}

export function buildSummary(records) {
  const perModelTask = [];
  for (const [, taskRecs] of groupBy(records, (r) => `${r.model} ${r.task}`)) {
    const graded = taskRecs.filter((r) => r.passRate !== null);
    const rates = graded.map((r) => r.passRate);
    perModelTask.push({
      model: taskRecs[0].model,
      task: taskRecs[0].task,
      language: taskRecs[0].language ?? 'unknown',
      type: taskRecs[0].type ?? 'unknown',
      runs: graded.length,
      truncated: taskRecs.filter((r) => r.failureClass === 'TRUNCATED').length,
      mean: rates.length ? mean(rates) : null,
      std: std(rates),
      passAt1: rates.length ? rates.filter((x) => x === 1).length / rates.length : null,
    });
  }

  const perModel = [];
  for (const [model, recs] of groupBy(records, (r) => r.model)) {
    const tasks = perModelTask.filter((t) => t.model === model && t.mean !== null);
    const failureCounts = {};
    for (const r of recs) {
      if (r.failureClass) failureCounts[r.failureClass] = (failureCounts[r.failureClass] ?? 0) + 1;
    }
    perModel.push({
      model,
      meanScore: tasks.length ? mean(tasks.map((t) => t.mean)) : null,
      passAt1: tasks.length ? mean(tasks.map((t) => t.passAt1)) : null,
      medianCompletionTokens: median(recs.map((r) => r.usage?.completion_tokens).filter((x) => x != null)),
      medianLatencyMs: median(recs.map((r) => r.latencyMs).filter((x) => x != null)),
      truncationRate: recs.filter((r) => r.failureClass === 'TRUNCATED').length / recs.length,
      extractionFailRate: recs.filter((r) => r.failureClass === 'EXTRACTION_FAIL').length / recs.length,
      failureCounts,
    });
  }
  perModel.sort((a, b) => (b.meanScore ?? -1) - (a.meanScore ?? -1));
  return {
    perModelTask,
    perModel,
    perLanguage: breakout(perModelTask, 'language'),
    perType: breakout(perModelTask, 'type'),
  };
}

const CSV_HEADER = 'model,task,language,type,run,temperature,failure_class,pass_rate,passed,total,extraction,finish_reason,prompt_tokens,completion_tokens,latency_ms';
// RFC-4180 escaping. Task ids and model slugs are path-safe upstream, but
// model display ids, error strings and future fields are not — quote any cell
// containing a comma, quote, or newline and double the inner quotes.
const cell = (v) => {
  if (v === null || v === undefined) return '';
  const s = String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function toCsv(records) {
  const rows = records.map((r) =>
    [r.model, r.task, r.language ?? 'unknown', r.type ?? 'unknown', r.run, r.params?.temperature, r.failureClass, r.passRate, r.passed, r.total, r.extraction, r.finishReason, r.usage?.prompt_tokens, r.usage?.completion_tokens, r.latencyMs]
      .map(cell)
      .join(','),
  );
  return [CSV_HEADER, ...rows].join('\n') + '\n';
}

const pct = (x) => (x === null ? 'n/a' : `${(x * 100).toFixed(1)}%`);

export function buildReportMd({ perModelTask, perModel, perLanguage, perType }) {
  const lines = ['# Model Bench — Phase 1 Report', '', '## Leaderboard', '', '| Model | Mean score | pass@1 | Median compl. tokens | Median latency (ms) | Truncation | Extraction fail |', '|---|---|---|---|---|---|---|'];
  for (const m of perModel) {
    const trunc = m.truncationRate > 0.1 ? `${pct(m.truncationRate)} ⚠ double max_tokens and rerun` : pct(m.truncationRate);
    lines.push(`| ${m.model} | ${pct(m.meanScore)} | ${pct(m.passAt1)} | ${m.medianCompletionTokens ?? 'n/a'} | ${m.medianLatencyMs ?? 'n/a'} | ${trunc} | ${pct(m.extractionFailRate)} |`);
  }
  lines.push('', '## Per task', '', '| Model | Task | Mean ± std | pass@1 | Graded runs | Truncated |', '|---|---|---|---|---|---|');
  for (const t of perModelTask) {
    lines.push(`| ${t.model} | ${t.task} | ${t.mean === null ? 'n/a' : `${t.mean.toFixed(3)} ± ${t.std.toFixed(3)}`} | ${pct(t.passAt1)} | ${t.runs} | ${t.truncated} |`);
  }
  lines.push('', '## Per language', '', '| Model | Language | Mean score | pass@1 | Tasks |', '|---|---|---|---|---|');
  for (const l of perLanguage) {
    lines.push(`| ${l.model} | ${l.language} | ${pct(l.meanScore)} | ${pct(l.passAt1)} | ${l.tasks} |`);
  }
  lines.push('', '## Per type', '', '| Model | Type | Mean score | pass@1 | Tasks |', '|---|---|---|---|---|');
  for (const t of perType) {
    lines.push(`| ${t.model} | ${t.type} | ${pct(t.meanScore)} | ${pct(t.passAt1)} | ${t.tasks} |`);
  }
  lines.push('', '## Failure classes', '');
  for (const m of perModel) {
    const counts = Object.entries(m.failureCounts).map(([k, v]) => `${k}: ${v}`).join(', ') || 'none';
    lines.push(`- **${m.model}** — ${counts}`);
  }
  return lines.join('\n') + '\n';
}

export function writeReports(records, resultsDir) {
  mkdirSync(resultsDir, { recursive: true });
  writeFileSync(join(resultsDir, 'summary.csv'), toCsv(records));
  writeFileSync(join(resultsDir, 'report.md'), buildReportMd(buildSummary(records)));
}
