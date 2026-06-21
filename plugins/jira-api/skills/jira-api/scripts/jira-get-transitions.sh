#!/usr/bin/env bash
# Usage: jira-get-transitions.sh <key>
# Output: TSV — id, name
set -euo pipefail
source "$(dirname "$0")/_lib.sh"

KEY="${1:?Usage: jira-get-transitions.sh <key>}"

jira_get "$_JIRA_REST/issue/$KEY/transitions" \
  | jq -r '.transitions[] | [.id, .name] | @tsv'
