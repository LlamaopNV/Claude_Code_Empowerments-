---
name: crucible
description: Use when the user hands over a rough software or product idea and wants it driven all the way to shipped, tested code in one pipeline — "build me X from this idea", "take this to done", "run the crucible on it", or the /crucible command — or wants to resume, inspect, or unstick a run under crucible-runs/. Not for clarifying a vague idea by itself (bake-to-completion), hardening one idea by itself (idea-forge), or a single bugfix or small edit (use the normal skills directly).
---

# Crucible

## Overview

Crucible melts one rough idea down and pours shipped, tested code: seven stages, each consuming the previous stage's artifact and writing its own into `crucible-runs/<run>/`. Slop is dross — the assay stage skims it, and the gate ledger (`scripts/gate.mjs`) plus a Stop hook refuse to let a run end without evidence on disk.

**Iron rule: a gate without evidence on disk is a claim, not a result.** Never edit `state.json` by hand; only `gate.mjs` writes it.

## Starting and resuming

- New run: `node "<plugin>/scripts/gate.mjs" init <yyyy-mm-dd-slug>` (add `--auto` only if the user asked to skip the approach checkpoint). Save the idea verbatim to `00-idea.md`.
- Resume: `gate.mjs status`, read `state.json` and the newest artifact, re-enter at `phase`. Artifacts are the interface — if the user hand-edited one, treat it as authoritative and rerun from there.
- Advance phases with `gate.mjs phase <run> <phase>` as you enter each stage. If the user diverts to unrelated work mid-run, set phase `paused` first.

## The seven stages

| Phase   | Consumes                    | How                                                                                                                                                                                                                                                                                         | Produces                      |
| ------- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| intake  | `00-idea.md`                | Restate as a crisp problem statement + goal. Vague or unvalidated idea → **bake-to-completion** interview; already concrete → **superpowers:brainstorming**. Ask only essential questions.                                                                                                  | `10-intake.md`                |
| diverge | `10-intake.md`              | Full: **idea-forge** (8 rivals, king-of-the-hill; expensive — needs user cost consent). Light (auto mode or user declines cost): 3 rival approaches from parallel subagents + a comparison verdict. Then the **checkpoint** (below).                                                        | `20-approach.md`              |
| spec    | `20-approach.md`            | **superpowers:writing-plans**: scope, acceptance criteria, definition of done, task breakdown. Include the **gate map**: the project's real commands for tests/lint/typecheck (if one truly has no equivalent, name the substitute command here — its output becomes that gate's evidence). | `30-spec.md`                  |
| tests   | `30-spec.md`                | **superpowers:test-driven-development**: failing tests that encode every acceptance criterion, before any implementation. List criterion → test file mapping.                                                                                                                               | `40-tests.md` + failing tests |
| build   | `30-spec.md`, `40-tests.md` | **superpowers:subagent-driven-development** per task (parallelize independent tasks via **superpowers:dispatching-parallel-agents**; isolate with **superpowers:using-git-worktrees** when needed). Domain skills fire as they apply. Log each dispatch + result.                           | `50-build-log.md`             |
| assay   | everything                  | Run every gate below, record each with `gate.mjs record`. Failures → **superpowers:systematic-debugging**, fix, re-run, re-record. Loop until `gate.mjs check <run>` prints ASSAY PASS.                                                                                                     | `60-gates/*` evidence         |
| deliver | all artifacts               | `gate.mjs check` must pass, then `gate.mjs phase <run> done`. Summarize what was built, key decisions (with the checkpoint verdict), and how each gate was verified. Integrate via **superpowers:finishing-a-development-branch**.                                                          | `70-delivery.md`              |

## The checkpoint (end of diverge)

Default (`checkpoint.mode: ask`): present the winning approach, its strongest rival, and a short rationale via a user question; record the decision in `20-approach.md`. In `auto` mode: proceed with the winner and record the rationale as if answering that question. This is the run's only planned stop — everything else runs autonomously.

## The five gates

Record each via `gate.mjs record <run> <gate> <exit-code> <evidence-file>` — evidence is the command's captured output (or the reviewer's written verdict) saved under `60-gates/`:

- **tests** — the project's test command; the tests from the tests phase, now green.
- **lint** — the project's lint command.
- **typecheck** — the project's typecheck (or the spec's named substitute).
- **review** — **superpowers:requesting-code-review** (or `/code-review`): diff reviewed against `30-spec.md`; verdict written to `60-gates/review.md`. Findings must be fixed or explicitly waived by the user.
- **critique** — a fresh-context subagent reads `30-spec.md` + the diff and hunts slop: dead code, needless abstraction, unexplained comments, spec drift, untested paths. Verdict to `60-gates/critique.md`; nonzero findings = exit 1 until resolved.

## Rationalizations the assay rejects

| Excuse                                 | Reality                                                                 |
| -------------------------------------- | ----------------------------------------------------------------------- |
| "Tests passed earlier, I remember"     | Memory is not evidence. Re-run, capture output, record.                 |
| "I only touched docs, lint is fine"    | Then the run is cheap. Run it, record it.                               |
| "The user is in a hurry"               | The gates are the product. Offer `gate.mjs phase <run> paused` instead. |
| "I'll just edit state.json to unblock" | That is forging the assay. Only `gate.mjs` writes state.                |
| "This project has no typecheck"        | The spec's gate map names a substitute; run that and record it.         |
| "The critique found only nitpicks"     | Fix them or get the user's explicit waiver into the evidence file.      |

## Red flags — stop and re-enter the pipeline

Claiming "done" without ASSAY PASS output in this conversation; writing implementation before `40-tests.md` exists; skipping the checkpoint in `ask` mode; a stage reading anything other than its predecessor's artifact as its brief.
