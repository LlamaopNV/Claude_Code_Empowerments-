# Generating test data

Synthesize a balanced, adversarial eval suite for a Claude Code artifact, then review and edit it before you trust any scorecard.

A trustworthy scorecard depends on a trustworthy suite. Anvil's generator does not just emit cases — it reads the artifact's real trigger text, balances the suite across buckets, validates it against the schema, and runs a deterministic coverage check that flags weak suites. This page covers running the generator and reviewing the result. New here? Start with [getting-started.md](getting-started.md).

## Run the generator

Pick an artifact (a skill, subagent, or plugin) and run:

```text
/anvil-gen-testdata <artifact>
```

For example, against the bundled example skill:

```text
/anvil-gen-testdata bake-to-completion
```

Behind the command, the **`generating-test-data`** skill and the **`anvil-testdata-generator`** subagent:

1. Locate the artifact and **read its actual files** (`SKILL.md`, agent `.md`, or plugin manifest) — the cases reflect the real trigger, not a guess from the name.
2. Synthesize a **balanced** suite across three buckets (see below).
3. Validate the YAML against `@anvil/core`'s `EvalSuiteSchema` (`anvil_validate_suite`).
4. Run the deterministic **coverage/balance check** (core `checkSuiteCoverage`).
5. Save the suite under `evals/` (`anvil_save_suite`) and report the path plus the coverage summary.

Optional flags: `--reps N` stamps the suite's repetitions; `--judge-model M` / `--run-model M` override the model ids.

## The three buckets

A balanced suite mixes three kinds of case so the eval can measure both *whether the artifact fires correctly* and *whether its output is good*:

| Bucket | `shouldActivate` | Measures |
|---|---|---|
| `should-fire` | `true` | **Recall** — the artifact triggers when it should. |
| `should-not-fire` | `false` | **Trigger precision** — near-misses that look adjacent but should *not* trigger the artifact. |
| `task` | `true` | **Quality** — output is scored against a rubric (and optional expectations). |

The generator targets roughly 3–4 cases per bucket. The deterministic check enforces the bar:

- BOTH `should-fire` AND `should-not-fire` buckets present.
- No severe bucket imbalance (it flags ratios around 5:1 or worse).
- Every `should-fire` / `task` case has a rubric the judge can anchor on.
- No judged case that is unfalsifiable (no rubric *and* no expectations).

The check returns **errors** (the suite is untrustworthy as-is — e.g. a missing `should-not-fire` bucket) and **warnings** (imbalance, a missing rubric). If there are errors, the skill will not silently save — it surfaces them and offers to regenerate.

## The suite YAML shape

Suites are YAML saved under `evals/`. The bundled `evals/bake-to-completion.skill.yaml` is the reference example. The shape, validated by `EvalSuiteSchema`:

```yaml
schemaVersion: 1
name: bake-to-completion effectiveness
artifact:
  kind: skill            # skill | subagent | plugin
  name: bake-to-completion
  path: plugins/anvil/skills/bake-to-completion
judgeModel: claude-opus-4-20250514
runModel: claude-sonnet-4-20250514
repetitions: 5
cases:
  - id: sf-vague-app-idea
    bucket: should-fire
    shouldActivate: true
    prompt: >-
      I have a rough idea for an app ... can you interview me about it
      and help me sharpen it before we design anything?
    rubric: >-
      A strong response runs a structured idea-interview: probes the
      target user, the core problem, differentiation, and feasibility.

  - id: snf-implement-known-feature
    bucket: should-not-fire
    shouldActivate: false
    prompt: >-
      Add a dark-mode toggle to the settings page of my React app and
      persist the choice in localStorage.
    expectations:
      - type: not-contains
        value: interview me about your idea

  - id: task-sharpen-and-summarize
    bucket: task
    shouldActivate: true
    prompt: >-
      Here is my fuzzy idea ... sharpen it and give me a one-paragraph
      pitch plus the single biggest risk.
    rubric: >-
      Output contains a crisp one-paragraph pitch and names a single,
      specific biggest risk with a rationale.
    expectations:
      - type: regex
        pattern: 'risk'
        flags: 'i'
      - type: contains
        value: pitch
        caseSensitive: false
```

Field notes:

- `bucket` and `shouldActivate` must be consistent — a `should-fire` case must have `shouldActivate: true`, a `should-not-fire` case `false`. The schema rejects mismatches.
- `rubric` is the optional text the **LLM judge** anchors on for quality scoring. Give every `should-fire` / `task` case one.
- `expectations` are optional **deterministic** checks against the output — `contains`, `not-contains`, `regex` (`file-*` checks only apply when a sandbox path is used). They run independently of the judge.

## Review and edit before running

> A weak or unbalanced suite biases every metric. Review the suite before trusting any scorecard.

Open the saved YAML under `evals/` (or the dashboard's test-data panel) and sanity-check it:

- Are the `should-not-fire` cases **genuine near-misses** — plausibly adjacent to the trigger — rather than obvious strawmen?
- Are the buckets reasonably balanced?
- Does every judged case have a rubric a judge can actually score against?
- Do the prompts read like real user requests?

Edit anything that looks off, then move on to running the eval.

## Next

- **[running-an-eval.md](running-an-eval.md)** — run the eval against this suite and read the scorecard.
- **[running-live.md](running-live.md)** — the full live walkthrough, including reviewing the suite in the dashboard.

Related: [metrics-reference.md](metrics-reference.md) · [architecture.md](architecture.md) · [improvement-loop.md](improvement-loop.md)
