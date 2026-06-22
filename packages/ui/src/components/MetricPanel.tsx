import type { MetricResult } from '@anvil/core';
import { formatMetricValue, formatSpread } from '../dataLayer.js';
import { Panel } from './primitives.js';

/**
 * A single metric tile: big value + its spread (CI or ±sd) + n. The contract
 * guarantees any n>1 metric carries spread, so the CI is always shown when real.
 */
export function MetricTile({
  label,
  metric,
  hint,
}: {
  label: string;
  metric?: MetricResult;
  hint?: string;
}): JSX.Element {
  if (!metric) {
    return (
      <Panel title={label}>
        <div className="text-3xl font-semibold tracking-tight text-anvil-muted">n/a</div>
        <div className="mt-1 text-xs text-anvil-muted">not reported</div>
      </Panel>
    );
  }
  const spread = formatSpread(metric);
  return (
    <Panel title={label}>
      <div className="tnum text-3xl font-semibold tracking-tight text-slate-100">
        {formatMetricValue(metric)}
      </div>
      <div className="mt-1.5 text-xs text-anvil-muted">
        {spread ? <span data-testid="metric-spread">{spread}</span> : <span>single sample</span>}
        <span className="ml-2 opacity-70">n={metric.n}</span>
      </div>
      {hint && <div className="mt-2 text-xs leading-relaxed text-anvil-muted/80">{hint}</div>}
    </Panel>
  );
}
