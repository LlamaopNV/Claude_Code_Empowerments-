# Bellows 0.2.0: per-model invocation profiles

## Context

A head-to-head coding benchmark (2026-07-05) across the NVIDIA free catalog exposed that bellows
calls every model as a generic chat endpoint, while NVIDIA publishes per-model invocation setups.
Concrete failures observed:

- `nvidia/nemotron-3-ultra-550b-a55b` needs `chat_template_kwargs: {enable_thinking}` +
  `reasoning_budget` + `temperature 1 / top_p 0.95`; called generically it generated at ~5 chars/s
  and was killed by the gateway mid-file.
- DeepSeek-style models stream their work in `delta.reasoning_content`, which `nim-lib` discards —
  `deepseek-ai/deepseek-v4-flash` returned "0 chars" while producing 41k chars of reasoning.
- Non-streaming calls via Node's `fetch` die at ~300s (undici body timeout) — long generations
  (`kimi-k2.6`, `gpt-oss-120b`, `nemotron`) all "failed" this way.
- `moonshotai/kimi-k2.6` has the opposite quirk: its streaming endpoint delivers zero tokens
  (closes at exactly ~300s); non-streaming works.
- The hardcoded default model `qwen/qwen3-coder-480b-a35b-instruct` no longer exists in the
  catalog; `mistralai/codestral-22b-instruct-v0.1` is listed by `/v1/models` but 404s on invocation.

Key discovery enabling the fix: every `build.nvidia.com/<model-id>` page embeds a JSON request
schema with per-parameter `default` values (temperature, top_p, max_tokens, and model-specific
extras like `reasoning_effort`, `reasoning_budget`, `chat_template_kwargs`). That is a
machine-readable, always-current source for each model's recommended setup.

## Goal

`nim_chat` / `nim.mjs chat` invoke any catalog model the way NVIDIA's own playground does, with
no per-model knowledge required from the caller, and long generations survive.

## Architecture

Two additions to `plugins/bellows/scripts/nim-lib.mjs`, consumed unchanged by the CLI and MCP
server:

### 1. Profile resolver

`getModelProfile(modelId, { env, fetchImpl } = {})` →
`{ params: {...}, source: 'live' | 'cache' | 'fallback' }`

- Fetches `https://build.nvidia.com/<model-id>`, reassembles the Next.js `self.__next_f.push`
  string chunks, locates the embedded request-body JSON schema (the object whose `properties`
  contains both `model` and `messages`), and extracts every property with a concrete non-null
  `default`.
- Property selection: primitives only (number/string/boolean/plain object), excluding
  `model`, `messages`, `stream`, `stop`, `seed`, `frequency_penalty`, `presence_penalty`,
  and response-shape fields. Whatever remains (e.g. `temperature`, `top_p`, `max_tokens`,
  `reasoning_effort`, `reasoning_budget`, `chat_template_kwargs`) becomes `params` sent
  verbatim in the request body.
- Cache: `bellows-profile-<slug>.json` in the OS temp dir, 24h TTL (same pattern as the
  model-list cache). `verify` never touches profiles.
- Failure at any step (network, page shape change, no schema found) → `source: 'fallback'`
  with empty params; the call proceeds generically. Never fatal.

### 2. Streaming chat pipeline

`chat({ model, prompt, system, maxTokens })` (same signature, `maxTokens` now optional):

- Request body = profile params, overlaid by explicit caller args (`maxTokens` wins over the
  profile's `max_tokens`), plus `stream: true`.
- SSE parsing accumulates `delta.content` and `delta.reasoning_content` separately.
- Returns the final `content`; if content is empty but reasoning is not, returns the reasoning
  text (flagged in the CLI output) so a thinking-heavy reply is never reported as empty.
- Zero tokens on both channels after stream close → one non-streaming retry (kimi quirk).
- Etiquette preserved: single 30s backoff on 429; 404 mapped to "model is in the catalog but not
  invocable on this account"; key handling unchanged (env only, never persisted by the lib).

### 3. Default model

`DEFAULT_MODEL = 'openai/gpt-oss-120b'` — speed-weighted winner of the 2026-07-05 bakeoff
(28/30 hidden tests in 102s; the only faster models scored ≤13/30). Revisit on future bakeoffs.

### 4. Surfaces

- CLI (`nim.mjs`): new `profile <model-id>` subcommand printing the resolved profile and its
  source; `chat` gains `--max-tokens <n>`. `verify` / `models` unchanged.
- MCP server: `nim_chat` picks all of this up via `chat()`; tool description updated to mention
  profiles and the new default.
- Docs: README, `skills/delegating-to-nim`, `skills/nim-integration-playbook/references/model-choice.md`,
  `commands/nim-models.md` (curated table refresh: drop dead ids, add current ones from the
  bakeoff), `commands/nim.md`. Plugin version 0.1.0 → 0.2.0 in `.claude-plugin/plugin.json`.

## Data flow

```
chat(model) ── getModelProfile(model) ── temp-dir cache (24h)
                     │ miss/stale
                     ▼
        build.nvidia.com/<id> page ── extract schema defaults ── cache write
                     │ any failure
                     ▼
              fallback: {} (generic call)

request body = profile.params ⊕ caller overrides ⊕ stream:true
  → SSE: content + reasoning_content
  → both empty → non-streaming retry once
  → content || reasoning → caller
```

## Error handling

| Failure | Behavior |
| --- | --- |
| Profile fetch/parse fails | generic call, `source: 'fallback'` (CLI `profile` shows it) |
| 429 | one 30s backoff, then surface the rate-limit error |
| 404 on invocation | "listed but not invocable on this account" message |
| Stream yields zero tokens | one non-streaming retry, then error |
| Content empty, reasoning present | return reasoning, note provenance |

## Testing

- Unit (existing `node --test` files, explicit paths): schema extraction from a captured
  `build.nvidia.com` HTML fixture; property selection rules; cache TTL; profile fallback on
  bad HTML; chat body composition (profile ⊕ overrides); SSE parsing incl. reasoning channel;
  zero-token → non-streaming fallback; 429/404 mapping. All network via injected `fetchImpl` /
  request stubs — tests run with no key and no network.
- Live smoke (manual, keyed): `verify`, `profile nvidia/nemotron-3-ultra-550b-a55b` (expects
  thinking params), `chat` against the default model, `chat --model moonshotai/kimi-k2.6`
  (exercises the non-streaming fallback).

## Out of scope

- Multi-turn conversations, tool calling, vision inputs.
- User-editable profile overrides (revisit if NVIDIA's page format breaks).
- Auto-refreshing the curated table in `nim-models.md` (stays a manual doc edit).
