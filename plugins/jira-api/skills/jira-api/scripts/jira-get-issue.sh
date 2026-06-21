#!/usr/bin/env bash
# Usage: jira-get-issue.sh <key> [fields]
# Returns raw JSON (pipe through jq for specific fields)
# Default fields: summary,description,status,assignee,issuetype,priority,comment,issuelinks,parent
set -euo pipefail
source "$(dirname "$0")/_lib.sh"

KEY="${1:?Usage: jira-get-issue.sh <key> [fields]}"
FIELDS="${2:-summary,description,status,assignee,issuetype,priority,comment,issuelinks,parent}"

jira_get "$_JIRA_REST/issue/$KEY?fields=$FIELDS"
