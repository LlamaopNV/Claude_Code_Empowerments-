#!/usr/bin/env bash
# PreToolUse(Write|Edit) hook. Reads the event JSON on stdin. Fires ONLY when
# the edit targets a forgemaster run manifest (forgemaster-runs/**/run.json)
# and the new content flips the run status to "done". In that case every
# quality gate in the manifest must already read "pass" (or "na"), otherwise
# the write is blocked (exit 2). For any other file or edit, exit 0 silently,
# so the hook costs nothing in sessions with no active forgemaster run.
set -u

payload="$(cat 2>/dev/null || true)"
[ -n "$payload" ] || exit 0

# Only care about run manifests. Tolerant match, no jq dependency; the path in
# the payload may use / or escaped \\ separators.
echo "$payload" | grep -qE 'forgemaster-runs[/\\]+[^"]*run\.json' || exit 0

# Only care when the incoming content declares the run done.
echo "$payload" | grep -qE '\\?"status\\?"[[:space:]]*:[[:space:]]*\\?"done\\?"' || exit 0

# The content being written (Write's "content" or Edit's "new_string") is JSON-
# escaped inside the payload, so gate lines look like \"tests\": \"pass\".
# An Edit may carry only the status line; then fall back to the on-disk file,
# whose gates must already be green before the flip is legal anyway.
file_path="$(echo "$payload" | sed -n 's/.*"file_path"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -1)"

gate_source="$payload"
required="tests lint types spec_review code_review self_critique"

has_gate() { # $1=source $2=gate — true if gate reads pass or na
  echo "$1" | grep -qE "\\\\?\"$2\\\\?\"[[:space:]]*:[[:space:]]*\\\\?\"(pass|na)\\\\?\""
}
gate_present() { # $1=source $2=gate — true if the gate key appears at all
  echo "$1" | grep -qE "\\\\?\"$2\\\\?\"[[:space:]]*:"
}

missing=""
for gate in $required; do
  if ! has_gate "$gate_source" "$gate"; then
    # A gate stated in the incoming content with a non-pass value blocks
    # outright. Only a gate ABSENT from the content (an Edit with a narrow
    # new_string) may fall back to the current on-disk manifest.
    if ! gate_present "$gate_source" "$gate" \
       && [ -n "$file_path" ] && [ -f "$file_path" ] \
       && has_gate "$(cat "$file_path")" "$gate"; then
      continue
    fi
    missing="$missing $gate"
  fi
done

if [ -n "$missing" ]; then
  echo "[forgemaster] Blocked: run.json cannot be set to \"done\" while gates are not recorded as pass/na:$missing." >&2
  echo "[forgemaster] Run the Gates stage, record each gate's real result, and only then mark the run done." >&2
  exit 2
fi
exit 0
