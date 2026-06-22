import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
} from '@tanstack/react-table';
import {
  CaretDown,
  CaretUp,
  CaretUpDown,
  Sparkle,
  Robot,
  PuzzlePiece,
  Function as FnIcon,
} from '@phosphor-icons/react';
import { useDataSource } from '../app/useDataSource.js';
import { useAsync } from '../app/useAsync.js';
import { filterByKind, formatRatio, type RunIndex } from '../dataLayer.js';
import { Loading, ErrorState, EmptyState, Badge, Panel } from '../components/primitives.js';
import { cn } from '../lib/cn.js';

type KindFilter = 'all' | 'skill' | 'subagent' | 'plugin';
type Entry = RunIndex['runs'][number];

/** Columns whose cells + headers are right-aligned (numeric / date). */
const RIGHT_ALIGNED = new Set(['activationF1', 'costTokens', 'createdAt']);

const KIND_ICON: Record<string, JSX.Element> = {
  skill: <Sparkle weight="fill" className="opacity-80" />,
  subagent: <Robot weight="fill" className="opacity-80" />,
  plugin: <PuzzlePiece weight="fill" className="opacity-80" />,
};

const columnHelper = createColumnHelper<Entry>();

export function Leaderboard(): JSX.Element {
  const { source, error: dsError } = useDataSource();
  const navigate = useNavigate();
  const idx = useAsync<RunIndex>(() => source!.getRunIndex(), [source], !!source);
  const [kind, setKind] = useState<KindFilter>('all');
  const [sorting, setSorting] = useState<SortingState>([{ id: 'qualityDelta', desc: true }]);

  const data = useMemo(
    () => (idx.status === 'ready' ? filterByKind(idx.data.runs, kind) : []),
    [idx, kind],
  );

  const columns = useMemo(
    () => [
      columnHelper.accessor('artifactName', {
        header: 'Artifact',
        cell: (info) => (
          <div className="min-w-0">
            <Link
              to={`/run/${info.row.original.runId}`}
              onClick={(e) => e.stopPropagation()}
              className="font-medium text-anvil-fg decoration-anvil-accent/50 underline-offset-4 hover:text-anvil-accent hover:underline"
            >
              {info.getValue()}
            </Link>
            <div className="truncate text-xs text-anvil-muted">{info.row.original.suiteName}</div>
          </div>
        ),
      }),
      columnHelper.accessor('artifactKind', {
        header: 'Kind',
        cell: (info) => (
          <Badge tone="accent">
            {KIND_ICON[info.getValue()] ?? <FnIcon />}
            {info.getValue()}
          </Badge>
        ),
      }),
      columnHelper.accessor((r) => r.headline.qualityDelta ?? null, {
        id: 'qualityDelta',
        header: 'Quality Δ',
        sortUndefined: 'last',
        cell: (info) => <DeltaCell value={info.getValue() ?? undefined} />,
      }),
      columnHelper.accessor((r) => r.headline.activationF1 ?? null, {
        id: 'activationF1',
        header: 'Activation F1',
        cell: (info) => <F1Cell value={info.getValue()} />,
      }),
      columnHelper.accessor((r) => r.headline.costTokens ?? null, {
        id: 'costTokens',
        header: 'Cost',
        cell: (info) => {
          const v = info.getValue();
          return v === null || v === undefined ? (
            <span className="text-anvil-faint">n/a</span>
          ) : (
            <span className="tnum text-anvil-fg/90">
              {v.toLocaleString()}
              <span className="ml-1 text-xs text-anvil-faint">tok</span>
            </span>
          );
        },
      }),
      columnHelper.accessor('createdAt', {
        header: 'When',
        cell: (info) => <span className="tnum text-anvil-muted">{shortDate(info.getValue())}</span>,
      }),
    ],
    [],
  );

  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  if (dsError) return <ErrorState message={dsError} />;
  if (!source || idx.status === 'loading') return <Loading what="leaderboard" />;
  if (idx.status === 'error') return <ErrorState message={idx.error} />;

  if (idx.data.runs.length === 0) {
    return (
      <EmptyState title="No eval runs yet">
        <p>
          Anvil hasn&apos;t scored any artifacts. From inside Claude Code, generate a suite with{' '}
          <code className="rounded bg-anvil-bg px-1 font-mono">/anvil-gen-testdata</code> and run it
          with <code className="rounded bg-anvil-bg px-1 font-mono">/anvil-eval</code>. Results land
          here automatically.
        </p>
      </EmptyState>
    );
  }

  return (
    <div className="animate-fade-in space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-anvil-fg">Effectiveness runs</h1>
        <p className="mt-1 text-sm text-anvil-muted">
          {idx.data.runs.length} recorded {idx.data.runs.length === 1 ? 'run' : 'runs'}. Click a
          column to sort, a row to open its scorecard.
        </p>
      </div>

      <FilterTabs value={kind} onChange={setKind} />

      <Panel className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              {table.getHeaderGroups().map((hg) => (
                <tr key={hg.id} className="border-b border-anvil-border">
                  {hg.headers.map((h) => {
                    const align = RIGHT_ALIGNED.has(h.column.id) ? 'right' : undefined;
                    const sorted = h.column.getIsSorted();
                    return (
                      <th
                        key={h.id}
                        onClick={h.column.getToggleSortingHandler()}
                        className={cn(
                          'select-none px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-anvil-muted',
                          'cursor-pointer transition-colors hover:text-anvil-fg',
                          align === 'right' ? 'text-right' : 'text-left',
                        )}
                      >
                        <span
                          className={cn(
                            'inline-flex items-center gap-1',
                            align === 'right' && 'flex-row-reverse',
                          )}
                        >
                          {flexRender(h.column.columnDef.header, h.getContext())}
                          <SortGlyph state={sorted} />
                        </span>
                      </th>
                    );
                  })}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  onClick={() => navigate(`/run/${row.original.runId}`)}
                  className="group cursor-pointer border-b border-anvil-border/40 transition-colors last:border-0 hover:bg-anvil-panel2/70"
                >
                  {row.getVisibleCells().map((cell) => {
                    const align = RIGHT_ALIGNED.has(cell.column.id) ? 'right' : undefined;
                    return (
                      <td
                        key={cell.id}
                        className={cn('px-4 py-3.5 align-middle', align === 'right' && 'text-right')}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
      {data.length === 0 && (
        <p className="text-sm text-anvil-muted">No runs match the &ldquo;{kind}&rdquo; filter.</p>
      )}
    </div>
  );
}

function SortGlyph({ state }: { state: false | 'asc' | 'desc' }): JSX.Element {
  if (state === 'asc') return <CaretUp weight="bold" className="text-anvil-accent" size={11} />;
  if (state === 'desc') return <CaretDown weight="bold" className="text-anvil-accent" size={11} />;
  return <CaretUpDown className="text-anvil-faint opacity-0 group-hover:opacity-100" size={11} />;
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
    <div className="inline-flex gap-1 rounded-lg border border-anvil-border bg-anvil-panel p-1">
      {kinds.map((k) => (
        <button
          key={k}
          onClick={() => onChange(k)}
          className={cn(
            'rounded-md px-3 py-1 text-sm capitalize transition-colors',
            value === k
              ? 'bg-anvil-accent/15 text-anvil-accent ring-1 ring-inset ring-anvil-accent/30'
              : 'text-anvil-muted hover:text-anvil-fg',
          )}
        >
          {k}
        </button>
      ))}
    </div>
  );
}

/** Quality delta as a diverging bar centred at 0 (red left / green right) plus the value. */
function DeltaCell({ value }: { value?: number }): JSX.Element {
  if (value === undefined) return <span className="text-anvil-faint">n/a</span>;
  const positive = value > 0;
  const zero = value === 0;
  const tone = positive ? 'text-anvil-good' : zero ? 'text-anvil-muted' : 'text-anvil-bad';
  const pct = Math.min(50, Math.abs(value) * 50);
  return (
    <div className="flex items-center gap-2.5">
      <div className="relative hidden h-1.5 w-20 overflow-hidden rounded-full bg-anvil-border2/70 sm:block">
        <span className="absolute left-1/2 top-0 h-full w-px bg-anvil-muted/40" />
        <span
          className={cn('absolute top-0 h-full', positive ? 'bg-anvil-good' : 'bg-anvil-bad')}
          style={positive ? { left: '50%', width: `${pct}%` } : { right: '50%', width: `${pct}%` }}
        />
      </div>
      <span className={cn('tnum font-medium', tone)}>
        {positive ? '+' : ''}
        {formatRatio(value)}
      </span>
    </div>
  );
}

function F1Cell({ value }: { value: number | null }): JSX.Element {
  if (value === null) return <span className="tnum text-anvil-faint">n/a</span>;
  const tone = value >= 0.999 ? 'text-anvil-good' : value >= 0.8 ? 'text-anvil-fg' : 'text-anvil-warn';
  return <span className={cn('tnum', tone)}>{formatRatio(value)}</span>;
}

function shortDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toISOString().slice(0, 10);
}
