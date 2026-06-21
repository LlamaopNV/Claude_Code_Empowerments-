#!/usr/bin/env bash
# Usage: pr-update.sh <id> <json_body> [workspace] [repo]
# json_body: JSON with fields to update, e.g. '{"title":"New title","description":"Updated"}'
# Supported fields: title, description, destination (branch name string — wrapped automatically),
#                   reviewers (array of UUID strings — wrapped automatically), close_source_branch
set -euo pipefail
source "$(dirname "$0")/_lib.sh"

ID="${1:?Usage: pr-update.sh <id> '<json_body>' [workspace] [repo]}"
BODY="${2:?JSON body required}"
WS="${3:-}"
REPO="${4:-}"

# Transform shorthand fields into Bitbucket API format
payload=$(echo "$BODY" | jq '
  (if .destination then .destination = { branch: { name: .destination } } else . end)
  | (if .reviewers then .reviewers = [.reviewers[] | { uuid: . }] else . end)
')

url=$(_bb_repo_url "/pullrequests/$ID" "$WS" "$REPO")
bb_put "$url" "$payload" | jq -r '"Updated PR #\(.id): \(.title) [\(.state)]\n\(.links.html.href // "")"'
