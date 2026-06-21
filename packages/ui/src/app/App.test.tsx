import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { DataSourceProvider } from './useDataSource.js';
import { Leaderboard } from '../pages/Leaderboard.js';
import { ScorecardPage } from '../pages/ScorecardPage.js';

const here = dirname(fileURLToPath(import.meta.url));
const fixtures = resolve(here, '../../../core/fixtures');
const read = (n: string) => JSON.parse(readFileSync(resolve(fixtures, n), 'utf8'));

/**
 * Wire a static data source by stubbing the global fetch the data layer uses,
 * AND failing the live probe so createDataSource() falls back to static.
 */
function installFetch(): void {
  const routes: Record<string, unknown> = {
    'data/index.json': read('index.json'),
    'data/demo/run-2026-06-21-bake-001.json': read('result.scorecard.json'),
    'data/traces/agent-aa11bb22cc33dd44.json': read('runtrace.subagent.json'),
  };
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/')) {
        // live probe fails → static fallback
        return { ok: false, status: 503, json: async () => ({}) } as Response;
      }
      const key = Object.keys(routes).find((k) => url.includes(k));
      if (!key) return { ok: false, status: 404, json: async () => ({}) } as Response;
      return { ok: true, status: 200, json: async () => routes[key] } as Response;
    }),
  );
}

beforeEach(() => {
  installFetch();
});

describe('Leaderboard', () => {
  it('renders the fixture artifact with its headline scores', async () => {
    render(
      <MemoryRouter>
        <DataSourceProvider>
          <Leaderboard />
        </DataSourceProvider>
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByText('bake-to-completion')).toBeInTheDocument());
    // Quality delta headline (+42.0%) is shown.
    expect(screen.getByText('+42.0%')).toBeInTheDocument();
  });
});

describe('Leaderboard (empty)', () => {
  it('shows the empty state explaining how to generate data', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('/api/'))
          return { ok: false, status: 503, json: async () => ({}) } as Response;
        if (url.includes('data/index.json'))
          return {
            ok: true,
            status: 200,
            json: async () => ({ schemaVersion: 1, runs: [] }),
          } as Response;
        return { ok: false, status: 404, json: async () => ({}) } as Response;
      }),
    );
    render(
      <MemoryRouter>
        <DataSourceProvider>
          <Leaderboard />
        </DataSourceProvider>
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByText('No eval runs yet')).toBeInTheDocument());
    expect(screen.getByText(/\/anvil-eval/)).toBeInTheDocument();
  });
});

describe('ScorecardPage (missing metric — adversarial)', () => {
  it('renders without crashing when quality.delta is absent', async () => {
    const card = read('result.scorecard.json') as { metrics: Record<string, unknown> };
    delete card.metrics['quality.delta'];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('/api/'))
          return { ok: false, status: 503, json: async () => ({}) } as Response;
        if (url.includes('run-2026-06-21-bake-001.json'))
          return { ok: true, status: 200, json: async () => card } as Response;
        if (url.includes('traces/'))
          return { ok: false, status: 404, json: async () => ({}) } as Response;
        return { ok: false, status: 404, json: async () => ({}) } as Response;
      }),
    );
    render(
      <MemoryRouter initialEntries={['/run/run-2026-06-21-bake-001']}>
        <DataSourceProvider>
          <Routes>
            <Route path="/run/:runId" element={<ScorecardPage />} />
          </Routes>
        </DataSourceProvider>
      </MemoryRouter>,
    );
    // Confusion matrix still renders; the quality-delta tile degrades to "—".
    await waitFor(() =>
      expect(screen.getByText('Activation confusion matrix')).toBeInTheDocument(),
    );
    expect(screen.getByText('Inconclusive')).toBeInTheDocument();
  });
});

describe('ScorecardPage', () => {
  it('renders metrics incl. a CI, the confusion matrix, and a verdict', async () => {
    render(
      <MemoryRouter initialEntries={['/run/run-2026-06-21-bake-001']}>
        <DataSourceProvider>
          <Routes>
            <Route path="/run/:runId" element={<ScorecardPage />} />
          </Routes>
        </DataSourceProvider>
      </MemoryRouter>,
    );

    // Verdict
    await waitFor(() =>
      expect(screen.getByText('Helps — measurable improvement')).toBeInTheDocument(),
    );
    // A confidence interval is rendered (quality delta CI).
    expect(screen.getByText('95% CI [18.0%, 66.0%]')).toBeInTheDocument();
    // Confusion matrix labels + an offending FN case id.
    expect(screen.getByText('Activation confusion matrix')).toBeInTheDocument();
    // The false-negative offender id appears (in the matrix list and the case row).
    expect(screen.getAllByText('sf-pressure-test-concept').length).toBeGreaterThan(0);
  });
});
