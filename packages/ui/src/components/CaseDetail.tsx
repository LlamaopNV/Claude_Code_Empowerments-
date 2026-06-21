import { useState } from 'react';
import type { CaseResult, RunTrace } from '@anvil/core';
import { useDataSource } from '../app/useDataSource.js';
import { Badge, Panel } from './primitives.js';
import { TraceTimeline } from './TraceTimeline.js';

/**
 * One case: activation correctness, expectation pass/fail, judge rationales, and
 * an expandable treatment-vs-baseline transcript compare (traces lazy-loaded
 * from the data source by id).
 */
export function CaseDetail({ c }: { c: CaseResult }): JSX.Element {
  const [open, setOpen] = useState(false);

  return (
    <Panel className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <code className="font-medium text-slate-100">{c.caseId}</code>
        <Badge tone={c.activationCorrect ? 'good' : 'bad'}>
          {c.activationCorrect ? 'activation ok' : 'activation wrong'}
        </Badge>
        <Badge tone={c.activated ? 'accent' : 'neutral'}>
          {c.activated ? 'fired' : 'did not fire'}
        </Badge>
        <Badge tone={c.expectationsPassed ? 'good' : 'bad'}>
          {c.expectationsPassed ? 'expectations pass' : 'expectations fail'}
        </Badge>
        {c.expectationResults.length > 0 && (
          <span className="text-xs text-anvil-muted">
            {c.expectationResults.filter(Boolean).length}/{c.expectationResults.length} checks
          </span>
        )}
      </div>

      {c.judgeSamples.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-anvil-muted">
            Judge rationales ({c.judgeSamples.length} samples, position-swapped)
          </h4>
          {c.judgeSamples.map((s, i) => (
            <div
              key={i}
              className="rounded border border-anvil-border/60 bg-anvil-bg/50 p-2 text-xs"
            >
              <div className="mb-1 flex items-center gap-2">
                <Badge
                  tone={
                    s.verdict === 'treatment' ? 'good' : s.verdict === 'baseline' ? 'bad' : 'warn'
                  }
                >
                  {s.verdict}
                </Badge>
                {s.swapped && <Badge tone="neutral">swapped</Badge>}
              </div>
              {s.rationale && <p className="text-slate-300">{s.rationale}</p>}
            </div>
          ))}
        </div>
      )}

      {(c.treatmentTraceId || c.baselineTraceId) && (
        <div>
          <button
            onClick={() => setOpen((v) => !v)}
            className="text-xs text-anvil-accent hover:underline"
          >
            {open ? 'Hide transcripts' : 'Compare transcripts (treatment vs baseline)'}
          </button>
          {open && (
            <div className="mt-3 grid gap-4 md:grid-cols-2">
              <TraceColumn label="Treatment" agentId={c.treatmentTraceId} />
              <TraceColumn label="Baseline" agentId={c.baselineTraceId} />
            </div>
          )}
        </div>
      )}
    </Panel>
  );
}

function TraceColumn({
  label,
  agentId,
}: {
  label: string;
  agentId?: string;
}): JSX.Element {
  const { source } = useDataSource();
  const [state, setState] = useState<
    { status: 'idle' } | { status: 'loading' } | { status: 'done'; trace: RunTrace | null }
  >({ status: 'idle' });

  if (!agentId) {
    return (
      <div className="rounded border border-anvil-border/40 p-3 text-xs text-anvil-muted">
        {label}: no trace recorded
      </div>
    );
  }

  if (state.status === 'idle' && source) {
    setState({ status: 'loading' });
    source.getTrace(agentId).then((trace) => setState({ status: 'done', trace }));
  }

  return (
    <div className="rounded border border-anvil-border/60 p-3">
      <div className="mb-2 text-xs font-semibold text-anvil-muted">{label}</div>
      {state.status !== 'done' && <div className="text-xs text-anvil-muted">loading trace…</div>}
      {state.status === 'done' && !state.trace && (
        <div className="text-xs text-anvil-muted">
          Trace <code>{agentId}</code> unavailable (offline demo or not yet served).
        </div>
      )}
      {state.status === 'done' && state.trace && <TraceTimeline trace={state.trace} />}
    </div>
  );
}
