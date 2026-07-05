# bellows — NVIDIA NIM empowerment plugin (design)

Date: 2026-07-05
Status: approved by user (brainstorming session)

## Purpose

Turn build.nvidia.com's free, OpenAI-compatible cloud inference into a first-class Claude Code
capability. The plugin does four jobs:

1. **Onboard** — walk the user through creating an NVIDIA account and API key, verify the key
   works, and persist it as the `NVIDIA_API_KEY` environment variable.
2. **Inventory** — list the models currently available on the endpoint, annotated with which are
   coding-focused and what each is good for.
3. **Delegate** — let Claude Code offload coding grunt-work (bulk transforms, second opinions,
   parallel drafts, huge-context summarization) to NVIDIA-hosted models such as Qwen-Coder,
   DeepSeek, and Nemotron.
4. **Instruct** — teach Claude how to integrate NVIDIA inference into the *user's own apps*
   correctly, via an integration playbook skill.

A bellows pumps outside air into a forge to make it burn hotter; this plugin pumps outside
inference into the marketplace's forge.

## Decisions made during brainstorming

- **Cloud only (v1).** All inference goes to `https://integrate.api.nvidia.com/v1` (hosted,
  free-credit NIM endpoints). "Local coding models" means open-weight models hosted on NVIDIA's
  cloud, not NIM containers on the user's GPU. Local NIMs are out of scope.
- **Both a CLI script and an MCP server.** A zero-dependency Node CLI (`scripts/nim.mjs`) that
  Claude or the user can shell out to, plus a bundled stdio MCP server. The MCP server is declared
  in the plugin manifest (`mcpServers`), so Claude Code auto-starts it whenever the plugin is
  enabled — that is the "always starts" guarantee.
- **Instructor = playbook skill**, not a scaffolding generator. The skill teaches patterns; Claude
  writes integration code native to whatever stack the target app uses.
- **Key storage: env var `NVIDIA_API_KEY` only.** Standard NVIDIA convention. No config files, no
  keys on disk.

## Components

```
plugins/bellows/
├── .claude-plugin/plugin.json     # name, version, author, mcpServers → auto-start
├── README.md
├── commands/
│   ├── nim-setup.md               # guided account + API key onboarding, verify, persist env var
│   ├── nim-models.md              # live inventory from /v1/models + curated annotations
│   └── nim.md                     # one-shot: /nim [--model <id>] "prompt" → answer in chat
├── skills/
│   ├── delegating-to-nim/
│   │   └── SKILL.md               # when & how Claude offloads work to NVIDIA models
│   └── nim-integration-playbook/
│       ├── SKILL.md               # the instructor: core pattern + model choice + key hygiene
│       └── references/
│           ├── openai-sdk-js.md   # JS/TS integration via official OpenAI SDK
│           ├── python.md          # Python integration
│           ├── curl.md            # raw HTTP
│           ├── streaming.md       # SSE streaming patterns
│           └── model-choice.md    # which model for chat / code / long-context
├── scripts/
│   └── nim.mjs                    # zero-dep Node CLI: verify | models | chat
└── mcp/
    └── server.mjs                 # stdio MCP server: nim_chat, nim_list_models
```

`nim.mjs` and `server.mjs` share one core client module (single `lib` file, two entry points) so
request construction, auth, and error mapping exist exactly once.

### /nim-setup

Idempotent onboarding and health check:

1. Check `NVIDIA_API_KEY` in the environment. If present, verify it with a real API call and
   report status (doubles as a health check).
2. If absent: open the browser to build.nvidia.com, walk the user step-by-step through signup and
   API key generation (keys look like `nvapi-...`).
3. Verify the new key with a live call before persisting anything.
4. Help persist it: `setx NVIDIA_API_KEY ...` on Windows, shell-profile export otherwise. Remind
   the user to restart the session so the variable is visible.

### /nim-models

Calls `GET https://integrate.api.nvidia.com/v1/models`, cross-references a curated table
(coding-focused models, context windows, good-for-what), and prints an annotated inventory. The
raw list is cached for one day (public data only) so repeat calls are free.

### /nim

Quick delegation: `/nim "prompt"` sends the prompt to the curated default coding model via
`nim.mjs`; `--model <id>` overrides. Output is shown in chat.

### delegating-to-nim skill

Teaches Claude *when* offloading is worth it (bulk mechanical transforms, second opinions on
tricky bugs, generating parallel drafts, summarizing content too large to read inline) and *how*
(shell out to `nim.mjs` or call the MCP tools). Includes the honesty rule: NVIDIA model output is
a draft to verify, never truth to relay.

### nim-integration-playbook skill (the instructor)

Triggers when the user wants to add AI capability to one of their apps using NVIDIA models. Core
pattern: point the official OpenAI SDK at `https://integrate.api.nvidia.com/v1` authenticated by
`NVIDIA_API_KEY`. References cover per-stack snippets, streaming, model selection, rate-limit
handling and fallbacks, and key hygiene (env-only, never committed).

### MCP server

Stdio, zero-dependency Node, launched automatically by Claude Code via the plugin manifest.
Tools:

- `nim_chat(model, prompt, system?)` → completion text
- `nim_list_models()` → model list

## Data flow and error handling

- Every surface reads `NVIDIA_API_KEY` from the environment. Missing key → identical actionable
  message everywhere: "run /nim-setup".
- 401 → key invalid or expired; point at /nim-setup.
- 429 → surface the retry-after information; the delegation skill instructs Claude to back off,
  not hammer.
- No key material or prompt content is written to disk. The only cache is the public model list.

## Testing and repo conventions

- Eval spec at `evals/bellows.skill.yaml`, following the existing proofmark/skill-foundry evals.
- Run proofmark over the plugin before shipping.
- Register the plugin in the marketplace manifest.
- Add a `site/bellows/` showcase page using the shared site shell.
- All work happens on a worktree branched off `main`.

## Out of scope (v1)

Local NIM containers, embeddings/vision/RAG helpers, usage/credit tracking, multi-key profiles.
The playbook's reference layout leaves room for embeddings and vision guides later.
