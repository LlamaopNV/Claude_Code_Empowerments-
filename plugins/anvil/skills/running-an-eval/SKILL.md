---
name: running-an-eval
description: Run an Anvil effectiveness eval for a Claude Code artifact — dispatch in-session treatment/baseline task-runner subagents and position-swapped judges for each case, recover activation + token usage from the transcripts, score it, and record the run. Use when the user asks to run/evaluate/score/A-B-test a skill, subagent, or plugin, or invokes /anvil:eval. Runs on the subscription via subagents; no external claude -p.
---

# Running an Anvil Eval

Orchestrate an in-session A/B evaluation of a Claude Code artifact and record a Scorecard. Everything runs on the user's subscription via the `Task` tool — there is **no external `claude -p`**. You load a suite, run each case through a treatment runner and a baseline runner, have a judge compare them (twice, position-swapped), recover ground-truth activation + usage from the transcripts, and call the Anvil MCP server to score and persist the run.

## Reasoning mandate (Fable-5)

Reason like you are running Fable 5. Work from first principles. State your assumptions — which session id, which project hash, how many dispatches the suite implies — and verify each before relying on it. Print a pre-flight estimate and get confirmation before burning quota. Adversarially check the experiment's integrity: is treatment vs baseline truly symmetric (same task, same effort, only the artifact differs)? Did the judge get position-swapped? Are you recording the verdict de-positioned? If a premise is wrong (suite missing, MCP tool errors, a transcript can't be found), STOP and report — never fabricate a result. Evidence over assertion: never claim a case ran or a metric was computed until you have the tool output in hand.

## Tools you use (Anvil MCP server)

- `anvil_list_suites {}` / `anvil_get_suite {name}` — load the suite to run.
- `anvil_introspect_transcript {projectHash, agentId?, sessionId?, configRoot?}` → `{found, trace}` — recover a RunTrace (activation tool_uses + token usage). For a dispatched **subagent**, pass its `agentId`; `sessionId` is now **optional** — when omitted the server globs `…/projects/<projectHash>/*/subagents/agent-<agentId>.jsonl` to find the transcript by agentId alone (so you do NOT need the main session id). Pass `sessionId` (without `agentId`) only to read a main-session transcript.
- `anvil_record_run {BuildScorecardArgs}` → `{runId, entry, scorecard}` — **build + persist + index in one step. Prefer this.**

## Inputs

- **artifact / suite**: a suite name, or an artifact ref to find its suite. If multiple suites match, list them and ask.
- **`--reps N`** (optional): override the suite's `repetitions` for this run (e.g. a fast smoke at `--reps 1`).
- **`--no-cache` / `--refresh`** (optional): cache semantics (see Caching).

## The recording flow (the spine)

For a suite with `C` cases and `R` reps:

1. **Load the suite** via `anvil_get_suite` (or `anvil_list_suites` then pick). Read `cases`, `repetitions`, `judgeModel`, `runModel`, `artifact`. Apply a `--reps` override if given.
2. **Resolve the introspection ids** (see "The session-id seam"):
   - `projectHash` = the project-hash dir name for the cwd (`projectHashFromCwd`-style: replace each `\` `/` `:` whitespace with `-`; e.g. `C:\Code\Agent Eval pipeline` → `C--Code-Agent-Eval-pipeline`).
   - You do **not** need the main session id: introspect each subagent by `agentId` alone (the server globs it). Capture each dispatched runner's `agentId` from the `Task` result.
3. **Pre-flight estimate** — compute the dispatch count and PRINT it, then ask the user to confirm before proceeding:
   - runner dispatches = `C × R × 2` (treatment + baseline).
   - judge dispatches = `C × R × 2` (position-swapped pair per rep).
   - subtract any cache hits (Caching). Show: "N cases × R reps = X runner + Y judge subagent dispatches (Z cached). Proceed?"
4. **For each case, for each rep (`rep` 0..R-1), SEQUENTIALLY** (throttle — do NOT fan out; quota + rate limits):
   a. **Cache check** (if caching on): if a cached treatment/baseline run exists for `(caseId, role, runModel, artifactVersion, rep)`, reuse it; else dispatch.
   b. **Dispatch treatment** — `Task` tool, `subagent_type: "anvil-task-runner"`, prompt = mode `treatment` + `caseId` + the case `prompt` + (for a skill) the artifact's SKILL.md guidance. **Capture the returned `agentId`.**
   c. **Dispatch baseline** — `Task` tool, `subagent_type: "anvil-task-runner"` (or, for a subagent artifact, the artifact's `baselineSubagent`, default `general-purpose`), prompt = mode `baseline` + `caseId` + the case `prompt`, NO artifact guidance. **Capture its `agentId`.**
   d. **Introspect both** — call `anvil_introspect_transcript` with `{projectHash, agentId}` for each runner's agentId (no sessionId). From the treatment trace recover: did the target artifact fire (Skill/Task tool_use matching the artifact name) → `activated`; and `totalUsage` → `treatmentUsage`. Keep `treatmentTraceId`/`baselineTraceId` = the agentIds.
   e. **Parse each runner's envelope** — extract `finalAnswer` from the ```json block the runner returned.
   f. **Judge, position-swapped** — dispatch `anvil-judge` TWICE for this rep:
      - dispatch 1 (canonical): `outputA = treatment.finalAnswer`, `outputB = baseline.finalAnswer`, record `swapped: false`.
      - dispatch 2 (swapped): `outputA = baseline.finalAnswer`, `outputB = treatment.finalAnswer`, record `swapped: true`.
      De-position each verdict into treatment/baseline/tie: in the canonical dispatch `winner:"A"` ⇒ `treatment`; in the swapped dispatch `winner:"A"` ⇒ `baseline`. Build a `JudgeSample {verdict, swapped, rationale}` per dispatch.
   g. **Evaluate deterministic expectations** for the case against the treatment `finalAnswer` (contains/regex/not-contains; file-* only if a sandbox path was used) → `expectationResults: boolean[]` in suite order.
5. **Assemble `ScoringCaseInput[]`** — one entry per case (judge samples accumulate across that case's reps):
   ```
   { caseId, shouldActivate, activated, expectationResults, judgeSamples, treatmentUsage?, treatmentTraceId?, baselineTraceId? }
   ```
6. **Record the run** — call `anvil_record_run` with:
   ```
   { runId, suiteName, artifact, judgeModel, runModel, repetitions, cases: ScoringCaseInput[], traces?, createdAt? }
   ```
   Use a fresh `runId` (e.g. `<artifactName>-<ISO-ish timestamp>`). It returns `{runId, entry, scorecard}`.
7. **Report** the scorecard's headline metrics WITH spread (never a bare number): `activation.precision/recall/f1`, `quality.delta` (with CI), `cost.tokens`/`cost.usd`, plus the confusion matrix's offending case ids. Tell the user the run id and that the UI (if `serve` is running) lists it.

## The session-id seam (RESOLVED — glob by agentId alone)

To recover a **subagent's** activation/usage you only need its `agentId` (the `Task` tool returns it). Call:

```
anvil_introspect_transcript { projectHash, agentId }   // NO sessionId needed
```

The server globs `…/projects/<projectHash>/*/subagents/agent-<agentId>.jsonl` across every session under the project hash and returns the matching transcript — the agentId filename is unique, so a single match is unambiguous. This means **a skill running in-session never has to discover the parent session id** to introspect the subagents it dispatched. (Core: `findSubagentTranscriptByAgentId(configRoot, projectHash, agentId)`.)

You still compute `projectHash` from the cwd (`projectHashFromCwd`-style: replace each `\` `/` `:` whitespace with `-`; e.g. `C:\Code\Agent Eval pipeline` → `C--Code-Agent-Eval-pipeline`).

`sessionId` remains available (and is required) **only** for reading a *main-session* transcript — pass `{ sessionId, projectHash }` with no `agentId`. If the glob returns `{found:false}` for an agentId you just dispatched, STOP and report (a missing transcript is an error, not a silent `activated:false`) — do not guess.

## Caching (`--no-cache` / `--refresh`)

A content-addressed cache (core `RunCache`) keys a run by `(caseId, role, runModel, artifactVersion, rep)` where `artifactVersion` is a hash of the artifact's files. Default reuses unchanged runs (skip the dispatch). `--no-cache` disables it. `--refresh` forces every run to re-execute (and overwrites stale entries). Editing the artifact changes `artifactVersion` and invalidates everything automatically — so an iterate-and-re-run only re-dispatches what changed. Reflect cache hits in the pre-flight estimate.

## Throttling

Dispatch **sequentially** — one subagent at a time, awaited — never a parallel fan-out. The estimate tells the user the total; sequential execution respects rate limits and keeps quota predictable.

## Red flags — STOP

| Thought | Reality |
|---|---|
| "I'll fan out all the runners in parallel to be fast" | Sequential throttle. Parallel fan-out trips rate limits and burns quota. |
| "Judge once is enough" | Judge twice, position-swapped, or position bias contaminates the delta. |
| "I'll report quality.delta = 0.4" | Never a bare number. Report it with its CI / n. |
| "The transcript wasn't found, I'll assume it didn't fire" | A missing transcript is an error to report, not a silent `activated:false`. |
| "I'll skip the estimate and just run" | The pre-flight estimate + confirmation is the quota guardrail. Show it. |
| "Baseline can use the skill too" | No. Baseline is artifact-free. The contrast is the measurement. |
