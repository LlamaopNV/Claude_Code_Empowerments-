#!/usr/bin/env bash
# PreToolUse(Bash) hook. Reads the event JSON on stdin. If the command is a
# git commit and the pre-commit gate is enabled, run lint + tests and block the
# commit (exit 2) on failure. For any other command, exit 0 and stay silent.
#
# Reads the precommit_gate user_config value from the CLAUDE_PLUGIN_OPTION_* env
# var Claude Code exports. Defaults to "true" when unset so the hook never errors
# before the plugin option has been configured.
set -u

gate="${CLAUDE_PLUGIN_OPTION_PRECOMMIT_GATE:-true}"
payload="$(cat 2>/dev/null || true)"

# Only act on git commit commands. Tolerant match, no jq dependency.
echo "$payload" | grep -qiE 'git[[:space:]]+commit' || exit 0
# Respect explicit bypasses; let the human own that choice.
echo "$payload" | grep -qE '\-\-no-verify' && exit 0
[ "$gate" = "true" ] || exit 0

root="${CLAUDE_PROJECT_DIR:-$(pwd)}"
cd "$root" 2>/dev/null || exit 0

run() { echo "[precommit-gate] $*" >&2; "$@"; }

# Pick the package manager.
if [ -f pnpm-lock.yaml ]; then pm="pnpm"
elif [ -f yarn.lock ]; then pm="yarn"
elif [ -f bun.lockb ]; then pm="bun"
elif [ -f package-lock.json ]; then pm="npm run"
else pm=""; fi

# Shallow search for a .NET solution/project (skip build output).
dotnet_root="$(find . -maxdepth 4 -name '*.sln' -not -path '*/bin/*' -not -path '*/obj/*' 2>/dev/null | head -1)"
[ -z "$dotnet_root" ] && dotnet_root="$(find . -maxdepth 4 -name '*.csproj' -not -path '*/bin/*' -not -path '*/obj/*' 2>/dev/null | head -1)"

fail=0
if [ -n "$pm" ] && [ -f package.json ]; then
  if grep -q '"check"' package.json; then run $pm check || fail=1; fi
  if grep -q '"check-types"' package.json; then run $pm check-types || fail=1; fi
  if grep -q '"test"' package.json; then run $pm test || fail=1; fi
elif [ -n "$dotnet_root" ] && command -v dotnet >/dev/null 2>&1; then
  run dotnet build --nologo || fail=1
  run dotnet test --nologo --no-build || fail=1
elif [ -f Cargo.toml ]; then
  run cargo test || fail=1
elif [ -f pyproject.toml ]; then
  command -v pytest >/dev/null 2>&1 && { run pytest -q || fail=1; }
fi

if [ "$fail" -ne 0 ]; then
  echo "[precommit-gate] Lint or tests failed. Commit blocked. Fix the failures, or commit with --no-verify if you are deliberately overriding." >&2
  exit 2
fi
exit 0
