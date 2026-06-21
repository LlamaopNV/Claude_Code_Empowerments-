#!/usr/bin/env bash
# Usage: pipeline-list.sh [page] [pagelen] [workspace] [repo]
set -euo pipefail
source "$(dirname "$0")/_lib.sh"

PAGE="${1:-1}"
PAGELEN="${2:-10}"
WS="${3:-}"
REPO="${4:-}"

url=$(_bb_repo_url "/pipelines?sort=-created_on&page=$PAGE&pagelen=$PAGELEN" "$WS" "$REPO")
bb_get "$url" | jq -r '.values[] | [
  "#\(.build_number)",
  .uuid,
  (.state.name // "UNKNOWN"),
  (.target.ref_name // .target.source // "?"),
  (.trigger.name // "?"),
  (.created_on // "")
] | @tsv' || echo "(no pipelines)"
