---
name: example-skill
description: Use when you need a starting point for a new skill — this is a template that explains the SKILL.md format and is safe to copy and rename.
---

# Example Skill

This is a template skill shipped with the `example-empowerment` plugin. Copy this
folder, rename it, and rewrite the frontmatter + body to create your own skill.

## How a skill is structured

A skill lives at `skills/<skill-name>/SKILL.md`. The YAML frontmatter at the top
has two fields that matter most:

- `name` — the kebab-case identifier (defaults to the folder name).
- `description` — a tight, trigger-focused sentence. Claude reads this to decide
  *when* to invoke the skill, so phrase it as "Use when …".

Everything below the frontmatter is the instruction content Claude follows once
the skill is invoked.

## When writing your own

1. Lead the `description` with the trigger ("Use when …"), not the mechanism.
2. Keep the body actionable: numbered steps, concrete examples, clear stop points.
3. Put supporting files (scripts, references) next to this `SKILL.md` and link them.

Replace this content entirely — it exists only to show the shape.
