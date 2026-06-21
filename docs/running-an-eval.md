# Running an eval

Run an in-session A/B effectiveness eval for a Claude Code artifact, then read the scorecard.

Everything runs on your subscription **via subagents (the `Task` tool)** — there is no external `claude -p` and no API key. You need a suite first; if you do not have one, see [generating-test-data.md](generating-test-data.md). New to Anvil? Start with [getting-started.md](getting-started.md).

## Run the command

```text
/anvil-eval <suite-name | artifact> [--reps N] [--no-cache | --refresh]
```

For example, a cheap one-rep smoke against the example suite:

```text
/anvil-eval bake-to-completion --reps 1
```

- **suite-name | artifact** (required): the suite to run by `name`, or an artifact whose suite should be found. If several match, you are asked which; if none exists, you are pointed to `/anvil-gen-testdata`.
- **`--reps N`** — override the suite's `repetitions` for this run (use `--reps 1` to smoke before a full run).
- **`--no-cache`** — ignore the run cache; re-execute every case.
- **`--refresh`** — force re-execution and overwrite stale cache entries.

`/anvil-eval` is a thin entry point that hands off to the **`running-an-eval`** skill.

## Confirm the pre-flight estimate

Before spending any quota, the skill prints a **pre-flight estimate** of subagent dispatches and asks you to confirm:

```
dispatches = cases × reps × (2 runners + 2 judges)
```

A 5-case suite at 5 reps is **250 subagent dispatches**. Cache hits are subtracted from the estimate. **Always read this and smoke with `--reps 1` first.** Confirm to proceed.

## What runs per case (the mechanics)

For each case, for each rep, the skill works **sequentially** — one subagent at a time, never a parallel fan-out (sequential execution respects rate limits and keeps quota predictable):

1. **Dispatch a treatment runner** — `anvil-task-runner` with the case prompt **plus the artifact's guidance** (e.g. its `SKILL.md`). Capture its `agentId`.
2. **Dispatch a baseline runner** — the same task prompt **with no artifact guidance** (for a subagent artifact, the configured `baselineSubagent`, default `general-purpose`). Capture its `agentId`. The treatment-vs-baseline contrast *is* the measurement.
3. **Introspect both transcripts by `agentId` alone.** `anvil_introspect_transcript {projectHash, agentId}` recovers each run's activation (did the artifact fire?) and token usage. The server globs `…/projects/<projectHash>/*/subagents/agent-<agentId>.jsonl` to find the transcript — **the main session id is *not* needed**. (`sessionId` is only required to read a *main-session* transcript.) If a transcript you just dispatched isn't found, that is an error to report — never a silent `activated: false`.
4. **Judge, position-swapped.** Dispatch `anvil-judge` twice per rep — once canonical (treatment as A), once swapped (treatment as B) — then de-position each verdict into treatment / baseline / tie. Judging twice cancels position bias.
5. **Evaluate deterministic expectations** against the treatment output.
6. **Record** — `anvil_record_run` builds, scores, persists, and indexes the run in one call, returning the run id and scorecard.

`projectHash` is derived from the cwd by replacing each `\`, `/`, `:`, and whitespace with `-` (e.g. `C:\Code\Agent Eval pipeline` → `C--Code-Agent-Eval-pipeline`).

## Caching

A content-addressed cache keys each run by `(caseId, role, runModel, artifactVersion, rep)`, where `artifactVersion` is a hash of the artifact's files. By default unchanged runs are reused (the dispatch is skipped). **Editing the artifact changes its hash and invalidates everything automatically**, so an iterate-and-re-run only re-dispatches what changed. Use `--no-cache` to ignore the cache, or `--refresh` to force re-execution and overwrite stale entries. Cache hits show up in the pre-flight estimate.

## Read the scorecard

The run reports headline metrics **with spread — never a bare number**:

- **`activation.precision` / `recall` / `f1`** — did the artifact fire when it should and stay quiet when it should not? Reported with the confusion matrix's offending case ids.
- **`quality.delta`** — pairwise treatment-vs-baseline win rate, position-swap-calibrated, with a 95% confidence interval.
- **`cost.tokens` / `cost.usd`** — token-based. On a subscription the USD figure is an **estimate, not a billed amount**.

The run id is printed and the run is recorded to disk. For what each metric means and the validity caveats (e.g. the in-session baseline contrast), see [metrics-reference.md](metrics-reference.md).

## See results in the dashboard

If you started the companion server (`anvil-server serve`, see [getting-started.md](getting-started.md)), recorded runs land in the leaderboard automatically, where you can drill into per-case judge rationales and the tool-use timeline.

> **Cross-process refresh note:** the eval records through the MCP server process, while the dashboard's HTTP/WS server is a *separate* process. If a new run does not appear live, **refresh the dashboard** — it re-reads results from disk on load. This is a known MVP limitation, not data loss. See [running-live.md](running-live.md) for details.

## Next

- **[improvement-loop.md](improvement-loop.md)** — use `/anvil-improve <artifact>` to propose edits tied to each metric, then re-measure the before/after delta.
- **[running-live.md](running-live.md)** — the complete live walkthrough.

Related: [metrics-reference.md](metrics-reference.md) · [architecture.md](architecture.md) · [generating-test-data.md](generating-test-data.md)
