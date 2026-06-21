#!/usr/bin/env bash
# Usage: pipeline-stop.sh <pipeline_uuid> [workspace] [repo]
set -euo pipefail
source "$(dirname "$0")/_lib.sh"

UUID="${1:?Usage: pipeline-stop.sh <pipeline_uuid> [workspace] [repo]}"
WS="${2:-}"
REPO="${3:-}"

url=$(_bb_repo_url "/pipelines/$UUID/stopPipeline" "$WS" "$REPO")
bb_post "$url"
echo "Stopped pipeline $UUID"
