# Orchestrator fixtures (Ticket 1.4)

These JSON bundles let `MockOrchestrator` (from `@anvil/core`) replay recorded
runner + judge outputs so downstream tests (server, orchestration) run with
**zero real subagent dispatches** — no subscription quota burned.

## Bundle shape

```jsonc
{
  "runners": [
    { "caseId": "<id>", "role": "treatment" | "baseline", "rep": 0,   // rep optional
      "finalText": "...", "trace": { /* a normalized RunTrace (RunTraceSchema) */ } }
  ],
  "judges": [
    { "caseId": "<id>", "swapped": false, "rep": 0,                    // rep optional
      "verdict": "treatment" | "baseline" | "tie", "rationale": "..." }
  ]
}
```

Lookup is by `(caseId, role[, rep])` for runners and `(caseId, swapped[, rep])`
for judges. A record with `rep` omitted serves **all** reps (rep-agnostic
fallback); add per-rep records only when you want reps to differ.

`trace` is a **normalized `RunTrace`**, not raw transcript JSONL. Validate it
with `RunTraceSchema` / `parseRunTrace` if you hand-edit it.

## Loading

```ts
import { readFileSync } from 'node:fs';
import { MockOrchestrator, loadOrchestratorFixture } from '@anvil/core';

const bundle = loadOrchestratorFixture(
  JSON.parse(readFileSync('fixtures/orchestrator/bake-to-completion.fixture.json', 'utf8')),
);
const orch = new MockOrchestrator(bundle);
const { finalText, trace } = await orch.dispatchRunner({ caseId: 'sf-vague-app-idea', role: 'treatment' });
```

## Refresh procedure (capturing a real run → fixture)

Fixtures are **synthetic** in this repo (privacy: never copy a user's real
`~/.claude` transcripts). To refresh from a real in-session run during a live
eval (Epic 7), the recording flow is:

1. Run an eval live with the real orchestrator (the `running-an-eval` skill,
   Epic 3). It dispatches treatment/baseline runners and swapped judges per case.
2. For each dispatch, the server's `anvil_introspect_transcript` (Ticket 2.2,
   wrapping `readTranscriptById` from this package) reads the subagent transcript
   JSONL and returns a normalized `RunTrace`.
3. Append one `runners[]` record per (caseId, role) with the returned
   `{ finalText, trace }`, and one `judges[]` record per (caseId, swapped) with
   the judge subagent's `{ verdict, rationale }`.
4. Write the bundle to `fixtures/orchestrator/<suite>.fixture.json` and validate:
   every embedded `trace` must pass `RunTraceSchema`.

The recording itself happens in the server/orchestration layer (Epics 2–3);
this package supplies the **replay** half (`MockOrchestrator`) and the parser
(`readTranscriptById`) those use. Keep bundles small and representative.
