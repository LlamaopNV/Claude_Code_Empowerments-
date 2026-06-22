import type { MetricResult } from '@anvil/core';
import { formatMetricValue, formatSpread } from '../dataLayer.js';

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
      <div className="rounded-xl border border-anvil-border bg-anvil-panel/70 p-4 shadow-card">
        <div className="text-[11px] font-medium uppercase tracking-wider text-anvil-muted">
          {label}
        </div>
        <div className="mt-1.5 text-3xl font-semibold tracking-tight text-anvil-faint">n/a</div>
        <div className="mt-1 text-xs text-anvil-faint">not reported</div>
      </div>
    );
  }
  const spread = formatSpread(metric);
  return (
    <div className="group rounded-xl border border-anvil-border bg-anvil-panel/70 p-4 shadow-card transition-colors hover:border-anvil-border2">
      <div className="text-[11px] font-medium uppercase tracking-wider text-anvil-muted">
        {label}
      </div>
      <div className="tnum mt-1.5 text-3xl font-semibold tracking-tight text-anvil-fg">
        {formatMetricValue(metric)}
      </div>
      <div className="mt-1.5 text-xs text-anvil-muted">
        {spread ? <span data-testid="metric-spread">{spread}</span> : <span>single sample</span>}
        <span className="ml-2 text-anvil-faint">n={metric.n}</span>
      </div>
      {hint && <div className="mt-2 text-xs leading-relaxed text-anvil-faint">{hint}</div>}
    </div>
  );
}
