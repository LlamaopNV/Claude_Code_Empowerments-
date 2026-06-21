# Anvil demo data — ILLUSTRATIVE SAMPLE DATA (not real measured runs)

Everything in this folder is **hand-curated, illustrative sample data** shipped so the
static GitHub Pages dashboard has something to render without a live Anvil server.

> ⚠️ These scorecards are **examples**, not real measured eval runs. The numbers were
> authored by hand to demonstrate the dashboard's panels (activation precision/recall,
> quality delta with CIs, cost, the confusion matrix, judge rationales). Do not cite them
> as a benchmark. The dashboard renders an "Illustrative sample data" banner whenever it
> is running in static mode for exactly this reason.

To produce **real** measured data, run an eval on your own Claude Code subscription
(`/anvil-eval <artifact>`) and open the live dashboard — see `docs/running-live.md`.

## Contents

| File | Artifact kind | Example |
| --- | --- | --- |
| `demo/run-2026-06-21-bake-001.json` | **skill** | `bake-to-completion` — idea-shaping skill effectiveness |
| `demo/run-2026-06-21-codeguide-001.json` | **subagent** | `claude-code-guide` vs `general-purpose` specialization |
| `demo/run-2026-06-21-jira-plugin-001.json` | **plugin** | `jira-api` plugin integrity + usefulness (incl. `plugin.loadOk`) |
| `index.json` | — | the leaderboard index (newest-first) listing all three |
| `traces/agent-*.json` | — | a few `RunTrace`s for the case drill-down / tool-use timeline |

Every file in this folder is schema-valid against `@anvil/core` (`RunIndexSchema`,
`ScorecardSchema`, `RunTraceSchema`). The validation is enforced by
`npm run validate:data -w @anvil/ui`.
