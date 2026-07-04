# Crucible

One rough idea in, assayed code out. Crucible is the top-of-toolchain orchestrator for this marketplace: hand it an idea in plain language and it drives intake, adversarial divergence, spec, tests-first, a subagent build, and an evidence-backed quality assay, ending in a delivery summary. Slop is dross — the gates exist to skim it.

## Why a plugin (not a bare skill)

The orchestration logic alone could live in a SKILL.md, but two requirements can't:

- **Enforcement** needs hooks. A skill can _ask_ the model to verify before claiming done; only a Stop hook can _refuse_ the claim. Crucible's Stop hook blocks the turn from ending during the assay/deliver phases while gates lack evidence.
- **Launch + state** need a command and a script. `/crucible` gives a deterministic entry point, and `scripts/gate.mjs` (plain Node, no bash, Windows-safe) is the only writer of run state, so "done" is a checked invariant, not prose.

## The pipeline

Each stage consumes the previous stage's artifact and writes its own into `crucible-runs/<yyyy-mm-dd-slug>/`, so every stage is resumable and hand-editable:

```
00-idea.md        the idea, verbatim
10-intake.md      crisp problem statement + goal + essential Q&A
20-approach.md    rival approaches, the winner, rationale, checkpoint verdict
30-spec.md        scope, acceptance criteria, definition of done, task list, gate map
40-tests.md       failing tests encoding each acceptance criterion
50-build-log.md   per-task subagent dispatches and outcomes
60-gates/         evidence files: tests, lint, typecheck, review, critique
70-delivery.md    what was built, key decisions, how it was verified
state.json        phase + gate ledger (written only by gate.mjs)
```

## How the installed skills are wired in

| Stage   | Skill                                                                        | Role                                                                                                                                |
| ------- | ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| intake  | `bake-to-completion`                                                         | interview that firms up a vague idea (this is its real interface — it clarifies ideas; it does not dispatch build agents)           |
| intake  | `superpowers:brainstorming`                                                  | intent/requirements exploration when the idea is already concrete                                                                   |
| diverge | `idea-forge`                                                                 | 8 rival variants fight a king-of-the-hill ladder; winner + rationale (expensive: used with user consent, else a 3-rival light mode) |
| spec    | `superpowers:writing-plans`                                                  | spec + task breakdown                                                                                                               |
| tests   | `superpowers:test-driven-development`                                        | failing tests before implementation                                                                                                 |
| build   | `superpowers:subagent-driven-development`                                    | per-task subagent dispatch with review                                                                                              |
| build   | `superpowers:dispatching-parallel-agents`, `superpowers:using-git-worktrees` | parallelism + isolation                                                                                                             |
| assay   | `superpowers:requesting-code-review` / `/code-review`                        | review gate against the spec                                                                                                        |
| assay   | `superpowers:systematic-debugging`                                           | root-causing gate failures                                                                                                          |
| assay   | `superpowers:verification-before-completion`                                 | evidence-before-claims discipline                                                                                                   |
| deliver | `superpowers:finishing-a-development-branch`                                 | merge/PR/cleanup decision                                                                                                           |

## The gate ledger

`scripts/gate.mjs` — library + CLI, tested by `scripts/gate.test.mjs` (`node --test plugins/crucible/scripts/gate.test.mjs`):

```
gate.mjs init <run> [--auto]                    scaffold a run
gate.mjs phase <run> <phase>                    advance (done requires ASSAY PASS)
gate.mjs record <run> <gate> <exit> <evidence>  record a gate with its proof
gate.mjs check <run>                            ASSAY PASS/FAIL with unmet gates
gate.mjs status [run]                           ledger overview
gate.mjs hook-stop | hook-session               hook protocol modes
```

Hooks: **Stop** blocks ending the turn during assay/deliver with unmet gates (once per stop, with the exact unmet list and a legitimate pause path); **SessionStart** surfaces unfinished runs so a new session can resume them.

## Usage

```
/crucible a CLI that turns any CSV into a shareable chart link
  → intake questions → rival approaches → checkpoint: "Approach A (server-render) vs B (client-only)?"
  → you pick → spec → failing tests → subagent build → assay loops until ASSAY PASS → delivery summary

/crucible resume 2026-07-04-csv-charts    pick an interrupted run back up
/crucible status                          where is every run?
/crucible <idea> --auto                   no checkpoint; rationale recorded instead
```
