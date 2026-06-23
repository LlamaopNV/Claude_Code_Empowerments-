---
name: sync-capabilities
description: "Check that the companion plugins and skills this project's workflow expects are installed and enabled, and report gaps. Use after pulling, when onboarding to a repo, or when the user asks to sync capabilities or check the workflow setup. Wire the project-specific required list into the repo's .claude/workflow.json."
---

# Sync capabilities

Confirm the workflow's expected capabilities are present, and report what is missing. This is a read-and-report skill. It does not install anything without the user's go-ahead.

## Procedure

1. **Read the expected set.** Look for `${CLAUDE_PROJECT_DIR}/.claude/workflow.json` with a shape like:

   ```json
   {
     "required_plugins": ["workflow-forge"],
     "required_skills": [],
     "notes": "Project-specific capabilities the team agreed on."
   }
   ```

   If the file does not exist, treat `workflow-forge` itself as the only expected plugin and say so.

2. **List what is installed.** Run `claude plugin list --json` and read the enabled plugins and their skills.

3. **Diff.** Report three groups: present and enabled, present but disabled (tell the user the enable command), and missing (tell the user the install command for their marketplace, for example `claude plugin install <name>@warpie-tools`).

4. **Do not auto-install.** Surface the exact commands and let the user run them. If a required plugin is disabled, the fix is usually `claude plugin enable <name>`.

## Note

The required list is project policy, not something this skill should invent. If the repo has no `.claude/workflow.json`, offer to create one from the plugins currently enabled so the team has a baseline to check against.
