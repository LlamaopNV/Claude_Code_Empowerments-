#!/usr/bin/env bash
# Usage: pipeline-status.sh <pipeline_uuid> [workspace] [repo]
# pipeline_uuid includes curly braces, e.g. {uuid}
set -euo pipefail
source "$(dirname "$0")/_lib.sh"

UUID="${1:?Usage: pipeline-status.sh <pipeline_uuid> [workspace] [repo]}"
WS="${2:-}"
REPO="${3:-}"

url=$(_bb_repo_url "/pipelines/$UUID" "$WS" "$REPO")
bb_get "$url" | jq -r '
  "Pipeline #\(.build_number)",
  "State: \(.state.name // "UNKNOWN")",
  "Branch: \(.target.ref_name // "?")",
  "Trigger: \(.trigger.name // "?")",
  "Creator: \(.creator.display_name // "unknown")",
  "Created: \(.created_on // "")",
  "Completed: \(.completed_on // "(running)")",
  "Duration: \(.build_seconds_used // 0)s"
'
