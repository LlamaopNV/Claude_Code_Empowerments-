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
    <div className="space-y-4">
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
            className="rounded border border-anvil-border bg-anvil-bg px-2 py-1"
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
        <table className="w-full text-left text-sm">
          <thead className="border-b border-anvil-border text-xs uppercase tracking-wide text-anvil-muted">
            <tr>
              <th className="px-4 py-3">Artifact</th>
              <th className="px-4 py-3">Kind</th>
              <th className="px-4 py-3">Quality Δ</th>
              <th className="px-4 py-3">Activation F1</th>
              <th className="px-4 py-3">Cost</th>
              <th className="px-4 py-3">When</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((e) => (
              <tr
                key={e.runId}
                className="border-b border-anvil-border/50 hover:bg-anvil-accent/5"
              >
                <td className="px-4 py-3 font-medium">
                  <Link className="text-anvil-accent hover:underline" to={`/run/${e.runId}`}>
                    {e.artifactName}
                  </Link>
                  <div className="text-xs text-anvil-muted">{e.suiteName}</div>
                </td>
                <td className="px-4 py-3">
                  <Badge tone="accent">{e.artifactKind}</Badge>
                </td>
                <td className="px-4 py-3">
                  <DeltaCell value={e.headline.qualityDelta} />
                </td>
                <td className="px-4 py-3">
                  {e.headline.activationF1 !== undefined
                    ? formatRatio(e.headline.activationF1)
                    : '—'}
                </td>
                <td className="px-4 py-3">
                  {e.headline.costTokens !== undefined
                    ? `${e.headline.costTokens.toLocaleString()} tok`
                    : '—'}
                </td>
                <td className="px-4 py-3 text-anvil-muted">{shortDate(e.createdAt)}</td>
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

function FilterTabs({
  value,
  onChange,
}: {
  value: KindFilter;
  onChange: (k: KindFilter) => void;
}): JSX.Element {
  const kinds: KindFilter[] = ['all', 'skill', 'subagent', 'plugin'];
  return (
    <div className="flex gap-1 rounded-lg border border-anvil-border bg-anvil-bg p-1">
      {kinds.map((k) => (
        <button
          key={k}
          onClick={() => onChange(k)}
          className={`rounded px-3 py-1 text-sm capitalize ${
            value === k ? 'bg-anvil-accent/20 text-anvil-accent' : 'text-anvil-muted'
          }`}
        >
          {k}
        </button>
      ))}
    </div>
  );
}

function DeltaCell({ value }: { value?: number }): JSX.Element {
  if (value === undefined) return <span>—</span>;
  const tone = value > 0 ? 'text-anvil-good' : value < 0 ? 'text-anvil-bad' : 'text-anvil-muted';
  return (
    <span className={tone}>
      {value > 0 ? '+' : ''}
      {formatRatio(value)}
    </span>
  );
}

function shortDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toISOString().slice(0, 10);
}
