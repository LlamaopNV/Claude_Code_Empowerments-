---
name: forgemaster
description: Use when the user hands over a rough software/product idea and wants it driven end to end to shipped, tested code — "build me X from this idea", "take this all the way", "run the full pipeline on it", or the /forgemaster command — or wants to resume or inspect an existing run under forgemaster-runs/. Not for validating a fuzzy idea alone (bake-to-completion), hardening one idea alone (idea-forge), or a single bugfix or small edit (use the normal skills directly).
---

# Forgemaster

## Overview

Forgemaster is the top of the toolchain: it takes ONE rough idea and drives it through intake → diverge → spec → plan → tests-first build → quality gates → delivery, by **delegating every stage to the specialist skill that owns it** and leaving a durable artifact behind at each step.

**Core principle: orchestrate, don't improvise.** Forgemaster writes almost nothing itself — it sequences the specialists and guards two invariants that no pressure may erode:

1. **Every stage ends in a file.** The conversation is never the record. If a stage ran, its artifact exists; if it was scaled down or skipped, the skip and its reason are in the manifest. This is what makes a run resumable and composable.
2. **Done is a measured state, not a feeling.** The run manifest is written only by `scripts/gate.mjs`, which refuses a gate without a non-empty evidence file on disk and refuses `done` while any gate is unmet. Two hooks back it up: a PreToolUse guard blocks editing `run.json` by hand, and a Stop hook blocks ending the turn mid-gates with an unmet ledger.

**Violating the letter of these invariants is violating their spirit.** "The design record is the conversation" is the canonical failure this skill exists to prevent.

## The run directory

First action of every run — before any question, restatement, or skill call — create:

```
forgemaster-runs/YYYY-MM-DD-<slug>/
  run.json          # the manifest: state machine + gate ledger. WRITTEN ONLY BY gate.mjs
  gates/            # evidence files: one captured output (or written verdict) per gate
  00-intake.md      # problem statement, goal, weight class, DoD sketch
  01-brief.md       # only if bake-to-completion ran
  02-approach.md    # chosen angle + rationale + rejected alternatives
  03-spec.md        # scope, non-goals, testable acceptance criteria, DoD
  04-plan.md        # task breakdown (or pointer to the writing-plans doc)
  05-build-log.md   # one entry per completed task: tests written → red → green
  06-gates.md       # narrative verdict per gate, pointing at its gates/ evidence file
  07-summary.md     # the delivery report
```

Create the run with `node "<plugin>/scripts/gate.mjs" init YYYY-MM-DD-<slug> <idea> [--auto] [--weight=light|standard|heavy]` — this scaffolds `run.json` and `gates/`. Never touch `run.json` with Write or Edit (the guard hook blocks it); drive it through the ledger CLI:

```
gate.mjs stage <slug> <stage>                    entering a stage
gate.mjs artifact <slug> <stage> <file>          leaving a stage
gate.mjs skip <slug> <stage> <reason...>         recording a scale-down
gate.mjs record <slug> <gate> <exit|na> <file>   gate result + evidence file
gate.mjs check <slug>                            GATES GREEN or the unmet list
gate.mjs status-set <slug> paused|active|abandoned|done
gate.mjs status [slug]                           ledger overview (also /forgemaster status)
```

Gate values only ever become `pass` (exit code 0 with the captured output on disk), `fail` (loop back and fix), or `na` (impossible for this deliverable; the reason itself is the evidence file — e.g. `types` for a plain-bash deliverable). `gate.mjs record` refuses a missing or empty evidence file, and `status-set done` refuses while any gate is unmet.

## Stage map

| #   | Stage            | Owned by                                                                                                                                                                   | Artifact                          |
| --- | ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| 0   | Intake & clarify | forgemaster; `bake-to-completion` when the idea is mush                                                                                                                    | `00-intake.md` (+ `01-brief.md`)  |
| 1   | Diverge & choose | `idea-forge` (heavy/standard); inline mini-diverge (light)                                                                                                                 | `02-approach.md` + **checkpoint** |
| 2   | Spec             | forgemaster writes it; `superpowers:brainstorming` first when the design space is real                                                                                     | `03-spec.md`                      |
| 3   | Plan             | `superpowers:writing-plans`                                                                                                                                                | `04-plan.md`                      |
| 4   | Build            | `superpowers:subagent-driven-development`, each task under `superpowers:test-driven-development`, isolated via `superpowers:using-git-worktrees`                           | `05-build-log.md` + code          |
| 5   | Gates            | `superpowers:verification-before-completion`, `superpowers:requesting-code-review`, `workflow-forge:iterative-reviewer`, `workflow-forge:symmetric-auditor`, `code-review` | `06-gates.md` + green manifest    |
| 6   | Deliver          | `superpowers:finishing-a-development-branch`                                                                                                                               | `07-summary.md`                   |

### 0 — Intake & clarify

Restate the idea as a crisp problem statement + goal. Ask **at most three essential questions in one batch** (AskUserQuestion) — placement, the one riskiest default, checkpoint preference (`pause` or `auto`). If the idea has no concrete user or mechanism to state, run `bake-to-completion` instead of guessing; its brief becomes `01-brief.md`. Assign the weight class in `00-intake.md`:

- **light** — small utility, clear prior art, hours of work.
- **standard** — a real feature or tool; wrong approach is a day lost.
- **heavy** — high-stakes; wrong approach is expensive to unwind.

### 1 — Diverge & choose (the only mandatory user checkpoint)

- **heavy:** full `idea-forge` (confirm its cost first, per its own rules). **standard:** `idea-forge` lite mode. Its hardened idea + transcript pointer go in `02-approach.md`.
- **light:** inline mini-diverge — three genuinely different approaches (one paragraph each), a short evaluation against the intake goal, pick one. Still written to `02-approach.md`; a full forge here is cost malpractice.
- **If `idea-forge` is not installed** (check before promising it): say so, offer `/plugin install idea-forge@claude-code-empowerments`, and on decline fall back to the inline mini-diverge at any weight — recorded in `skips` as a fallback, not silently.

**Checkpoint contract:** present the chosen angle, the rationale, and the strongest rejected alternative in 5–10 lines. If `checkpoint` is `pause`, stop and wait for go-ahead/redirect. If `auto`, state the choice and proceed. This checkpoint is never batched into intake questions — the user weighs in on an _evaluated approach_, not on blind config.

### 2–3 — Spec & plan

`03-spec.md` must contain: scope, explicit non-goals, **acceptance criteria phrased as testable assertions**, and the definition of done (= the six gates + any deliverable-specific checks). For standard/heavy, run `superpowers:brainstorming` (pointed at `02-approach.md`, concept already validated — design only) before writing the spec; then `superpowers:writing-plans` for the task breakdown. For light, a task list inside `04-plan.md` is enough — record the scale-down in `skips`.

### 4 — Build, tests first

Isolate in a worktree (`superpowers:using-git-worktrees`) for standard/heavy. Execute the plan with `superpowers:subagent-driven-development`; for a **light** run with few, sequential tasks, executing them directly is legal — as a recorded `skips` entry. What never scales down at any weight: every task obeys `superpowers:test-driven-development` — the failing test that encodes the acceptance criterion exists **before** implementation, and `05-build-log.md` records red → green per task. Bugs found on the way go through `superpowers:systematic-debugging`, not guess-and-patch.

### 5 — Gates (loop until green, no exceptions)

For each gate: run the command with its output captured to a file under `gates/` (e.g. `npm test > forgemaster-runs/<slug>/gates/tests.txt`), record it with `gate.mjs record <slug> <gate> <exit-code> <file>`, and summarize the verdict in `06-gates.md` pointing at the evidence file. Any `fail` → fix (via `superpowers:systematic-debugging`) → re-run → re-record. Loop until `gate.mjs check <slug>` prints GATES GREEN. The gates:

- **tests** — full suite, fresh run, output observed (`superpowers:verification-before-completion`).
- **lint / types** — project linter and typechecker clean, or `na` with reason.
- **spec_review** — walk `03-spec.md` criterion by criterion against the deliverable; every criterion met or explicitly deferred with user sign-off.
- **code_review** — `superpowers:requesting-code-review` plus the `workflow-forge:iterative-reviewer` agent until clean; `workflow-forge:symmetric-auditor` when the change touches sibling surfaces (schema+callers, create/edit/view).
- **self_critique** — dispatch a fresh-eyes subagent with the spec and the diff: "find slop — dead code, cargo-culted comments, unverified claims, template smell, anything a tired reviewer would wave through." Findings fixed or recorded as accepted with reasons.

If the deliverable is itself a Claude Code artifact (skill/plugin/agent), record `proofmark` as a seventh gate (`gate.mjs record <slug> proofmark ...` — extra gates block `done` if they fail) and suggest an `anvil` eval after delivery.

While the run sits in the gates or deliver stage with unmet gates, the Stop hook blocks ending the turn: the way out is to record the missing evidence or, if the user asked to stop, `gate.mjs status-set <slug> paused`.

### 6 — Deliver

`superpowers:finishing-a-development-branch` for the merge/PR decision. Write `07-summary.md`: what was built, the key decisions (each linking the stage artifact that made it), how it was verified (gate evidence), and how to run it. Only then `gate.mjs status-set <slug> done` — the ledger itself refuses while any gate is unmet.

## Resuming

"Continue the dupescan run" / `/forgemaster resume`: the SessionStart hook lists unfinished runs at session start; otherwise `gate.mjs status` finds them. Pick the newest `active` or `paused` run, announce the stage, and re-enter it **from the artifacts, not from memory**. Any artifact can be regenerated by re-running its stage; downstream artifacts are then stale and their stages re-run.

## What you must not do

- Do not carry state in conversation only. If it isn't in the run directory, it didn't happen.
- Do not skip or shrink a stage silently. Scaling down is legal; unrecorded scaling is not — every scale-down is a `skips` entry with a reason.
- Do not touch `run.json` with Write/Edit — the guard hook blocks it, and routing around it (e.g. shell redirection) is forging the ledger. Only `gate.mjs` writes the manifest.
- Do not flip a gate without its evidence file under `gates/` — `gate.mjs record` enforces this; do not game it with a placeholder file.
- Do not implement before the failing test exists. "I'll add tests after" is the build stage failing.
- Do not replace a specialist with your own inline version when the specialist is installed (the mini-diverge fallback exists only for missing `idea-forge` or light weight).
- Do not batch the approach checkpoint into intake questions, and do not skip it in `pause` mode because the choice "seems obvious".
- Do not mark the run `done` with unmet gates — the ledger refuses; the answer is to fix, not to route around the manifest.
- Do not abandon a run mid-gates by just ending the turn — the Stop hook blocks it; either finish the ledger or record the pause.

## Red flags — STOP

| Thought                                         | Reality                                                                                                                                                            |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| "The user said skip the ceremony"               | Ceremony ≠ record. Scale the _depth_ (weight class, recorded skips), never the artifacts, tests-first, or gates.                                                   |
| "The design record is the conversation"         | The conversation dies with the session. Stage artifact or it didn't happen.                                                                                        |
| "This idea is too small for the pipeline"       | Then it's a **light** run — mini-diverge, thin plan — not a no-pipeline run. If it's a one-line edit, say forgemaster is the wrong tool and use the normal skills. |
| "Tests pass, close enough to done"              | Tests are one gate of six. spec_review and self_critique are where slop hides.                                                                                     |
| "I remember what the spec said"                 | Re-read `03-spec.md`. Memory is how criteria get silently dropped.                                                                                                 |
| "The approach is obviously X, no need to pause" | In `pause` mode the user asked to weigh in. Present and wait.                                                                                                      |
