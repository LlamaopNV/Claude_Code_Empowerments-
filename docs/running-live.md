# Running Anvil live — your first real eval (USER guide)

This is the exact, ordered path to turn the shipped **illustrative demo** into **real measured data**
on your own Claude Code subscription. Everything runs in-session via subagents — there is no external
`claude -p` and no API key. It does consume subscription quota, so the steps below start with a cheap
smoke before any full run.

> Prerequisites: Node ≥ 20, a Claude Code subscription, this repo checked out, and `npm ci` already run
> at the repo root.

---

## 1. Build the server (and core)

The plugin's MCP server is `@anvil/server`; it imports the compiled `@anvil/core`. Build both:

```bash
npm run build -w @anvil/core
npm run build -w @anvil/server
# or just: npm run build   (builds every workspace)
```

This produces `packages/server/dist/bin/anvil-server.js` (the `anvil-server` bin the plugin's
`.mcp.json` launches) and `packages/core/dist/` (the schemas the server validates against).

Sanity check the binary:

```bash
node packages/server/dist/bin/anvil-server.js info
# → {"name":"anvil-server","version":"0.1.0","evalSchemaVersion":1,"resultSchemaVersion":1}
```

## 2. Make sure the Anvil plugin is loaded and enabled

The Anvil plugin lives at `plugins/anvil/` in this repo's marketplace. In a Claude Code session:

1. Add/refresh the marketplace (if not already added):
   `/plugin marketplace add LlamaopNV/Claude_Code_Empowerments-`
2. Open `/plugin`, find **anvil**, and install/enable it.
3. **Reload after any change** to the plugin or the server build: run `/plugin` and toggle anvil off/on,
   or restart the Claude Code session. The MCP server is spawned from `plugins/anvil/.mcp.json`, so a
   fresh build of `@anvil/server` only takes effect after a plugin reload / session restart.

Confirm the MCP tools are available — ask Claude to "list the anvil MCP tools" or check that
`anvil_list_suites`, `anvil_introspect_transcript`, `anvil_record_run`, etc. are present.

## 3. Start the companion server for the dashboard (optional but recommended)

The eval itself does **not** need the HTTP server — the orchestration skill talks to the MCP server
over stdio. But to watch results live in the dashboard, start the companion REST/WS API in a terminal:

```bash
node packages/server/dist/bin/anvil-server.js serve --port 4319
# Optionally serve the built UI too:
#   npm run build -w @anvil/ui   (first)
#   node packages/server/dist/bin/anvil-server.js serve --port 4319 --ui-dir packages/ui/dist
```

Then open the UI: either `http://127.0.0.1:4319` (if you passed `--ui-dir`) or run the UI dev server
(`npm run dev -w @anvil/ui`) which auto-detects the live server and shows a **live server** badge.

## 4. Generate a test suite for an artifact

Pick an artifact to evaluate (a skill, subagent, or plugin). In the Claude Code session:

```text
/anvil-gen-testdata bake-to-completion
```

The generator drafts a **balanced** suite — should-fire cases, should-not-fire near-misses, and task
cases with rubrics — validates it against `@anvil/core`, and saves it under `evals/`. Review it in the
dashboard's test-data panel (or open the YAML) and edit anything that looks unbalanced before trusting
the scores. A weak/unbalanced suite biases every metric.

## 5. Cheap smoke run (1 rep) before the full run

Always smoke first — it confirms the whole pipeline works end-to-end for ~1/Nth of the quota:

```text
/anvil-eval bake-to-completion --reps 1
```

The skill prints a **pre-flight estimate** ("N cases × 1 rep = X runner + Y judge subagent
dispatches") and asks you to confirm before spending quota. Confirm. It then, sequentially:

- dispatches a **treatment** and a **baseline** `anvil-task-runner` per case,
- introspects each subagent transcript **by agentId alone** (the server globs
  `…/projects/<projectHash>/*/subagents/agent-<agentId>.jsonl` — you do not need the session id),
- dispatches a **position-swapped** `anvil-judge` pair, and
- records a `Scorecard` via `anvil_record_run`.

If the smoke produces a valid scorecard, run the full thing (the suite's own `repetitions`, e.g. 5):

```text
/anvil-eval bake-to-completion
```

## 6. Read the scorecard

The run reports headline metrics **with spread** (never a bare number):

- **activation.precision / recall / f1** — did the artifact fire when it should (and stay quiet when it
  shouldn't)? With the confusion matrix's offending case ids.
- **quality.delta** — pairwise treatment-vs-baseline win rate, position-swap-calibrated, with a 95% CI.
- **cost.tokens / cost.usd** — token-based; on a subscription the USD figure is an **estimate, not a
  billed amount** (see Metrics Reference).

Open the dashboard to drill into per-case judge rationales and the tool-use timeline. The run id is
printed; the leaderboard lists it.

## 7. Improve, then re-measure

```text
/anvil-improve bake-to-completion
```

The analyst proposes concrete, minimal edits tied to the metric each should move, asks for confirmation
before editing any file, then re-runs and reports the **before/after delta**.

---

## Caveats to know up front

- **Cross-process WS-push refresh.** The eval records scorecards through the MCP server process; the
  HTTP/WS server you started in step 3 is a *separate* process. The storage layer is not a cross-process
  lock and the WS push only fires for saves made through the HTTP server instance. **In practice: if a
  new run doesn't appear live, refresh the dashboard** (it re-reads `results/index.json` from disk on
  load). This is a known MVP limitation, not data loss — the result is on disk.
- **Quota.** Dispatch count is `cases × reps × (2 runners + 2 judges)`. A 5-case suite at 5 reps is
  250 subagent dispatches. Use `--reps 1` to smoke; let caching (`--no-cache`/`--refresh`) skip
  unchanged cases when iterating. Always read the pre-flight estimate before confirming.
- **Reload discipline.** Re-build the server → reload the plugin (or restart the session) or you'll run
  against a stale MCP server.
- **Role-isolation tradeoff.** "Baseline" is the same task run without the artifact's guidance — an
  in-session, instruction-level contrast, not a separate clean process. See Metrics Reference for the
  threat-to-validity discussion.
