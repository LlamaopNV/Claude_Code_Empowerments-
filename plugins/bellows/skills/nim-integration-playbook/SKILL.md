---
name: nim-integration-playbook
description: Use when the user wants to add AI/LLM capability to THEIR OWN app using NVIDIA-hosted models (build.nvidia.com / integrate.api.nvidia.com) - chat features, code assistants, summarizers, or any OpenAI-compatible integration pointed at NVIDIA's free endpoints. Covers SDK setup per stack, model selection, streaming, key hygiene, and rate-limit handling. NOT for delegating Claude's own work to a model (that is delegating-to-nim) and not for other providers' APIs.
---

# NVIDIA integration playbook

One pattern rules everything: NVIDIA's hosted endpoints are OpenAI-compatible, so the user's
app uses the standard OpenAI SDK for its language, pointed at NVIDIA's base URL with their
NVIDIA_API_KEY. Write integration code native to the app's existing stack and style.

## The core pattern

- Base URL: `https://integrate.api.nvidia.com/v1`
- Auth: `Authorization: Bearer $NVIDIA_API_KEY` (keys look like `nvapi-...`)
- Endpoints: `/chat/completions` (primary), `/models` (inventory)
- SDK: the official OpenAI client for the stack, with `baseURL`/`base_url` overridden

Per-stack snippets, load only what the app needs:

- JavaScript/TypeScript: `references/openai-sdk-js.md`
- Python: `references/python.md`
- Any other language / no SDK: `references/curl.md` (raw HTTP translates everywhere)
- Streaming UX: `references/streaming.md`
- Which model to wire in: `references/model-choice.md`

## Rules that always apply

1. **Key hygiene.** The key comes from the environment (NVIDIA_API_KEY), never a literal in
   code, never committed, never logged. Frontend apps must proxy through a backend route; a
   key shipped to the browser is public.
2. **Fail loud and helpful.** Map 401 to "check NVIDIA_API_KEY" and 429 to a retry-with-backoff
   (one retry, then surface the error). Do not swallow errors into empty strings.
3. **Model id is config, not code.** Read it from an env var or config file with a sane
   default, so the user can swap models without a deploy.
4. **Timeouts.** Hosted models can take tens of seconds on long prompts; set client timeouts
   of 60s or more and stream when the UI shows text to a human.
5. **If the user has no key yet**, point them at /nim-setup in Claude Code, or
   https://build.nvidia.com directly.
