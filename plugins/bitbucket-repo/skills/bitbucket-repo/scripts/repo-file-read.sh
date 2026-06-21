#!/usr/bin/env bash
# Usage: repo-file-read.sh <ref> <path> [workspace] [repo]
# ref: branch name, tag, or commit hash
set -euo pipefail
source "$(dirname "$0")/_lib.sh"

REF="${1:?Usage: repo-file-read.sh <ref> <path> [workspace] [repo]}"
FILE_PATH="${2:?File path required}"
WS="${3:-}"
REPO="${4:-}"

# URL-encode the ref (slashes in branch names like feature/QR-52)
ENCODED_REF=$(python3 -c "import urllib.parse; print(urllib.parse.quote('$REF', safe=''))")

url=$(_bb_repo_url "/src/$ENCODED_REF/$FILE_PATH" "$WS" "$REPO")
bb_get_raw "$url" || echo "(empty file)"
