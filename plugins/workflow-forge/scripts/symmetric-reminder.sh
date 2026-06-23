#!/usr/bin/env bash
# PostToolUse(Write|Edit) hook. Non-blocking. When a file that usually has
# siblings is touched (schema, router/api, route, form, migration, .NET
# controller/endpoint/entity), print a short reminder to run the symmetric
# audit before declaring the task done.
set -u

payload="$(cat 2>/dev/null || true)"
path="$(echo "$payload" | grep -oE '"file_path"[[:space:]]*:[[:space:]]*"[^"]+"' | head -1 | sed -E 's/.*"file_path"[[:space:]]*:[[:space:]]*"([^"]+)".*/\1/')"
[ -z "$path" ] && exit 0

case "$path" in
  *schema*|*router*|*/routers/*|*/api/*|*/routes/*|*route.ts*|*form*|*migrations*|*Controller*|*Endpoint*|*Entities*|*Entity.cs)
    echo "[symmetric] Touched '$path'. This usually has siblings (create/edit/view, callers of a schema, other procedures on the same table). Run the symmetric audit (@agent-workflow-forge:symmetric-auditor) before calling this done." >&2
    ;;
esac
exit 0
