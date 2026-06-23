---
name: web-smoke-test
description: Use when asked to smoke-test a web change, or when iterative-review-fix is about to declare a web UI / front-end change done. Drives a real Chrome via the chrome-devtools MCP against the project's dev server, exercises the changed flow, and captures browser + server failures into a report. Generic and project-agnostic — reads the dev command and URL from the project rather than hardcoding them.
---

# Web Smoke Test

Drive a real browser through the change you just made and prove the happy path
still works before calling a web UI change done. This is the final gate after
review, not a replacement for it.

## When to Use

- The user asks to "smoke-test", "click through it", or "check it in the browser".
- `iterative-review-fix` (or `jira-ticket`) is about to declare a change done and
  the change touched front-end / web UI code.

## When NOT to Use

- The change is backend-only with no rendered surface. Say so and skip.
- There is a project-specific smoke skill (for example one bound to an isolated
  dev server and database). Prefer that one; this is the generic fallback.

## Step 0 — Check the dependency FIRST

This skill needs the **chrome-devtools MCP** (the `chrome-devtools-mcp` plugin).
Before doing anything else, confirm those browser tools are available
(e.g. `new_page`, `navigate_page`, `take_snapshot`, `list_console_messages`,
`list_network_requests`).

If they are NOT available, STOP and tell the user how to add it, for example:

```
/plugin marketplace add anthropics/claude-code     # if not already added
/plugin install chrome-devtools-mcp@<marketplace>
```

Do not attempt to smoke-test without the MCP. Report the gap and stop.

## Step 1 — Work out how to run the app

Determine the dev command and the URL to open, in this order:

1. Read `CLAUDE.md` for a dev/serve command and a fixed port if one is stated.
2. Otherwise read `package.json` scripts (`dev`, `start`, `serve`) or the
   stack's equivalent, and infer the default port for the framework
   (Next 3000, Vite 5173, and so on).
3. If you still cannot tell, ask the user for the dev command and the URL.

Note the host OS so any shell snippet you run matches it (Git Bash on Windows).

## Step 2 — Start the dev server

Start the dev server as a background process. Wait until it is actually serving
(poll the URL, do not just sleep). Record the PID / handle so you can stop it in
Step 5. If a server is already running on the target URL, reuse it and do not
start a second one.

## Step 3 — Decide what to exercise

Identify the routes and flows the current change set affects (from the diff, the
spec, or by asking). Keep the run focused on what changed plus the one or two
paths most likely to break because of it. Do not attempt to crawl the whole app.

## Step 4 — Drive the browser and capture failures

Using the chrome-devtools MCP:

1. Open a page and navigate to the first target route.
2. Walk the flow: click, fill, submit, and navigate as a user would.
3. After each meaningful step, capture:
   - **Console messages** — flag any `error` (and noteworthy `warning`).
   - **Network requests** — flag any non-2xx/3xx response or failed request.
   - **A snapshot or screenshot** at key states.
4. Treat as a FAILURE: uncaught console errors, failed/4xx/5xx requests on the
   happy path, a flow step that cannot complete, or a blank/broken render.

## Step 5 — Report and clean up

1. Stop the dev server you started (leave a pre-existing one running).
2. Print a concise report:

   ```
   web-smoke-test: <PASS | FAIL>
   Routes exercised:  <list>
   Console errors:    <count> <details if any>
   Network failures:  <count> <details if any>
   Screenshots:       <paths if saved>
   ```

3. On FAIL, list each failure with enough detail to fix it, and (when invoked by
   a review/pilot flow) hand back so the caller can loop into a fix. Do not
   declare the change done while smoke is failing.

## Red Flags

| Thought | Reality |
|---------|---------|
| "I'll just assume it works, the tests passed." | Unit tests do not catch a blank screen or a 500 on submit. Drive the browser. |
| "No chrome-devtools MCP, I'll script curl instead." | This skill is about the rendered UI. Stop and report the missing MCP. |
| "I'll crawl every page." | Stay scoped to what the change touched plus its immediate neighbours. |
| "I'll leave the dev server running." | Stop any server you started; only reuse one that was already up. |
