#!/usr/bin/env bash
# Stop hook. Non-blocking. If tracking files are enabled and WORKLOG.md was not
# modified in roughly this session, nudge to log the work.
# Reads maintain_tracking_files from the CLAUDE_PLUGIN_OPTION_* env var that
# Claude Code exports for each userConfig value. Defaults to "true" when unset
# so the hook never errors before the plugin option has been configured.
set -u

maintain="${CLAUDE_PLUGIN_OPTION_MAINTAIN_TRACKING_FILES:-true}"
[ "$maintain" = "true" ] || exit 0
root="${CLAUDE_PROJECT_DIR:-$(pwd)}"
log="$root/WORKLOG.md"

[ -f "$log" ] || { echo "[worklog] No WORKLOG.md yet. Run /workflow-forge:bootstrap to create the tracking files." >&2; exit 0; }

# Modified in the last 30 minutes? Treat as up to date.
if [ -n "$(find "$log" -mmin -30 2>/dev/null)" ]; then exit 0; fi
echo "[worklog] WORKLOG.md has not been updated recently. Append a line for the work just done before moving on." >&2
exit 0
