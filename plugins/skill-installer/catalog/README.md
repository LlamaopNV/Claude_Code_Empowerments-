# Skill catalog

These are the **installable** skills surfaced by the `skill-installer` plugin.

They are intentionally **not** under a `skills/` directory, so Claude Code does
NOT auto-load them. They only become active skills once a user installs one via
`/skill-installer`.

## Adding a new skill (for developers)

Adding a skill is a drop-in — no code changes to the plugin are needed.

### 1. Create the folder

Make a kebab-case folder here, with a `SKILL.md` inside:

```
catalog/
  my-new-skill/
    SKILL.md
    scripts/        (optional — copied on install)
    references/     (optional — copied on install)
```

### 2. Write the frontmatter (this is what the installer shows)

The installer reads two fields from your `SKILL.md` frontmatter and shows them
to the user when they choose what to install. **Get these right** — they are
how a teammate decides whether to install your skill.

```markdown
---
name: my-new-skill
description: Use when [specific triggering conditions] — [what it does in one line].
---

# My New Skill

[Skill body…]
```

- **`name`** — the install name and the folder name it lands in. Keep it
  identical to the folder name. If omitted, the installer falls back to the
  folder name.
- **`description`** — shown verbatim in the install menu. Make it specific:
  *when* to use the skill and *what* it does. This doubles as the trigger
  Claude Code uses to auto-load the skill once installed, so vague descriptions
  hurt twice.

### 3. Commit

Commit the new folder. The next time anyone runs the installer, your skill
appears in the list automatically — there is nothing else to register.

### Declaring a dependency between skills

If your skill invokes another catalog skill, say so in the body (e.g. "this
skill invokes `/symmetric-audit`") and note it in the plugin
[`README.md`](../README.md) table. The installer has a built-in check for the
`iterative-review-fix` → `symmetric-audit` pairing; for new dependencies, add a
similar note so users install them together.

## Authoring tips

- **Be specific in `description`.** "Use when committing — enforces
  Conventional Commits" beats "helps with git".
- **Include "When to Use" / "When NOT to Use"** sections in the body to prevent
  misuse.
- **Self-contained folders.** Anything the skill needs at runtime
  (`scripts/`, `references/`) must live inside the skill folder — the installer
  copies the whole folder.
- **Reference other skills by `/name`** when one skill should invoke another.
