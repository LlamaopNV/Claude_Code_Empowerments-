#!/usr/bin/env bash
# Usage: jira-move-to-sprint.sh <sprint_id> <issue_key> [issue_key...]
set -euo pipefail
source "$(dirname "$0")/_lib.sh"

SPRINT_ID="${1:?Usage: jira-move-to-sprint.sh <sprint_id> <issue_key> [issue_key...]}"
shift
KEYS=("$@")
[[ ${#KEYS[@]} -eq 0 ]] && { echo "Error: at least one issue key required" >&2; exit 1; }

issues_json=$(printf '%s\n' "${KEYS[@]}" | jq -R . | jq -s '.')

jira_post "$_JIRA_AGILE/sprint/$SPRINT_ID/issue" "{\"issues\":$issues_json}"
echo "Moved ${KEYS[*]} → sprint $SPRINT_ID"
