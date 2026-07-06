# model-bench — NVIDIA Build model benchmark harness

Implements `nvidia-build-model-benchmark-spec.md` (Phase 0 + Phase 1 + reporting;
Phases 2–3 land in follow-up plans). Zero npm dependencies; grading runs in
network-disabled Docker containers.

## Prereqs

- `NVIDIA_API_KEY` in the environment (`/nim-setup` in Claude Code).
- Docker running. Build the grading images once (all base images digest-pinned):

      cd bench/model-bench/docker
      docker build -t model-bench-python:3.14 -f python.Dockerfile .
      docker build -t model-bench-node:24 -f node.Dockerfile .
      for f in go rust sqlite ts polyglot; do docker build -t "model-bench-$f" -f "$f.Dockerfile" .; done

## Usage (from repo root)

- Phase 0 (probe, writes `configs/<slug>.json`):
  `node bench/model-bench/src/run.mjs --phase 0 --models deepseek-ai/deepseek-v4-flash,z-ai/glm-5.2`
- Phase 1 (baseline, n=5 per task):
  `node bench/model-bench/src/run.mjs --phase 1 --models <ids>`
- Report: `node bench/model-bench/src/run.mjs --phase report`
- Dry run (whole pipeline, one cheap model, n=1):
  `node bench/model-bench/src/run.mjs --dry-run`
- Restrict phase 1 to specific tasks:
  `node bench/model-bench/src/run.mjs --phase 1 --models <ids> --tasks 02-rate-limiter,06-event-emitter`
- Validate every task's reference solution in Docker (run before trusting any scores):
  `node bench/model-bench/src/validate-tasks.mjs [--tasks <ids>]`

Raw request/response logs: `results/raw/<phase>/<model-slug>/<task>/<run>.json`.
Human review step: eyeball each generated `configs/*.json` and 5 random
extractions per model (`decision` field in the raw logs) before trusting scores.

## Tests

`node --test bench/model-bench/src/*.test.mjs` (explicit paths; directory args
are broken with `node --test` here).
