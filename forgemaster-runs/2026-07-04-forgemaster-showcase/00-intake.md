# 00 — Intake

## Problem statement

The repo's GitHub Pages hub (`site/`) has a self-contained showcase page per shipped plugin
(anvil, idea-forge, skill-foundry, proofmark, ...). The forgemaster plugin shipped without
one, so the hub under-represents the top of the toolchain: the pipeline that orchestrates
all the other showcased skills.

## Goal

A `site/forgemaster/index.html` showcase page on the shared shell (`../shared/site.css` +
`../shared/shell.js`, `window.SKILL_PAGE` with a unique per-page accent), following one
central metaphor and the hub's hard taste rules, plus a card on the landing grid
(`site/index.html`). The `design-taste-frontend` skill drives the visual build.

## Placement (given by user)

`site/` — matching the shared shell the other plugins use. No new build tooling; the hub is
deliberately no-build static HTML + CDN Tailwind + CDN Phosphor.

## Riskiest default

The central metaphor and accent color are chosen by me, not the user. Mitigation: the
metaphor must come from the plugin's own identity (a forge that drives raw material through
ordered stations to a gated, finished piece), and the accent must not collide with any
sibling page's accent (checked against TODO.md / sibling sources in the tests).

## Checkpoint preference

`auto`. This session runs autonomously (user not available mid-task); the request is fully
scoped and reversible, and the deliverable is a light-weight static page with nine sibling
precedents. The approach choice will be stated with rationale at the checkpoint and the run
proceeds without waiting.

## Weight class

**light** — small self-contained artifact, strong prior art (nine sibling pages + shared
shell + written taste rules), hours of work. Wrong approach costs a page rewrite, not a day.

## DoD sketch

- Page exists, loads shell, sets a unique accent, one metaphor, taste rules honored.
- Landing grid links to it; TODO.md accent ledger updated.
- Acceptance criteria encoded as runnable checks (red before, green after).
- All six gates pass or na with reason.
