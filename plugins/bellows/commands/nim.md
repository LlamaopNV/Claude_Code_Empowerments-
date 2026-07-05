---
description: Send a one-shot prompt to an NVIDIA-hosted model (free build.nvidia.com inference) and show the answer.
argument-hint: [--model <id>] "prompt"
---

# /nim

One-shot delegation to NVIDIA's hosted models.

1. Parse `$ARGUMENTS`: an optional `--model <id>` followed by the prompt text. No prompt ->
   ask for one.
2. Run: `node "${CLAUDE_PLUGIN_ROOT}/scripts/nim.mjs" chat --model <id-or-default> "<prompt>"`
   (omit `--model` to use the curated default coding model). For multi-line prompts, pipe
   them on stdin instead of the argument list.
3. Show the model's answer clearly attributed to the model id that produced it, so the user
   never mistakes it for your own analysis. If the output matters (code, facts), sanity-check
   it and say what you checked.
4. On missing-key/401 errors, point at `/nim-setup`. On 429, say the free tier is rate
   limited and to retry shortly; do not auto-retry in a loop.
