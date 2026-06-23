# Design: `mutation-testing` skill

**Date:** 2026-06-23
**Status:** Draft for review
**Type:** Personal superpowers-style skill (technique + discipline guardrail)
**Deploy path:** new plugin in *this* repo (the `claude-code-empowerments`
marketplace) — `plugins/mutation-testing/` (manifest + `skills/mutation-testing/
SKILL.md`), registered in `.claude-plugin/marketplace.json`. Mirrors the existing
`bake-to-completion` skill-plugin. (NOT `~/.claude/skills` — this repo is the
distributable home.)

## Problem

A passing test proves nothing about whether it would catch a regression. Real,
observed failure mode: production code that a test supposedly covers can be
changed — its behavior broken — and the suite stays green. These are *dead
tests*: green checkmarks that assert nothing meaningful, giving false
confidence.

TDD's "watch it fail" step proves a test has *grip* on the code exactly **once**,
at the moment the test is born (the missing feature is the first mutant). Nothing
re-proves grip afterward, so grip erodes silently during refactors, or is absent
from the start in inherited / tests-after suites.

## Core principle

> A test only has value if it fails when the behavior it covers breaks.

This skill re-proves grip for tests that already exist, using mutation testing:
deliberately break the code, confirm the test catches it.

## The technique — a "grip check" (mutation testing by hand)

1. Pick the behavior a test claims to cover.
2. Deliberately break that behavior in the **production** code — a *mutant*:
   flip `<` to `<=`, return a constant, delete a branch, introduce an off-by-one,
   negate a condition.
3. Run the test. **It must fail.**
4. Restore the code.
   - Failed → the test has grip. Done.
   - **Passed → dead test.** The behavior is uncovered. Route to the guardrail.

This is the TDD "watch it fail" move applied to existing code.

## The guardrail (load-bearing)

When a grip check finds a dead test, the **only** allowed response is to
write or strengthen a test whose assertion comes from **intended behavior**
(the ticket / spec / what the code *should* do), then prove the new version
fails under the mutant and passes on correct code.

Two hard prohibitions:

- ❌ **Never derive the assertion from what the code currently returns.** That
  blesses current behavior — including bugs — as the spec. The tautology trap.
- ❌ **Never change production code to make a test pass.** Direction of
  authority is fixed: code conforms to test; test conforms to intent.

Test changes are **spec-driven, never code-driven.**

## Tooling: discipline-first, frameworks optional

The core technique is the **manual** grip check above: zero dependencies,
language-agnostic, an extension of a muscle the user already has. Most repos
have no mutation framework installed, so a hard tool dependency would make the
skill un-followable most of the time.

The skill *references* real mutation-testing frameworks as an **escalation**
for auditing a whole suite or wiring into CI — examples to name, not require:
Stryker (JS/TS), `mutmut` / `cosmic-ray` (Python), PIT (Java), Stryker.NET.

## When it fires

- **Refactor time** in the TDD loop — the exact moment grip silently erodes.
- **On-demand** when a weak test is suspected ("I changed X and nothing broke").
- **Inheriting** a suite that isn't trusted.

## Scope of a single run

- **Default:** check one suspect test.
- **On request:** sweep all tests touching the code just changed.

Keeps the default fast; avoids turning every invocation into a full-suite audit.

## Skill shape

- **Type:** technique skill with a discipline guardrail.
- **Frontmatter:** `name: mutation-testing`; `description` starts with "Use
  when…", keyword-loaded for discovery — "mutation testing, dead test, tests
  pass but don't catch bugs, weak assertions, test doesn't fail, false
  confidence, inherited test suite." Description states triggers ONLY, never
  summarizes the workflow (per writing-skills SDO).
- **Flowchart:** one small flowchart, only for the dead-test routing decision
  (where agents go wrong). Everything else tables/lists.
- **Cross-reference:** `REQUIRED BACKGROUND: superpowers:test-driven-development`.
- **Rationalization table + red flags** targeting the specific failures found in
  baseline testing (candidates: "the test passes so it's fine", "let me assert
  what it returns now", "no mutation tool installed so I can't", "I'll just
  delete the dead test", "easier to tweak the code to pass").

## How the skill gets built (non-negotiable, per writing-skills)

RED-GREEN-REFACTOR for the skill itself:

1. **RED** — write pressure scenarios first: an agent handed a dead test and
   tempted to (a) assert current output, (b) delete the test, (c) edit code to
   pass. Run WITHOUT the skill; record verbatim rationalizations.
2. **GREEN** — write the skill to kill exactly those rationalizations.
3. **REFACTOR** — re-test under pressure, plug new loopholes until bulletproof.

No skill text is written before the baseline is observed.

## UI demonstration (in-repo, rides existing Pages deploy)

A pedagogical demo page makes the skill's core idea viscerally clear, in the
spirit of the user's `tdd-heartbeat` GitHub Pages demo — but hosted *inside this
repo* rather than as a standalone site.

**Integration:** a new hash route in the existing `packages/ui` React app —
`/#/demos/mutation-testing`. It reuses the app's HashRouter, the Geist/Phosphor
/Tailwind design system, and the existing `pages-deploy.yml` workflow (which
already builds `packages/ui/dist` with base `/<repo>/` and publishes on push to
`main`). No new repo, workflow, or bundle. Live URL:
`https://llamaopnv.github.io/Claude_Code_Empowerments-/#/demos/mutation-testing`.

**Metaphor — the mutant net.** The test suite is a net; mutation testing throws
mutants at it. A caught mutant is *killed* (good — the net has grip); one that
slips through *survives* (a dead spot). Color semantics are deliberate and
explained on-page, since mutation testing inverts intuition: killed = green/good,
survived = red/bad, and "the test went red" is framed as the test doing its job.

**Interactive core:**
- A tiny real function (e.g. `isAdult(age) => age >= 18`) with its test suite.
- A row of mutants (`>=`→`>`, `>=`→`<`, `return true`, `return false`,
  off-by-one). "Run mutation testing" injects each; tests flip to killed ❌ or
  survive ✅, survivors light up.
- A **grip score** gauge (mutation score) — analog of the heartbeat scorecard.
- A **Strengthen the test** toggle that adds the boundary test (`age === 18`);
  re-run, the survivor dies, gauge → 100%. The payoff moment.
- A **guardrail panel** contrasting the survivor's ❌ wrong "fixes" (assert
  current output / edit the code — the tautology trap) vs the ✅ spec-driven
  fix. Puts the skill's load-bearing rule on screen.

**Tech:** the mutation/grip logic is a small **pure-TS module**, deterministic
(results pre-computed per mutant — no real test runner in the browser), built
test-first with the existing Vitest setup. The React page renders it.

**Build order:** the skill is built and verified first (it stands alone); the
demo follows. The demo is illustrative — it does not gate the skill.

## Relationship to the broader idea

This is skill 1 of 2. Skill 2 (future, separate spec) derives tests from client
intent / tickets (Acceptance-Test-Driven Development) and shares this skill's
spec-authority principle. Building mutation-testing first because it is
self-contained and tool/ticket-independent.

## Out of scope

- Building or bundling a mutation-testing framework.
- The ticket → test skill (separate spec).
- Editing the upstream superpowers TDD skill (lives in a versioned cache).
