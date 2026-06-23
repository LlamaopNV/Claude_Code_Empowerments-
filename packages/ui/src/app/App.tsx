import { Link, Route, Routes } from 'react-router-dom';
import { Lightning, Warning } from '@phosphor-icons/react';
import { DataSourceProvider, useDataSource } from './useDataSource.js';
import { Leaderboard } from '../pages/Leaderboard.js';
import { ScorecardPage } from '../pages/ScorecardPage.js';
import TestTrustDemo from '../demos/test-trust/TestTrustDemo.js';
import { Badge } from '../components/primitives.js';

export function App(): JSX.Element {
  return (
    <DataSourceProvider>
      <div className="flex min-h-full flex-col">
        <Header />
        <SampleDataBanner />
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
          <Routes>
            <Route path="/" element={<Leaderboard />} />
            <Route path="/run/:runId" element={<ScorecardPage />} />
            <Route path="/demos/test-trust" element={<TestTrustDemo />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </main>
        <Footer />
      </div>
    </DataSourceProvider>
  );
}

function Header(): JSX.Element {
  const { source } = useDataSource();
  return (
    <header className="sticky top-0 z-20 border-b border-anvil-border bg-anvil-bg/75 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
        <Link to="/" className="group flex items-center gap-2.5">
          <span
            aria-hidden
            className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-anvil-accent to-[#3b7de0] text-anvil-bg shadow-glow transition-transform group-hover:scale-105"
          >
            <Lightning weight="fill" size={16} />
          </span>
          <span className="text-[15px] font-semibold tracking-tight text-anvil-fg">Anvil</span>
          <span className="hidden text-xs text-anvil-muted sm:inline">effectiveness dashboard</span>
        </Link>
        <nav className="ml-6 hidden items-center gap-4 text-sm sm:flex">
          <Link to="/demos/test-trust" className="text-anvil-muted transition-colors hover:text-anvil-fg">
            Test-trust demo
          </Link>
        </nav>
        <div className="ml-auto">
          {source ? (
            <Badge tone={source.mode === 'live' ? 'good' : 'neutral'}>
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  source.mode === 'live' ? 'bg-anvil-good' : 'bg-anvil-faint'
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
 * Static (GitHub Pages) mode ships committed, hand-curated illustrative
 * scorecards so the public site has something to render without a live server.
 * They are NOT real measured runs, so a banner makes that unmistakable. Live
 * mode (a reachable Anvil server) shows real recorded runs, so it is suppressed.
 */
function SampleDataBanner(): JSX.Element | null {
  const { source } = useDataSource();
  if (!source || source.mode !== 'static') return null;
  return (
    <div className="border-b border-anvil-warn/30 bg-anvil-warn/[0.07] text-anvil-warn">
      <div className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-2 text-sm">
        <Warning weight="fill" size={15} className="shrink-0" />
        <span className="text-anvil-warn/90">
          <strong className="text-anvil-warn">Illustrative sample data.</strong> Hand-curated
          examples that demonstrate the dashboard. They are not real measured eval runs. Run{' '}
          <code className="rounded bg-anvil-bg px-1 font-mono text-xs">/anvil-eval</code> on your own
          subscription and open the live dashboard for real numbers.
        </span>
      </div>
    </div>
  );
}

function Footer(): JSX.Element {
  return (
    <footer className="border-t border-anvil-border">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-4 text-xs text-anvil-faint">
        <span>Anvil: native effectiveness evals for Claude Code artifacts.</span>
        <span className="font-mono">activation · quality-delta · cost</span>
      </div>
    </footer>
  );
}

function NotFound(): JSX.Element {
  return (
    <div className="bg-grid animate-fade-in rounded-xl border border-dashed border-anvil-border2 p-12 text-center">
      <p className="text-lg font-semibold text-anvil-fg">Not found.</p>
      <Link to="/" className="mt-1 inline-block text-sm text-anvil-accent hover:underline">
        Back to the leaderboard
      </Link>
    </div>
  );
}
