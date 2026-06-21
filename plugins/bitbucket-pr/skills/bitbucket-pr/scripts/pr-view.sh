#!/usr/bin/env bash
# Usage: pr-view.sh <id> [workspace] [repo]
set -euo pipefail
source "$(dirname "$0")/_lib.sh"

ID="${1:?Usage: pr-view.sh <id> [workspace] [repo]}"
WS="${2:-}"
REPO="${3:-}"

url=$(_bb_repo_url "/pullrequests/$ID" "$WS" "$REPO")
bb_get "$url" | jq -r '
  "# \(.title) (#\(.id))",
  "State: \(.state)",
  "Author: \(.author.display_name // "unknown")",
  "Branch: \(.source.branch.name) → \(.destination.branch.name)",
  "Reviewers: \(([.reviewers[]?.display_name] | join(", ")) // "(none)")",
  "Created: \(.created_on)",
  "Updated: \(.updated_on)",
  "",
  (.description // "(no description)")
'
