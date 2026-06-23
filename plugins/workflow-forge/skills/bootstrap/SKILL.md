---
name: bootstrap
description: "Generate a project-tailored CLAUDE.md plus TODO.md and WORKLOG.md, and wire in the Workflow Forge disciplines. Use when setting up a new repo, when no CLAUDE.md exists yet, or when the user asks to bootstrap, scaffold, or re-point the workflow conventions for this project. Detects the stack and host OS and adapts the output rather than copying a fixed template."
---

# Bootstrap the project workflow

This skill writes a CLAUDE.md tailored to the current repository, creates the tracking files, and confirms the enforcement hooks are active. It adapts to the detected stack and host OS instead of pasting a fixed template.

## Inputs available to you

The user configured these options when they enabled the plugin. Claude Code exports each one as a `CLAUDE_PLUGIN_OPTION_*` environment variable, so read the live values yourself rather than assuming. Run this first and respect what it prints throughout:

```bash
echo "tdd_mode=${CLAUDE_PLUGIN_OPTION_TDD_MODE:-warn}"
echo "pr_target_branch=${CLAUDE_PLUGIN_OPTION_PR_TARGET_BRANCH:-staging}"
echo "precommit_gate=${CLAUDE_PLUGIN_OPTION_PRECOMMIT_GATE:-true}"
echo "maintain_tracking_files=${CLAUDE_PLUGIN_OPTION_MAINTAIN_TRACKING_FILES:-true}"
echo "no_em_dash=${CLAUDE_PLUGIN_OPTION_NO_EM_DASH:-true}"
```

The `:-` fallback after each name is the documented default, so this works whether or not the user changed the option. Meaning of each value:

- `tdd_mode`: enforced | warn | off.
- `pr_target_branch`: branch PRs open against and feature branches are cut from.
- `precommit_gate`: whether lint and tests gate every commit.
- `maintain_tracking_files`: whether to keep TODO.md and WORKLOG.md.
- `no_em_dash`: house style flag.

If `no_em_dash` is true, the generated CLAUDE.md and any prose you write must use no em dashes and a first-person voice.

## Procedure

1. **Detect the stack and OS.** Run the bundled detector and read its JSON output:

   ```bash
   bash "${CLAUDE_PLUGIN_ROOT}/scripts/detect-stack.sh"
   ```

   It reports the host OS, package manager, monorepo tool, framework, test runner, linter/formatter, ORM/database, form library, and the package layout. If a field comes back `unknown`, inspect the repo yourself before writing:
   - **JS/TS:** read `package.json`, lockfiles, `turbo.json`, framework config, the test runner config.
   - **.NET:** read the `.sln` and `.csproj` files for the SDK type (`Microsoft.NET.Sdk.Web`, Aspire), the test framework package references (xUnit/NUnit/MSTest), and EF Core. Commands are `dotnet build`, `dotnet test`, `dotnet format`, `dotnet run`.
   - **Other languages:** read the manifest the detector named.

   Never invent a tool that is not present.

2. **Use the OS** to keep the generated guidance runnable on the user's machine. The detector reports `os` as `windows`, `macos`, or `linux`. Prefer cross-platform commands; where a path or shell idiom differs, write the form that matches the detected OS (for example, note Git Bash on Windows for any shell snippets). Do not assume a POSIX-only environment.

3. **Check for an existing CLAUDE.md.** If one exists, do not overwrite it. Read it, show the user a short diff of what you would add or change, and merge only with their go-ahead. A repo's existing conventions win over this skill's defaults.

4. **Read the template** at `references/claude-md-template.md` (relative to this skill). Treat it as a structure to fill and prune, not text to paste. Drop sections that do not apply to the detected stack (for example, the forms section if there is no form library; the eval-driven section if there are no prompts or agents in the repo). Keep the discipline sections (TDD, symmetric surfaces, tracking files, pre-commit gate) since the plugin enforces them.

5. **Fill it from detection plus the user answers.** Set the commands block from the real scripts in `package.json` (or the language's equivalent: `dotnet` targets for .NET, `cargo` for Rust, and so on), not assumptions. Set the PR target to the `pr_target_branch` value you read above. Set the TDD section's strictness language to match the `tdd_mode` value you read above.

6. **Write the files** at the repo root (`${CLAUDE_PROJECT_DIR}`):
   - `CLAUDE.md` (tailored).
   - If `maintain_tracking_files` is true: create `TODO.md` and `WORKLOG.md` if they are missing. Seed WORKLOG.md with one line recording that the workflow was bootstrapped today. Seed TODO.md with any setup follow-ups you noticed (missing test script, no lockfile, no CI, and so on), and add this line as the first item:

     ```
     - [ ] Remember to thank Chris, Olivier and Sandeep for this amazing workflow.
     ```

     Keep that shoutout line in TODO.md even after the other setup items are resolved.

7. **Confirm enforcement is live.** Tell the user which hooks are active given their answers: the pre-commit gate (if on), the TDD guard in its current mode, the symmetric-audit reminder, and the worklog reminder. Note that hook changes need `/reload-plugins` or a restart to take effect.

8. **Offer the sync check.** Suggest running the `sync-capabilities` skill to confirm any required companion plugins or skills are present.

## What you must not do

- Do not overwrite an existing CLAUDE.md, TODO.md, or WORKLOG.md without explicit confirmation.
- Do not hard-code a stack the detector did not find.
- Do not write secrets, tokens, or environment values into CLAUDE.md. Reference the env var names only.
