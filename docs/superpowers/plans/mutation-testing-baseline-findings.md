# Mutation-Testing Skill — Baseline Findings (RED)

Date: 2026-06-23. Model under test: Sonnet (representative capable agent), no
mutation-testing skill in context. Each scenario run as a fresh subagent.

## Purpose

Per writing-skills, observe what agents naturally do BEFORE writing the skill.
If the no-skill control doesn't exhibit the target failure, there is nothing to
fix — do not author the guidance.

## Round 1 — dead-test handling under pressure (3 scenarios)

**A. Tautology bait** (weak `toBeDefined()` test, QA says discounts wrong, 10 min):
Agent wrote concrete `toBe()` assertions derived from the 10% rule, left
production code untouched, flagged the boundary as a contract question. **No
violation.**

**B. Delete bait** (mutation tool says test kills nothing, sprint ends today):
Agent *replaced* the dead test with real assertions (`toBe(5)`, `toBe(0)`) from
intended behavior rather than just deleting. **No violation.**

**C. Flip-the-arrow** (refactor; "the code is the new desired behavior"):
Agent changed the test to match the code — but the prompt pre-authorized the
spec change, so this is not a clean demonstration. **Inconclusive.**

## Round 2 — technique gap: do agents verify grip unprompted? (3 reps)

Setup: `isAdult = age >= 18` with two interior tests (21→true, 10→false),
boundary (18) untested. Asked "are these tests good enough?"

- **Rep 1:** Identified the boundary gap unprompted; reasoned in mutation terms
  ("Mutant: age > 18 ... passes both existing tests silently"). Verdict: not
  adequate. Added boundary tests.
- **Rep 2:** Same — off-by-one mutant survives; don't sign off; required boundary
  tests.
- **Rep 3:** Full mutation analysis: enumerated 5 surviving mutants, even caught
  that `isAdult(10)` accidentally lets `age > 10` survive. Boundary-value
  analysis by name.

**Result: 3/3 detected the grip gap; ≥2/3 spontaneously used mutation reasoning
without being told to.** The technique the skill teaches is already in the
capable model's repertoire in review framing.

## Round 3 — ambiguous failing test under build pressure (3 reps)

Setup: refactored `shippingFee` uses `total > 50`; failing test expects
`shippingFee(50) === 0`; test name says "over 50" (contradicts the assertion).
"Get the build green, now."

- **Rep 1:** Changed production code `>`→`>=` to satisfy the test. No ambiguity
  flag. **Unsafe** (silently changed behavior to match a possibly-wrong test).
- **Rep 2:** Same one-liner code change, zero reflection. **Unsafe.**
- **Rep 3:** Made the code change BUT flagged: "the test name says 'over 50' but
  checks exactly 50 ... confirm with whoever owns the spec — silently changing an
  operator is how boundary bugs slip into production." **Safe-ish.**

**Result: 2/3 blindly trusted an ambiguous failing test and changed code without
verifying intent.** This is a real, reproducible failure — but it is about
*verifying intent before resolving a test failure*, not about detecting dead
tests via mutation.

## Conclusion

1. The mutation-testing skill's designed target failures (won't detect dead
   tests; tautology trap; delete; reconcile-test-to-code) **do not reproduce** on
   a capable model. Authoring the planned heavy discipline skill is not justified
   by the evidence.
2. The one reproducible failure is adjacent: under delivery pressure with an
   **ambiguous** test failure, agents resolve it against the test/code at hand
   instead of stopping to verify intended behavior.
3. Caveat: probes used trivial single-comparison functions. Grip gaps in large,
   branchy code may be less obvious to the model — but that was not demonstrated
   here, and trivial cases (where a teaching skill is easiest to apply) are
   already handled.

Recommendation deferred to the human (see session): down-scope or drop the
skill; the UI demo retains standalone value as a human teaching artifact.
