#!/usr/bin/env bash
# Usage: pipeline-log.sh <pipeline_uuid> <step_uuid> [workspace] [repo]
set -euo pipefail
source "$(dirname "$0")/_lib.sh"

PIPE_UUID="${1:?Usage: pipeline-log.sh <pipeline_uuid> <step_uuid> [workspace] [repo]}"
STEP_UUID="${2:?Step UUID required}"
WS="${3:-}"
REPO="${4:-}"

url=$(_bb_repo_url "/pipelines/$PIPE_UUID/steps/$STEP_UUID/log" "$WS" "$REPO")
bb_get_raw "$url" || echo "(empty log)"
