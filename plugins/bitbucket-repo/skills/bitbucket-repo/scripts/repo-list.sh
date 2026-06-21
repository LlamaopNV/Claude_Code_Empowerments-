#!/usr/bin/env bash
# Usage: repo-list.sh [workspace] [filter] [pagelen]
set -euo pipefail
source "$(dirname "$0")/_lib.sh"

WS="${1:-}"
FILTER="${2:-}"
PAGELEN="${3:-25}"

params="pagelen=$PAGELEN"
[[ -n "$FILTER" ]] && params="$params&q=name+~+%22$FILTER%22"

url=$(_bb_ws_url "?$params" "$WS")
bb_get "$url" | jq -r '.values[] | [.slug, (.description // "(no description)"), (.updated_on // "")] | @tsv' || echo "(no repositories)"
