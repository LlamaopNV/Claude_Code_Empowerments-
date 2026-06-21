#!/usr/bin/env bash
# Usage: jira-transition.sh <key> <transition_name>
# Smart: fetches available transitions, matches by name (case-insensitive), executes
# Replaces the two-step "get transitions → find ID → execute" pattern
set -euo pipefail
source "$(dirname "$0")/_lib.sh"

KEY="${1:?Usage: jira-transition.sh <key> <transition_name>}"
TARGET="${2:?Transition name required (e.g. 'In Progress', 'Done')}"

transitions=$(jira_get "$_JIRA_REST/issue/$KEY/transitions")

tid=$(echo "$transitions" | jq -r --arg name "$TARGET" \
  '.transitions[] | select(.name | ascii_downcase == ($name | ascii_downcase)) | .id')

if [[ -z "$tid" ]]; then
  echo "Error: no transition '$TARGET' found for $KEY. Available:" >&2
  echo "$transitions" | jq -r '.transitions[] | "  \(.id)\t\(.name)"' >&2
  exit 1
fi

jira_post "$_JIRA_REST/issue/$KEY/transitions" "{\"transition\":{\"id\":\"$tid\"}}"
echo "Transitioned $KEY → $TARGET"
