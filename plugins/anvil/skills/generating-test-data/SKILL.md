---
name: generating-test-data
description: Generate a balanced Anvil eval suite for a Claude Code artifact — read the artifact's files, synthesize should-fire / should-not-fire near-miss / task cases via the testdata-generator subagent, validate and coverage-check the suite, then save it for review. Use when the user asks to generate/create test data or an eval suite for a skill, subagent, or plugin, or invokes /anvil-gen-testdata.
---

# Generating Anvil Test Data

Produce a balanced, adversarial eval suite for a target artifact and save it so the user can review/edit it (in the UI or the YAML) before running an eval. A trustworthy scorecard depends on a trustworthy suite — so this skill does not just generate; it validates and runs a coverage/balance check, and surfaces weaknesses for human fix-up.

## Reasoning mandate (Fable-5)

Reason like you are running Fable 5. Work from first principles. Read the artifact's ACTUAL trigger/process text — never guess the suite from the name. After generation, adversarially inspect the suite: are the should-not-fire cases genuine near-misses or strawmen? are the buckets balanced? does every judged case have a rubric? Verify the suite validates and passes the coverage check before claiming it's ready; if the coverage check flags errors, surface them and offer to regenerate rather than shipping a weak suite. Evidence over assertion.

## Tools you use (Anvil MCP server + core)

- `anvil_validate_suite {yaml}` → `{valid, suite?|error}` — validate the generated YAML.
- `anvil_save_suite {yaml, fileName?}` → `{saved, path, name}` — persist it to the evals dir.
- The core `checkSuiteCoverage(suite)` advisory (bucket balance, near-miss presence, rubric completeness) — run it on the validated suite. (Available via the server when wired, or reason it manually using its rules.)

## Flow

1. **Locate the artifact** the user named (a skill/subagent/plugin). Resolve its files (SKILL.md, agent .md, or plugin manifest) and read them.
2. **Pick the suite metadata** — `judgeModel`, `runModel`, `repetitions` (use sensible defaults / the user's wishes), and the `ArtifactRef` (`kind`, `name`, `path`).
3. **Dispatch `anvil-testdata-generator`** (`Task` tool) with the artifact's files + the metadata + a target of ~3–4 cases per bucket. It returns a coverage rationale + a ```yaml suite block.
4. **Extract the YAML** from the generator's final fenced block.
5. **Validate** with `anvil_validate_suite`. If invalid, show the error and re-dispatch the generator with the error so it fixes the YAML — loop until valid (cap at a couple attempts, then report).
6. **Coverage/balance check** — run `checkSuiteCoverage` on the validated suite. Surface `errors` (untrustworthy as-is — e.g. no should-not-fire bucket, an unfalsifiable judged case) and `warnings` (imbalance, missing rubric). If there are ERRORS, do NOT silently save — tell the user and offer to regenerate addressing them.
7. **Save** with `anvil_save_suite` (filename defaults to a slug of the suite name). Report the saved path + name + the coverage summary, and tell the user they can review/edit it in the UI before running `/anvil-eval`.

## What "balanced" means (the bar the check enforces)

- BOTH `should-fire` AND `should-not-fire` buckets present (recall AND precision).
- No severe bucket imbalance (avoid ≥5:1).
- Every `should-fire`/`task` case has a rubric the judge can anchor on.
- No judged case that is unfalsifiable (no rubric AND no expectations).

## Red flags — STOP

| Thought | Reality |
|---|---|
| "Save it as soon as it validates" | Validation ≠ good test data. Run the coverage check; surface errors first. |
| "The generator skipped should-not-fire, that's fine" | A suite with no near-misses can't measure precision. Regenerate. |
| "I'll guess the trigger to save a read" | Read the artifact's text. The whole suite hinges on the real trigger. |
| "Warnings can be ignored" | Warnings are how a weak suite gets fixed before it misleads a scorecard. Show them. |
