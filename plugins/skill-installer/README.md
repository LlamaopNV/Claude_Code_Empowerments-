# skill-installer

A Claude Code plugin that lets you **browse a catalog of team skills and install
the ones you want** — into either your user-global skills folder or the current
project's skills folder.

It is the marketplace-distributed, pick-what-you-want successor to the old
`skill-sync` bulk-sync framework: instead of copying every skill at once, you
choose.

## For users — installing skills

1. Make sure the plugin is enabled (it shows as **skill-installer** under the
   `warpie-tools` marketplace in `/plugins`).
2. Run `/skill-installer` (or just say "install a skill" / "what skills can I
   add?").
3. You'll see a numbered list of every catalog skill **with a description and
   its install status**. Reply with the numbers or names you want (or "all").
4. Choose **global** (`~/.claude/skills`, every project) or **project**
   (`<cwd>/.claude/skills`, this repo only).
5. The skills are copied in. They become active next time Claude Code starts
   (or after `/reload-plugins`).

Existing skills with the same name are never overwritten without a warning.

## What's in the catalog

The installable skills live in [`catalog/`](./catalog/). Current contents:

| Skill | What it does |
|-------|--------------|
| `conventional-commits` | Enforces Conventional Commits 1.0.0 for all git commits. |
| `symmetric-audit` | Audits sibling files (create/edit/view, schema consumers, route families) for divergence and fixes them. |
| `iterative-review-fix` | Automated review → evaluate → fix loop before commit/PR. Invokes `symmetric-audit` first. |
| `web-smoke-test` | Drives a real Chrome (via the chrome-devtools MCP) through a web change and reports browser + server failures. |
| `van-pletzen` | A for-laughs novelty persona. Talk _as_ Van Pletzen (the "Groothond") in his Mengels voice. Opt-in only: fires solely when you name it, never from topic or vibe. |

> `iterative-review-fix` depends on `symmetric-audit` — install both together.
> `web-smoke-test` requires the `chrome-devtools-mcp` plugin.
> `van-pletzen` is a joke skill and stays dormant until you explicitly ask for it by name.

## For developers — adding a skill to the catalog

See **[`catalog/README.md`](./catalog/README.md)** for the full step-by-step
guide. In short: drop a `<skill-name>/SKILL.md` folder into `catalog/`, give it
good frontmatter (`name` + a specific `description`), commit, and it shows up in
the installer automatically — no code changes needed.

## Layout

```
plugins/skill-installer/
├── .claude-plugin/plugin.json     # manifest (registered in marketplace.json)
├── README.md                      # this file
├── skills/
│   └── skill-installer/SKILL.md   # the installer logic (the only ACTIVE skill; run via /skill-installer)
└── catalog/                       # installable library — NOT auto-loaded
    ├── README.md                  # how to add a skill
    └── <skill-name>/SKILL.md
```

The `catalog/` folder is deliberately **not** named `skills/`, so its contents
are not auto-activated. Only `skills/skill-installer/` is an active skill.
