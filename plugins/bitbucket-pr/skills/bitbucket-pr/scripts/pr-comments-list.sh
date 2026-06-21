#!/usr/bin/env bash
# Usage: pr-comments-list.sh <id> [page] [pagelen] [workspace] [repo]
set -euo pipefail
source "$(dirname "$0")/_lib.sh"

ID="${1:?Usage: pr-comments-list.sh <id> [page] [pagelen] [workspace] [repo]}"
PAGE="${2:-1}"
PAGELEN="${3:-25}"
WS="${4:-}"
REPO="${5:-}"

url=$(_bb_repo_url "/pullrequests/$ID/comments?page=$PAGE&pagelen=$PAGELEN" "$WS" "$REPO")
bb_get "$url" | jq -r '.values[] | [
  "#\(.id)",
  (.user.display_name // "unknown"),
  (.created_on // ""),
  (if .inline then "[\(.inline.path):\(.inline.to // .inline.from // "?")]" else "" end),
  ((.content.raw // "") | .[0:200])
] | @tsv' || echo "(no comments)"
