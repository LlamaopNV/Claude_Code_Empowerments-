# 03 — Spec

## Scope

1. `site/forgemaster/index.html` — a self-contained showcase page on the shared shell,
   metaphor "the run record": an interactive scripted replay of a forgemaster run (stage
   rail, artifact tree, live `run.json`, gate-ledger finale with one fail → fix beat and a
   blocked premature done-write), a compact delegation strip (which specialist owns each
   stage), and an install section.
2. A forgemaster card on the landing grid (`site/index.html`), accent `#f2c94c`.
3. TODO.md showcase ledger row for forgemaster.
4. Acceptance checks encoded as a runnable node script (`checks.mjs` in this run dir, since
   `site/` is deliberately no-build and has no test infra).

## Non-goals

- No new build tooling, bundler, or test framework in `site/`.
- No changes to `site/shared/*` (the shell is frozen; per-page styles live in the page).
- No changes to the forgemaster plugin itself, the marketplace manifest, or the eval files.
- No sub-pages (idea-forge-style transcript pages); one page only.
- No live execution of anything: the demo is a scripted illustration of a run, clearly a
  storytelling component, not a fake product screenshot.

## Acceptance criteria (testable assertions — encoded 1:1 in checks.mjs)

- AC1  `site/forgemaster/index.html` exists and is non-empty.
- AC2  It references `../shared/site.css` in `<head>` and loads `../shared/shell.js`.
- AC3  It sets `window.SKILL_PAGE` with `accent: '#f2c94c'` and `homeUrl: '../'`.
- AC4  `#f2c94c` appears in no other `site/*/index.html` and no other hub accent hex
       (`#6ea8e6 #e8a33d #9d8cf5 #ee6f9e #cd7cf0 #3fc9b0 #ff7849 #7c6cf0 #e5675f #3bbdd6`)
       appears in the new page (semantic `--add`/`--miss`/`--intent` vars are the only
       state colors).
- AC5  Zero em-dashes (U+2014) and en-dashes (U+2013) anywhere in the new/changed files.
- AC6  Icons: Phosphor CDN is loaded; the page contains no inline `<svg`.
- AC7  `<main id="top">` present; no hand-written `<header` or `<footer` tag (shell injects
       both).
- AC8  Tailwind CDN + config maps `accent: 'var(--accent)'`.
- AC9  Motion: no `addEventListener('scroll'`; the file contains
       `prefers-reduced-motion` handling; reveal-on-scroll uses IntersectionObserver.
- AC10 Every `navLinks` anchor (`#...`) exists as an `id` in the page.
- AC11 `site/index.html` has a card `href="./forgemaster/"` with `--c:#f2c94c`.
- AC12 All local asset references in the new page are relative (no `src="/` or `href="/`).
- AC13 TODO.md ledger lists forgemaster with `#f2c94c`.

Non-mechanical criteria (verified at spec_review/self_critique, not by script): hero
discipline (max 2-line headline, CTA above fold, max 4 hero text elements), no generic
3-equal feature cards, eyebrows rationed, copy self-audit, dark theme locked, one radius
system.

## Definition of done

The six manifest gates, where:
- **tests** = `node checks.mjs` green (all ACs), run fresh, output recorded.
- **lint** = repo lint clean over the change set (site/ is eslint-excluded by design; the
  gate still runs the repo linter to prove nothing else regressed).
- **types** = `na` expected (no typed surface in the deliverable) unless repo typecheck
  covers touched files.
- **spec_review** = this file walked criterion by criterion against the deliverable.
- **code_review** + **self_critique** = per the skill's stage 5.
