# Anvil plugin (skeleton)

Native effectiveness evals & improvement loop for Claude Code skills, subagents,
and plugins. This is the **plugin skeleton** (Ticket 0.3); the commands, skills,
and agents are filled in by later epics (E3–E5).

## Layout

- `.claude-plugin/plugin.json` — plugin manifest (`name: anvil`).
- `.mcp.json` — registers the **`anvil`** MCP server.
- `commands/` — `/anvil-eval`, `/anvil-gen-testdata`, `/anvil-improve` (Epic 3–5).
- `skills/` — `running-an-eval`, `generating-test-data`, `improving-an-artifact` (Epic 3–5).
- `agents/` — `anvil-task-runner`, `anvil-judge`, `anvil-testdata-generator`, `anvil-analyst` (Epic 3–5).

## MCP server wiring (placeholder — Epic 2 makes it real)

`.mcp.json` launches the server's stdio entry built from `packages/server`:

```
node ${CLAUDE_PLUGIN_ROOT}/../../packages/server/dist/bin/anvil-server.js
```

- **bin name:** `anvil-server` (declared in `packages/server/package.json`).
- The path is resolved from `${CLAUDE_PLUGIN_ROOT}` (this `plugins/anvil` dir)
  back up to the repo root, then into the built server. **The server must be
  built first** (`npm run build`) before the MCP server can start — Epic 2 will
  document the build/start lifecycle and may add a published bin so `npx
  anvil-server` works without the relative path.
- Today the entry is a placeholder that prints server info (schema versions);
  the stdio MCP protocol implementation lands in Ticket 2.2.
