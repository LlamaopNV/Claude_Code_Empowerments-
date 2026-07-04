---
description: Drive a rough idea end to end to shipped, tested code through the forgemaster pipeline, or resume/inspect an existing run.
argument-hint: <idea in plain language | resume [slug] | status>
---

# /forgemaster

Thin entry point: hands off to the **`forgemaster`** skill.

- `/forgemaster <idea>` — start a run: intake → diverge (idea-forge) → spec → plan → tests-first build (subagent-driven) → quality gates → deliver. One user checkpoint after approach selection (say "auto" in intake to skip it).
- `/forgemaster resume [slug]` — re-enter the newest (or named) run under `forgemaster-runs/` at its recorded stage, from its artifacts.
- `/forgemaster status` — report each run's stage, gate ledger, and next action, without executing anything.

The run is not done until all six gates in `run.json` read pass/na with an evidence file on disk. The manifest is written only by the plugin's `gate.mjs` ledger: a PreToolUse hook blocks hand-editing `run.json`, a Stop hook blocks abandoning a run mid-gates, and a SessionStart hook surfaces unfinished runs to resume.
