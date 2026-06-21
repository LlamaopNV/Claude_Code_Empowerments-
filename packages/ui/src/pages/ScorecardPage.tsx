import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useDataSource } from '../app/useDataSource.js';
import { useAsync } from '../app/useAsync.js';
import {
  getMetric,
  headlineVerdict,
  tallyJudgeSamples,
  buildOverhead,
  formatRatio,
  type Scorecard,
  type RunTrace,
} from '../dataLayer.js';
import { Loading, ErrorState, Panel, Badge } from '../components/primitives.js';
import { MetricTile } from '../components/MetricPanel.js';
import { ConfusionMatrixView } from '../components/ConfusionMatrixView.js';
import { CostOverheadChart } from '../components/CostOverheadChart.js';
import { CaseDetail } from '../components/CaseDetail.js';

export function ScorecardPage(): JSX.Element {
  const { runId = '' } = useParams();
  const { source, error: dsError } = useDataSource();

  const card = useAsync<Scorecard>(
    () => source!.getScorecard(runId),
    [source, runId],
    !!source,
  );

  // Resolve traces referenced by cases (for the cost-overhead chart). Best
  // effort: unavailable traces are simply omitted from the chart.
  const traceIds = useMemo(() => {
    if (card.status !== 'ready') return [] as string[];
    const ids = new Set<string>();
    for (const c of card.data.cases) {
      if (c.treatmentTraceId) ids.add(c.treatmentTraceId);
      if (c.baselineTraceId) ids.add(c.baselineTraceId);
    }
    return [...ids];
  }, [card]);

  const traces = useAsync<Record<string, RunTrace | null>>(
    async () => {
      const entries = await Promise.all(
        traceIds.map(async (id) => [id, await source!.getTrace(id)] as const),
      );
      return Object.fromEntries(entries);
    },
    [source, traceIds.join(',')],
    !!source && card.status === 'ready',
  );

  if (dsError) return <ErrorState message={dsError} />;
  if (!source || card.status === 'loading') return <Loading what="scorecard" />;
  if (card.status === 'error') return <ErrorState message={card.error} />;

  const c = card.data;
  const verdict = headlineVerdict(c);
  const tally = tallyJudgeSamples(c.cases);

  const tokensByTrace: Record<string, number> =
    traces.status === 'ready'
      ? Object.fromEntries(
          Object.entries(traces.data)
            .filter(([, t]) => t !== null)
            .map(([id, t]) => [
              id,
              (t as RunTrace).totalUsage.inputTokens + (t as RunTrace).totalUsage.outputTokens,
            ]),
        )
      : {};
  const overhead = buildOverhead(c.cases, tokensByTrace);

  return (
    <div className="space-y-6">
      <div>
        <Link to="/" className="text-sm text-anvil-accent hover:underline">
          ← Leaderboard
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h2 className="text-xl font-semibold">{c.artifact.name}</h2>
          <Badge tone="accent">{c.artifact.kind}</Badge>
          {!c.pluginLoadOk && <Badge tone="bad">plugin load failed</Badge>}
          <span className="text-sm text-anvil-muted">
            {c.suiteName} · {c.repetitions} reps · judge {c.judgeModel}
          </span>
        </div>
      </div>

      {/* Headline verdict */}
      <div
        className={`rounded-lg border p-4 ${
          verdict.tone === 'good'
            ? 'border-anvil-good/40 bg-anvil-good/10'
            : verdict.tone === 'bad'
              ? 'border-anvil-bad/40 bg-anvil-bad/10'
              : 'border-anvil-warn/40 bg-anvil-warn/10'
        }`}
      >
        <div className="text-lg font-semibold">{verdict.label}</div>
        <div className="text-sm text-anvil-muted">{verdict.detail}</div>
      </div>

      {/* Metric tiles */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
        <MetricTile
          label="Quality delta"
          metric={getMetric(c, 'quality.delta')}
          hint="Pairwise treatment vs baseline (judge)."
        />
        <MetricTile label="Activation F1" metric={getMetric(c, 'activation.f1')} />
        <MetricTile label="Activation precision" metric={getMetric(c, 'activation.precision')} />
        <MetricTile label="Activation recall" metric={getMetric(c, 'activation.recall')} />
        <MetricTile label="Cost" metric={getMetric(c, 'cost.tokens')} />
        {getMetric(c, 'latency.ms') && (
          <MetricTile label="Latency" metric={getMetric(c, 'latency.ms')} />
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <ConfusionMatrixView confusion={c.confusion} />
        <Panel title="Pairwise judge tally">
          <div className="grid grid-cols-3 gap-2 text-center">
            <TallyCell label="Treatment wins" value={tally.treatment} tone="good" />
            <TallyCell label="Ties" value={tally.tie} tone="warn" />
            <TallyCell label="Baseline wins" value={tally.baseline} tone="bad" />
          </div>
          <div className="mt-3 text-sm text-anvil-muted">
            Net win fraction:{' '}
            <span className="font-medium text-slate-200">
              {tally.net === null ? '—' : formatRatio(tally.net)}
            </span>{' '}
            across {tally.total} samples.
          </div>
        </Panel>
      </div>

      <CostOverheadChart points={overhead} />

      <div className="space-y-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-anvil-muted">
          Per-case detail ({c.cases.length})
        </h3>
        {c.cases.map((cs) => (
          <CaseDetail key={cs.caseId} c={cs} />
        ))}
      </div>
    </div>
  );
}

function TallyCell({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: 'good' | 'bad' | 'warn';
}): JSX.Element {
  const cls =
    tone === 'good' ? 'text-anvil-good' : tone === 'bad' ? 'text-anvil-bad' : 'text-anvil-warn';
  return (
    <div className="rounded border border-anvil-border bg-anvil-bg p-3">
      <div className={`text-2xl font-semibold ${cls}`}>{value}</div>
      <div className="text-xs text-anvil-muted">{label}</div>
    </div>
  );
}
