#!/usr/bin/env bash
# Usage: jira-update-issue.sh <key> <json_body>
# json_body: {"fields":{"description":<ADF>, "summary":"...", ...}}
set -euo pipefail
source "$(dirname "$0")/_lib.sh"

KEY="${1:?Usage: jira-update-issue.sh <key> '<json_body>'}"
BODY="${2:?JSON body required}"

jira_put "$_JIRA_REST/issue/$KEY" "$BODY"
echo "Updated $KEY — $_JIRA_BROWSE/$KEY"
