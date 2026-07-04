# Forgemaster

The top of the toolchain: hand it one rough idea, it drives the whole development process by
sequencing the marketplace's specialist skills — and refuses to call the result "done" until
every quality gate has observed evidence.

## Pipeline

| Stage            | Delegates to                                                                          | Leaves behind                        |
| ---------------- | ------------------------------------------------------------------------------------- | ------------------------------------ |
| Intake & clarify | forgemaster itself; `bake-to-completion` for mushy ideas                              | `00-intake.md` (+ `01-brief.md`)     |
| Diverge & choose | `idea-forge` (lite for standard weight; inline mini-diverge for light)                | `02-approach.md` + a user checkpoint |
| Spec & plan      | `superpowers:brainstorming` → `superpowers:writing-plans`                             | `03-spec.md`, `04-plan.md`           |
| Build            | `superpowers:subagent-driven-development` under `superpowers:test-driven-development` | `05-build-log.md` + code             |
| Gates            | verification, code review, iterative-reviewer, symmetric-auditor, self-critique       | `06-gates.md`                        |
| Deliver          | `superpowers:finishing-a-development-branch`                                          | `07-summary.md`                      |

Every stage writes an artifact into `forgemaster-runs/YYYY-MM-DD-<slug>/`, so a run can be
resumed, inspected, or partially re-run at any stage boundary. `run.json` is the state machine,
and gate evidence lives beside it under `gates/`.

## Enforcement

Since 0.2.0 the manifest has a single writer: `scripts/gate.mjs` (plain Node, Windows-safe,
tested by `scripts/gate.test.mjs` — `node --test plugins/forgemaster/scripts/gate.test.mjs`).
The ledger refuses to record a gate without a non-empty evidence file, refuses `done` while
any of the six gates (plus any extra, e.g. `proofmark`) is unmet, and supports `na` with the
reason as its evidence. Three hooks in `hooks/hooks.json` back it up:

- **PreToolUse (Write|Edit)** — blocks hand-editing any `forgemaster-runs/**/run.json`; the
  ledger CLI is the only legal writer. Costs nothing outside a run.
- **Stop** — blocks ending the turn while an active run sits in the gates/deliver stage with
  unmet gates (once per stop, naming them); the escape hatch is recording the evidence or
  `gate.mjs status-set <slug> paused`.
- **SessionStart** — lists unfinished runs so a fresh session resumes instead of forgetting.

Lint/test enforcement on `git commit` is deliberately left to `workflow-forge`'s pre-commit
gate rather than duplicated.

## Usage

```
/forgemaster a CLI tool that finds duplicate files by content hash, with dry-run and delete modes
/forgemaster resume
/forgemaster status
```

Companion plugins: `idea-forge` (install it for the real diverge stage), `superpowers`,
`workflow-forge`; `proofmark` + `anvil` join the gates when the deliverable is itself a
Claude Code artifact.
