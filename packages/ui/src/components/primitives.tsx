import type { ReactNode } from 'react';

export function Panel({
  title,
  children,
  className = '',
}: {
  title?: ReactNode;
  children: ReactNode;
  className?: string;
}): JSX.Element {
  return (
    <section
      className={`rounded-xl border border-anvil-border bg-anvil-panel/80 p-4 shadow-card backdrop-blur-sm ${className}`}
    >
      {title && (
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-anvil-muted">
          {title}
        </h3>
      )}
      {children}
    </section>
  );
}

export function Loading({ what = 'data' }: { what?: string }): JSX.Element {
  return (
    <div className="flex items-center gap-3 p-6 text-anvil-muted" role="status">
      <span className="relative flex h-3 w-3">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-anvil-accent opacity-60" />
        <span className="relative inline-flex h-3 w-3 rounded-full bg-anvil-accent" />
      </span>
      Loading {what}…
    </div>
  );
}

export function ErrorState({ message }: { message: string }): JSX.Element {
  return (
    <div className="rounded-xl border border-anvil-bad/40 bg-anvil-bad/10 p-4 text-sm text-anvil-bad shadow-card">
      <strong className="block">Something went wrong</strong>
      <span className="break-words text-anvil-bad/90">{message}</span>
    </div>
  );
}

export function EmptyState({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}): JSX.Element {
  return (
    <div className="animate-fade-in rounded-xl border border-dashed border-anvil-border bg-anvil-panel/40 p-10 text-center">
      <p className="text-lg font-medium text-slate-100">{title}</p>
      <div className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-anvil-muted">
        {children}
      </div>
    </div>
  );
}

const TONE: Record<string, string> = {
  good: 'bg-anvil-good/15 text-anvil-good border-anvil-good/40',
  bad: 'bg-anvil-bad/15 text-anvil-bad border-anvil-bad/40',
  warn: 'bg-anvil-warn/15 text-anvil-warn border-anvil-warn/40',
  mixed: 'bg-anvil-warn/15 text-anvil-warn border-anvil-warn/40',
  unknown: 'bg-anvil-border/40 text-anvil-muted border-anvil-border',
  neutral: 'bg-anvil-border/40 text-slate-300 border-anvil-border',
  accent: 'bg-anvil-accent/15 text-anvil-accent border-anvil-accent/40',
};

export function Badge({
  tone = 'neutral',
  children,
}: {
  tone?: keyof typeof TONE | string;
  children: ReactNode;
}): JSX.Element {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${
        TONE[tone] ?? TONE.neutral
      }`}
    >
      {children}
    </span>
  );
}
