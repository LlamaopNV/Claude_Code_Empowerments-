#!/usr/bin/env bash
# Usage: pipeline-steps.sh <pipeline_uuid> [workspace] [repo]
set -euo pipefail
source "$(dirname "$0")/_lib.sh"

UUID="${1:?Usage: pipeline-steps.sh <pipeline_uuid> [workspace] [repo]}"
WS="${2:-}"
REPO="${3:-}"

url=$(_bb_repo_url "/pipelines/$UUID/steps" "$WS" "$REPO")
bb_get "$url" | jq -r '.values[] | [
  .uuid,
  (.state.name // "UNKNOWN"),
  (.image.name // "?"),
  (.started_on // ""),
  (.completed_on // "(running)")
] | @tsv' || echo "(no steps)"
