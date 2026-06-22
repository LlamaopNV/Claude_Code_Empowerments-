import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useDataSource } from '../app/useDataSource.js';
import { useAsync } from '../app/useAsync.js';
import {
  sortEntries,
  filterByKind,
  formatRatio,
  type RunIndex,
  type SortKey,
} from '../dataLayer.js';
import { Loading, ErrorState, EmptyState, Badge, Panel } from '../components/primitives.js';

type KindFilter = 'all' | 'skill' | 'subagent' | 'plugin';

/** Small glyph per artifact kind so rows are scannable at a glance. */
const KIND_GLYPH: Record<string, string> = { skill: '◆', subagent: '⬡', plugin: '⧉' };

export function Leaderboard(): JSX.Element {
  const { source, error: dsError } = useDataSource();
  const idx = useAsync<RunIndex>(() => source!.getRunIndex(), [source], !!source);
  const [kind, setKind] = useState<KindFilter>('all');
  const [sortKey, setSortKey] = useState<SortKey>('qualityDelta');

  const rows = useMemo(() => {
    if (idx.status !== 'ready') return [];
    return sortEntries(filterByKind(idx.data.runs, kind), sortKey);
  }, [idx, kind, sortKey]);

  if (dsError) return <ErrorState message={dsError} />;
  if (!source || idx.status === 'loading') return <Loading what="leaderboard" />;
  if (idx.status === 'error') return <ErrorState message={idx.error} />;

  if (idx.data.runs.length === 0) {
    return (
      <EmptyState title="No eval runs yet">
        <p>
          Anvil hasn&apos;t scored any artifacts. From inside Claude Code, generate a suite with{' '}
          <code className="rounded bg-anvil-bg px-1">/anvil-gen-testdata &lt;artifact&gt;</code> and
          run it with <code className="rounded bg-anvil-bg px-1">/anvil-eval &lt;artifact&gt;</code>.
          Results land here automatically.
        </p>
      </EmptyState>
    );
  }

  return (
    <div className="animate-fade-in space-y-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-slate-100">Effectiveness runs</h1>
        <p className="mt-1 text-sm text-anvil-muted">
          {idx.data.runs.length} recorded {idx.data.runs.length === 1 ? 'run' : 'runs'} · ranked by{' '}
          {SORT_LABEL[sortKey]}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <FilterTabs value={kind} onChange={setKind} />
        <div className="ml-auto flex items-center gap-2 text-sm">
          <label className="text-anvil-muted" htmlFor="sort">
            Sort by
          </label>
          <select
            id="sort"
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as SortKey)}
            className="rounded-lg border border-anvil-border bg-anvil-panel px-2.5 py-1.5 text-slate-200 transition-colors hover:border-anvil-accent/50 focus:border-anvil-accent focus:outline-none focus:ring-1 focus:ring-anvil-accent/40"
          >
            <option value="qualityDelta">Quality delta</option>
            <option value="activationF1">Activation F1</option>
            <option value="costTokens">Cost (tokens)</option>
            <option value="createdAt">Newest</option>
            <option value="artifactName">Name</option>
          </select>
        </div>
      </div>

      <Panel className="overflow-x-auto p-0">
        <table className="w-full border-collapse text-left text-sm">
          <thead className="border-b border-anvil-border text-xs uppercase tracking-wide text-anvil-muted">
            <tr>
              <th className="px-4 py-3 font-semibold">Artifact</th>
              <th className="px-4 py-3 font-semibold">Kind</th>
              <th className="px-4 py-3 font-semibold">Quality Δ</th>
              <th className="px-4 py-3 text-right font-semibold">Activation F1</th>
              <th className="px-4 py-3 text-right font-semibold">Cost</th>
              <th className="px-4 py-3 text-right font-semibold">When</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((e) => (
              <tr
                key={e.runId}
                className="group border-b border-anvil-border/40 transition-colors last:border-0 hover:bg-anvil-panel2/70"
              >
                <td className="px-4 py-3.5">
                  <Link
                    className="font-medium text-slate-100 decoration-anvil-accent/50 underline-offset-4 group-hover:text-anvil-accent group-hover:underline"
                    to={`/run/${e.runId}`}
                  >
                    {e.artifactName}
                  </Link>
                  <div className="mt-0.5 text-xs text-anvil-muted">{e.suiteName}</div>
                </td>
                <td className="px-4 py-3.5">
                  <Badge tone="accent">
                    <span aria-hidden className="opacity-80">
                      {KIND_GLYPH[e.artifactKind] ?? '•'}
                    </span>
                    {e.artifactKind}
                  </Badge>
                </td>
                <td className="px-4 py-3.5">
                  <DeltaCell value={e.headline.qualityDelta} />
                </td>
                <td className="px-4 py-3.5 text-right tnum">
                  {e.headline.activationF1 !== undefined ? (
                    <F1Value value={e.headline.activationF1} />
                  ) : (
                    <span className="text-anvil-muted">n/a</span>
                  )}
                </td>
                <td className="px-4 py-3.5 text-right tnum text-slate-300">
                  {e.headline.costTokens !== undefined ? (
                    <>
                      {e.headline.costTokens.toLocaleString()}
                      <span className="ml-1 text-xs text-anvil-muted">tok</span>
                    </>
                  ) : (
                    <span className="text-anvil-muted">n/a</span>
                  )}
                </td>
                <td className="px-4 py-3.5 text-right tnum text-anvil-muted">
                  {shortDate(e.createdAt)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
      {rows.length === 0 && (
        <p className="text-sm text-anvil-muted">No runs match the “{kind}” filter.</p>
      )}
    </div>
  );
}

const SORT_LABEL: Record<SortKey, string> = {
  qualityDelta: 'quality delta',
  activationF1: 'activation F1',
  costTokens: 'cost',
  createdAt: 'recency',
  artifactName: 'name',
};

function FilterTabs({
  value,
  onChange,
}: {
  value: KindFilter;
  onChange: (k: KindFilter) => void;
}): JSX.Element {
  const kinds: KindFilter[] = ['all', 'skill', 'subagent', 'plugin'];
  return (
    <div className="flex gap-1 rounded-lg border border-anvil-border bg-anvil-panel p-1">
      {kinds.map((k) => (
        <button
          key={k}
          onClick={() => onChange(k)}
          className={`rounded-md px-3 py-1 text-sm capitalize transition-colors ${
            value === k
              ? 'bg-anvil-accent/20 text-anvil-accent shadow-sm'
              : 'text-anvil-muted hover:text-slate-200'
          }`}
        >
          {k}
        </button>
      ))}
    </div>
  );
}

/** Quality delta as a diverging bar centred at 0 (red left / green right) plus the value. */
function DeltaCell({ value }: { value?: number }): JSX.Element {
  if (value === undefined) return <span className="text-anvil-muted">n/a</span>;
  const positive = value > 0;
  const zero = value === 0;
  const tone = positive ? 'text-anvil-good' : zero ? 'text-anvil-muted' : 'text-anvil-bad';
  // Map the delta (roughly -1..1) to a 0..50% half-width fill from centre.
  const pct = Math.min(50, Math.abs(value) * 50);
  return (
    <div className="flex items-center gap-2.5">
      <div className="relative hidden h-1.5 w-24 overflow-hidden rounded-full bg-anvil-border/60 sm:block">
        <span className="absolute left-1/2 top-0 h-full w-px bg-anvil-muted/40" />
        <span
          className={`absolute top-0 h-full ${positive ? 'bg-anvil-good' : 'bg-anvil-bad'}`}
          style={
            positive
              ? { left: '50%', width: `${pct}%` }
              : { right: '50%', width: `${pct}%` }
          }
        />
      </div>
      <span className={`tnum font-medium ${tone}`}>
        {positive ? '+' : ''}
        {formatRatio(value)}
      </span>
    </div>
  );
}

function F1Value({ value }: { value: number }): JSX.Element {
  const tone = value >= 0.999 ? 'text-anvil-good' : value >= 0.8 ? 'text-slate-200' : 'text-anvil-warn';
  return <span className={tone}>{formatRatio(value)}</span>;
}

function shortDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toISOString().slice(0, 10);
}
