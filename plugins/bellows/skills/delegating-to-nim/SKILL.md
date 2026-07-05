---
name: delegating-to-nim
description: Use when work could be offloaded to a free NVIDIA-hosted model (build.nvidia.com) instead of doing it inline - bulk mechanical code transforms, second opinions on a tricky bug or design, generating parallel draft implementations, or summarizing content too large to read in context. Requires NVIDIA_API_KEY (run /nim-setup once). NOT for tasks needing repo context the remote model cannot see, and never as an authority - its output is a draft to verify.
---

# Delegating to NVIDIA models

Free hosted inference is a workbench assistant, not an oracle. Offload work that is cheap to
verify and expensive to produce.

## When it pays off

- **Bulk mechanical transforms.** Rename/reshape 40 similar files? Send one exemplar and the
  rule, apply the pattern locally, verify with tests.
- **Second opinions.** Stuck on a bug or a design choice? Describe it to a reasoning model
  (deepseek-ai/deepseek-r1) and compare its take with your own. Disagreement is signal.
- **Parallel drafts.** Need three candidate implementations to compare? Ask a coding model for
  drafts while you write the one you believe in.
- **Big-input summarization.** Logs, diffs, or docs too large to read inline: pipe them in and
  work from the summary, but spot-check any claim you act on.

## When it does not

- The task needs live repo context (imports, house style, private types) the remote model
  cannot see. You will spend longer fixing its guesses than doing the work.
- The answer must be authoritative. Model output is a DRAFT. Verify before relaying: run the
  code, check the claim, or label it clearly as an unverified suggestion.
- Secrets or proprietary code the user has not okayed leaving the machine. Prompts go to
  NVIDIA's cloud; ask before sending anything sensitive.

## How to call it

Two equivalent surfaces (same lib underneath):

- **MCP tools** (auto-started with this plugin): `nim_chat(prompt, model?, system?)`,
  `nim_list_models()`.
- **CLI** for piped input:
  `node "${CLAUDE_PLUGIN_ROOT}/scripts/nim.mjs" chat --model <id> "prompt"` or
  `cat big.log | node "${CLAUDE_PLUGIN_ROOT}/scripts/nim.mjs" chat "summarize the errors"`.

Model choice: default (qwen/qwen3-coder-480b-a35b-instruct) for code; deepseek-ai/deepseek-r1
for deliberate reasoning; run /nim-models for the live annotated inventory.

## Etiquette

- Missing key or 401: stop and point the user at /nim-setup. Do not improvise key handling.
- 429: back off once, then tell the user the free tier is saturated. Never retry in a loop.
- Attribute delegated output ("draft from qwen3-coder") so the user knows its provenance.
