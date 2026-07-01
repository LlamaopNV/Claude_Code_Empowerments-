---
name: idea-forge
description: Use when the user has ONE clarified, high-stakes idea they want maximally hardened/stress-tested before committing - runs an adversarial king-of-the-hill LADDER (8 rival variants, a pre-screened best original seeded as champion, each rung grafts the challenger's strongest compatible fix into a running merge) and returns one reinforced idea that is PROVABLY no worse than the best original, plus a full transcript. Use AFTER an idea is clear (e.g. after bake-to-completion), not for vague or many-idea triage. Expensive - confirm cost first.
---

# idea-forge

## Overview

Harden a single idea by making rival versions of it **fight**, then **compounding** the survivor's hardening graft by graft. Spawn 8 high-reasoning agents that each produce a distinct improved variant. Pre-screen them in one cheap pass to name the strongest as **champion-zero** and freeze a pristine copy in **reserve**. Then run a **king-of-the-hill ladder**: the champion holds the hill while each remaining variant challenges it once; every rung grafts the challenger's single strongest *compatible* mechanism into a **running merge**, re-validating it against everything grafted before and against the previous champion. A final **audit rung** pits the accumulated champion against the reserved best original - if the accumulation didn't actually beat the pristine original, the original ships. Output: the hardened idea + a transcript of why every rejected direction lost and every graft survived.

**Core principle:** The value is NOT selecting the best of 8. It is **reinforcement under selection, audited at the artifact level** - the champion is amended by the strongest *compatible* criticism from every rung, and the synthesizer (the merge) is held to the same evidentiary standard as the selector (the judge). Two guarantees make this real:
- **The merge is audited, not asserted.** Every graft must prove non-contradiction against the running **graft ledger** AND must match-or-beat the immediately previous champion, or it is rolled back.
- **The shipped artifact is measured, not claimed.** The central promise - "better than the single best original" - is a *gate*, not a slogan: the accumulated champion must clear a calibrated margin over the reserved original or the original ships.

If you remove the ledger and the audits, you have a path-dependent chimera that can quietly end up worse than one of its parents. The audited merge is the product.

## When to use

- The user has **one clarified idea** (a sentence/paragraph) and says "harden it / stress-test it / pressure-test / make it bulletproof / run it through the gauntlet / forge it."
- The stakes justify the cost: being wrong is expensive, and the idea is specific enough to attack.
- Natural upstream: `bake-to-completion` clarifies an idea; idea-forge then hardens it. **bake -> forge.**

## When NOT to use (read this before spawning anything)

| Situation | Use instead |
|-----------|-------------|
| Idea is vague / not yet defined | `bake-to-completion` first - forge cannot harden mush. |
| User has many ideas to triage / pick among | A breadth/ranking tool - forge is depth-on-one. |
| User wants a build plan or architecture | `superpowers:writing-plans` / `brainstorming`. |
| Low stakes, or user wants a quick take | A single critique pass. Forge is ~18-24 Opus calls - overkill. |
| Budget/latency sensitive right now | Offer **lite mode** (4 contenders) or decline. |

**Cost honesty:** a full forge spawns 8 contender agents + 1 pre-screen + a 7-rung ladder (1-3 calls per rung) + 1 audit rung ≈ **18-24 high-reasoning (Opus) agent calls** and several minutes. This is *fewer* than a 7-debate bracket because each rung spends **one** call by default (a contested near-tie spends a second; a ledger-conflict edit or a regressed merge spends a third) versus six per debate - but it is still expensive. ALWAYS state the expected cost and get a go-ahead before spawning. Offer lite mode.

## Input

A single idea as a sentence or short paragraph (the "seed"). If the user gives more than one idea, ask which ONE to forge. If the seed is too vague to attack (no concrete claim, user, or mechanism), stop and recommend `bake-to-completion` first.

## The mechanism (precise enough to execute without guessing)

> The exact agent-spawn sequence, prompts, and logging are in the companion **`run-tournament.md`** (the executor playbook). This section defines the rules; `run-tournament.md` defines the operations.

### 1. Round 0 - generate 8 contenders
Spawn **8 agents** (Opus, high reasoning effort). Each receives the seed and **one distinct improvement axis** so the variants genuinely diverge instead of rewording each other. Default axes:

1. **Sharpen the core value** - make the central benefit undeniable.
2. **Maximize differentiation** - make it hard to copy / clearly unlike alternatives.
3. **Minimize feasibility/cost risk** - make it the most buildable/shippable version, with the lowest cost-and-effort risk to stand it up.
4. **Attack & repair the core assumption** - find the load-bearing assumption and redesign so it matters less.
5. **Expand the opportunity** - bigger market / wider applicability without losing focus.
6. **Narrow to a wedge** - the smallest beachhead version that wins a niche completely.
7. **Maximize defensibility/durability** - moat, compounding advantage, hard to erode.
8. **Radical reframe** - solve the underlying need a structurally different way.

Each contender returns **(a)** the improved variant (a tight paragraph), and **(b)** a rationale - why these changes make it stronger, plus its single biggest self-identified weakness. These 8 are the ladder entrants.

### 2. Seed - pre-screen, name champion-zero, freeze the reserve (1 cheap Opus call)
Run **one** Opus pass over all 8 variants. It **ranks** them on the 5 criteria below and names the strongest as **champion-zero**. This matters: the ladder's incumbency advantage must accrue to the *a-priori-best* variant, not to whoever happened to be spawned first.

- **champion-zero** = rank #1. It begins as the champion and starts accumulating grafts.
- **RESERVE** = a *frozen, pristine copy* of champion-zero's text. It never changes and is never grafted. It exists to backstop the entire run (Step 6).
- **Challenger order** = the other 7 variants, entering the ladder in *descending* rank order (strongest challenger first), so strong mechanisms surface early.

The pre-screen is a single unverified judgment; the final audit rung (Step 6) is what guards against it mis-ranking. Note this honestly in the transcript.

### 3. The ladder - one gated Opus call per rung (king-of-the-hill)
The champion **holds the hill** for the whole ladder; challengers are **graft sources, never wholesale replacements**. (Replacement would throw away accumulated hardening; the floor guarantee comes from the audit rung, not from swapping in a challenger.) Each rung is **one Opus call** that returns this **ordered, gated chain** - work the steps in order, do not reorder:

- **(a) steelman_both** - the strongest honest case FOR the champion and FOR the challenger.
- **(b) scores** - score *both* on the 5 criteria (1-5). Each criterion MUST **quote its verbatim rubric line** and **cite the steelman point** that justifies the score. Sum each (max 25).
- **(c) winner** - name champion or challenger, with explicit **MARGIN** (= winner_sum − loser_sum) and a one-sentence dominance assertion. *The named winner must be the higher-sum side; the orchestrator retries the call once if the verdict contradicts its own scores.*
- **(d) loser_salvage** - the **loser's single strongest valid OBJECTION** to the winner, plus the loser's **single strongest mutually-compatible MECHANISM**, or an explicit `NOTHING-COMPATIBLE` flag (which ends the rung with no merge).
- **(e) carry_forward (MERGE)** - a before/after/change merge **grafting both the objection-fix and the mechanism into the champion** (not the challenger). See §4 for the ledger check.
- **(f) predecessor_audit** - re-score the merged champion against the **immediately previous** champion on the same 5 criteria (see §5).

Selection and synthesis are **decoupled**: the rung records a winner regardless of whether the merge survives. The champion only ever *accumulates*; it is never replaced by a challenger.

### Judging criteria (the same 5 every rung) - quote the verbatim rubric line
| Criterion | Verbatim rubric line the judge MUST quote |
|-----------|--------------------------------------------|
| **Impact** | "Impact - if true, it materially changes outcomes for the named target user, not a marginal nicety." |
| **Feasibility & cost** | "Feasibility & cost - it can be built and shipped with realistic resources, and the cost/effort risk of standing it up is low." |
| **Robustness** | "Robustness - it survives the strongest objection raised against it in this rung's steelman." |
| **Defensibility** | "Defensibility - it is hard for a competitor to copy or for time to erode." |
| **Clarity** | "Clarity - it is specific and unambiguous, with a concrete user and mechanism, not hand-wavy." |

Quoting the rubric line (and the steelman point that justifies each score) forces grounding and reduces length/confidence bias. Score = sum of the 5 (max 25).

### Calibration - the noise floor and the swapped recheck
Margins inside the judge's noise are not real signal. The noise floor is **~1 summed point** (out of 25, i.e. ~1 of the 5 criterion-points).
- **MARGIN ≥ 2:** auto-certify the rung verdict.
- **MARGIN ≤ 1 (inside the band):** spend **one** fresh **position-SWAPPED** judgment with the prior verdict hidden. **Agree** → certify. **Disagree** → that disagreement *is* the variance: **incumbency holds** (the champion keeps the hill and is recorded as the rung winner).

This same noise floor gates the audit rung (Step 6).

### 4. Composable compatibility - the graft ledger
The champion carries a **GRAFT LEDGER**: one line per accepted graft (`[id] rung R, challenger #k (axis): <mechanism> - must not contradict: <guard>`). "Compatible" is **not** a one-shot local guess; it is a **re-validated, composable predicate**:

- Field **(e)** must assert the new graft's **non-contradiction against EACH live ledger entry**, not just against the current prose.
- A flagged **CONFLICT does not silently accumulate.** It forces the existing **escape-hatch edit call** to **RESOLVE** it: keep the stronger graft, drop or reconcile the weaker, and **update the ledger**. Then the resolved champion proceeds to the predecessor audit.

This directly answers the riskiest assumption - that compatibility is monotonic. If a rung-7 graft retroactively contradicts a rung-3 graft, the ledger surfaces it and it is *adjudicated*, not left to fester.

### 5. The whole-artifact audit - predecessor gate and rollback
The merge is the one generative, value-delivering act, so it gets the same scrutiny as the verdict. Any rung with a **non-no-op** merge ends by **re-judging the just-merged champion against the previous champion** on the same rubric:
- **MATCH-OR-BEAT** (merged_sum ≥ predecessor_sum): the merge stands; append the graft to the ledger.
- **REGRESSION**: the merge broke something (possibly a graft from rungs earlier). The orchestrator confirms with one independent position-swapped predecessor judgment, then **ROLLS BACK** to the predecessor - the champion reverts, the graft is discarded, the ledger is unchanged. **The rung's winner is still recorded** (a bad merge costs the graft, not the verdict).

### 6. The audit rung - the floor guarantee (1 mandatory call)
After the last ladder rung, run **one** audit rung pitting the **accumulated champion** against the **reserved best original** as a real challenger on the 5 criteria. The champion **ships only if it clears the noise floor** (margin ≥ 2) over the pristine original; an inside-band result triggers one swapped recheck, and a still-inside result **ships the reserved original**. This turns the load-bearing claim into a **measured gate**: you can never finish worse than the strongest original.

### 7. Output
Return:
1. **The hardened idea** - the shipped text (accumulated champion, or the reserved original if it failed the audit).
2. **Before -> after summary** - original seed vs. shipped idea, and the 2-4 most important changes, each tied to the rung/objection/graft that caused it. State the audit-rung margin explicitly.
3. **The graft ledger** - every accepted graft and any conflicts resolved or merges rolled back.
4. **The transcript** - every rung: both steelmans, the scores with quoted rubric lines, the winner + margin + tie-break/swapped-recheck, the salvage, the merge diff, the ledger check, and the predecessor audit. Saved to `./idea-forge-runs/YYYY-MM-DD-<slug>.md` (+ optional JSON sidecar). The transcript is half the value - it shows the user the structural flaws in their thinking *and* exactly which hardening survived re-validation.

## What v2 guarantees - and what it does not

- **Guarantees:** a champion **provably no worse than the best original** (audit-rung gate), **hardened by every graft that survived re-validation** (ledger + predecessor audit), with selection calibrated to the noise floor and position bias controlled within each rung.
- **Does NOT guarantee a global optimum.** A king-of-the-hill ladder with a running merge is order-sensitive: the seeding and challenger order shape *which* compatible mechanisms compound. The reserve audit caps the downside and the pre-screen removes random first-mover bias, but a different order could compound a different (possibly better) set. State this in the transcript. Exploring alternate orders is deliberately out of scope to keep cost bounded.

## Lite mode
For cost/latency: **4 contenders** (axes 1, 3, 4, 8), pre-screen + champion-zero + reserve, a 3-rung ladder, then the audit rung. Same ledger, predecessor audits, calibration, and floor guarantee. ~9-12 Opus calls. Offer this whenever the user hesitates on cost.

## Worked example (abridged)

**Seed:** "A browser extension that summarizes long YouTube videos."

- **Contenders (8 axes)** produce e.g. *#3 feasibility/cost:* "summarize from existing captions only, no audio model"; *#6 wedge:* "only online-course lectures, with a timestamped concept index"; *#4 assumption-attack:* "people don't want summaries, they want to *skip to* the part they need - build a semantic chapter-jumper."
- **Pre-screen** ranks #4 strongest → **champion-zero**; a frozen copy of #4 goes to **reserve**. Challengers enter #6, #3, #1, ... by rank.
- **Rung 1 (champion #4 vs challenger #6, wedge):** champion wins, margin 3 (auto-certify). Salvage from #6: the "timestamped concept index" mechanism. **Merge:** champion gains a per-chapter concept index. Ledger entry [g1] added. Predecessor audit: match-or-beat → stands.
- **Rung 2 (vs #1, sharpen value):** margin 1 → **swapped recheck**; recheck agrees champion holds. Salvage: optional per-chapter summary. **Merge** flagged **CONFLICT** with [g1] (index vs summary both claim the chapter UI) → escape-hatch resolve: keep both but subordinate summaries under the index; ledger updated.
- **Rung 3 (vs #3, feasibility/cost):** salvage "captions-only, no audio model" lowers cost risk; merge **REGRESSES** clarity per the predecessor audit (it over-stuffed the paragraph) → **rollback**, graft discarded, but #3 still recorded as the rung loser. (Honesty: this fix needs its own pass.)
- ...remaining rungs run...
- **Audit rung:** accumulated champion vs reserved #4. Margin 4 → **champion ships**.
- **Before->after:** seed "summarize videos" → "a semantic *chapter-jumper* for long-form/lecture video with a timestamped concept index and optional subordinate per-chapter summaries, wedged into online courses." The navigation insight came from champion-zero; the index and summary survived re-validation; the captions-only cost fix was honestly rolled back rather than shipped broken.

## Red flags - STOP

| Thought | Reality |
|---------|---------|
| "I'll skip the merge audit and just trust each graft" | Then you ship a path-dependent chimera that can be worse than a parent and never know it. The predecessor audit + ledger ARE the product. |
| "Compatible at rung 3 stays compatible forever" | Compatibility is non-monotonic. Re-assert every new graft against EVERY live ledger entry; resolve conflicts, don't accumulate them. |
| "Just declare the champion better than the original" | The central claim must be MEASURED. Run the audit rung; if the champion can't clear the noise floor over the reserve, ship the reserve. |
| "Seed champion-zero as whoever I spawned first" | Incumbency must accrue to the a-priori-best. Pre-screen and rank first; freeze the best in reserve. |
| "A 1-point margin is a real win" | That's inside the noise floor. Run the swapped recheck with the prior verdict hidden; disagreement means incumbency holds. |
| "A challenger won the rung, so swap it in as champion" | Never wholesale-replace - you'd discard accumulated hardening. Graft its winning mechanism into the champion; the floor comes from the audit rung. |
| "Let the agents debate until they agree" | Unbounded debate burns cost. Each rung is one gated call (max three with recheck/edit). |
| "No need to save the transcript or ledger" | The transcript + ledger are half the value - they show which hardening survived re-validation and why. Save them. |

## Common mistakes
- **Auditing the selector but not the synthesizer** - calibrating the verdict (swapped recheck) while leaving the merge unchecked. v2 audits both: ledger non-contradiction + predecessor match-or-beat.
- **Treating "compatible" as a one-shot guess** - it is a composable predicate re-validated against the whole ledger every rung.
- **Pretending order doesn't matter** - it does. Claim "no worse than the best original and hardened by every surviving graft," never "the unique global optimum." Note the residual path dependence.
- **Rewording instead of diverging** - variants that differ in prose but not in direction. Enforce one distinct axis per contender.
- **Echo-chamber blindness** - 8 same-model agents share priors; the pre-screen and every judge inherit those blind spots. Be honest in the transcript when a rung added little, and note a future version could mix model families for the judge.
- **No-op / rollback pattern ignored** - if most rungs are no-ops or rollbacks, tell the user: champion-zero was already tight and the ladder's marginal value was low. Honesty beats theater.