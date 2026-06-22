import type { ConfusionMatrix } from '@anvil/core';
import { confusionRates, formatRatio } from '../dataLayer.js';
import { Panel } from './primitives.js';

/**
 * The activation confusion matrix (TP/TN/FP/FN) with derived precision/recall/F1
 * and the offending case ids listed beneath.
 */
export function ConfusionMatrixView({ confusion }: { confusion: ConfusionMatrix }): JSX.Element {
  const r = confusionRates(confusion);
  const cell = (
    label: string,
    value: number,
    tone: 'good' | 'bad',
  ): JSX.Element => (
    <div
      className={`rounded-md border p-3 text-center ${
        tone === 'good'
          ? 'border-anvil-good/40 bg-anvil-good/10'
          : 'border-anvil-bad/40 bg-anvil-bad/10'
      }`}
    >
      <div className="text-xs text-anvil-muted">{label}</div>
      <div className="text-2xl font-semibold">{value}</div>
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

      <dl className="mt-4 grid grid-cols-3 gap-2 text-sm">
        <Rate label="Precision" value={r.precision} />
        <Rate label="Recall" value={r.recall} />
        <Rate label="F1" value={r.f1} />
      </dl>

      {(confusion.falsePositiveCaseIds.length > 0 ||
        confusion.falseNegativeCaseIds.length > 0) && (
        <div className="mt-4 space-y-2 text-xs">
          {confusion.falsePositiveCaseIds.length > 0 && (
            <OffenderList
              label="Wrongly fired (FP)"
              ids={confusion.falsePositiveCaseIds}
            />
          )}
          {confusion.falseNegativeCaseIds.length > 0 && (
            <OffenderList
              label="Failed to fire (FN)"
              ids={confusion.falseNegativeCaseIds}
            />
          )}
        </div>
      )}
    </Panel>
  );
}

function Rate({ label, value }: { label: string; value: number | null }): JSX.Element {
  return (
    <div className="rounded border border-anvil-border bg-anvil-bg p-2 text-center">
      <dt className="text-xs text-anvil-muted">{label}</dt>
      <dd className="text-base font-medium">{value === null ? 'n/a' : formatRatio(value)}</dd>
    </div>
  );
}

function OffenderList({ label, ids }: { label: string; ids: string[] }): JSX.Element {
  return (
    <div>
      <span className="text-anvil-bad">{label}:</span>{' '}
      {ids.map((id) => (
        <code
          key={id}
          className="mr-1 inline-block rounded bg-anvil-bg px-1 py-0.5 text-anvil-muted"
        >
          {id}
        </code>
      ))}
    </div>
  );
}
