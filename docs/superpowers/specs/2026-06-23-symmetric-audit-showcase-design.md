# Symmetric Audit — Showcase Page Design

**Date:** 2026-06-23
**Status:** Approved design, pre-build
**Artifact:** A single self-contained `index.html` showcase for the `symmetric-audit` skill,
in the spirit of [tdd-heartbeat](https://llamaopnv.github.io/tdd-heartbeat/). Built in the
scratchpad first; publish target decided after first look.

## Goal

A small, premium, scroll-driven landing page that showcases **real-world use cases** of the
`symmetric-audit` skill — the way tdd-heartbeat showcases TDD through one central metaphor.

## Design Read

Reading this as: a developer-tool showcase for engineers who write CRUD apps, with a
dark-tech / editorial language built on one literal metaphor (**the cracked mirror**),
leaning toward native CSS + CDN Tailwind utilities + Geist / Geist Mono + scroll-driven motion.

**Dials:** `DESIGN_VARIANCE 7 · MOTION_INTENSITY 6 · VISUAL_DENSITY 4`.

Stack note: the design-taste skill defaults to a React/Next/Tailwind/Motion build. We keep its
*principles* (design read, dials, anti-center bias, motivated motion, contrast + copy audits,
em-dash ban, one accent locked) but adapt the *stack* to a single openable `index.html`
(CDN Tailwind + vanilla JS, no build step) so the page can be opened locally and published as a
static GitHub Pages site — matching how tdd-heartbeat ships.

## Central Concept — "The Mirror"

The page is built on bilateral symmetry. A change enters on the **left** (the surface you
edited). The page asks: did it reflect on the **right** (the sibling you forgot)? When it does
not, the mirror **cracks** along the center seam — and that crack *is* the bug. Running the
audit **heals** the glass.

Three glass states map to the skill's three verdicts:

- **In sync** → glass intact, faint reflection.
- **Diverged** → crack draws down the seam, then heals as the equivalent fix lands.
- **Intentionally asymmetric** → frosted / one-way glass, deliberately not reflected (the
  nuance that stops reflexive mirroring).

## Page Structure

1. **Hero** — split 50/50, hairline seam down the middle. Left: a `create` surface gaining a
   field. Right: the `update` twin, untouched. Headline: *"The bug isn't in the file you
   changed."* Sub: *"It's in the sibling you forgot."* On load, the right side fails to update
   and a crack draws down the seam. Single primary CTA → "See it run". (Hero obeys taste hard
   rules: ≤2-line headline, ≤20-word sub, max 4 text elements, fits one viewport, `min-h-[100dvh]`.)
2. **The cost** — one short section on why this slips through: the diff looks complete, CI is
   green, the gap only surfaces in production.
3. **Pick a change** (interactive core) — visitor selects one of 5 scenarios; the Mirror
   replays it: left surface changes → audit enumerates siblings → each renders a verdict →
   the diverged sibling cracks then heals as the fix lands. Ends on the audit summary block.
4. **The three verdicts** — in sync / diverged / intentionally asymmetric, each with its glass
   state and a one-line definition.
5. **How to run it** — invocation (`/symmetric-audit`), trigger phrases, where it fits
   (mid-task, pre-commit, Step 1 of `iterative-review-fix`), and the one-line install via
   skill-installer.
6. **Footer** — link to the skill source and to skill-installer.

## The 5 Real-World Scenarios (stack-generic)

Code snippets are written in neutral pseudo-TS that does **not** assume a specific ORM or
framework (no Prisma/Drizzle/Django-specific calls). Each is a true divergence class the skill
catches:

1. **The forgotten edit form** — add `phoneNumber` to the user entity; the create form gets it,
   the edit form does not. → *diverged → fixed*
2. **The unguarded sibling route** — add an `isAdmin` guard to `GET /reports`; its family member
   `GET /reports/export` stays open. → *security divergence → fixed*
3. **The half-handled enum** — extend `OrderStatus` with `REFUNDED`; the status badge handles it,
   the filter dropdown throws on the unknown value. → *diverged → fixed*
4. **The projection gap** — a new `archivedAt` on the write path never enters the list query's
   projection, so the UI can never read it back. → *read/write asymmetry → fixed*
5. **The deliberate omission** — `password` accepted on create, intentionally absent from edit.
   → *intentionally asymmetric — not a bug* (demonstrates verdict #3, prevents over-mirroring).

## Motion Plan (motivated, per taste skill)

- **Hero seam crack** on load — communicates the core failure mode (storytelling). Respects
  `prefers-reduced-motion`: reduced → show the cracked end-state statically, no animation.
- **Scenario replay** — sequenced reveal of siblings + verdicts (storytelling + state change).
- **Scroll-reveal stagger** on the verdicts + how-to sections (`IntersectionObserver`, run once).
- No marquee. No infinite loops. Each animation has a one-sentence justification or it is cut.

## Guardrails (taste pre-flight, enforced before ship)

- One accent color locked page-wide (an "alert" hue for cracks; neutral zinc/slate base, dark theme).
- Em-dashes banned in visible copy (use periods / restructure). Real typographic quotes only.
- Every CTA + badge passes WCAG AA contrast. Buttons fit one line. One CTA intent.
- Copy self-audit: no fake-precise invented metrics; no AI-cute filler.
- Page theme locked dark; no section inverts.
- Single accessible `index.html`; works with JS for animation but the content is readable without it.

## Out of Scope (YAGNI)

- No build tooling, no framework, no package install.
- No backend, no analytics, no real audit execution — the scenarios are scripted illustrations.
- Publishing/deploy is a follow-up decision after the first local look.
