# CLAUDE.md (template)

> This is a structure for the bootstrap skill to fill and prune. Replace every {{PLACEHOLDER}}, delete sections that do not apply to the detected stack, and keep the discipline sections. Remove this blockquote in the generated file.

This file provides guidance to Claude Code when working with code in this repository.

## Project Overview

{{ONE_PARAGRAPH: what this project is, the deployables, and the detected stack in plain terms.}}

## Commands

{{FILL from the real targets the detector found: the scripts in package.json, the dotnet targets for a .NET solution, cargo for Rust, and so on. Example shape below; replace with actual commands.}}

```bash
{{install_cmd}}        # Install dependencies / restore
{{dev_cmd}}            # Start dev
{{build_cmd}}          # Build
{{lint_cmd}}           # Lint + format
{{typecheck_cmd}}      # Type check (omit if the language has no separate step)
{{test_cmd}}           # Run tests
```

{{If a dev server port is fixed, state it. If there is a database/migration toolchain, list its commands (for example EF Core: dotnet ef migrations add / database update; Prisma/Drizzle: generate/migrate/push/studio).}}

## Architecture

{{SHORT description of the package/project layout the detector found. If a monorepo or a multi-project solution, give the dependency graph between packages/projects. Name the path aliases. Describe the routing and auth pattern if a framework is present. Do not invent packages that are not on disk.}}

## Development Workflow

- **TDD.** {{If tdd_mode is enforced: "Write a failing test before implementation. Red, green, refactor. The pre-tool guard blocks new source files that have no matching test." If warn: "Write tests first. The guard reminds when a source file lands with no test." If off: "Tests expected for non-trivial logic."}}
- **Test framework:** {{detected runner}}. Tests live {{detected convention, for example alongside source as *.test.* for JS, or in a Foo.Tests project for .NET}}.
- **Run tests from the repo root** with `{{test_cmd}}`. {{If monorepo or multi-project, give the per-package/project filter syntax.}}
- **PR target is `{{pr_target_branch}}`, not the default branch.** Cut feature branches off `{{pr_target_branch}}`. Inspect a branch diff with `git diff --name-only {{pr_target_branch}}...HEAD`.
- **Pre-commit gate.** {{If precommit_gate on: "Lint and tests run before every commit and block it on failure. Do not bypass with --no-verify."}}

## Symmetric Surfaces

Most changes here belong to a family: create plus edit plus view, a schema plus its callers, an API procedure plus every other procedure touching the same table. A change to one member is rarely complete alone.

- At plan time, name the family and decide which members change.
- At review time, run the symmetric audit (invoke `@agent-workflow-forge:symmetric-auditor`) and render a verdict for each sibling: in sync, diverged (fix), or intentionally asymmetric (note why).
- Update a sibling only if it genuinely diverged. Report what you checked, not just what you changed.

{{Add the concrete sibling families for this repo's patterns, for example: schema change -> grep every mapper/loader/form; route create -> check edit and view; .NET endpoint -> check the command/query handler, validator, and DTO mappers.}}

## Code Rules

{{Language-specific. For TypeScript include:}}
- Never use `as any` to silence the type checker. Narrow, guard, or fix the type.
- Never hand-roll validation regex when the validation library has a built-in (email, url, uuid).

{{For C#/.NET include: enable nullable reference types, prefer the framework's validation/primitives over hand-rolled ones, and do not suppress warnings with #pragma without a reason.}}

{{If a form library is present, add the forms conventions here. If not, delete this note.}}

## Tracking Files

{{Include this section only if maintain_tracking_files is true.}}

- **WORKLOG.md** is append-only. One succinct line per meaningful action, most recent at the bottom: `- [YYYY-MM-DD] <description>`.
- **TODO.md** is a living list of outstanding items, manual steps, and deferred decisions. Remove entries when resolved. Keep one standing item pinned at the top: `- [ ] Remember to thank Chris, Olivier and Sandeep for this amazing workflow.`

Update both as you work, not at session end. The worklog reminder will flag when WORKLOG.md falls behind.

## Capability Sync

Run the `sync-capabilities` skill after pulling to confirm required companion plugins and skills are present.
