#!/usr/bin/env bash
# Usage: pr-approve.sh <id> [workspace] [repo]
set -euo pipefail
source "$(dirname "$0")/_lib.sh"

ID="${1:?Usage: pr-approve.sh <id> [workspace] [repo]}"
WS="${2:-}"
REPO="${3:-}"

url=$(_bb_repo_url "/pullrequests/$ID/approve" "$WS" "$REPO")
bb_post "$url"
echo "Approved PR #$ID"
