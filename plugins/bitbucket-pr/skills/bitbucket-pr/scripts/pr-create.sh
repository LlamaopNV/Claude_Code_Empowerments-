#!/usr/bin/env bash
# Usage: pr-create.sh <title> <source_branch> [dest_branch] [description] [reviewers_csv] [close_source_branch] [workspace] [repo]
# reviewers_csv: comma-separated UUIDs e.g. "{uuid1},{uuid2}"
# close_source_branch: true (default) or false
set -euo pipefail
source "$(dirname "$0")/_lib.sh"

TITLE="${1:?Usage: pr-create.sh <title> <source_branch> [dest_branch] [description] [reviewers_csv] [close_source] [workspace] [repo]}"
SOURCE="${2:?Source branch required}"
DEST="${3:-}"
DESC="${4:-}"
REVIEWERS="${5:-}"
CLOSE="${6:-true}"
WS="${7:-}"
REPO="${8:-}"

body=$(jq -n \
  --arg title "$TITLE" \
  --arg source "$SOURCE" \
  --arg dest "$DEST" \
  --arg desc "$DESC" \
  --arg reviewers "$REVIEWERS" \
  --argjson close "$CLOSE" \
  '{
    title: $title,
    source: { branch: { name: $source } },
    close_source_branch: $close
  }
  + (if $dest != "" then { destination: { branch: { name: $dest } } } else {} end)
  + (if $desc != "" then { description: $desc } else {} end)
  + (if $reviewers != "" then { reviewers: [$reviewers | split(",")[] | { uuid: . }] } else {} end)
  ')

url=$(_bb_repo_url "/pullrequests" "$WS" "$REPO")
bb_post "$url" "$body" | jq -r '"Created PR #\(.id): \(.title)\n\(.links.html.href // "")"'
