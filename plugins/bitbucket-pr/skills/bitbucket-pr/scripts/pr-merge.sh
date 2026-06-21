#!/usr/bin/env bash
# Usage: pr-merge.sh <id> [strategy] [message] [close_source_branch] [workspace] [repo]
# strategy: merge_commit (default), squash, fast_forward
# close_source_branch: true (default) or false
set -euo pipefail
source "$(dirname "$0")/_lib.sh"

ID="${1:?Usage: pr-merge.sh <id> [strategy] [message] [close_source] [workspace] [repo]}"
STRATEGY="${2:-merge_commit}"
MESSAGE="${3:-}"
CLOSE="${4:-true}"
WS="${5:-}"
REPO="${6:-}"

body=$(jq -n \
  --arg type "$STRATEGY" \
  --arg msg "$MESSAGE" \
  --argjson close "$CLOSE" \
  '{ type: $type, close_source_branch: $close }
   + (if $msg != "" then { message: $msg } else {} end)')

url=$(_bb_repo_url "/pullrequests/$ID/merge" "$WS" "$REPO")
bb_post "$url" "$body" | jq -r '"Merged PR #\(.id // "?") (\(.state // "?"))"'
