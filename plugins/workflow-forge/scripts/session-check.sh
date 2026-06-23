#!/usr/bin/env bash
# SessionStart hook. Non-blocking. If the repo has no CLAUDE.md, surface a
# one-line suggestion to bootstrap. Stays silent once a CLAUDE.md exists.
set -u
root="${CLAUDE_PROJECT_DIR:-$(pwd)}"
[ -f "$root/CLAUDE.md" ] && exit 0
echo "[workflow-forge] No CLAUDE.md in this repo. Run /workflow-forge:bootstrap to generate one tailored to this project and wire in the workflow." >&2
exit 0
