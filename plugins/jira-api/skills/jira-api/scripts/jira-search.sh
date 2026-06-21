#!/usr/bin/env bash
# Usage: jira-search.sh <jql> [fields] [max_results]
# fields default: summary,status,assignee,issuetype,priority,parent
# Output: TSV — key, summary, status, assignee, priority, issuetype
set -euo pipefail
source "$(dirname "$0")/_lib.sh"

JQL="${1:?Usage: jira-search.sh <jql> [fields] [max_results]}"
FIELDS="${2:-summary,status,assignee,issuetype,priority,parent}"
MAX="${3:-50}"

ENCODED=$(_jira_encode "$JQL")

jira_get "$_JIRA_REST/search/jql?jql=$ENCODED&fields=$FIELDS&maxResults=$MAX" \
  | jq -r '.issues[] | [
    .key,
    .fields.summary,
    .fields.status.name,
    (.fields.assignee.displayName // "unassigned"),
    (.fields.priority.name // "?"),
    (.fields.issuetype.name // "?")
  ] | @tsv' || echo "(no results)"
