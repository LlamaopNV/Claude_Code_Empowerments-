# Empowerments Showcase Site — Design

**Date:** 2026-06-23
**Status:** Approved. Building the Anvil page.
**This deliverable:** the Anvil "Forge" showcase page, built onto an existing shared shell.

## Context (what already exists)

A second instance built a no-build static "skill showcase" hub. It now lives durably in this
repo under `site/` (copied out of that instance's scratchpad so it cannot be cleaned up):

```
site/
  index.html                  landing / hub  (pre-built, DO NOT rebuild)
  shared/site.css             tokens, fonts, nav, footer, buttons, code panes  (pre-built)
  shared/shell.js             injects nav + footer, sets per-page --accent     (pre-built)
  symmetric-audit/index.html  reference page  (pre-built; the quality bar)
  anvil/index.html            placeholder  <-- THIS DELIVERABLE replaces it
```

The original handoff doc is preserved at `docs/superpowers/2026-06-23-anvil-page-handoff.md`.

## Decisions (locked)

- **Site model:** one hub in this repo. Landing index links to one page per skill.
- **Publish target:** this repo's GitHub Pages, replacing the Anvil dashboard deploy. The
  dashboard code stays in the repo; it just stops being the published artifact.
- **Build:** no framework, no build step. Self-contained HTML per page + CDN Tailwind + CDN
  Phosphor + vanilla JS, sharing `site/shared/site.css` and `site/shared/shell.js`.
- **Scope of THIS work:** build `site/anvil/index.html` only, plus rewrite the Pages workflow to
  publish `site/`. The landing, shell, and symmetric-audit page are not touched.
- **Anvil metaphor:** **The Forge** as the voice (skills are forged and tempered, not shipped).
  The on-screen mechanic is the real one: an A/B eval (treatment vs baseline) judged into a
  scorecard, then an improvement loop that re-strikes and shows the before/after delta.
- **Anvil accent:** steel-blue `#6ea8e6`, set per-page via `window.SKILL_PAGE.accent`. The
  landing card for anvil already uses this color. No second brand color.
- **Maintainer sync skill:** explicit follow-up, not built here.

## Integration contract (from the shell)

`site/anvil/index.html` must:

- link `../shared/site.css` in `<head>`, load CDN Phosphor + Tailwind + the inline tailwind config;
- give `<main>` `id="top"`;
- set `window.SKILL_PAGE` (brand `skill showcase`, brandIcon `ph-stack`, accent `#6ea8e6`,
  homeUrl `../`, repoUrl, 2-4 navLinks to section anchors, optional cta, footNote) then load
  `../shared/shell.js` (it injects the nav + footer; do not hand-write them);
- reuse shell components: `.pane` / `.pane__bar` / `.pane__body` / `.row` (states `ctx`/`add`/
  `miss`/`fix`/`intent`, `.row-anim`), `.btn-primary` / `.btn-ghost` / `.btn-sm`, `.reveal`,
  `.dot`, and the `--bg*/--border*/--text*/--accent/--add/--miss/--intent/--radius` tokens.

## Anvil page anatomy (matches the symmetric-audit reference)

1. **Hero** (split). Headline: "Skills aren't shipped. They're forged." Sub (<=20 words): the A/B
   measurement in one sentence. CTAs: "See it run" (primary) and "Read the skill" (ghost). Right:
   a compact, real A/B readout (treatment vs baseline case rows) resolving to a quality.delta with
   a count-up. On load it animates once; `prefers-reduced-motion` shows the resolved end-state.
2. **The problem band.** Vibes-based iteration ("it felt better, ship it") vs a measured A/B with a
   confidence interval.
3. **Interactive core** ("Strike the skill. Read the scorecard."). Scenario chips, each mapped to a
   real Anvil dimension, drive a scripted timeline: cases stack, treatment + baseline panes stream
   per-case results, the position-swapped judge lands verdicts, a scorecard fills in Anvil's real
   format, then `anvil:improve` proposes a fix and re-strikes so the headline metric climbs and a
   before/after delta lands. Three scenarios:
   - **Won't fire** -> low `activation.recall` (false negatives in the confusion matrix); the fix
     tightens the trigger description; recall climbs to 1.0.
   - **Worse than baseline** -> `quality.delta` near zero with a CI crossing 0; the judge prefers
     baseline; the fix lifts delta to +0.69 with a CI of [0.38, 1.00] (real example numbers).
   - **Too expensive** -> quality holds but tokens-per-run are high (cost is recovered from the
     transcripts); the fix trims the skill; tokens drop with quality held inside the CI.
4. **Install / invoke.** Real commands: `/plugin marketplace add LlamaopNV/Claude_Code_Empowerments-`,
   then `/anvil:gen-testdata`, `/anvil:eval`, `/anvil:improve`. Real surface: 3 skills
   (generating-test-data, running-an-eval, improving-an-artifact), 4 agents (anvil-analyst,
   anvil-judge, anvil-task-runner, anvil-testdata-generator). Note it runs in-session on the
   subscription via subagents.
5. **Footer** injected by the shell.

### Real scorecard schema (render against this, label demo numbers as example data)

From `packages/ui/public/data/*.json` / `packages/core`:
`metrics["activation.precision"|"activation.recall"|"activation.f1"]` = `{value, unit:"ratio", n,
stdDev}`; `metrics["quality.delta"]` adds `ci:{level:0.95, lower, upper}`; `confusion` =
`{truePositive, falsePositive, trueNegative, falseNegative}`; plus `artifact{kind,name,path}`,
`judgeModel`, `runModel`, `repetitions`.

## Deploy change

Rewrite `.github/workflows/pages-deploy.yml`: drop the Node/npm/@anvil build + data-validation
steps; upload `site/` as the Pages artifact (`actions/upload-pages-artifact@v3`, `path: site`).
Keep triggers (`push` to `main` + `workflow_dispatch`), permissions, concurrency, and the deploy
job unchanged.

## Taste discipline (hard gates, enforced before ship)

Zero em-dashes or en-dashes in any visible copy. One accent (`#6ea8e6`); green/red/grey only as
semantic state inside code/scorecard readouts. Dark locked. 10px radius everywhere. Motivated
motion only, `prefers-reduced-motion` jumps to end-state, reveals via IntersectionObserver. Hero:
<=2-line headline, <=20-word sub, <=4 text elements, `min-h-[calc(100dvh-4rem)]`. Phosphor icons
only, no hand-rolled SVG icons except the bespoke metaphor visual. No fake-div product
screenshots; the interactive component is real. No 3-equal-card rows; give grids rhythm. Copy
self-audit: no AI-cute filler, no fake-precise metrics unless labeled as example data.

## Out of scope (YAGNI)

No framework/build/backend. No real eval execution (scenarios are scripted illustrations). The
maintainer-gated sync skill (regenerate landing roster from `marketplace.json`, gated to
`user.email == llama.op@gmail.com`) and per-skill pages beyond Anvil are follow-ups.
