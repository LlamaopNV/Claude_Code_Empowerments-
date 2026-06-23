import { useState } from 'react';
import {
  runMutationTesting,
  ISADULT_SCENARIO,
  BASE_TEST_IDS,
  BOUNDARY_TEST_ID,
} from './grip.js';
import {
  SHIPPING_INTENT_SCENARIO,
  type ResolutionId,
} from './intent.js';

/**
 * Two-act teaching page on test trustworthiness:
 *   Act 1 — a passing test can prove nothing (grip / mutation testing).
 *   Act 2 — a failing test can be the wrong one (establish intent first).
 * Both run on deterministic in-browser models; no real test runner.
 */
export default function TestTrustDemo(): JSX.Element {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-12">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight text-anvil-fg">
          Tests you can&rsquo;t trust
        </h1>
        <p className="text-sm text-anvil-muted">
          A green check and a red X both lie sometimes. Two ways a test betrays you &mdash; and what
          to do about each.
        </p>
      </header>
      <GripAct />
      <IntentAct />
    </div>
  );
}

function GripAct(): JSX.Element {
  const [strengthened, setStrengthened] = useState(false);
  const [hasRun, setHasRun] = useState(false);

  const activeTestIds = strengthened ? [...BASE_TEST_IDS, BOUNDARY_TEST_ID] : BASE_TEST_IDS;
  const report = runMutationTesting(ISADULT_SCENARIO, activeTestIds);
  const pct = Math.round(report.score * 100);

  return (
    <section className="flex flex-col gap-4">
      <ActHeading n={1} title="The passing test that proves nothing" />
      <p className="text-sm text-anvil-muted">
        Mutation testing breaks the code on purpose. A mutant your tests catch is{' '}
        <em>killed</em> (good). One that slips through <em>survives</em> &mdash; a dead spot your
        green suite cannot see.
      </p>

      <pre className="overflow-x-auto rounded-lg border border-anvil-border bg-anvil-bg2 p-4 font-mono text-xs text-anvil-fg">
        {ISADULT_SCENARIO.originalSource}
        {'\n\n'}
        {activeTestIds
          .map((id) => ISADULT_SCENARIO.tests.find((t) => t.id === id)?.name)
          .map((name) => `test: ${name}`)
          .join('\n')}
      </pre>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => {
            setStrengthened((s) => !s);
            setHasRun(false);
          }}
          className="rounded-lg border border-anvil-border px-3 py-1.5 text-sm text-anvil-fg hover:border-anvil-border2"
        >
          {strengthened ? 'Remove the boundary test' : 'Strengthen the test'}
        </button>
        <button
          type="button"
          onClick={() => setHasRun(true)}
          className="rounded-lg bg-anvil-accent px-3 py-1.5 text-sm font-medium text-anvil-bg hover:opacity-90"
        >
          Run mutation testing
        </button>
      </div>

      {hasRun && (
        <div className="flex flex-col gap-3">
          <div className="text-sm font-medium text-anvil-fg">
            Grip score: {pct}% &mdash; {report.survivorIds.length} survived
          </div>
          <ul className="flex flex-col gap-2">
            {report.results.map((r) => {
              const mutant = ISADULT_SCENARIO.mutants.find((m) => m.id === r.mutantId)!;
              const killed = r.status === 'killed';
              return (
                <li
                  key={r.mutantId}
                  className={`rounded-lg border-l-2 p-3 text-sm ${
                    killed
                      ? 'border-anvil-good bg-anvil-good/[0.08]'
                      : 'border-anvil-warn bg-anvil-warn/[0.08]'
                  }`}
                >
                  <span className="font-mono text-xs text-anvil-fg">{mutant.label}</span>
                  <span className={`ml-2 ${killed ? 'text-anvil-good' : 'text-anvil-warn'}`}>
                    {killed ? 'killed' : 'survived'}
                  </span>
                  <code className="mt-1 block font-mono text-[11px] text-anvil-faint">
                    {mutant.mutatedSource}
                  </code>
                  <div className="mt-0.5 text-xs text-anvil-muted">{mutant.explanation}</div>
                </li>
              );
            })}
          </ul>
          {report.survivorIds.length > 0 ? (
            <p className="text-xs text-anvil-muted">
              100% line coverage, and a regression still walks right through. Add the boundary test.
            </p>
          ) : (
            <p className="text-xs text-anvil-good">
              Every mutant dies. <em>Now</em> the suite has grip.
            </p>
          )}
        </div>
      )}
    </section>
  );
}

function IntentAct(): JSX.Element {
  const [selected, setSelected] = useState<ResolutionId | null>(null);
  const { code, test, contradiction, candidates, resolutions } = SHIPPING_INTENT_SCENARIO;
  const chosen = resolutions.find((r) => r.id === selected) ?? null;

  return (
    <section className="flex flex-col gap-4">
      <ActHeading n={2} title="The failing test that lies about intent" />
      <p className="text-sm text-anvil-muted">
        Here a test is <em>failing</em>. The reflex under pressure is to make it green the fastest
        way. But which side is even right?
      </p>

      <pre className="overflow-x-auto rounded-lg border border-anvil-border bg-anvil-bg2 p-4 font-mono text-xs text-anvil-fg">
        {code}
        {'\n\n'}
        {`test('${test.name}', () => {\n  expect(${test.call}).toBe(${test.expected}); // fails: returns 5\n});`}
      </pre>

      <p className="rounded-lg border border-anvil-warn/30 bg-anvil-warn/[0.07] p-3 text-sm text-anvil-warn/90">
        {contradiction}
      </p>

      <div className="grid gap-2 sm:grid-cols-2">
        {candidates.map((c) => (
          <div key={c.id} className="rounded-lg border border-anvil-border p-3 text-xs">
            <div className="font-mono text-anvil-fg">{c.label}</div>
            <div className="mt-1 text-anvil-muted">{c.meaning}</div>
            <div className="mt-1.5 text-anvil-faint">{c.fixes}</div>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-2">
        <div className="text-sm font-medium text-anvil-fg">What do you do?</div>
        <div className="flex flex-wrap gap-2">
          {resolutions.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => setSelected(r.id)}
              className={`rounded-lg border px-3 py-1.5 text-sm ${
                selected === r.id
                  ? 'border-anvil-accent text-anvil-fg'
                  : 'border-anvil-border text-anvil-muted hover:border-anvil-border2'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {chosen && (
        <div
          className={`rounded-lg border-l-2 p-3 text-sm ${
            chosen.safe
              ? 'border-anvil-good bg-anvil-good/[0.08]'
              : 'border-anvil-warn bg-anvil-warn/[0.08]'
          }`}
        >
          <span
            data-testid="intent-verdict"
            className={`font-semibold ${chosen.safe ? 'text-anvil-good' : 'text-anvil-warn'}`}
          >
            {chosen.safe ? 'Safe' : 'Unsafe'}
          </span>
          <p className="mt-0.5 text-xs italic text-anvil-faint">{chosen.action}</p>
          <p className="mt-1 text-anvil-muted">{chosen.verdict}</p>
        </div>
      )}
    </section>
  );
}

function ActHeading({ n, title }: { n: number; title: string }): JSX.Element {
  return (
    <div className="flex items-center gap-2">
      <span
        aria-hidden
        className="flex h-6 w-6 items-center justify-center rounded-full bg-anvil-accent/15 font-mono text-xs text-anvil-accent"
      >
        {n}
      </span>
      <h2 className="text-lg font-semibold text-anvil-fg">{title}</h2>
    </div>
  );
}
