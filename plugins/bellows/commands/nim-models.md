---
description: List the models available on your NVIDIA build.nvidia.com account, annotated with what each is good for.
argument-hint: [--json]
---

# /nim-models

## 1. Fetch the live list

Run: `node "${CLAUDE_PLUGIN_ROOT}/scripts/nim.mjs" models --json`

If it fails with a missing-key or 401 error, relay the message and point the user at `/nim-setup`; stop.

## 2. Present an annotated inventory

Cross-reference the live ids against this curated table. Present three groups: **coding models**
(lead with these), **general/reasoning models**, then a count of everything else with a note
that the full list is available on request. Only show rows whose id appeared in the live list;
never present a curated row the endpoint did not return.

| Model id | Good for |
|---|---|
| qwen/qwen3-coder-480b-a35b-instruct | Best default for code generation and bulk transforms; large context |
| deepseek-ai/deepseek-v3.1 | Strong general coding, cheap second opinions |
| deepseek-ai/deepseek-r1 | Deliberate reasoning; tricky-bug analysis (slow, verbose) |
| moonshotai/kimi-k2-instruct | Agentic/tool-style tasks, long context |
| nvidia/llama-3.3-nemotron-super-49b-v1.5 | Fast general assistant work |
| meta/llama-3.3-70b-instruct | Reliable general baseline |

(The table is curated; when the live list contains an obviously newer flagship coding model,
say so rather than pretending the table is complete.)

## 3. Remind the delegation path

Close with: use `/nim "prompt"` or the `nim_chat` MCP tool to send work to any of these ids.
