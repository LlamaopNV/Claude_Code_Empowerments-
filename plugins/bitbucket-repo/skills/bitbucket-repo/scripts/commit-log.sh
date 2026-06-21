#!/usr/bin/env bash
# Usage: commit-log.sh [branch] [path] [limit] [workspace] [repo]
# Pass "" for branch/path to skip filtering
set -euo pipefail
source "$(dirname "$0")/_lib.sh"

BRANCH="${1:-}"
FILE_PATH="${2:-}"
LIMIT="${3:-10}"
WS="${4:-}"
REPO="${5:-}"

params="pagelen=$LIMIT"
[[ -n "$BRANCH" ]] && params="$params&include=$BRANCH"
[[ -n "$FILE_PATH" ]] && params="$params&path=$FILE_PATH"

url=$(_bb_repo_url "/commits?$params" "$WS" "$REPO")
bb_get "$url" | jq -r '.values[] | [
  (.hash // "?" | .[0:8]),
  (.author.user.display_name // .author.raw // "unknown"),
  (.date // ""),
  ((.message // "") | split("\n")[0])
] | @tsv' || echo "(no commits)"
