# Choosing a model

Verify availability against the live list (`/nim-models` in Claude Code, or GET /v1/models)
before hardcoding a default; NVIDIA rotates the catalog.

| Need | Start with | Why |
|---|---|---|
| Code generation / refactoring feature | openai/gpt-oss-120b | Fast and accurate on coding tasks (2026-07 bakeoff winner) |
| General chat / assistant | meta/llama-3.3-70b-instruct | Reliable, fast, cheap on credits |
| Deep reasoning (analysis, planning) | nvidia/nemotron-3-ultra-550b-a55b | Deliberate thinking-budget model (slow; stream it) |
| Long-context ingestion | moonshotai/kimi-k2.6 | Long context, agentic style |
| Low latency, high volume | nvidia/llama-3.3-nemotron-super-49b-v1.5 | Small enough to be snappy |

Each model's build.nvidia.com page embeds its recommended request parameters (temperature,
top_p, max_tokens, reasoning knobs). Match them in your own integration - reasoning models
in particular degrade badly when called with generic parameters. Prefer streaming; several
models emit a separate `reasoning_content` delta channel your client should not discard.

Rules of thumb:
- Ship with ONE default and make it configurable (env var), then let usage argue for changes.
- Free-tier credits are finite: prefer the smallest model that passes your quality bar.
- Re-run the availability check in CI or at boot if the app hard-depends on a specific id.
