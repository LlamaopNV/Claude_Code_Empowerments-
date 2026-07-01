# Idea Brief — idea-forge

*Baked: 2026-06-27 via bake-to-completion*

## One-line pitch
A Claude Code skill that hardens a single high-stakes idea by spawning 8 high-reasoning agents, having them generate rival improved variants, and running a single-elimination **debate tournament** where each round's winner is *edited to absorb the loser's strongest objection* — so the surviving idea is reinforced by every fight it won, not merely selected.

## Problem & evidence
Iterating on an idea with one LLM produces **sycophantic convergence**: the model anchors on your framing and polishes the surface instead of attacking the structure, so the load-bearing flaw is never surfaced. Evidence is everyday — anyone who has refined a concept with an LLM has watched it agree with a premise it should have demolished. Existing single-adversary passes (including bake-to-completion's stress-test phase) attack a *fixed* idea with *one* critic; they never force the idea to compete against genuinely different versions of itself under a judge that must choose. Competition is what exposes the flaw, because a rival agent is incentivized to find it.

## Target user (specific)
Owners of a **single high-stakes idea where being wrong is expensive and a second opinion is cheap by comparison**:
- **Solo founder / indie hacker** with one bet they can't afford to get wrong (copes today: pestering friends, one ChatGPT critique).
- **Researcher / strategist** refining a thesis, problem statement, or experimental design (copes: lit review + a co-author's gut check).
- **Engineer / PM** choosing between architectural or product directions (copes: design doc + review comments).

Explicitly NOT for triaging many ideas at once — that is a breadth tool, not this depth tool.

## Value proposition
You get back **one maximally-reinforced idea plus a transcript of why every rejected direction lost.** The transcript is half the product: you learn the specific structural flaws in your thinking. The reinforcement (not the selection) is the differentiator — the survivor is an idea that has been *amended by the strongest valid criticism from every round it survived*, then put through a final adversarial gauntlet.

## Scope
**MVP (in):**
- 8 contenders, each assigned a **distinct improvement axis** (forced divergence).
- Single-elimination bracket 8 -> 4 -> 2 -> 1 (7 debates).
- Bounded debates: exactly **2 exchanges per pair** (opening argument + one rebuttal each).
- **Single rubric-bound judge** per debate (5 named criteria, must quote the winning line).
- **Reinforcement carry-forward**: winner's text is edited to absorb the loser's single strongest valid objection before advancing. (NON-NEGOTIABLE — this is the product.)
- Final adversarial gauntlet on the survivor (steelmanned objection + riskiest assumption -> amend).
- Full markdown/JSON **transcript log** + before->after summary.
- **Lite mode** (4 contenders, 3 debates) as the cheap option.

**Out of scope (MVP):** multi-model judging, Swiss/round-robin formats, >8 contenders, a live/web UI, auto-iterating the winner through repeated full tournaments.

## Differentiation
- **vs. bake-to-completion (same repo):** that is an *extractive, Socratic, human-paced* interview that pulls an idea out of your head across 8 fixed dimensions. idea-forge is *generative, adversarial, autonomous* — it manufactures rival variants and makes them fight. They chain: **bake -> forge** (clarify, then harden).
- **vs. "generate 8, pick the best" (flat ensemble):** flat selection discards the 7 losers' insights. The bracket's **reinforcement carry-forward** keeps the best objection from every loser and edits it into the survivor. The novel combination is *tournament + per-round reinforcement editing as a reusable skill*, not "debate" or "tournament" alone.
- **vs. research debate methods:** those optimize for factual accuracy; this optimizes for idea hardening with concrete carry-forward edits, packaged as a CLI-spawnable workflow.

## Key risks & assumptions
1. **Same-model correlation (OPEN, #1 risk).** Eight Opus agents share priors, so "debate" risks being one model talking to itself, judged by the same model. *Blunted by:* forced-divergence axes, rubric-bound judging against external criteria, and inspectable carry-forward edits. *Residual:* monoculture caps the diversity ceiling. Future fix: mix model families (Opus contenders + different-family judge).
2. **Judge reliability (OPEN).** A single LLM judge may be noisy/biased (length, confidence). *Blunted by:* narrow rubric (5 criteria 1-5), require quoting the winning line, panel-of-3 opt-in for the final, and the transcript so a human can overrule. *Residual:* judging is the weakest link.
3. **Bracket-value assumption.** The whole structure is justified ONLY by reinforcement carry-forward. If carry-forward edits are routinely no-ops, the bracket isn't worth its cost and the tool should collapse to flat ensemble. (See Validation kill-criterion.)
4. **Cost/latency.** ~24-30 Opus calls per full forge — real money and minutes. *Controlled by:* bounded 2-exchange debates, single judge by default, lite mode.

## Validation plan
**Cheapest smoke test:** run idea-forge once on *this very idea* and check whether the transcript surfaces a structural flaw not already in this brief.

**Real test (A/B):** on 3-5 real ideas, compare Arm A (full idea-forge) vs. Arm B (generate 8, one judge picks one, no debate/carry-forward). Blind-score the two survivors on robustness-to-objection and specificity.

**Success criteria:** forge's survivor wins on a clear majority AND its transcript surfaces >=1 structural flaw the flat pick missed.

**Kill criterion:** if forge only *ties* flat-ensemble, the bracket isn't earning its cost -> collapse the skill to the cheap flat version.

## Open questions for the design phase
- Exact rubric criteria and weights; tie-break rule formalization.
- Carry-forward edit format — diff vs. full rewrite — and how to detect a no-op edit.
- Whether the final gauntlet should always use a panel-of-3 judge.
- Cost guardrails / confirmation prompt before spawning 8 Opus agents.
- Transcript schema (JSON vs. markdown) and what the before->after summary must always contain.
