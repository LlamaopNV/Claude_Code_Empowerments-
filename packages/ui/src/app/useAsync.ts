import { useEffect, useState } from 'react';

export type AsyncState<T> =
  | { status: 'loading' }
  | { status: 'error'; error: string }
  | { status: 'ready'; data: T };

/**
 * Run an async loader when its deps change. `enabled=false` keeps it loading
 * (used while the data source is still resolving).
 */
export function useAsync<T>(
  loader: () => Promise<T>,
  deps: ReadonlyArray<unknown>,
  enabled = true,
): AsyncState<T> {
  const [state, setState] = useState<AsyncState<T>>({ status: 'loading' });

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    setState({ status: 'loading' });
    loader()
      .then((data) => {
        if (!cancelled) setState({ status: 'ready', data });
      })
      .catch((e: unknown) => {
        if (!cancelled) setState({ status: 'error', error: String(e) });
      });
    return () => {
      cancelled = true;
    };
    // Deps are caller-provided via the `deps` array; `loader` is intentionally
    // not a dep (it is recreated each render but keyed by `deps`).
  }, [enabled, ...deps]);

  return state;
}
