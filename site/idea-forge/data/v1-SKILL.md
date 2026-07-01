---
name: idea-forge
description: Use when the user has ONE clarified, high-stakes idea they want maximally hardened/stress-tested before committing — runs an adversarial multi-agent debate tournament (8 rival variants, single-elimination, judge per round, winner absorbs the loser's best objection each round) and returns one reinforced idea plus a full debate transcript. Use AFTER an idea is clear (e.g. after bake-to-completion), not for vague or many-idea triage. Expensive — confirm cost first.
---

# idea-forge

## Overview

Harden a single idea by making rival versions of it **fight**. Spawn 8 high-reasoning agents that each produce a distinct improved variant; run a single-elimination debate **tournament**; after each debate the winner is **edited to absorb the loser's strongest valid objection** ("reinforcement carry-forward"). One idea survives, then runs a final adversarial gauntlet. Output: the hardened idea + a transcript of why every rejected direction lost.

**Core principle:** The value is NOT selecting the best of 8. It is **reinforcement under selection** — the survivor is amended by the strongest criticism from every round it won. If you remove carry-forward, you have a worse, more expensive version of "generate 8, pick 1." Carry-forward is the product.

## When to use

- The user has **one clarified idea** (a sentence/paragraph) and says "harden it / stress-test it / pressure-test / make it bulletproof / run it through the gauntlet / forge it."
- The stakes justify the cost: being wrong is expensive, and the idea is specific enough to attack.
- Natural upstream: `bake-to-completion` clarifies an idea; idea-forge then hardens it. **bake -> forge.**

## When NOT to use (read this before spawning anything)

| Situation | Use instead |
|-----------|-------------|
| Idea is vague / not yet defined | `bake-to-completion` first — forge cannot harden mush. |
| User has many ideas to triage / pick among | A breadth/ranking tool — forge is depth-on-one. |
| User wants a build plan or architecture | `superpowers:writing-plans` / `brainstorming`. |
| Low stakes, or user wants a quick take | A single critique pass. Forge is ~24-30 Opus calls — overkill. |
| Budget/latency sensitive right now | Offer **lite mode** (4 contenders) or decline. |

**Cost honesty:** a full forge spawns 8 contender agents + 7 debate pairs + 7 judges + a final gauntlet ≈ **24-30 high-reasoning (Opus) agent calls** and several minutes. ALWAYS state the expected cost and get a go-ahead before spawning. Offer lite mode.

## Input

A single idea as a sentence or short paragraph (the "seed"). If the user gives more than one idea, ask which ONE to forge. If the seed is too vague to attack (no concrete claim, user, or mechanism), stop and recommend `bake-to-completion` first.

## The mechanism (precise enough to execute without guessing)

> The exact agent-spawn sequence, prompts, and logging are in the companion **`run-tournament.md`** (the executor playbook). This section defines the rules; `run-tournament.md` defines the operations.

### 1. Round 0 — generate 8 contenders
Spawn **8 agents** (subagent_type Opus, high reasoning effort). Each receives the seed idea and **one distinct improvement axis** so the variants genuinely diverge instead of rewording each other. Default axes:

1. **Sharpen the core value** — make the central benefit undeniable.
2. **Maximize differentiation** — make it hard to copy / clearly unlike alternatives.
3. **Minimize feasibility risk** — make it the most buildable/shippable version.
4. **Attack & repair the core assumption** — find the load-bearing assumption and redesign so it matters less.
5. **Expand the opportunity** — bigger market / wider applicability without losing focus.
6. **Narrow to a wedge** — the smallest beachhead version that wins a niche completely.
7. **Maximize defensibility/durability** — moat, compounding advantage, hard to erode.
8. **Radical reframe** — solve the underlying need a structurally different way.

Each contender returns: **(a) the improved variant** (a tight paragraph), and **(b) a rationale** — why these specific changes make it stronger, and its single biggest weakness (self-identified). These 8 are the bracket entrants, seeded 1-8 in the order above.

### 2. Tournament — single elimination 8 -> 4 -> 2 -> 1
Pair entrants (1v8, 2v7, 3v6, 4v5; then winners re-paired in bracket order). For **each pair**, run a structured **debate**:

- **Exchange 1 (opening):** each side argues, in parallel, why *its* variant is superior against the judging criteria, and names the strongest weakness of the *other* variant.
- **Exchange 2 (rebuttal):** each side responds to the other's attack and defends.
- Exactly **2 exchanges per pair** (4 agent messages total). No open-ended back-and-forth — this bounds cost.

Then a **judge** (one Opus agent; or panel-of-3 for the final, optional) scores **both** variants on the 5 criteria below (1-5 each), sums, and picks the winner.

### 3. Judging criteria (the same 5 every debate)
| Criterion | Question |
|-----------|----------|
| **Impact** | If true, how much does it matter to the target user? |
| **Feasibility** | Can it actually be built/shipped with realistic resources? |
| **Robustness** | How well does it survive the objections raised in the debate? |
| **Defensibility** | How hard is it to copy or erode? |
| **Clarity** | Is it specific and unambiguous, not hand-wavy? |

The judge MUST **quote the specific line** from each variant that earned its top and bottom score (forces grounding, reduces length/confidence bias). Score = sum of the 5 (max 25).

**Tie-break (in order):** (1) higher **Robustness** sub-score; (2) the variant that raised the objection the *other* could not fully rebut; (3) higher **Clarity**. Judge states which rule decided it.

### 4. Reinforcement carry-forward (non-negotiable)
After each debate, the winner does NOT advance unchanged. Take the **single strongest valid objection the loser raised** (the judge names it) and **edit the winner's variant text to incorporate/neutralize it**. The edit is explicit and logged as a before->after diff. If the objection is genuinely a no-op (winner already handles it), log "no-op — already addressed" and say why; a pattern of no-ops is a signal the idea is already tight (and that the bracket added little — note it).

The amended winner is what advances to the next round. By the final, the survivor carries reinforcements from every round it won.

### 5. Final gauntlet
The lone survivor faces a last adversarial pass (one Opus agent acting as steelman critic):
- the **strongest steelmanned objection** to the surviving idea, and
- its **riskiest remaining assumption** (the one that kills it if false).

The idea is **amended once more** to address or honestly log each. The result is the maximally-reinforced final idea.

### 6. Output
Return three things:
1. **The hardened idea** — final amended text.
2. **Before -> after summary** — original seed vs. final, and the 2-4 most important changes the tournament produced (each tied to the round/objection that caused it).
3. **The transcript** — every debate: the two variants, both exchanges, the judge's scores + quoted lines + tie-break, and the carry-forward edit. Saved to `./idea-forge-runs/YYYY-MM-DD-<slug>.md` (and optionally a JSON sidecar). The transcript is half the value — it shows the user the structural flaws in their thinking.

## Lite mode
For cost/latency: **4 contenders** (axes 1, 2, 4, 8), bracket 4 -> 2 -> 1 (3 debates), single judge, same carry-forward and final gauntlet. ~10-12 Opus calls. Offer this whenever the user hesitates on cost.

## Worked example (abridged)

**Seed:** "A browser extension that summarizes long YouTube videos."

- **Contenders (8 axes)** produce variants e.g. *#3 feasibility:* "summarize from existing captions only, no audio model"; *#6 wedge:* "only for online-course lectures, with timestamped concept index"; *#4 assumption-attack:* "people don't want summaries, they want to *skip to* the part they need — so build a semantic chapter-jumper, not a summarizer."
- **Round 8->4, debate #4 (assumption-attack) vs #1 (sharpen value):** #4 argues the real job is navigation not summarization; #1 rebuts that summaries serve a distinct skim use-case. Judge: #4 wins on Impact+Robustness (quotes "users abandon summaries but use chapter jumps") — tie-break unused. **Carry-forward:** #4 edited to *also* offer an optional summary per chapter (absorbing #1's valid skim point).
- ...rounds continue; the wedge variant (#6) and the reframed navigator (#4) reach the final. Navigator wins on Defensibility.
- **Final gauntlet:** steelman objection "YouTube could ship this natively"; riskiest assumption "caption quality is good enough." Amended: focus on lecture/long-form where native chapters are absent and add a caption-quality fallback.
- **Before->after:** seed was "summarize videos"; survivor is "a semantic *chapter-jumper* for long-form/lecture video with optional per-chapter summaries and a caption-quality fallback, wedged into online courses." The structural insight (navigation > summarization) came from the assumption-attack contender and survived because it absorbed its rivals' best points.

## Red flags — STOP

| Thought | Reality |
|---------|---------|
| "I'll skip carry-forward and just pick the best variant" | Then you built a worse flat ensemble. Carry-forward IS the product. Never skip it. |
| "The 8 variants all look similar" | You didn't enforce distinct axes. Re-spawn with the forced-divergence axes — same-model agents converge unless pushed apart. |
| "Let the agents debate until they agree" | Unbounded debate burns cost and rarely converges. Exactly 2 exchanges per pair. |
| "I'll just judge by which I like better" | Self-preference/length bias. Score the 5 rubric criteria and QUOTE the winning line. |
| "Spawn all 24+ Opus agents, sort it out after" | State the cost and get a go-ahead FIRST. Offer lite mode. |
| "The idea is vague but I'll forge it anyway" | Forge can't harden mush. Send them to bake-to-completion first. |
| "Skip the final gauntlet, it already won" | The gauntlet is what makes it *maximally* reinforced. Mandatory. |
| "No need to save the transcript" | The transcript is half the value — it's where the user learns their idea's flaws. Save it. |

## Common mistakes
- **Rewording instead of diverging** — variants that differ in prose but not in direction. Enforce one distinct axis per contender.
- **Echo-chamber blindness** — 8 same-model agents share priors; the debate's diversity is capped. Be honest in the transcript when a round added little, and note the open risk (a future version can mix model families for the judge).
- **Judge as the silent weak link** — never let a judge pick without quoting evidence and naming the tie-break rule used.
- **No-op carry-forwards ignored** — if every edit is a no-op, tell the user: the idea was already tight and the tournament's marginal value was low. Honesty beats theater.
