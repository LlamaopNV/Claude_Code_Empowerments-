import { Link, Route, Routes } from 'react-router-dom';
import { DataSourceProvider, useDataSource } from './useDataSource.js';
import { Leaderboard } from '../pages/Leaderboard.js';
import { ScorecardPage } from '../pages/ScorecardPage.js';
import { Badge } from '../components/primitives.js';

export function App(): JSX.Element {
  return (
    <DataSourceProvider>
      <div className="min-h-full">
        <Header />
        <SampleDataBanner />
        <main className="mx-auto max-w-6xl px-4 py-6">
          <Routes>
            <Route path="/" element={<Leaderboard />} />
            <Route path="/run/:runId" element={<ScorecardPage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </main>
      </div>
    </DataSourceProvider>
  );
}

function Header(): JSX.Element {
  const { source } = useDataSource();
  return (
    <header className="sticky top-0 z-20 border-b border-anvil-border bg-anvil-bg/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
        <Link to="/" className="group flex items-center gap-2.5">
          <span
            aria-hidden
            className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-anvil-accent to-anvil-accent2 text-sm font-black text-anvil-bg shadow-glow transition-transform group-hover:scale-105"
          >
            A
          </span>
          <span className="text-lg font-bold tracking-tight text-slate-100">Anvil</span>
          <span className="hidden text-xs text-anvil-muted sm:inline">effectiveness dashboard</span>
        </Link>
        <div className="ml-auto">
          {source ? (
            <Badge tone={source.mode === 'live' ? 'good' : 'neutral'}>
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  source.mode === 'live' ? 'bg-anvil-good' : 'bg-anvil-muted'
                }`}
              />
              {source.mode === 'live' ? 'live server' : 'static demo'}
            </Badge>
          ) : (
            <Badge tone="warn">connecting…</Badge>
          )}
        </div>
      </div>
    </header>
  );
}

/**
 * Static (GitHub Pages) mode ships committed, hand-curated **illustrative**
 * scorecards so the public site has something to render without a live server.
 * They are NOT real measured runs — make that unmistakable with a banner so a
 * visitor never reads the demo numbers as a benchmark. Live mode (a reachable
 * Anvil server) shows real recorded runs, so the banner is suppressed there.
 */
function SampleDataBanner(): JSX.Element | null {
  const { source } = useDataSource();
  if (!source || source.mode !== 'static') return null;
  return (
    <div className="border-b border-amber-500/40 bg-amber-500/10 text-amber-200">
      <div className="mx-auto max-w-6xl px-4 py-2 text-sm">
        <strong>Illustrative sample data.</strong> These scorecards are hand-curated examples to
        demonstrate the dashboard — not real measured eval runs. Run{' '}
        <code className="rounded bg-anvil-bg px-1">/anvil-eval</code> on your own subscription and
        open the live dashboard to see real numbers.
      </div>
    </div>
  );
}

function NotFound(): JSX.Element {
  return (
    <div className="text-center text-anvil-muted">
      <p className="text-lg">Not found.</p>
      <Link to="/" className="text-anvil-accent hover:underline">
        Back to the leaderboard
      </Link>
    </div>
  );
}
