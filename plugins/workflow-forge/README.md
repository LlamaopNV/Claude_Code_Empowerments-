# Workflow Forge

A Claude Code plugin that bootstraps a project-tailored `CLAUDE.md` and wires in the working disciplines: TDD, iterative review, a pre-commit test gate, symmetric-surface audits, capability sync, and TODO/WORKLOG tracking.

It does not ship a fixed `CLAUDE.md`. Claude Code ignores a `CLAUDE.md` at a plugin root by design, so this plugin instead generates one into whatever repo it runs in, adapting to the detected stack and host OS.

## Install

From the `warpie-tools` marketplace:

```bash
/plugin marketplace add warpie-tools
/plugin install workflow-forge@warpie-tools
```

At enable time Claude Code prompts for the config below. Then, inside a project:

```
/workflow-forge:bootstrap
```

For local iteration from a working tree, add the repo as a local marketplace (`/plugin marketplace add <path-to-this-repo>`) and install from it, or run `claude plugin validate ./plugins/workflow-forge` to check the manifest.

## Install-time configuration (`userConfig`)

| Key | Type | Default | Effect |
| --- | --- | --- | --- |
| `tdd_mode` | string | `warn` | `enforced` blocks new source with no test, `warn` reminds, `off` disables the guard. |
| `pr_target_branch` | string | `staging` | Written into the generated CLAUDE.md and used by the review agent. |
| `precommit_gate` | boolean | `true` | Runs lint and tests before `git commit`; blocks on failure. |
| `maintain_tracking_files` | boolean | `true` | Creates and nudges WORKLOG.md and TODO.md. |
| `no_em_dash` | boolean | `true` | Generates CLAUDE.md and prose with no em dashes, first-person voice. |

Change these later in `/plugin` or with `claude plugin` config; hook changes take effect after `/reload-plugins`.

## Components

- **Skill `bootstrap`** — detects the stack and OS, reads your answers, writes a tailored CLAUDE.md plus TODO.md and WORKLOG.md. Never overwrites an existing CLAUDE.md without confirmation.
- **Skill `sync-capabilities`** — checks expected companion plugins/skills against what is installed and reports gaps.
- **Agent `iterative-reviewer`** — review-and-fix loop over a diff, re-runs lint/types/tests until clean. Invoke with `@agent-workflow-forge:iterative-reviewer`.
- **Agent `symmetric-auditor`** — finds sibling surfaces (create/edit/view, schema callers, procedures on the same table) and renders a verdict per sibling. Invoke with `@agent-workflow-forge:symmetric-auditor`.
- **Hooks**
  - `SessionStart` — suggests bootstrap when no CLAUDE.md exists.
  - `PreToolUse(Bash)` — pre-commit gate: lint + tests before a commit, blocks on failure (respects `--no-verify`).
  - `PreToolUse(Write|Edit)` — TDD guard in your chosen mode.
  - `PostToolUse(Write|Edit)` — symmetric-audit reminder on schema/router/route/form/.NET edits.
  - `Stop` — worklog reminder when WORKLOG.md falls behind.

## Stack and OS detection

`scripts/detect-stack.sh` reports the host OS (`windows` / `macos` / `linux`) and the toolchain. It recognises:

- **JS/TS:** pnpm/yarn/bun/npm, Next/Vite/Remix/Svelte/TanStack Start/node-server, Vitest/Jest/Playwright, ESLint/Biome/oxlint, Prisma/Drizzle/TypeORM.
- **.NET:** `.sln`/`.csproj`, ASP.NET Core and Aspire, xUnit/NUnit/MSTest, EF Core, `dotnet build`/`dotnet test`/`dotnet format`.
- **Rust** (`cargo`), **Go** (`go.mod`), **Python** (`pyproject.toml`/`requirements.txt`, pytest).

If a field comes back `unknown`, the bootstrap skill inspects the repo itself before writing rather than guessing.

## Notes and assumptions

- Hooks run shell at your trust level. They are conservative: they stay silent unless there is something to say, and only the pre-commit gate and the enforced TDD mode ever block.
- Hooks run under bash (`"shell": "bash"`), so they work in Git Bash on Windows as well as macOS/Linux. The scripts are dependency-free (no jq).
- The pre-commit gate detects the toolchain and runs `check`, `check-types`, and `test` (JS), `dotnet build` + `dotnet test` (.NET), `cargo test` (Rust), or `pytest` (Python) when present. Adjust `scripts/precommit-gate.sh` for a different command set.
- `sync-capabilities` reads the required list from `.claude/workflow.json` in the repo. That list is team policy; the skill will not invent it.
