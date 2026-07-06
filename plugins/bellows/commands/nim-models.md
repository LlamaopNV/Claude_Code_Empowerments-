---
description: List the models available on your NVIDIA build.nvidia.com account, annotated with what each is good for.
argument-hint: [--json]
---

# /nim-models

## 1. Fetch the live list

Run: `node "${CLAUDE_PLUGIN_ROOT}/scripts/nim.mjs" models --json`

If it fails with a missing-key or 401 error, relay the message and point the user at `/nim-setup`; stop.
Note: this list may come from a 24-hour local cache of the public model ids, so it can lag a very
recent catalog change; `/nim-setup` (verify) is the key health check, not this command.

## 2. Present an annotated inventory

Cross-reference the live ids against this curated table. Present three groups: **coding models**
(lead with these), **general/reasoning models**, then a count of everything else with a note
that the full list is available on request. Only show rows whose id appeared in the live list;
never present a curated row the endpoint did not return.

| Model id | Good for |
|---|---|
| openai/gpt-oss-120b | Default: fastest model that still aced the 2026-07 coding bakeoff |
| deepseek-ai/deepseek-v4-pro | Strong general coding, thorough second opinions |
| deepseek-ai/deepseek-v4-flash | Cheap second opinions; thinks a lot relative to its final answer |
| z-ai/glm-5.2 | Solid general coding alternative |
| nvidia/nemotron-3-ultra-550b-a55b | Deliberate reasoning and tricky-bug analysis (slow; thinking-budget model) |
| moonshotai/kimi-k2.6 | Agentic/tool-style tasks, long context |
| nvidia/llama-3.3-nemotron-super-49b-v1.5 | Fast general assistant work |
| meta/llama-3.3-70b-instruct | Reliable general baseline |

(The table is curated; when the live list contains an obviously newer flagship coding model,
say so rather than pretending the table is complete. A few catalog ids are listed by
`/v1/models` but 404 on invocation — the chat surfaces report that plainly when it happens.)

## 3. Remind the delegation path

Close with: use `/nim "prompt"` or the `nim_chat` MCP tool to send work to any of these ids.
