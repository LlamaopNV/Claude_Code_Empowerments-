import type { ConfusionMatrix } from '@anvil/core';
import { confusionRates, formatRatio } from '../dataLayer.js';
import { Panel } from './primitives.js';
import { cn } from '../lib/cn.js';

/**
 * The activation confusion matrix (TP/TN/FP/FN) with derived precision/recall/F1
 * and the offending case ids listed beneath.
 */
export function ConfusionMatrixView({ confusion }: { confusion: ConfusionMatrix }): JSX.Element {
  const r = confusionRates(confusion);
  const cell = (label: string, value: number, tone: 'good' | 'bad'): JSX.Element => (
    <div
      className={cn(
        'rounded-lg border p-3 text-center',
        tone === 'good'
          ? 'border-anvil-good/30 bg-anvil-good/[0.08]'
          : 'border-anvil-bad/30 bg-anvil-bad/[0.08]',
      )}
    >
      <div className="text-[11px] uppercase tracking-wide text-anvil-muted">{label}</div>
      <div
        className={cn(
          'tnum mt-0.5 text-2xl font-semibold',
          tone === 'good' ? 'text-anvil-good' : value > 0 ? 'text-anvil-bad' : 'text-anvil-fg',
        )}
      >
        {value}
      </div>
    </div>
  );

  return (
    <Panel title="Activation confusion matrix">
      <div className="grid grid-cols-2 gap-3">
        {cell('True positive', confusion.truePositive, 'good')}
        {cell('False positive', confusion.falsePositive, 'bad')}
        {cell('False negative', confusion.falseNegative, 'bad')}
        {cell('True negative', confusion.trueNegative, 'good')}
      </div>

      <dl className="mt-3 grid grid-cols-3 gap-2 text-sm">
        <Rate label="Precision" value={r.precision} />
        <Rate label="Recall" value={r.recall} />
        <Rate label="F1" value={r.f1} />
      </dl>

      {(confusion.falsePositiveCaseIds.length > 0 || confusion.falseNegativeCaseIds.length > 0) && (
        <div className="mt-4 space-y-2 text-xs">
          {confusion.falsePositiveCaseIds.length > 0 && (
            <OffenderList label="Wrongly fired (FP)" ids={confusion.falsePositiveCaseIds} />
          )}
          {confusion.falseNegativeCaseIds.length > 0 && (
            <OffenderList label="Failed to fire (FN)" ids={confusion.falseNegativeCaseIds} />
          )}
        </div>
      )}
    </Panel>
  );
}

function Rate({ label, value }: { label: string; value: number | null }): JSX.Element {
  return (
    <div className="rounded-lg border border-anvil-border bg-anvil-bg/60 p-2 text-center">
      <dt className="text-[11px] uppercase tracking-wide text-anvil-muted">{label}</dt>
      <dd className="tnum mt-0.5 text-base font-medium text-anvil-fg">
        {value === null ? 'n/a' : formatRatio(value)}
      </dd>
    </div>
  );
}

function OffenderList({ label, ids }: { label: string; ids: string[] }): JSX.Element {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-anvil-bad">{label}:</span>{' '}
      {ids.map((id) => (
        <code
          key={id}
          className="rounded bg-anvil-bg px-1.5 py-0.5 font-mono text-anvil-muted ring-1 ring-inset ring-anvil-border"
        >
          {id}
        </code>
      ))}
    </div>
  );
}
