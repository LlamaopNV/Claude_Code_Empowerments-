import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle, XCircle, Warning } from '@phosphor-icons/react';
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
import { cn } from '../lib/cn.js';

export function ScorecardPage(): JSX.Element {
  const { runId = '' } = useParams();
  const { source, error: dsError } = useDataSource();

  const card = useAsync<Scorecard>(() => source!.getScorecard(runId), [source, runId], !!source);

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

  const VerdictIcon =
    verdict.tone === 'good' ? CheckCircle : verdict.tone === 'bad' ? XCircle : Warning;

  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <Link
          to="/"
          className="inline-flex items-center gap-1 text-sm text-anvil-muted transition-colors hover:text-anvil-accent"
        >
          <ArrowLeft size={14} weight="bold" />
          Leaderboard
        </Link>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <h2 className="text-2xl font-semibold tracking-tight text-anvil-fg">{c.artifact.name}</h2>
          <Badge tone="accent">{c.artifact.kind}</Badge>
          {!c.pluginLoadOk && <Badge tone="bad">plugin load failed</Badge>}
          <span className="text-sm text-anvil-muted">
            {c.suiteName} · {c.repetitions} reps · judge {c.judgeModel}
          </span>
        </div>
      </div>

      {/* Headline verdict */}
      <div
        className={cn(
          'flex items-start gap-3 rounded-xl border p-4 shadow-card',
          verdict.tone === 'good'
            ? 'border-anvil-good/30 bg-anvil-good/[0.08]'
            : verdict.tone === 'bad'
              ? 'border-anvil-bad/30 bg-anvil-bad/[0.08]'
              : 'border-anvil-warn/30 bg-anvil-warn/[0.08]',
        )}
      >
        <VerdictIcon
          weight="fill"
          size={22}
          className={cn(
            'mt-0.5 shrink-0',
            verdict.tone === 'good'
              ? 'text-anvil-good'
              : verdict.tone === 'bad'
                ? 'text-anvil-bad'
                : 'text-anvil-warn',
          )}
        />
        <div>
          <div className="font-semibold text-anvil-fg">{verdict.label}</div>
          <div className="mt-0.5 text-sm text-anvil-muted">{verdict.detail}</div>
        </div>
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
        {getMetric(c, 'latency.ms') && <MetricTile label="Latency" metric={getMetric(c, 'latency.ms')} />}
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
            <span className="tnum font-medium text-anvil-fg">
              {tally.net === null ? 'n/a' : formatRatio(tally.net)}
            </span>{' '}
            across {tally.total} samples.
          </div>
        </Panel>
      </div>

      <CostOverheadChart points={overhead} />

      <div className="space-y-3">
        <h3 className="text-[13px] font-semibold uppercase tracking-wider text-anvil-muted">
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
    <div className="rounded-lg border border-anvil-border bg-anvil-bg/60 p-3">
      <div className={cn('tnum text-2xl font-semibold', cls)}>{value}</div>
      <div className="mt-0.5 text-xs text-anvil-muted">{label}</div>
    </div>
  );
}
