---
description: Send a one-shot prompt to an NVIDIA-hosted model (free build.nvidia.com inference) and show the answer.
argument-hint: [--model <id>] "prompt"
---

# /nim

One-shot delegation to NVIDIA's hosted models.

1. Parse `$ARGUMENTS`: an optional `--model <id>` followed by the prompt text. No prompt ->
   ask for one.
2. Run: `node "${CLAUDE_PLUGIN_ROOT}/scripts/nim.mjs" chat --model <id> -- "<prompt>"` (omit
   `--model` to use the curated default coding model). Always insert the `--` separator before
   the prompt so it is never mistaken for an option. For multi-line prompts, or any prompt
   containing double quotes, dollar signs, backticks, or a token starting with `--`, pipe it
   on stdin instead of passing it as an argument.
3. Show the model's answer clearly attributed to the model id that produced it, so the user
   never mistakes it for your own analysis. If the output matters (code, facts), sanity-check
   it and say what you checked.
4. On missing-key/401 errors, point at `/nim-setup`. On 429, say the free tier is rate
   limited and to retry shortly; do not auto-retry in a loop.
