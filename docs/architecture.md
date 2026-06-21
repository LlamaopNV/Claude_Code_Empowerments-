# Architecture

Anvil is a Claude Code plugin plus an MCP server and companion API that run native, in-session A/B evals of skills, subagents, and plugins — recovering ground truth by reading the session's own transcript JSONL, with no `claude -p` and no external process spawning.

See also: [metrics-reference.md](metrics-reference.md), [improvement-loop.md](improvement-loop.md), [running-an-eval.md](running-an-eval.md), [running-live.md](running-live.md), [generating-test-data.md](generating-test-data.md), [getting-started.md](getting-started.md).

## The components

Anvil is one in-process server bridging a Claude Code plugin to a dashboard UI, all sharing a single typed contract.

| Component | What it is | Role |
|---|---|---|
| **Plugin** (`plugins/anvil/`) | Commands + skills + subagents | The in-session orchestration: drives runs, generates data, closes the improvement loop |
| **MCP server** (`packages/server`, stdio) | Tools the model calls | Bridges the orchestration skills to storage + scoring + introspection |
| **Companion REST/WS API** (same process) | Local HTTP + WebSocket | Feeds the UI in live mode and pushes new scorecards |
| **UI** (`packages/ui`, Vite/React) | Dual-mode dashboard | Renders scorecards live (API/WS) or from static committed JSON (Pages) |
| **`@anvil/core`** (`packages/core`) | Pure TS lib (Zod schema + scoring math + introspection) | The frozen shared contract reused by server, plugin tooling, and UI typegen |

### Plugin surfaces

- **Commands:** `/anvil-gen-testdata`, `/anvil-eval`, `/anvil-improve`.
- **Skills:** `generating-test-data`, `running-an-eval`, `improving-an-artifact`.
- **Subagents:** `anvil-testdata-generator`, `anvil-task-runner` (treatment/baseline modes), `anvil-judge` (pairwise, position-swapped), `anvil-analyst`.

Evals run **in-session via subagents** (the `Task` tool) on the user's subscription — no `claude -p`, no spawned external process.

### MCP server tools (the model calls these)

`anvil_list_suites`, `anvil_get_suite`, `anvil_save_suite`, `anvil_validate_suite`, `anvil_introspect_transcript` (reads transcript JSONL → `RunTrace`), `anvil_score` (runs the core scoring math → `Scorecard`), `anvil_save_scorecard`, `anvil_record_run`.

### Companion REST/WS API (the UI calls these)

`GET /api/suites`, `GET /api/results`, `GET /api/results/:id`, `GET /api/traces/:agentId`, plus a **WebSocket** channel that pushes new/updated scorecards live. The same process can serve the built UI statically for a one-command local experience. See [running-live.md](running-live.md).

## Data flow

The loop is **generate test data → measure → propose improvements → re-measure delta** (`docs/execution-plan.md` §0.5):

1. **`/anvil-gen-testdata`** → the `anvil-testdata-generator` subagent drafts a balanced `EvalSuite` (should-fire, should-not-fire near-misses, task cases with rubrics), saved via the MCP server. The coverage check (`checkSuiteCoverage`) gates it for human review.
2. **`/anvil-eval`** → the `running-an-eval` skill dispatches **treatment** and **baseline** `anvil-task-runner` subagents ×`reps`, then **`anvil-judge`** subagents **pairwise and position-swapped**.
3. **The server reads the transcript JSONL** for activation (Skill/Task `tool_use`) + token usage.
4. **`@anvil/core` computes a `Scorecard`** with confidence intervals (`buildScorecard`).
5. The server **stores** the scorecard and **pushes it to the UI over WebSocket**.
6. **`/anvil-improve`** → the `anvil-analyst` subagent proposes minimal edits → (on confirmation) edits are applied → **re-run** → the before/after **delta** is computed and shown. See [improvement-loop.md](improvement-loop.md).

```
  /anvil-gen-testdata        /anvil-eval                          /anvil-improve
        │                         │                                     │
        ▼                         ▼                                     ▼
 ┌───────────────┐   ┌──────────────────────────────┐        ┌──────────────────┐
 │ testdata-     │   │ running-an-eval skill         │        │ improving-an-    │
 │ generator     │   │  ├─ treatment runner ×reps    │        │ artifact skill   │
 │ → EvalSuite   │   │  ├─ baseline  runner ×reps    │        │  ├─ anvil-analyst│
 └──────┬────────┘   │  └─ anvil-judge (pos-swapped) │        │  │   → proposals │
        │            └───────────────┬───────────────┘        │  ├─ confirm (you)│
        │                            │                         │  ├─ apply edits  │
        │     ┌──────────────────────┼─────────────────────┐   │  └─ re-run ──────┼──┐
        ▼     ▼                      ▼                      │   └──────────────────┘  │
 ┌──────────────────────────────────────────────────────┐  │                         │
 │            Anvil MCP server (stdio) + REST/WS         │◀─┘  computeRunDelta ◀───────┘
 │  list/get/save/validate suite · introspect transcript│
 │  · score · save scorecard · record run               │
 │   reads  <configRoot>/projects/<projectHash>/         │
 │          <sessionId>/subagents/agent-<agentId>.jsonl  │
 └───────────────┬──────────────────────────┬───────────┘
                 │  uses @anvil/core         │  WS push + REST
                 ▼  (schema + scoring)       ▼
        ┌──────────────────┐        ┌──────────────────────┐
        │   @anvil/core    │        │   UI (dual-mode)     │
        │  Zod contract +  │        │  live API/WS  ──or──  │
        │  scoring math    │        │  static committed JSON│
        └──────────────────┘        └──────────────────────┘
```

## Transcript introspection

Anvil never shells out to discover what happened — it reads the transcript the session already writes. Subagent transcripts live at:

```
<configRoot>/projects/<projectHash>/<sessionId>/subagents/agent-<agentId>.jsonl
```

The main session transcript is `<configRoot>/projects/<projectHash>/<sessionId>.jsonl` and supplies the dispatch record (`name: "Agent"` + `subagent_type`) and skill activations (`name: "Skill"` + `skill`). The introspection lib normalizes a transcript into a `RunTrace` (ordered events, `toolUses[]`, per-message `usage` incl. cache-token breakdown, `finalText`, `pluginErrors`). These transcript facts are verified in [spike-findings.md](spike-findings.md); critically, the dispatched **agentId is the filename**, so a subagent transcript can be resolved by **agentId-glob alone** — no extra mapping needed. Activation is therefore read as **verified ground truth from `tool_use` records, not heuristics** (see [metrics-reference.md](metrics-reference.md)).

## The shared contract (`@anvil/core`)

`@anvil/core` is the frozen seam every other component depends on. It is pure and I/O-free, holding:

- the **Zod schema + types** — `EvalSuite`, `ArtifactRef` (`skill | subagent | plugin`), `EvalCase`, `Expectation`, and the result contract (`RunTrace`, `MetricResult`, `ConfusionMatrix`, `JudgeSample`, `Scorecard`, `RunIndexEntry`, `index.json`);
- the **scoring math** — deterministic expectation evaluation, pairwise judge aggregation with position-swap reconciliation, token-based cost against a pinned pricing table, variance/CIs, and plugin-load integrity;
- the **transcript-introspection lib**.

Freezing this contract (a `RESULT_SCHEMA_VERSION` guards breaking changes; only additive changes are allowed without a bump) is what lets the **UI epic proceed in parallel** against fixtures while the server and plugin are built — the server stores it, the model produces it via MCP tools, and the UI types itself from it.

## Why native (no `claude -p`)

Evals run as in-session subagents on the user's subscription. The baseline ("without the artifact") is achieved by **subagent instruction / role** (a baseline runner prompted without the artifact, or a specialized subagent versus `general-purpose`) rather than a separate process — a documented tradeoff (instruction-level isolation is weaker than process isolation; see the role-isolation tradeoff in [metrics-reference.md](metrics-reference.md)). The win is that activation and token usage are recovered directly from the transcript the session already writes, with zero external orchestration.
