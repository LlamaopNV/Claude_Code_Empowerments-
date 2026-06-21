#!/usr/bin/env bash
# Usage: jira-list-epics.sh
# Lists all epics in the configured project (JIRA_PROJECT)
# Output: TSV — key, summary, status
set -euo pipefail
source "$(dirname "$0")/_lib.sh"

JQL="project = $_JIRA_PROJECT AND issuetype = Epic ORDER BY key ASC"
ENCODED=$(_jira_encode "$JQL")

jira_get "$_JIRA_REST/search/jql?jql=$ENCODED&fields=summary,status&maxResults=50" \
  | jq -r '.issues[] | [.key, .fields.summary, .fields.status.name] | @tsv' || echo "(no epics)"
