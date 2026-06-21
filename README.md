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

The plugins appear under the **Discover** tab. Select one, press Enter to view it, and install.

> You can also add the marketplace by full URL:
> `/plugin marketplace add https://github.com/LlamaopNV/Claude_Code_Empowerments-.git`

## Plugins

| Plugin | Category | What it does |
| --- | --- | --- |
| `bitbucket-repo` | development | Browse Bitbucket repositories: list repos, branches, commits, and read files at any ref. |
| `bitbucket-pipeline` | development | Manage Bitbucket CI/CD pipelines: list, inspect, trigger, and stop pipeline runs. |
| `bitbucket-pr` | development | Manage Bitbucket pull requests: list, view, create, update, review, merge, and comment. |
| `jira-api` | productivity | Jira REST API reference plus prebuilt scripts for auth, search, issue CRUD, transitions, comments, sprints, and ADF. |
| `md-with-mermaid-to-pdf` | productivity | Convert a Markdown file with Mermaid diagrams to PDF (renders each diagram to SVG, then to PDF). |
| `new-aspire-project` | development | Bootstrap a new .NET Aspire project from a clean-architecture / CQRS template. ⚠️ See note below. |
| `bake-to-completion` | development | Interviews you about a half-baked software/product idea, stress-tests every aspect, and hands off a strengthened brief for planning. |
| `anvil` | development | Native effectiveness evals & improvement loop for Claude Code skills, subagents & plugins — generate balanced test data, run in-session A/B trials on your subscription, score activation / quality-delta / cost, and propose improvements. **See the [Anvil](#anvil--effectiveness-evals-for-claude-code-artifacts) section below.** |

## Anvil — effectiveness evals for Claude Code artifacts

**Anvil** is the most substantial plugin in this marketplace: a native **plugin + MCP server + local/Pages
dashboard** that measures how effective a **skill**, **subagent**, or **plugin** actually is — and helps you
make it better.

Point Anvil at an artifact from inside Claude Code. It **generates a balanced test suite** for it
(should-fire, should-not-fire near-misses, task cases with rubrics), runs **in-session subagent A/B trials**
on **your own subscription** (no external `claude -p`, no API key), and returns a **scorecard**: activation
precision/recall/F1, with-vs-without **quality delta with confidence intervals**, token cost, and variance.
Then `/anvil-improve` proposes concrete edits and **re-runs to prove the delta**. Everything renders in a
dashboard you can run locally or publish to GitHub Pages.

> **Subscription requirement.** Anvil executes evals **in-session via subagents** (the `Task` tool) on your
> Claude Code subscription. It does not call any metered API and needs no API key. Reported USD cost is a
> token-math **estimate** of an equivalent metered call — a subscription is a flat fee, not billed per run.

### Quickstart

```bash
# 1. From the repo root: install + build the server (it compiles @anvil/core first)
npm ci
npm run build -w @anvil/core
npm run build -w @anvil/server

# 2. (optional) start the companion API + dashboard
npm run build -w @anvil/ui
node packages/server/dist/bin/anvil-server.js serve --port 4319 --ui-dir packages/ui/dist
#    → open http://127.0.0.1:4319
```

Then, inside a Claude Code session with the **anvil** plugin installed (`/plugin` → install anvil; reload
after a rebuild):

```text
/anvil-gen-testdata bake-to-completion     # generate a balanced suite for an artifact
/anvil-eval bake-to-completion --reps 1    # cheap smoke run (then drop --reps for the full run)
/anvil-improve bake-to-completion          # propose edits, re-run, show the measured delta
```

The full step-by-step USER walkthrough is **[docs/running-live.md](docs/running-live.md)**.

### Architecture

```mermaid
flowchart LR
  subgraph CC["Claude Code session (your subscription)"]
    CMD["/anvil-eval, /anvil-gen-testdata, /anvil-improve"]
    SK["skills: running-an-eval · generating-test-data · improving-an-artifact"]
    SA["subagents: anvil-task-runner · anvil-judge · anvil-testdata-generator · anvil-analyst"]
    CMD --> SK --> SA
  end
  SK -- "MCP stdio tools" --> SRV["@anvil/server (MCP + REST/WS)"]
  SA -- "writes transcript JSONL" --> TR["~/.claude/projects/<hash>/.../subagents/agent-<id>.jsonl"]
  SRV -- "reads transcripts → activation + usage" --> TR
  SRV -- "validate + score via" --> CORE["@anvil/core (Zod schema + scoring)"]
  SRV -- "results/index.json + scorecards" --> ST[("results/")]
  SRV -- "REST + WS push" --> UI["@anvil/ui dashboard (live / static)"]
  ST -. "committed demo JSON" .-> UI
```

- **`@anvil/core`** — the frozen Zod contract (eval suite + result schemas) plus scoring math and transcript
  introspection. **`@anvil/server`** — the MCP stdio server (tools the model calls) + a companion REST/WS API
  for the UI. **`@anvil/ui`** — the dual-mode dashboard (live against the server, or static committed JSON on
  Pages). **`plugins/anvil/`** — the installable commands/skills/subagents.

### Docs

| Doc | What it covers |
| --- | --- |
| [Getting Started](docs/getting-started.md) | Install the plugin + build the server |
| [Generating Test Data](docs/generating-test-data.md) | `/anvil-gen-testdata`, the bucket model, reviewing a suite |
| [Running an Eval](docs/running-an-eval.md) | `/anvil-eval` mechanics, caching, reading a scorecard |
| [Running Live](docs/running-live.md) | The exact ordered steps for your **first real eval** |
| [Metrics Reference](docs/metrics-reference.md) | Each metric, judge/position-swap methodology, role-isolation tradeoff, cost caveat |
| [Improvement Loop](docs/improvement-loop.md) | `/anvil-improve` — propose → confirm → re-run → delta |
| [Architecture](docs/architecture.md) | Plugin + MCP + subagents + UI + the data flow |
| [Releasing](docs/releasing.md) | Versioning, schema-migration policy, cutting a release |

### Live demo

The dashboard is published to GitHub Pages with **illustrative sample data** (clearly labeled — not real
measured runs): **https://llamaopnv.github.io/Claude_Code_Empowerments-/**

> Screenshot/GIF placeholder. To capture one: build the UI (`npm run build -w @anvil/ui`), serve it
> (`node packages/server/dist/bin/anvil-server.js serve --ui-dir packages/ui/dist`), open
> `http://127.0.0.1:4319`, and screenshot the leaderboard + a scorecard into `docs/images/` (then link them
> here).

## Configuration

Several plugins call external APIs and read their credentials/targets from environment
variables (set them in your shell, or in a project's `.claude/settings.json` `env` block).
Nothing is hardcoded to any organization.

### Bitbucket plugins (`bitbucket-repo`, `bitbucket-pipeline`, `bitbucket-pr`)

| Variable | Required | Notes |
| --- | --- | --- |
| `BB_USER` | yes | Your Bitbucket username. |
| `BB_TOKEN` | yes | A Bitbucket **App Password** (Personal settings → App passwords). Grant Repositories / Pull requests / Pipelines read+write. |
| `BB_WORKSPACE` | auto | Workspace slug. Auto-detected from the repo's `origin` git remote if unset. |
| `BB_REPO` | auto | Repository slug. Auto-detected from the `origin` git remote if unset. |

`BB_USER`/`BB_TOKEN` can also live in a `~/.bitbucket` file (`KEY=value` per line).

### Jira plugin (`jira-api`)

| Variable | Required | Notes |
| --- | --- | --- |
| `JIRA_BASE_URL` | yes | Your Jira Cloud site, e.g. `https://your-org.atlassian.net`. |
| `JIRA_API_TOKEN` | yes | Create at <https://id.atlassian.com/manage-profile/security/api-tokens>. |
| `JIRA_EMAIL` | no | Atlassian account email. Defaults to `git config user.email`. |
| `JIRA_PROJECT` | yes | Project key, e.g. `ABC`. |
| `JIRA_BOARD` | yes | Agile board ID, e.g. `42`. |

### `md-with-mermaid-to-pdf`

Needs `mmdc` (mermaid-cli) and `npx`. The skill calls `npx --yes md-to-pdf` automatically.

### `new-aspire-project`

> ⚠️ **Template body not included.** This plugin's bundled `AspireApp1/` template currently
> contains only the solution file, `Directory.Packages.props`, and documentation — **not the
> actual source projects** (`Source/`, `Orchestration/`, `Tests/`, `*.csproj`, `*.cs`). As shipped
> it will not produce a buildable project. Drop your real Aspire clean/CQRS template into
> `plugins/new-aspire-project/skills/new-aspire-project/AspireApp1/` to make it functional.
> Requires the .NET 10 SDK and `dotnet-ef`.

## Repository layout

```text
.
├── .claude-plugin/
│   └── marketplace.json          # The marketplace catalog (lists every plugin)
├── plugins/
│   └── <plugin-name>/
│       ├── .claude-plugin/
│       │   └── plugin.json        # Plugin manifest
│       └── skills/<skill>/SKILL.md  # Skill(s), with scripts/ alongside as needed
├── .gitattributes                 # forces LF on *.sh so scripts run on every OS
├── CHANGELOG.md
└── README.md
```

## Add your own plugin

1. Create `plugins/<your-plugin-name>/` with a manifest at
   `plugins/<your-plugin-name>/.claude-plugin/plugin.json`:

   ```json
   {
     "name": "your-plugin-name",
     "version": "0.1.0",
     "description": "What your plugin does.",
     "author": { "name": "LlamaopNV" }
   }
   ```

2. Add components in the conventional folders (all optional): `skills/<name>/SKILL.md`,
   `commands/<name>.md`, `agents/<name>.md`, `hooks/hooks.json`, `.mcp.json`.
3. Register it in `.claude-plugin/marketplace.json` by adding an entry to the `plugins` array
   (with `source`, `description`, `version`, `category`).

> **Shell scripts must be LF.** The repo's `.gitattributes` enforces this for `*.sh`. A CRLF
> `.sh` breaks under bash (`bad interpreter`) on every OS, including Git Bash on Windows.

## Validate before you push

```bash
claude plugin validate .
```

This checks the marketplace manifest and every referenced plugin.

## License

MIT
