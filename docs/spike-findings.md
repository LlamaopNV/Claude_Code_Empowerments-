# Ticket 0.1 — Spike Findings (Native In-Session Introspection)

**Date:** 2026-06-21
**Status:** ✅ **Crux primitives verified** against real session transcripts (no `claude -p`).
**Method:** Inspected transcripts this Claude Code session already produced on Windows, including a
real dispatched subagent (`claude-code-guide`, agentId `adee89195ab9af81e`).

## Environment
- Project transcript root: `C:\Users\Llama\.claude\projects\C--Code-Agent-Eval-pipeline\`
- Main session transcript: `<sessionId>.jsonl`
- **Subagent transcripts: `<sessionId>/subagents/agent-<agentId>.jsonl`**

## Verified facts (with evidence)

| Claim | Evidence | Verdict |
|---|---|---|
| Subagent transcripts persist on disk | `…/2b67b33f-…/subagents/agent-adee89195ab9af81e.jsonl` (883 KB) | ✅ |
| Dispatch → transcript mapping | filename agentId == the agentId returned by the Agent/Task dispatch | ✅ |
| Subagent internal tool calls recorded | subagent file: `13×WebFetch, 1×WebSearch, 1×Grep, 1×Read` (matches reported 16 tool_uses) | ✅ |
| Token usage recoverable | `"usage":{"input_tokens":…,"output_tokens":…,"cache_creation_input_tokens":…,"cache_read_input_tokens":…}` — 25 records | ✅ |
| Dispatch detectable in parent | main session: `"name":"Agent"` + `"subagent_type":"claude-code-guide"` | ✅ |
| Skill activation detectable | main session: `"name":"Skill"` + `"skill":"bake-to-completion"` | ✅ |

## Implications for the architecture
- **Activation detection** (skills): a fired skill is a `tool_use` with `name:"Skill"` and a `skill`
  field → precision/recall is direct, no heuristics. (Ticket 1.3)
- **Activation detection** (subagents): a dispatch is a `tool_use` with `name:"Agent"`/`"Task"` and
  `subagent_type` → directly classifiable. (Ticket 1.3)
- **Usage/cost** (Ticket 1.5): per-message `usage` incl. cache-token breakdown → token-based cost works.
- **Subagent → transcript mapping** (risk #3): RESOLVED — agentId from the dispatch is the filename.
- **Introspection source** (Ticket 1.2): primary = subagent transcript JSONL at the path above;
  the parent transcript supplies the dispatch record + skill activations.

## Not yet run (orchestration on top of proven primitives)
- The full assembled A/B loop: treatment runner + baseline runner + judge, scored end-to-end. This is
  orchestration over the verified primitives, not a new unknown. To be exercised live in Epic 7.
- A subagent that itself invokes a skill: inferred to record `name:"Skill"` in its own transcript
  (same agent-loop JSONL format as the parent); confirm during Ticket 3.1/3.3.

## Conclusion
The native model (in-session subagents + transcript-JSONL introspection, no `claude -p`) is **feasible**.
The plan's W0 gate is satisfied for its risky primitives; proceed to W1.
