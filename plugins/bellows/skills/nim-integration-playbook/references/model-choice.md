# Choosing a model

Verify availability against the live list (`/nim-models` in Claude Code, or GET /v1/models)
before hardcoding a default; NVIDIA rotates the catalog.

| Need | Start with | Why |
|---|---|---|
| Code generation / refactoring feature | qwen/qwen3-coder-480b-a35b-instruct | Strongest hosted coding model; large context |
| General chat / assistant | meta/llama-3.3-70b-instruct | Reliable, fast, cheap on credits |
| Deep reasoning (analysis, planning) | deepseek-ai/deepseek-r1 | Deliberate chain-of-thought quality |
| Long-context ingestion | moonshotai/kimi-k2-instruct | Long context, agentic style |
| Low latency, high volume | nvidia/llama-3.3-nemotron-super-49b-v1.5 | Small enough to be snappy |

Rules of thumb:
- Ship with ONE default and make it configurable (env var), then let usage argue for changes.
- Free-tier credits are finite: prefer the smallest model that passes your quality bar.
- Re-run the availability check in CI or at boot if the app hard-depends on a specific id.
