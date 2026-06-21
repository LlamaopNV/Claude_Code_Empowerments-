#!/usr/bin/env bash
# Usage: pr-comment-delete.sh <pr_id> <comment_id> [workspace] [repo]
set -euo pipefail
source "$(dirname "$0")/_lib.sh"

PR_ID="${1:?Usage: pr-comment-delete.sh <pr_id> <comment_id> [workspace] [repo]}"
COMMENT_ID="${2:?Comment ID required}"
WS="${3:-}"
REPO="${4:-}"

url=$(_bb_repo_url "/pullrequests/$PR_ID/comments/$COMMENT_ID" "$WS" "$REPO")
bb_delete "$url"
echo "Deleted comment #$COMMENT_ID on PR #$PR_ID"
