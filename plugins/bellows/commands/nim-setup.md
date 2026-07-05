---
description: Set up (or health-check) NVIDIA build.nvidia.com access -- create an account and API key, verify it live, and persist NVIDIA_API_KEY.
argument-hint: (no arguments)
---

# /nim-setup

Idempotent onboarding and health check for NVIDIA's free hosted inference. Follow the steps in
order; never write the key to any file, and never echo a full key back into the chat (show at
most the `nvapi-` prefix plus the last 4 characters).

## 1. Check the current state

Run: `node "${CLAUDE_PLUGIN_ROOT}/scripts/nim.mjs" verify`

- If it prints `OK: key valid, N models available`: report the healthy state and stop. Setup is done.
- If it reports a 401: the key exists but is dead. Continue from step 3 to mint a new one.
- If it reports a missing key: continue from step 2.

## 2. Guide account and key creation

Walk the user through it in the browser (open the URL for them if a browser tool is available,
otherwise print it):

1. Go to https://build.nvidia.com and sign in, or create a free NVIDIA account.
2. Once signed in, open any model page (or the API keys section of the account menu) and
   generate an API key. Free accounts include promotional credits; no card is needed.
3. The key starts with `nvapi-`. Have the user paste it into the chat, or set it themselves.

## 3. Verify the key BEFORE persisting

Have the user set it for this session, or run the verify with it inline (PowerShell):

`$env:NVIDIA_API_KEY = '<pasted key>'; node "${CLAUDE_PLUGIN_ROOT}/scripts/nim.mjs" verify`

Only proceed once verify prints OK. If it fails with 401, the key was mis-pasted; try again.

## 4. Persist it

- Windows: `setx NVIDIA_API_KEY "<pasted key>"` then remind the user: setx affects NEW
  processes only, so Claude Code must be restarted before the key is visible everywhere.
- macOS/Linux: append `export NVIDIA_API_KEY="<pasted key>"` to the shell profile
  (`~/.zshrc` or `~/.bashrc`) and `source` it.

## 5. Confirm

Run verify once more in a fresh context if possible, then tell the user what they now have:
`/nim-models` for the inventory, `/nim` for quick delegation, and the `nim_chat` /
`nim_list_models` MCP tools that start automatically with this plugin.
