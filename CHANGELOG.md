# Changelog

All notable changes to this marketplace are documented here.

## [Unreleased]

### Added
- **`idea-forge`** plugin (v0.1.0) — hardens ONE clarified, high-stakes idea by making eight
  rival variants of it fight an adversarial **king-of-the-hill ladder**: a pre-screened best
  original seeds the champion, each rung grafts the challenger's strongest *compatible* fix into
  a running merge (re-validated against a graft ledger and the previous champion), and a final
  audit rung ships the champion only if it **provably beats the frozen best original**. The
  depth-on-one companion to `bake-to-completion`'s clarify pass. Skill: `idea-forge`, with the
  `run-tournament.md` executor playbook. Registered in `marketplace.json` (bumped to `0.4.0`),
  with a showcase page at `site/idea-forge/` (the skill's own self-improvement tournament, its
  full debate transcript, and the v1-to-v2 diff). Steel-violet accent `#7c6cf0`.
- **`skill-foundry`** plugin (v0.1.0) — authors a new skill, subagent, or plugin to this
  marketplace's house conventions (file layout, `plugin.json`, `marketplace.json`
  registration, README/CHANGELOG updates) and hands off to Anvil for evaluation. Fills the
  authoring gap `skill-installer`'s own catalog README points at but doesn't fill.
  - Skills: `skill-foundry`.
  - Scripts: `check-registration.sh` (verifies a plugin is fully registered before commit).

### Removed
- Dropped six plugins that were not authored in this marketplace: `bitbucket-repo`,
  `bitbucket-pipeline`, `bitbucket-pr`, `jira-api`, `md-with-mermaid-to-pdf`, and
  `new-aspire-project`. Their plugin directories, `marketplace.json` entries, README
  documentation, and skill-showcase pages were removed.

### Changed
- Rebuilt the skill-showcase landing grid (`site/index.html`) around the remaining owned
  skills (anvil, symmetric-audit, workflow-forge, bake-to-completion, design-taste-frontend,
  skill-installer, tdd-heartbeat), with content-sized cards, accent icons, and two feature tiles.

## [0.3.0] - 2026-06-21

### Added — Anvil MVP

- **`anvil`** plugin (v0.1.0) — native effectiveness evals & improvement loop for Claude Code
  skills, subagents & plugins. Generate balanced test data, run **in-session subagent A/B trials**
  on your subscription (no external `claude -p`, no API key), score activation precision/recall/F1 +
  with-vs-without quality delta with confidence intervals + token cost + variance, and propose
  concrete improvements that re-measure the delta.
  - Commands: `/anvil-gen-testdata`, `/anvil-eval`, `/anvil-improve`.
  - Subagents: `anvil-task-runner`, `anvil-judge`, `anvil-testdata-generator`, `anvil-analyst`.
  - Skills: `running-an-eval`, `generating-test-data`, `improving-an-artifact`.
- **`@anvil/core`** (v0.1.0) — frozen Zod contract (eval suite + result schemas, `schemaVersion: 1`
  for both), scoring math (deterministic checks, position-swap judge aggregation, token-based cost,
  CIs/variance, plugin integrity), and transcript-introspection lib. New:
  `findSubagentTranscriptByAgentId` resolves a subagent transcript by `agentId` alone (globs the
  project's sessions), so an in-session skill no longer needs the parent session id.
- **`@anvil/server`** (v0.1.0) — `anvil-server` bin with `mcp` (stdio tools the model calls) and
  `serve` (companion REST/WS API for the UI) modes; JSON storage of suites/results with an idempotent
  index. `anvil_introspect_transcript` now accepts `agentId` with an **optional** `sessionId`.
- **`@anvil/ui`** (v0.1.0) — dual-mode dashboard (Vite + React + Recharts): live against the server,
  or static committed JSON for GitHub Pages. Ships an **illustrative** demo dataset (skill, subagent,
  plugin examples) under a clearly-labeled banner.
- **`bake-to-completion`** plugin (v0.1.0) — an interview-driven skill that strengthens a
  half-baked software/product idea (adaptive Socratic interview + adversarial stress-test) and hands
  off a brief for design and planning.
- **GitHub Pages deploy** (`.github/workflows/pages-deploy.yml`) and a **cross-platform CI matrix**
  (Windows/macOS/Linux) plus an opt-in manual live-smoke job (`.github/workflows/ci.yml`).
- **Docs** under `docs/`: Getting Started, Generating Test Data, Running an Eval, Running Live,
  Metrics Reference, Improvement Loop, Architecture, and Releasing (versioning + schema-migration
  policy).

### Removed
- `idea-briefs/` is now treated as local skill output (generated in a user's working directory) and
  is git-ignored rather than committed to the marketplace.

## [0.2.0] - 2026-06-18

### Added
- `bitbucket-repo`, `bitbucket-pipeline`, `bitbucket-pr` — Bitbucket Cloud plugins
  (auth and workspace/repo resolved from env vars or the git remote).
- `jira-api` — Jira REST API reference and scripts (instance configurable via `JIRA_BASE_URL`).
- `md-with-mermaid-to-pdf` — Markdown-with-Mermaid to PDF converter.
- `new-aspire-project` — .NET Aspire clean/CQRS project scaffolder (template body must be
  supplied; see README).
- `.gitattributes` enforcing LF line endings on `*.sh`.

### Removed
- `example-empowerment` placeholder plugin (superseded by the real plugins above).

### Changed
- Genericized all imported plugins: removed organization-specific authors, the hardcoded
  Jira instance, and bundled machine/session artifacts (`.claude/settings.local.json`,
  agent memory).

## [0.1.0] - 2026-06-18

### Added
- Initial marketplace skeleton (`.claude-plugin/marketplace.json`).
- `example-empowerment` template plugin with a sample skill, command, and agent.
- README with installation and authoring instructions.
