# Getting started with Anvil

Install, build, and load Anvil so you can generate test data and run effectiveness evals on your own Claude Code skills, subagents, and plugins.

Anvil is a native effectiveness-eval and improvement loop for Claude Code artifacts. It runs entirely **in-session via subagents on your subscription** — there is no external `claude -p` and no API key. This page gets the toolchain installed and the plugin loaded; then follow [generating-test-data.md](generating-test-data.md) and [running-an-eval.md](running-an-eval.md).

## Prerequisites

- Node ≥ 20
- A Claude Code subscription (evals consume quota)
- This repo checked out

## 1. Install dependencies

Anvil is an npm-workspaces monorepo with three packages — `@anvil/core` (schemas, scoring, introspection), `@anvil/server` (the MCP stdio server plus a REST/WS companion API), and `@anvil/ui` (the Vite/React dashboard). Install everything from the repo root:

```bash
npm ci
```

## 2. Build core and the server

The plugin's MCP server is `@anvil/server`, and it imports the **compiled** `@anvil/core`. Build core first, then the server:

```bash
npm run build -w @anvil/core
npm run build -w @anvil/server
# or build every workspace at once:
npm run build
```

This produces:

- `packages/core/dist/` — the schemas the server validates suites and scorecards against.
- `packages/server/dist/bin/anvil-server.js` — the `anvil-server` bin the plugin launches.

Smoke-test the binary:

```bash
node packages/server/dist/bin/anvil-server.js info
# → {"name":"anvil-server","version":"0.1.0","evalSchemaVersion":1,"resultSchemaVersion":1}
```

The bin has three subcommands: `mcp` (the stdio MCP server the plugin spawns), `serve` (the companion REST/WS API for the dashboard), and `info` (the smoke probe above).

## 3. Install and load the Anvil plugin

The Anvil plugin lives at `plugins/anvil/` in this repo's marketplace. In a Claude Code session:

1. Add the marketplace (if not already added):

   ```text
   /plugin marketplace add LlamaopNV/Claude_Code_Empowerments-
   ```

2. Open `/plugin`, find **anvil**, and install/enable it.

The plugin spawns its MCP server from `plugins/anvil/.mcp.json`, which launches the built `anvil-server` (in `mcp` mode) relative to the repo root. So **the server must be built (step 2) before the plugin can start.**

### Reload after any change

> **Important:** the MCP server is launched once when the plugin loads. After you **rebuild `@anvil/server`** or **edit the plugin**, you must reload it — otherwise you run against a stale server. Either open `/plugin` and toggle **anvil** off and on, or restart the Claude Code session.

## 4. Confirm the MCP tools are available

Ask Claude to "list the anvil MCP tools", or check that tools such as `anvil_list_suites`, `anvil_introspect_transcript`, and `anvil_record_run` are present. If they are not, the server probably is not built or the plugin needs a reload (see above).

## 5. (Optional) Start the dashboard

The eval itself does **not** need the HTTP server — orchestration talks to the MCP server over stdio. But to watch results land live, start the companion REST/WS API in a terminal:

```bash
node packages/server/dist/bin/anvil-server.js serve --port 4319
```

To also serve the built dashboard from the same process, build the UI first and pass `--ui-dir`:

```bash
npm run build -w @anvil/ui
node packages/server/dist/bin/anvil-server.js serve --port 4319 --ui-dir packages/ui/dist
# then open http://127.0.0.1:4319
```

Without a reachable server the dashboard falls back to a static demo. For the full dashboard walkthrough (live vs. demo mode, the live-server badge), see [running-live.md](running-live.md).

## Next steps

1. **[generating-test-data.md](generating-test-data.md)** — synthesize a balanced eval suite for an artifact and review it.
2. **[running-an-eval.md](running-an-eval.md)** — run the eval and read the scorecard.
3. **[running-live.md](running-live.md)** — the end-to-end live walkthrough, including the dashboard.

Related: [architecture.md](architecture.md) · [metrics-reference.md](metrics-reference.md) · [improvement-loop.md](improvement-loop.md)
