# bellows

**Pump free NVIDIA inference into your forge.**

A bellows feeds outside air into a forge to make it burn hotter. This plugin feeds outside
inference (NVIDIA's free hosted models at build.nvidia.com) into Claude Code: guided key
setup, a live annotated model inventory, delegation of coding grunt-work, and an instructor
playbook for wiring the same models into your own apps.

## What you get

| Surface | What it does |
|---|---|
| `/nim-setup` | Guided account + API key creation, live verification, persists `NVIDIA_API_KEY`. Idempotent; doubles as a health check. |
| `/nim-models` | Live inventory from `/v1/models`, annotated with what each model is good for. |
| `/nim "prompt"` | One-shot delegation to a hosted coding model (`--model <id>` to override). |
| `nim_chat`, `nim_list_models` | MCP tools, auto-started with the plugin. No manual server management. |
| `delegating-to-nim` skill | Teaches Claude when offloading pays (bulk transforms, second opinions, parallel drafts, big-input summarization) and the honesty rules. |
| `nim-integration-playbook` skill | The instructor: OpenAI-SDK-pointed-at-NVIDIA patterns for JS/TS, Python, raw HTTP, streaming, model choice, key hygiene. |

## Setup

1. Install/enable the plugin.
2. Run `/nim-setup` and follow along (free NVIDIA account, key starts with `nvapi-`).
3. That's it. The key lives only in the `NVIDIA_API_KEY` environment variable.

## Design notes

- One zero-dependency client lib (`scripts/nim-lib.mjs`) backs both the CLI
  (`scripts/nim.mjs`) and the MCP server (`mcp/server.mjs`).
- No key material or prompt content ever touches disk.
- Cloud-only v1: everything talks to `https://integrate.api.nvidia.com/v1`. Local NIM
  containers are out of scope for now.

## Tests

`node --test plugins/bellows/scripts/nim-lib.test.mjs plugins/bellows/scripts/nim-cli.test.mjs plugins/bellows/mcp/server.test.mjs` (no network, no key needed).
