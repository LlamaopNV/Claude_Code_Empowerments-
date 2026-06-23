#!/usr/bin/env bash
# PreToolUse(Write|Edit) hook. Encourages test-first.
# Reads tdd_mode ("enforced" | "warn" | "off") from the CLAUDE_PLUGIN_OPTION_*
# env var Claude Code exports. Defaults to "warn" when unset so the hook never
# errors before the plugin option has been configured.
#
# In "enforced" mode, writing a NEW non-test source file with no sibling test
# blocks (exit 2). In "warn" mode it prints a reminder and allows (exit 0).
# Editing existing files and writing test files always pass.
set -u

mode="${CLAUDE_PLUGIN_OPTION_TDD_MODE:-warn}"
[ "$mode" = "off" ] && exit 0

payload="$(cat 2>/dev/null || true)"

# Extract the target path from the event JSON. Tolerant, no jq.
path="$(echo "$payload" | grep -oE '"file_path"[[:space:]]*:[[:space:]]*"[^"]+"' | head -1 | sed -E 's/.*"file_path"[[:space:]]*:[[:space:]]*"([^"]+)".*/\1/')"
[ -z "$path" ] && exit 0

case "$path" in
  # Source files we care about.
  *.ts|*.tsx|*.js|*.jsx|*.py|*.rs|*.go|*.cs) ;;
  *) exit 0 ;;
esac
# Skip test files, type declarations, configs, generated code, build output.
case "$path" in
  *.test.*|*.spec.*|*_test.*|*test_*|*Tests.cs|*Test.cs|*.Tests.*|*.d.ts|*config*|*generated*|*migrations*|*/obj/*|*/bin/*) exit 0 ;;
esac

root="${CLAUDE_PROJECT_DIR:-$(pwd)}"
base="$(basename "$path")"
stem="${base%.*}"
ext="${base##*.}"
dir="$(dirname "$path")"

# Does a plausible sibling test already exist?
found=0
for cand in \
  "$dir/$stem.test.$ext" "$dir/$stem.spec.$ext" \
  "$dir/${stem}_test.$ext" "$dir/test_$stem.$ext" \
  "$dir/${stem}Tests.$ext" "$dir/${stem}Test.$ext" "$dir/${stem}.Tests.$ext"; do
  [ -f "$root/$cand" ] && found=1 && break
done
# Broaden the search by stem if nothing adjacent was found (covers .NET test
# projects, which keep tests in a separate Foo.Tests assembly).
if [ "$found" -eq 0 ]; then
  command -v grep >/dev/null 2>&1 && \
  find "$root" -type f \( -name "$stem.test.*" -o -name "$stem.spec.*" -o -name "${stem}_test.*" -o -name "test_$stem.*" -o -name "${stem}Tests.*" -o -name "${stem}Test.*" \) 2>/dev/null \
    | grep -q . && found=1
fi
[ "$found" -eq 1 ] && exit 0

# Only block on NEW files; edits to existing source pass.
is_new=1
[ -f "$root/$path" ] && is_new=0

if [ "$mode" = "enforced" ] && [ "$is_new" -eq 1 ]; then
  echo "[tdd-guard] No test found for new source file '$path'. Write the failing test first (red, green, refactor), or set TDD mode to warn/off in the plugin config." >&2
  exit 2
fi

echo "[tdd-guard] Heads up: '$path' has no matching test yet. Add one before moving on." >&2
exit 0
