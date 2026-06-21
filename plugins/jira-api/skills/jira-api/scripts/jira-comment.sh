#!/usr/bin/env bash
# Usage: jira-comment.sh <key> <text>
# Auto-wraps plain text in ADF paragraph format
set -euo pipefail
source "$(dirname "$0")/_lib.sh"

KEY="${1:?Usage: jira-comment.sh <key> <text>}"
TEXT="${2:?Comment text required}"

body=$(jq -n --arg text "$TEXT" '{
  body: {
    type: "doc",
    version: 1,
    content: [{
      type: "paragraph",
      content: [{ type: "text", text: $text }]
    }]
  }
}')

jira_post "$_JIRA_REST/issue/$KEY/comment" "$body" | jq -r '"Comment added (id: \(.id))"'
