#!/usr/bin/env bash
# Usage: pipeline-trigger.sh <branch> [custom_pipeline] [variables_json] [workspace] [repo]
# variables_json: JSON array e.g. '[{"key":"FOO","value":"bar","secured":false}]'
set -euo pipefail
source "$(dirname "$0")/_lib.sh"

BRANCH="${1:?Usage: pipeline-trigger.sh <branch> [custom_pipeline] [variables_json] [workspace] [repo]}"
CUSTOM="${2:-}"
VARS="${3:-}"
WS="${4:-}"
REPO="${5:-}"

body=$(jq -n \
  --arg branch "$BRANCH" \
  --arg custom "$CUSTOM" \
  --argjson vars "${VARS:-null}" \
  '{
    target: ({
      ref_type: "branch",
      type: "pipeline_ref_target",
      ref_name: $branch
    }
    + (if $custom != "" then { selector: { type: "custom", pattern: $custom } } else {} end))
  }
  + (if $vars then { variables: $vars } else {} end)')

url=$(_bb_repo_url "/pipelines" "$WS" "$REPO")
bb_post "$url" "$body" | jq -r '"Triggered pipeline #\(.build_number) (\(.state.name // "PENDING"))\nUUID: \(.uuid)"'
