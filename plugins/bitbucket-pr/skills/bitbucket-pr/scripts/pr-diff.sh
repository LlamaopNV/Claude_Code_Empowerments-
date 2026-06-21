#!/usr/bin/env bash
# Usage: pr-diff.sh <id> [workspace] [repo]
set -euo pipefail
source "$(dirname "$0")/_lib.sh"

ID="${1:?Usage: pr-diff.sh <id> [workspace] [repo]}"
WS="${2:-}"
REPO="${3:-}"

url=$(_bb_repo_url "/pullrequests/$ID/diff" "$WS" "$REPO")
bb_get_raw "$url" || echo "(empty diff)"
