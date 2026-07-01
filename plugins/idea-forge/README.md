# idea-forge

**Harden one idea by making rival versions of it fight, then compounding the survivor graft by graft.**

`idea-forge` takes a single clarified, high-stakes idea and runs it through an adversarial
**king-of-the-hill ladder**. It spawns eight high-reasoning agents that each improve the idea along a
distinct axis, pre-screens them to seat the strongest as champion, and then makes every remaining
variant challenge the champion once. Each rung grafts the challenger's single strongest *compatible*
mechanism into a **running merge** that is re-validated against everything grafted before. A final
audit rung ships the accumulated champion only if it **provably beats the best original** — otherwise
the original ships.

It is the depth-on-one companion to `bake-to-completion`. Where bake *clarifies* a fuzzy idea,
idea-forge *hardens* a clear one:

```
bake-to-completion   ->   idea-forge        ->   writing-plans / brainstorming
(clarify the idea)        (stress-test it)       (build it)
```

## What makes it more than "generate 8, pick 1"

The value is **reinforcement under selection, audited at the artifact level**, not selection. Two
guarantees make that real:

- **The merge is audited, not asserted.** Every graft must prove non-contradiction against a running
  **graft ledger** and must match-or-beat the immediately previous champion, or it is rolled back.
- **The shipped artifact is measured, not claimed.** The central promise — "better than the single
  best original" — is a *gate*: the accumulated champion must clear a calibrated margin over a frozen
  reserve copy of the best original, or the reserve ships. You can never finish worse than where you
  started.

Remove the ledger and the audits and you have a path-dependent chimera that can quietly end up worse
than one of its parents. The audited merge is the product.

## Use it

- The user has **one clarified idea** and says "harden it / stress-test it / pressure-test it / make
  it bulletproof / run it through the gauntlet / forge it."
- The stakes justify the cost: being wrong is expensive, and the idea is specific enough to attack.

Do **not** use it for a vague idea (bake it first), for triaging *many* ideas (it is depth on one),
or when the budget is tight — offer **lite mode** (4 contenders, ~9-12 Opus calls) instead.

**Cost honesty:** a full forge is ~18-24 high-reasoning (Opus) agent calls and several minutes. The
skill always states the expected cost and gets a go-ahead before spawning anything.

## Output

1. The **hardened idea** (the accumulated champion, or the reserved original if it failed the audit).
2. A **before -> after summary**, with each pivotal change tied to the rung and objection that forced
   it, and the audit-rung margin stated explicitly.
3. The **graft ledger** — every accepted graft, every conflict resolved, every merge rolled back.
4. A full **transcript** saved to `./idea-forge-runs/YYYY-MM-DD-<slug>.md`. The transcript is half the
   value: it shows the structural flaws in the thinking *and* exactly which hardening survived
   re-validation.

## How this plugin was produced

idea-forge v1 was written by `bake-to-completion`, then pointed at the one idea it knew best — its own
design — and made to forge itself. That self-improvement tournament produced the v2 shipped here (the
king-of-the-hill ladder with the audited merge and the floor guarantee). The full before/after,
transcript, and v1-to-v2 diff are on the [showcase page](https://llamaopnv.github.io/Claude_Code_Empowerments-/idea-forge/).

The mechanism is defined in [`skills/idea-forge/SKILL.md`](skills/idea-forge/SKILL.md); the exact
agent-spawn sequence, prompts, and logging live in the executor companion
[`skills/idea-forge/run-tournament.md`](skills/idea-forge/run-tournament.md).
