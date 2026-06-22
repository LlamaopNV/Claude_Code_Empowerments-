import type { ReactNode } from 'react';
import { cn } from '../lib/cn.js';

/**
 * A surface card. `title` renders a header row; `action` (optional) sits on the
 * right of that row. Owned component (shadcn idiom) — never a default-state lib.
 */
export function Panel({
  title,
  action,
  children,
  className = '',
}: {
  title?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}): JSX.Element {
  return (
    <section
      className={cn(
        'rounded-xl border border-anvil-border bg-anvil-panel/70 shadow-card backdrop-blur-sm',
        title ? 'p-0' : 'p-4',
        className,
      )}
    >
      {title && (
        <header className="flex items-center justify-between gap-3 border-b border-anvil-border px-4 py-3">
          <h3 className="text-[13px] font-semibold tracking-tight text-anvil-fg">{title}</h3>
          {action}
        </header>
      )}
      {title ? <div className="p-4">{children}</div> : children}
    </section>
  );
}

export function Skeleton({ className = '' }: { className?: string }): JSX.Element {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-md bg-anvil-panel2',
        'after:absolute after:inset-0 after:-translate-x-full after:animate-shimmer',
        'after:bg-gradient-to-r after:from-transparent after:via-white/5 after:to-transparent',
        className,
      )}
    />
  );
}

export function Loading({ what = 'data' }: { what?: string }): JSX.Element {
  return (
    <div className="animate-fade-in space-y-4" role="status" aria-label={`Loading ${what}`}>
      <Skeleton className="h-9 w-56" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
      </div>
      <Skeleton className="h-64 w-full" />
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
    <div className="bg-grid animate-fade-in rounded-xl border border-dashed border-anvil-border2 bg-anvil-panel/30 p-12 text-center">
      <p className="text-lg font-semibold tracking-tight text-anvil-fg">{title}</p>
      <div className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-anvil-muted">
        {children}
      </div>
    </div>
  );
}

const TONE: Record<string, string> = {
  good: 'bg-anvil-good/15 text-anvil-good ring-anvil-good/30',
  bad: 'bg-anvil-bad/15 text-anvil-bad ring-anvil-bad/30',
  warn: 'bg-anvil-warn/15 text-anvil-warn ring-anvil-warn/30',
  mixed: 'bg-anvil-warn/15 text-anvil-warn ring-anvil-warn/30',
  unknown: 'bg-anvil-border2/40 text-anvil-muted ring-anvil-border2',
  neutral: 'bg-anvil-border2/40 text-anvil-fg/80 ring-anvil-border2',
  accent: 'bg-anvil-accent/15 text-anvil-accent ring-anvil-accent/30',
};

export function Badge({
  tone = 'neutral',
  className = '',
  children,
}: {
  tone?: keyof typeof TONE | string;
  className?: string;
  children: ReactNode;
}): JSX.Element {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset',
        TONE[tone] ?? TONE.neutral,
        className,
      )}
    >
      {children}
    </span>
  );
}

type ButtonProps = {
  variant?: 'primary' | 'ghost' | 'subtle';
  className?: string;
  children: ReactNode;
} & React.ButtonHTMLAttributes<HTMLButtonElement>;

export function Button({
  variant = 'subtle',
  className = '',
  children,
  ...rest
}: ButtonProps): JSX.Element {
  const variants: Record<string, string> = {
    primary:
      'bg-anvil-accent text-anvil-bg hover:bg-anvil-accent2 shadow-glow',
    ghost: 'text-anvil-muted hover:text-anvil-fg hover:bg-anvil-panel2',
    subtle:
      'border border-anvil-border2 bg-anvil-panel text-anvil-fg hover:border-anvil-accent/50 hover:bg-anvil-panel2',
  };
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium',
        'transition-all duration-150 active:translate-y-px focus:outline-none focus-visible:ring-2 focus-visible:ring-anvil-accent/50',
        variants[variant],
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
