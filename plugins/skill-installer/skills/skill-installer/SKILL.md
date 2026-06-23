---
name: skill-installer
description: Use when the user wants to browse, list, choose, or install Claude Code skills from the skill-installer catalog. Triggers on "install a skill", "what skills can I add", "list available skills", "add the conventional-commits skill", or the /skill-installer command.
---

# Skill Installer

Browse the bundled skill **catalog** and install the skills the user selects
into either their user-global (`~/.claude/skills`) or current-project
(`<cwd>/.claude/skills`) directory.

The catalog is the source of truth. It lives **inside this plugin** at
`${CLAUDE_PLUGIN_ROOT}/catalog/` — it is NOT auto-loaded as active skills, so
nothing here is "on" until the user installs it.

## When to Use

- "Install a skill" / "add a skill"
- "What skills can I add?" / "list available skills" / "show me the catalog"
- "Install conventional-commits" (a specific catalog skill by name)
- The `/skill-installer` command

## When NOT to Use

- The user wants to **author** a new skill → point them at
  `${CLAUDE_PLUGIN_ROOT}/catalog/README.md` (the "Adding a skill" guide).
- The user wants to manage the plugin itself (enable/disable) → that's the
  native `/plugin` browser, not this skill.

## Procedure

Follow these steps in order.

### Step 1 — Read the catalog and current install state

List every immediate subdirectory of `${CLAUDE_PLUGIN_ROOT}/catalog/` that
contains a `SKILL.md`. For each one, read **only the YAML frontmatter** of its
`SKILL.md` and extract:

- `name` — the skill's install name (falls back to the folder name if the
  frontmatter is missing or has no `name`).
- `description` — used verbatim when presenting choices.

Then check whether each skill is **already installed**, in each scope:

- Global: `~/.claude/skills/<name>/` exists (`$HOME` on macOS/Linux,
  `%USERPROFILE%` on Windows).
- Project: `<cwd>/.claude/skills/<name>/` exists.

Keep this status per skill so you can show it in the list (`global`, `project`,
`global+project`, or not installed).

If the catalog is empty (only `README.md`, no skill folders), tell the user
there are no skills available to install and stop. Do not show an empty list.

### Step 2 — Print the catalog as a numbered list and ask what to install

Do **not** use `AskUserQuestion` or any fixed picker for this. Print the whole
catalog as a plain numbered Markdown list and let the user reply in their own
words with what they want. The list scales to any number of skills.

For each skill show: the number, the `name`, an install-status marker, and the
`description`. Order alphabetically by `name`. Use this shape:

```
Skill catalog (8). Status: [installed: global] / [installed: project] / [available]

  1. changelog-update      [available]
     Folds conventional commits since the last release into CHANGELOG.md.
  2. conventional-commits  [installed: global]
     Enforces Conventional Commits 1.0.0 for all git commits.
  ...

Reply with the skills to install — numbers or names, e.g. "1, 4, 7" or
"conventional-commits, jira-ticket". You can also say "all" or "none".
```

Showing each skill's description and its install status is core to this skill —
never print bare names, and always surface what is already installed so the user
does not reinstall by accident.

Then **wait for the user's reply** and resolve it to a set of catalog skills
(accept numbers, exact names, "all", or "none"). If anything is ambiguous or
does not match a catalog entry, ask once to clarify rather than guessing.

**Dependency check:** if the resolved selection includes `iterative-review-fix`
WITHOUT `symmetric-audit`, tell the user that `iterative-review-fix` invokes
`symmetric-audit` as its first step, and offer to add it.

If the selection is empty (or "none"), report that nothing was selected and stop.

### Step 3 — Choose the install target

Ask the user where to install (this is asked on **every** run):

- **User-global** → `~/.claude/skills` (available in every project on this
  machine).
- **Current project** → `<cwd>/.claude/skills` (scoped to this repo only).

Resolve `~` to the real home directory (`$HOME` on macOS/Linux,
`$env:USERPROFILE` / `%USERPROFILE%` on Windows). Resolve `<cwd>` to the
directory Claude Code is currently running in.

### Step 4 — Install each selected skill

For each selected skill, copy its **entire folder** from
`${CLAUDE_PLUGIN_ROOT}/catalog/<name>/` to `<target>/.claude/skills/<name>/`
(or `<target>/<name>/` when the target already ends in `skills`). Copy every
file in the folder, not just `SKILL.md` — a skill may ship `scripts/` or
`references/`.

- Create the target `skills` directory if it does not exist.
- If `<target>/skills/<name>/` **already exists**, warn the user and ask for
  confirmation before overwriting. Do not overwrite silently.
- Perform the copy with your own file tools so it works cross-platform
  (Windows / macOS / Linux). Do not rely on a single-OS shell idiom.

### Step 5 — Report

Print a concise summary:

```
Installed:
  <skill-name>  →  <full target path>
  ...
Skipped (already present, not overwritten):
  <skill-name>
```

End with: "Installed skills become active the next time Claude Code starts
(or after /reload-plugins)."

## Red Flags

| Thought | Reality |
|---------|---------|
| "I'll just list the skill names." | The user needs the descriptions to choose. Always include them. |
| "I'll use AskUserQuestion for the picker." | No. Print a numbered text list and let the user reply. The fixed picker is clunky and caps at 4. |
| "I won't bother showing what's installed." | Always show install status so the user does not reinstall by accident. |
| "I'll install to global by default." | Always ask global-vs-project. Never assume. |
| "I'll copy just the SKILL.md." | Copy the whole folder — scripts/references may exist. |
| "I'll overwrite the existing skill quietly." | Warn and confirm before any overwrite. |
| "They picked the review loop, that's enough." | iterative-review-fix needs symmetric-audit. Flag it. |
