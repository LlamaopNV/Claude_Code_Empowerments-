#!/usr/bin/env bash
# Usage: branch-list.sh [filter] [page] [pagelen] [workspace] [repo]
set -euo pipefail
source "$(dirname "$0")/_lib.sh"

FILTER="${1:-}"
PAGE="${2:-1}"
PAGELEN="${3:-25}"
WS="${4:-}"
REPO="${5:-}"

params="page=$PAGE&pagelen=$PAGELEN"
[[ -n "$FILTER" ]] && params="$params&q=name+~+%22$FILTER%22"

url=$(_bb_repo_url "/refs/branches?$params" "$WS" "$REPO")
bb_get "$url" | jq -r '.values[] | [.name, (.target.hash // "?" | .[0:8]), (.target.date // "")] | @tsv' || echo "(no branches)"
