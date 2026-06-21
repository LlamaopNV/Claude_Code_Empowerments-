# Anvil — Execution Plan (Native Architecture)

**Multi-ticket, sub-agent-driven implementation plan**
Derived from `idea-briefs/2026-06-21-claude-artifact-eval-pipeline.md` (revised).

**Architecture in one line:** Anvil is a **Claude Code plugin** (commands + skills + subagents) plus
an **MCP server** that bridges to a **local/Pages UI**. Evals run **in-session via subagents** on the
user's subscription — **no `claude -p`, no external process spawning**. Activation and token usage are
recovered by the server reading the **session transcript JSONL** the session already writes. The loop
is **generate test data → measure → propose improvements → re-measure delta**.

---

## 0. How to use this plan

Executed by **sub-agents, one ticket at a time**, coordinated by the main Claude Code session
(orchestrator). Every ticket is self-contained.

### 0.1 The Fable-5 reasoning mandate (prepend to EVERY sub-agent dispatch)

> **Reason like you are running Fable 5.** Work from first principles, not pattern-matching. State
> your assumptions explicitly and verify each against the actual code or docs before relying on it.
> Before writing code, write the test that would falsify it (TDD). After writing code, adversarially
> attack your own solution — what input breaks it, what did you not handle, what did you assume about
> the environment? Prefer the simplest design that satisfies the acceptance criteria; do not
> gold-plate. If you discover the ticket's premise is wrong, STOP and report back rather than building
> on a false foundation. Never claim something works until you have run it and read the output.
> Concrete over vague, evidence over assertion, every time.

### 0.2 Execution discipline (all tickets)

- **TDD mandatory** (`superpowers:test-driven-development`). Red → green → refactor.
- **No quota burn in tests.** Tests never dispatch real subagents/judges; use the **mock
  orchestrator + recorded transcript fixtures** (Ticket 1.4). Only Ticket 0.1 and the dogfood evals
  (Epic 7) run live in a real session.
- **Verify before claiming done** (`superpowers:verification-before-completion`) — paste the output.
- **Conventional commits**, GPG-signed (start gpg-agent first — project memory).
- **Cross-platform** (author on Windows): Node + path-safe; UI builds on Win/macOS/Linux.

### 0.3 Resolved technical decisions

| Decision | Choice | Rationale |
|---|---|---|
| Delivery form | **Claude Code plugin** at `plugins/anvil/` (this repo's marketplace) | Native, installable, matches repo convention |
| Execution model | **In-session subagents** (`Task` tool): treatment / baseline / judge | Native, on-subscription; **no `claude -p`** |
| Bridge to UI | **MCP server** (stdio for Claude) + **companion REST/WS** (for the UI), one process | Model tools + live UI data |
| Introspection | Server reads **session/subagent transcript JSONL** for activation + usage | Ground truth without shelling out |
| Baseline | **Role/instruction-isolated** subagent (or subagent-vs-`general-purpose`) | In-session A/B; tradeoff documented |
| Shared logic | **`core`** TS lib (Zod schema + scoring math), pure & tested | Reused by server, plugin tooling, UI typegen |
| UI | **Vite + React + TS + Tailwind + Recharts**, dual-mode (live API / static demo) | Dashboards; GitHub Pages |
| Validation | **Zod** for evals + results | Runtime safety + types |
| Tests | **Vitest** + mock orchestrator + transcript fixtures | Fast, quota-free |
| Monorepo | **npm workspaces**: `core`, `server`, `ui` (+ `plugins/anvil` assets) | Clear seams |

### 0.4 Target repository layout

```
/
├─ package.json                       # npm workspaces root
├─ packages/
│  ├─ core/                           # Zod schema + scoring math + transcript-introspection lib
│  ├─ server/                         # Anvil MCP server (stdio) + REST/WS companion API + storage
│  └─ ui/                             # Vite React dashboard (dual-mode)
├─ plugins/anvil/                     # the installable plugin
│  ├─ .claude-plugin/plugin.json
│  ├─ .mcp.json                       # points at packages/server
│  ├─ commands/                       # /anvil-eval, /anvil-gen-testdata, /anvil-improve
│  ├─ skills/                         # running-an-eval, generating-test-data, improving-an-artifact
│  └─ agents/                         # anvil-task-runner, anvil-judge, anvil-testdata-generator, anvil-analyst
├─ evals/                             # example eval suites (yaml)
├─ fixtures/                          # recorded transcript JSONL + suite/result fixtures
├─ results/                           # generated results (demo committed; rest gitignored)
├─ docs/
└─ .github/workflows/                 # ci.yml, pages-deploy.yml
```

### 0.5 Data-flow (one sentence)

`/anvil-gen-testdata` → **generator subagent** drafts a balanced `EvalSuite` (saved via MCP server) →
`/anvil-eval` → **running-an-eval skill** dispatches **treatment/baseline `anvil-task-runner`** subagents
×reps then **`anvil-judge`** subagents (pairwise, position-swapped) → **server reads transcript JSONL**
for activation + usage → **core** computes a `Scorecard` with CIs → server stores it and pushes to the
**UI** over WS → `/anvil-improve` → **analyst subagent** proposes edits → re-run → **delta** shown.

---

## 1. Epics overview

| Epic | Theme | Tickets |
|---|---|---|
| **E0** | Spike & foundations | 0.1–0.3 |
| **E1** | Core: schema, scoring, introspection | 1.1–1.5 |
| **E2** | MCP server + companion API + storage | 2.1–2.4 |
| **E3** | In-session orchestration (plugin: commands/skills/runner+judge subagents) | 3.1–3.5 |
| **E4** | Test-data generation | 4.1–4.3 |
| **E5** | Improvement loop | 5.1–5.3 |
| **E6** | UI dashboard (dual-mode) | 6.1–6.7 |
| **E7** | Dogfood evals & demo data | 7.1–7.4 |
| **E8** | Distribution, docs, CI/CD, Pages | 8.1–8.5 |

**Key parallelism:** once the **result-JSON contract** (Ticket 1.1 + 2.2) is frozen, the **UI epic
(E6)** proceeds in parallel against fixtures. E1 unblocks E2/E3/E4/E5.

---

## EPIC 0 — Spike & Foundations

### Ticket 0.1 — In-session feasibility spike (THE GATE) ⛔
- **Goal:** Prove the native model end-to-end in a real Claude Code session, with **no `claude -p`**:
  1. An orchestration skill/command dispatches a **treatment** subagent and a **baseline** subagent on one task and collects both outputs.
  2. It dispatches a **judge** subagent that returns a structured pairwise verdict.
  3. A small Node reader locates and parses the **session + subagent transcript JSONL** and recovers (a) which **skill/subagent fired** (Skill/Task `tool_use`) and (b) **token usage**.
- **Steps:** build the minimal command + 3 throwaway subagent defs in `plugins/anvil`; run live; save the produced transcripts to `fixtures/spike/`; document the **actual** on-disk transcript path + JSON shapes for the main session AND subagent sessions; confirm activation + usage are recoverable per-subagent.
- **Deliverables:** `docs/spike-findings.md` (verified paths/field shapes, pasted JSON) + committed fixtures.
- **Acceptance:** Findings show, with pasted JSON, how to detect activation + read usage **for an
  in-session subagent run**, and a judge verdict captured — zero `claude -p`. Primary introspection
  source chosen (subagent transcript vs orchestrator-observed) with a documented fallback.
- **If it fails:** STOP. Report the failure (esp. if subagent transcripts aren't readable/mappable);
  redesign E1/E3 introspection before proceeding.
- **Sub-agent:** general-purpose, live session. Prepend Fable-5 mandate.

### Ticket 0.2 — Repo scaffolding & toolchain
- **Deps:** none (parallel with 0.1).
- **Goal:** npm-workspaces monorepo (`core`/`server`/`ui`) + `plugins/anvil` skeleton, TS strict,
  ESLint+Prettier, Vitest, green CI skeleton.
- **Acceptance:** `npm ci && npm run lint && npm run typecheck && npm test` green locally + CI.

### Ticket 0.3 — Plugin manifest skeleton
- **Deps:** 0.2.
- **Goal:** `plugins/anvil/.claude-plugin/plugin.json`, `.mcp.json` (referencing `packages/server`),
  and empty `commands/`, `skills/`, `agents/` dirs registered in this repo's marketplace json.
- **Acceptance:** Plugin loads in a real session without errors (`/plugin` lists it; MCP server starts);
  marketplace validates.

---

## EPIC 1 — Core: schema, scoring, introspection

### Ticket 1.1 — Eval & result schemas (the contracts)
- **Deps:** 0.2.
- **Goal:** Zod schemas + TS types: **EvalSuite** `{name, artifact, judgeModel, runModel, repetitions,
  cases[]}`; **ArtifactRef** discriminated union `skill|subagent|plugin`; **EvalCase** `{id, prompt,
  bucket: should-fire|should-not-fire|task, shouldActivate, expectations[], rubric?}`; **Expectation**
  (regex/contains/not-contains/file/exit); **result contract** `RunTrace`, `MetricResult`, `Scorecard`,
  `RunIndexEntry`, `index.json`. **Freeze the result contract here** for the UI.
- **Acceptance:** Example YAML + fixture JSON round-trip; invalid samples rejected clearly.

### Ticket 1.2 — Transcript-introspection library
- **Deps:** 1.1, 0.1 findings.
- **Goal:** Pure-ish lib: given a session/subagent id + config dir, locate `…/projects/<hash>/<id>.jsonl`,
  parse it into a normalized `RunTrace` (ordered events, `toolUses[]` incl. Skill/Task name+input,
  `usage` tokens, `finalText`, `pluginErrors`). Robust to partial/unknown lines; returns `null` if absent.
- **Acceptance:** Parses the 0.1 fixtures into expected `RunTrace`s for both main + subagent transcripts; malformed lines don't crash.

### Ticket 1.3 — Activation detector + confusion matrix
- **Deps:** 1.2.
- **Goal:** From `RunTrace`(s) decide whether the **target** artifact fired; over a suite's buckets,
  compute precision/recall/F1 + confusion matrix (TP/FP/TN/FN) with offending case ids. Distinguish
  "fired but wrong skill," "fired via plugin command," "subagent fired."
- **Acceptance:** Deterministic over fixtures; the three distinctions covered.

### Ticket 1.4 — Mock orchestrator + recorded fixtures
- **Deps:** 1.2.
- **Goal:** A `MockOrchestrator` that replays recorded subagent outputs + transcripts keyed by
  (case, role), plus a record mode capturing real runs into `fixtures/`. Keeps the whole suite quota-free.
- **Acceptance:** Downstream tests run with zero real subagent dispatches; documented fixture-refresh procedure.

### Ticket 1.5 — Scoring math (deterministic + judge aggregation + cost + variance)
- **Deps:** 1.1, 1.4.
- **Goal:** Pure functions: deterministic expectation evaluation; **pairwise judge aggregation**
  (win/lose/tie with position-swap reconciliation → calibrated delta); **cost** (token×pinned pricing
  table, with the subscription "estimated not billed" note); **variance/CIs** over reps; **plugin
  load integrity** from `pluginErrors`. Rolls case results → `Scorecard`. Never a bare number sans spread.
- **Acceptance:** Each function unit-tested on known inputs; position-swap flips inputs not outputs; CI math verified.

---

## EPIC 2 — MCP server + companion API + storage

### Ticket 2.1 — Storage layer
- **Deps:** 1.1.
- **Goal:** JSON persistence for suites + results: write `results/<runId>.json` (full detail incl.
  per-case traces + judge rationales) and maintain `results/index.json` (idempotent append); load/list suites.
- **Acceptance:** Output validates against the result schema; index append idempotent.

### Ticket 2.2 — MCP server (tools for the model)
- **Deps:** 1.1, 1.2, 2.1, 0.3.
- **Goal:** stdio MCP server exposing tools the orchestration skills call: `anvil_list_suites`,
  `anvil_get_suite`, `anvil_save_suite`, `anvil_validate_suite`, `anvil_record_run`,
  `anvil_introspect_transcript` (wraps 1.2), `anvil_score` (wraps 1.5), `anvil_save_scorecard`.
- **Acceptance:** Server starts from `.mcp.json`; each tool exercised via a test client; inputs/outputs schema-checked.

### Ticket 2.3 — Companion REST/WS API (for the UI)
- **Deps:** 2.1.
- **Goal:** In the same process, a local HTTP server: `GET /api/suites`, `GET /api/results`,
  `GET /api/results/:id`, plus a **WS** channel that pushes new/updated scorecards live. Optionally
  serves the built UI statically for the one-command local experience.
- **Acceptance:** UI fixture client reads suites/results; WS push delivers a new scorecard live.

### Ticket 2.4 — Server config & lifecycle
- **Deps:** 2.2, 2.3.
- **Goal:** Port/config, graceful start/stop, CLAUDE_CONFIG_DIR awareness for transcript paths,
  clear logs; safe when run both as MCP child and standalone (`anvil-server` bin) for the UI.
- **Acceptance:** Starts in both modes; documented; survives missing/empty results dir.

---

## EPIC 3 — In-session orchestration (the plugin)

### Ticket 3.1 — `anvil-task-runner` subagent
- **Deps:** 0.1.
- **Goal:** Subagent def that executes a single test-case task and returns structured output. Two
  modes via its prompt: **treatment** (artifact's guidance applied / artifact available) and
  **baseline** (without). Deterministic output envelope for scoring.
- **Acceptance:** Live smoke (Epic 7) + fixture replay; envelope matches schema.

### Ticket 3.2 — `anvil-judge` subagent
- **Deps:** 1.5.
- **Goal:** Subagent def that takes two outputs (A/B) + a rubric and returns a structured pairwise
  verdict + rationale; **position-swap** handled by the orchestrator calling it twice with swapped order.
- **Acceptance:** Verdict schema-valid; rationale captured; ties supported.

### Ticket 3.3 — `running-an-eval` skill
- **Deps:** 3.1, 3.2, 2.2.
- **Goal:** The orchestration skill (invoked by `/anvil-eval`): load suite → for each case ×reps,
  dispatch treatment+baseline runners, then judge (swapped) → call server to introspect transcripts +
  score → save scorecard. **Throttled sequentially**; prints a **pre-flight estimate**; supports `--reps`.
- **Acceptance:** Full suite runs end-to-end against the **mock orchestrator**; produces a valid scorecard; estimate printed.

### Ticket 3.4 — `/anvil-eval` command
- **Deps:** 3.3.
- **Goal:** Command entry point wiring args (artifact/suite, reps) to the skill, with friendly help/errors.
- **Acceptance:** Command invokes the skill; bad args explained.

### Ticket 3.5 — Caching & incremental runs
- **Deps:** 3.3.
- **Goal:** Content-addressed cache keyed by (case, role, model, artifact-version) so iterating only
  re-runs what changed; `--no-cache`/`--refresh`.
- **Acceptance:** Editing one case re-runs only that case; cache invalidates on model/artifact change.

---

## EPIC 4 — Test-data generation

### Ticket 4.1 — `anvil-testdata-generator` subagent
- **Deps:** 1.1.
- **Goal:** Given an `ArtifactRef` (description, trigger conditions, prescribed process), synthesize a
  **balanced** `EvalSuite`: **should-fire** cases, **should-not-fire near-misses** (adversarial trigger
  precision), and **task cases with rubrics**. Returns schema-valid suite + a coverage rationale.
- **Acceptance:** Produces a valid suite for a sample skill with all three buckets populated and a stated balance.

### Ticket 4.2 — `generating-test-data` skill + `/anvil-gen-testdata` command
- **Deps:** 4.1, 2.2.
- **Goal:** Skill that reads the target artifact's files, invokes the generator, validates, saves the
  suite via the server, and surfaces it for UI review. Command wraps it.
- **Acceptance:** `/anvil-gen-testdata <artifact>` yields a saved, valid, reviewable suite.

### Ticket 4.3 — Coverage & balance check
- **Deps:** 4.1.
- **Goal:** A deterministic check + advisory: bucket balance, near-miss presence, rubric completeness;
  flags weak suites so authors fix test data before trusting scores.
- **Acceptance:** Flags an intentionally unbalanced suite; passes a good one.

---

## EPIC 5 — Improvement loop

### Ticket 5.1 — `anvil-analyst` subagent
- **Deps:** 1.5.
- **Goal:** Given a `Scorecard` + the artifact's files + failing cases, produce **concrete, minimal
  edit proposals** (e.g., sharpen trigger description to fix false-negatives; add a missing process
  step; tighten scope to cut false-positives), each tied to the metric it should move and the evidence.
- **Acceptance:** For a fixture scorecard with known weaknesses, returns targeted proposals referencing the offending cases.

### Ticket 5.2 — `improving-an-artifact` skill + `/anvil-improve` command
- **Deps:** 5.1, 3.3.
- **Goal:** Skill that runs analyst → presents proposals → on user confirmation applies edits to the
  artifact files → **re-runs the eval** → reports the **measured delta** (before/after scorecards).
  Human confirmation required before any file edit.
- **Acceptance:** End-to-end on a fixture: proposal → (confirmed) edit → re-run → delta reported; no edit without confirmation.

### Ticket 5.3 — Delta tracking in results
- **Deps:** 5.2, 2.1.
- **Goal:** Persist before/after pairs + the applied edit summary in results so the UI can show an
  improvement timeline per artifact.
- **Acceptance:** Result store captures the delta record; index reflects improvement history.

---

## EPIC 6 — UI Dashboard (dual-mode; parallel after the contract is frozen)

### Ticket 6.1 — UI scaffold + dual-mode data layer
- **Deps:** 1.1 contract (+ fixture).
- **Goal:** Vite/React/TS/Tailwind/Recharts app; a data layer that uses the **live server API + WS**
  when available and falls back to **static committed JSON** (Pages). Pages base-path configured.
- **Acceptance:** `npm run dev` renders fixtures live + static; `npm run build` is Pages-ready.

### Ticket 6.2 — Home / leaderboard
- **Goal:** Artifacts with headline scores (quality delta, activation F1, cost), sortable/filterable by type; empty state explains how to generate data.
- **Acceptance:** Renders fixtures; sort/filter tested.

### Ticket 6.3 — Artifact scorecard
- **Goal:** Metric panels (quality delta w/ CI, activation precision/recall, cost, latency, variance) + **activation confusion matrix** + verdict.
- **Acceptance:** All metrics + matrix render from fixture.

### Ticket 6.4 — With/without compare + cost panel
- **Goal:** Side-by-side treatment vs baseline outputs + cost/latency overhead viz.
- **Acceptance:** Pairwise outputs + overhead render.

### Ticket 6.5 — Test-data review/edit panel
- **Deps:** 6.1, 2.3.
- **Goal:** View/edit a generated suite (buckets, prompts, expectations, rubric), see the balance
  check, and save back via the server — the human-in-the-loop step for test-data quality.
- **Acceptance:** Edit a case and persist it; balance warnings shown.

### Ticket 6.6 — Run detail + judge/transcript viewer
- **Goal:** Per-case pass/fail, captured outputs, **judge rationales**, expandable tool-use timeline.
- **Acceptance:** Renders per-case detail incl. rationale; large traces handled.

### Ticket 6.7 — Improvement timeline + run-history trend
- **Deps:** 5.3.
- **Goal:** Per-artifact time series of headline metrics across runs, annotated with applied edits (the improvement loop made visible).
- **Acceptance:** Trend + edit annotations render from committed runs.

---

## EPIC 7 — Dogfood evals & demo data

### Ticket 7.1 — Example **skill** eval (generate → run → improve)
- **Goal:** Pick a skill in this repo; `/anvil-gen-testdata` it, `/anvil-eval` it live, `/anvil-improve` once. Capture real before/after.
- **Acceptance:** Valid scorecards + a real improvement delta; documented.

### Ticket 7.2 — Example **subagent** eval
- **Goal:** Specialized subagent vs `general-purpose` on tasks it should excel at.
- **Acceptance:** Real scorecard showing the specialization delta.

### Ticket 7.3 — Example **plugin** eval
- **Goal:** A whole plugin in this repo incl. load-integrity + an end-to-end command case.
- **Acceptance:** Real scorecard incl. integrity metric.

### Ticket 7.4 — Commit demo dataset
- **Goal:** Curate 7.1–7.3 into a committed `results/` demo set powering the public Pages site.
- **Acceptance:** UI build renders the demo set; documented as canonical.

---

## EPIC 8 — Distribution, docs, CI/CD, Pages

### Ticket 8.1 — GitHub Pages deploy workflow
- **Goal:** Build `packages/ui` with committed demo data, publish to Pages on push to `main` (correct base path).
- **Acceptance:** Pages site live rendering the demo from a clean checkout.

### Ticket 8.2 — CI matrix
- **Goal:** Lint/typecheck/test on Win/macOS/Linux; a separate **opt-in live** job (manual dispatch, needs auth) running a tiny real eval as smoke.
- **Acceptance:** Matrix green; live job gated + documented.

### Ticket 8.3 — Documentation set
- **Goal:** `docs/`: Getting Started (install the plugin), **Generating Test Data**, **Running an Eval**,
  **Metrics Reference** (judge methodology + the role-isolation tradeoff + subscription-cost caveat),
  **Improvement Loop**, and Architecture (plugin + MCP + subagents + UI).
- **Acceptance:** A new user can install, generate data, run, and improve following only the docs.

### Ticket 8.4 — Local quickstart + README
- **Goal:** One-command local path (install plugin → `/anvil-gen-testdata` → `/anvil-eval` → start
  server → `npm run dev`); top-level README with value prop, screenshot/gif, subscription requirement.
- **Acceptance:** Clean clone → working local dashboard following the README.

### Ticket 8.5 — Versioning & release
- **Goal:** Eval **schema version** field + migration policy; semver; CHANGELOG; tag MVP.
- **Acceptance:** Schema carries a version; unknown version warns clearly.

---

## 9. Execution waves (dependency-ordered)

| Wave | Tickets | Parallel? | Gate to advance |
|---|---|---|---|
| **W0** | 0.1 spike | solo | ⛔ spike passes or plan stops |
| **W1** | 0.2, 0.3 | parallel | plugin loads; green CI skeleton |
| **W2** | 1.1 → 1.2 → 1.3, 1.4, 1.5 | 1.1/1.2 serial, then 1.3–1.5 parallel | mock orchestrator + scoring green; **result contract frozen** |
| **W3** | 2.1 → 2.2, 2.3 → 2.4 | server tickets mostly serial | MCP tools + UI API exercised |
| **W3′** | 6.1 → 6.2–6.7 | **parallel with W3+** after 6.1 | UI renders contract fixtures |
| **W4** | 3.1, 3.2 → 3.3 → 3.4, 3.5 | runners parallel, then skill | suite runs end-to-end on mock |
| **W5** | 4.1 → 4.2, 4.3 | generator then skill/check | balanced suite generated + validated |
| **W6** | 5.1 → 5.2 → 5.3 | serial | improvement delta proven on fixture |
| **W7** | 7.1–7.3 → 7.4 | evals parallel, then curate | real demo dataset (live) |
| **W8** | 8.1, 8.2 early; 8.3–8.5 last | parallel | Pages live + docs complete |

**Orchestrator rule:** dispatch one sub-agent per ticket, in wave order, **prepending the Fable-5
mandate (§0.1) and execution discipline (§0.2) to every dispatch.** Within a wave, dispatch independent
tickets concurrently (`superpowers:dispatching-parallel-agents`). After each ticket, require pasted
command output proving acceptance before marking it done.

## 10. Definition of Done (MVP)

From inside Claude Code on their subscription, an author can: `/anvil-gen-testdata <artifact>` to get a
balanced suite → review/edit it in the dashboard → `/anvil-eval <artifact>` to run **in-session subagent
A/B trials** (no `claude -p`) and see a **Scorecard** (activation precision/recall, with-vs-without
quality delta with a CI, cost, variance) live in the UI → `/anvil-improve` to get concrete edit
proposals, apply them with confirmation, and see the **measured delta** → and the repo's own demo
dataset is live on GitHub Pages. All non-live tests pass on Win/macOS/Linux CI.
