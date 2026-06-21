#!/usr/bin/env bash
# Usage: jira-create-issue.sh <json_body>
# json_body: {"fields":{"summary":"...", ...}}
# Auto-injects the project key (JIRA_PROJECT) and defaults issuetype to Story if not set
# Output: KEY — browse_url
set -euo pipefail
source "$(dirname "$0")/_lib.sh"

BODY="${1:?Usage: jira-create-issue.sh '<json_body>'}"

payload=$(echo "$BODY" | jq --arg proj "$_JIRA_PROJECT" '
  .fields.project //= { key: $proj }
  | .fields.issuetype //= { name: "Story" }
')

result=$(jira_post "$_JIRA_REST/issue" "$payload")
key=$(echo "$result" | jq -r '.key')
echo "$key — $_JIRA_BROWSE/$key"
