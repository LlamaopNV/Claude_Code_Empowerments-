#!/usr/bin/env bash
# Usage: jira-active-sprint.sh
# Returns active sprint for the configured board (JIRA_BOARD): ID, name, start/end dates
set -euo pipefail
source "$(dirname "$0")/_lib.sh"

jira_get "$_JIRA_AGILE/board/$_JIRA_BOARD/sprint?state=active" \
  | jq -r '.values[] | "ID: \(.id)\nName: \(.name)\nStart: \(.startDate)\nEnd: \(.endDate)"'
