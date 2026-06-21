#!/usr/bin/env bash
# Usage: pr-list.sh [state] [page] [workspace] [repo]
# state: OPEN (default), MERGED, DECLINED, SUPERSEDED
set -euo pipefail
source "$(dirname "$0")/_lib.sh"

STATE="${1:-OPEN}"
PAGE="${2:-1}"
WS="${3:-}"
REPO="${4:-}"

params="state=$STATE&page=$PAGE"
url=$(_bb_repo_url "/pullrequests?$params" "$WS" "$REPO")
bb_get "$url" | jq -r '.values[] | ["#\(.id)", .state, .title, "\(.source.branch.name) → \(.destination.branch.name)", (.author.display_name // "unknown")] | @tsv' || echo "(no pull requests)"
