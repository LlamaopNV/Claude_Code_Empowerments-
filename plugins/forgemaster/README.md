# Forgemaster

The top of the toolchain: hand it one rough idea, it drives the whole development process by
sequencing the marketplace's specialist skills — and refuses to call the result "done" until
every quality gate has observed evidence.

## Pipeline

| Stage | Delegates to | Leaves behind |
|-------|--------------|---------------|
| Intake & clarify | forgemaster itself; `bake-to-completion` for mushy ideas | `00-intake.md` (+ `01-brief.md`) |
| Diverge & choose | `idea-forge` (lite for standard weight; inline mini-diverge for light) | `02-approach.md` + a user checkpoint |
| Spec & plan | `superpowers:brainstorming` → `superpowers:writing-plans` | `03-spec.md`, `04-plan.md` |
| Build | `superpowers:subagent-driven-development` under `superpowers:test-driven-development` | `05-build-log.md` + code |
| Gates | verification, code review, iterative-reviewer, symmetric-auditor, self-critique | `06-gates.md` |
| Deliver | `superpowers:finishing-a-development-branch` | `07-summary.md` |

Every stage writes an artifact into `forgemaster-runs/YYYY-MM-DD-<slug>/`, so a run can be
resumed, inspected, or partially re-run at any stage boundary. `run.json` is the state machine.

## Enforcement

`hooks/hooks.json` registers a `PreToolUse(Write|Edit)` hook (`scripts/done-gate.sh`) that
blocks setting a run manifest's `status` to `"done"` while any gate reads anything but
`pass`/`na`. It exits silently for every write that doesn't target a
`forgemaster-runs/**/run.json`, so it costs nothing outside a run. Lint/test enforcement on
`git commit` is deliberately left to `workflow-forge`'s pre-commit gate rather than duplicated.

## Usage

```
/forgemaster a CLI tool that finds duplicate files by content hash, with dry-run and delete modes
/forgemaster resume
/forgemaster status
```

Companion plugins: `idea-forge` (install it for the real diverge stage), `superpowers`,
`workflow-forge`; `proofmark` + `anvil` join the gates when the deliverable is itself a
Claude Code artifact.
