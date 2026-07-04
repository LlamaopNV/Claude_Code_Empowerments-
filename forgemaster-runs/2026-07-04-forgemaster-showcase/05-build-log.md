# 05 — Build log (tests first, red → green per task)

## T1 — checks.mjs (the failing tests)

Wrote `checks.mjs` encoding AC1–AC13. Fresh run before any deliverable existed:

```
node forgemaster-runs/2026-07-04-forgemaster-showcase/checks.mjs
FAIL AC1..AC3, AC4b, AC6..AC13  (12 CHECK(S) RED)
PASS AC4a, AC5                  (environment preconditions: accent unique, existing files dash-clean)
```

RED observed. ✔

## T2 — site/forgemaster/index.html

`design-taste-frontend` invoked per the user's instruction; design read declared (devtool
showcase inside the existing dark hub, VARIANCE 6 / MOTION 6 / DENSITY 4). Page built on the
shared shell: hero (split, manifest pane), problem band (red-flags pane), run-replay demo
(stage rail + artifact tree + live run.json + events, IntersectionObserver start, replay
button, reduced-motion renders the final state instantly), owners strip, install section
with the "shipped through its own pipeline" callout.

Re-run: AC1–AC10, AC12 PASS; AC11, AC13 still red (expected — T3 scope). GREEN for T2. ✔

## T3 — landing card + TODO ledger

Feature card (col-span-2, `--c:#f2c94c`, ph-hammer) added after idea-forge, exactly filling
the plugins grid's last row (bento cell-count rule). TODO.md ledger row added.

Re-run: `ALL CHECKS GREEN` (13/13). ✔

## T4 — visual verification (headless Edge + puppeteer-core)

- Shell nav + footer injected; hero, problem, demo, owners, install all render on desktop
  (1440px), screenshots taken.
- Demo end state verified programmatically: `status=done`, all six gates
  `pass/pass/na/pass/pass/pass`, hallmark shown, 9 artifact rows, 12 event lines.
- Animated path (prefers-reduced-motion: no-preference emulated): progresses on script
  (diverge at ~2.4s, gates at ~6.4s, done at ~12.4s). Replay button restarts the run.
- Reduced-motion path (this machine's system default, reduce=true): final state renders
  instantly, no timers. Confirmed both paths.
- Zero console errors, zero page errors.
- Mobile (390px): initial render clipped long mono rows; fixed by `.pane__body
  { overflow-x: auto; }`, shorter hero pane lines, and a taste fix (two middots in one
  events line reduced to zero). Checks re-run: ALL GREEN. Mobile re-screenshot clean.

## Post-delivery fix (user report: "Watch a run" appeared to do nothing)

On machines with OS animations off (`prefers-reduced-motion: reduce`), every path rendered
the demo's end state instantly, so an explicit click on Replay or "Watch a run" showed no
change. Reworked: the reduce preference now only governs the *automatic* start (still
instant end state); an explicit user request (Replay, or any `a[href="#demo"]` link, bound
by delegation since the nav is shell-injected) steps the beats on the timed cadence with
the CSS motion effects still disabled. Skip to end stays instant. Verified on the real
reduce=true machine state: auto-start instant, replay progressive (diverge at 2.4s), nav
link restarts (intake at 1.2s), skip instant, zero console errors; checks ALL GREEN.
