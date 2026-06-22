import { useState } from 'react';
import type { RunTrace, TraceEvent } from '@anvil/core';
import { Badge } from './primitives.js';

/** How many events to render before requiring "show more" (large-trace guard). */
const WINDOW = 50;

/**
 * Expandable tool-use / message timeline from a RunTrace. Large traces are
 * windowed: only the first WINDOW events render until the user expands, so a
 * thousand-event transcript never blocks the main thread on mount.
 */
export function TraceTimeline({ trace }: { trace: RunTrace }): JSX.Element {
  const [expanded, setExpanded] = useState(false);
  const total = trace.events.length;
  const shown = expanded ? trace.events : trace.events.slice(0, WINDOW);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-xs text-anvil-muted">
        <Badge tone={trace.isSubagent ? 'accent' : 'neutral'}>
          {trace.isSubagent ? 'subagent' : 'main'}
        </Badge>
        <code>{trace.agentId}</code>
        <span className="ml-auto">
          {total} events · {trace.totalUsage.inputTokens + trace.totalUsage.outputTokens} tok
        </span>
      </div>

      <ol className="space-y-1">
        {shown.map((ev) => (
          <TraceRow key={ev.index} ev={ev} />
        ))}
      </ol>

      {total > WINDOW && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="text-xs text-anvil-accent hover:underline"
        >
          {expanded ? 'Collapse' : `Show all ${total} events`}
        </button>
      )}
    </div>
  );
}

function TraceRow({ ev }: { ev: TraceEvent }): JSX.Element {
  if (ev.kind === 'tool_use' && ev.toolUse) {
    const tu = ev.toolUse;
    const tag = tu.skill ?? tu.subagentType;
    return (
      <li className="flex items-start gap-2 rounded border border-anvil-border/60 bg-anvil-bg/60 p-2 text-xs">
        <Badge tone="accent">{tu.name}</Badge>
        {tag && <code className="text-anvil-muted">{tag}</code>}
        <span className="ml-auto opacity-60">#{ev.index}</span>
      </li>
    );
  }
  return (
    <li className="rounded border border-anvil-border/40 p-2 text-xs">
      <span className="mr-2 uppercase tracking-wide text-anvil-muted">{ev.kind}</span>
      {ev.text && <span className="text-anvil-fg/80">{truncate(ev.text, 240)}</span>}
    </li>
  );
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n) + '…' : s;
}
