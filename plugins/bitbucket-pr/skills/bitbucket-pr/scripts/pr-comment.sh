#!/usr/bin/env bash
# Usage: pr-comment.sh <id> <body> [file_path] [line] [workspace] [repo]
# Omit file_path and line for a general comment. Provide both for an inline comment.
set -euo pipefail
source "$(dirname "$0")/_lib.sh"

ID="${1:?Usage: pr-comment.sh <id> <body> [file_path] [line] [workspace] [repo]}"
COMMENT_BODY="${2:?Comment body required}"
FILE_PATH="${3:-}"
LINE="${4:-}"
WS="${5:-}"
REPO="${6:-}"

payload=$(jq -n --arg body "$COMMENT_BODY" --arg path "$FILE_PATH" --arg line "$LINE" '
  { content: { raw: $body } }
  + (if $path != "" then { inline: ({ path: $path } + (if $line != "" then { to: ($line | tonumber) } else {} end)) } else {} end)
')

url=$(_bb_repo_url "/pullrequests/$ID/comments" "$WS" "$REPO")
result=$(bb_post "$url" "$payload")
cid=$(echo "$result" | jq -r '.id')

if [[ -n "$FILE_PATH" ]]; then
  echo "Comment #$cid added on $FILE_PATH:$LINE"
else
  echo "Comment #$cid added"
fi
