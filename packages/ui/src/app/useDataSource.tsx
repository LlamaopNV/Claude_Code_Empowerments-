/**
 * React context that resolves the dual-mode data source once and shares it.
 */
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { createDataSource, type AnvilDataSource } from '../dataLayer.js';

interface DataSourceState {
  source: AnvilDataSource | null;
  error: string | null;
}

const Ctx = createContext<DataSourceState>({ source: null, error: null });

export function DataSourceProvider({ children }: { children: ReactNode }): JSX.Element {
  const [state, setState] = useState<DataSourceState>({ source: null, error: null });

  useEffect(() => {
    let cancelled = false;
    createDataSource()
      .then((source) => {
        if (!cancelled) setState({ source, error: null });
      })
      .catch((e: unknown) => {
        if (!cancelled) setState({ source: null, error: String(e) });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return <Ctx.Provider value={state}>{children}</Ctx.Provider>;
}

export function useDataSource(): DataSourceState {
  return useContext(Ctx);
}
