# Credits & Attribution

This plugin is **adapted, with thanks, from work by Peter Steinberger ([@steipete](https://github.com/steipete))**.

- **Original source:** [`steipete/agent-scripts` → `skills/github-project-triage/SKILL.md`](https://github.com/steipete/agent-scripts/blob/main/skills/github-project-triage/SKILL.md)
- **Original license:** MIT (see https://github.com/steipete/agent-scripts)
- **Author:** Peter Steinberger ([@steipete](https://github.com/steipete))

## What was changed

The original is tuned to its author's personal environment. This vendored copy is **generalized** so it runs in any repository with an authenticated `gh` CLI:

- Removed the dependency on the `repobar` binary / `~/Projects/RepoBar` SwiftPM build; queue discovery now uses plain `gh`.
- Removed hardcoded default owners (`steipete`, `openclaw`) and the `amantus-ai` carve-out; scope now defaults to the **current repository** and broadens only on explicit user request.
- Replaced the maintainer named "Peter" with the repo's owner/maintainer, and "Peter comments are authoritative" with "owner comments are authoritative".
- Replaced author-specific tooling references (`clawdbot`, `clawtributors`, `gitcrawl`, `Peekaboo`, `Codex Auto Review`, `~/Projects/...` helper scripts) with portable equivalents (`gh api` for trust signals, the repo's own `/code-review` step, generic UI proof paths).
- Kept the methodology, triage taxonomy, output shapes, and intent intact — those are the original author's design.

The core triage approach and structure are Peter Steinberger's; this copy only de-personalizes it. If you build on this, please keep the attribution.
