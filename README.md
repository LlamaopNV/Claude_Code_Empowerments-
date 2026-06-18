# Claude Code Empowerments

A personal **marketplace** of [Claude Code](https://docs.claude.com/en/docs/claude-code) plugins and skills — empowerments for everyday coding.

This repo is a Claude Code plugin marketplace. Add it once, then browse and install any plugin it offers from inside Claude Code with `/plugin`.

## Install

In any Claude Code session:

```text
/plugin marketplace add LlamaopNV/Claude_Code_Empowerments-
```

Then open the plugin browser and install what you want:

```text
/plugin
```

The plugins in this marketplace appear under the **Discover** tab. Select one, press Enter to view it, and install.

> You can also add the marketplace by full URL if you prefer:
> `/plugin marketplace add https://github.com/LlamaopNV/Claude_Code_Empowerments-.git`

## What's inside

| Plugin | Category | Description |
| --- | --- | --- |
| `example-empowerment` | development | A copy-me template plugin demonstrating a skill, a command, and an agent. |
| `bake-to-completion` | development | Interviews you about a half-baked software/product idea, stress-tests every aspect, and hands off a strengthened brief for planning. |

## Repository layout

```text
.
├── .claude-plugin/
│   └── marketplace.json          # The marketplace catalog (lists every plugin)
├── plugins/
│   └── example-empowerment/      # One plugin = one folder
│       ├── .claude-plugin/
│       │   └── plugin.json        # Plugin manifest
│       ├── skills/
│       │   └── example-skill/
│       │       └── SKILL.md       # A skill (model-invoked)
│       ├── commands/
│       │   └── example-command.md # A slash command
│       └── agents/
│           └── example-agent.md   # A subagent definition
├── CHANGELOG.md
└── README.md
```

## Add your own plugin

1. **Create the plugin folder** under `plugins/<your-plugin-name>/`.
2. **Add a manifest** at `plugins/<your-plugin-name>/.claude-plugin/plugin.json`:

   ```json
   {
     "name": "your-plugin-name",
     "version": "0.1.0",
     "description": "What your plugin does.",
     "author": { "name": "LlamaopNV" },
     "license": "MIT"
   }
   ```

3. **Add components** in the conventional folders (all optional):
   - `skills/<name>/SKILL.md` — model-invoked skills.
   - `commands/<name>.md` — `/your-plugin-name:<name>` slash commands.
   - `agents/<name>.md` — subagents.
   - `hooks/hooks.json` — event hooks.
   - `.mcp.json` — MCP servers.
4. **Register it** in `.claude-plugin/marketplace.json` by adding an entry to the
   `plugins` array:

   ```json
   {
     "name": "your-plugin-name",
     "source": "./plugins/your-plugin-name",
     "description": "What your plugin does.",
     "version": "0.1.0",
     "category": "development"
   }
   ```

The fastest path is to **copy `plugins/example-empowerment/`**, rename it, and edit
the contents — it already has a working skill, command, and agent to use as templates.

## Validate before you push

```bash
claude plugin validate .
```

This checks the marketplace manifest and every referenced plugin.

## License

MIT
