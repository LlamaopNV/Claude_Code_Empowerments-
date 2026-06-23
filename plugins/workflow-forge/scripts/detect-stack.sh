#!/usr/bin/env bash
# Detect the project stack and host OS, print a JSON summary on stdout.
# Dependency-free: pure shell, no jq required. Runs from the project root.
set -u

root="${CLAUDE_PROJECT_DIR:-$(pwd)}"
cd "$root" 2>/dev/null || { echo '{"error":"cannot cd to project root"}'; exit 0; }

has() { [ -e "$1" ]; }
pkg_has() { [ -f package.json ] && grep -q "\"$1\"" package.json 2>/dev/null; }
# Shallow, node_modules-free search for a filename pattern. Prints first match.
find_any() { find . -maxdepth "${2:-4}" -name "$1" -not -path '*/node_modules/*' -not -path '*/bin/*' -not -path '*/obj/*' 2>/dev/null | head -1; }
# Grep across .NET project files for a token.
csproj_has() { grep -rqi "$1" --include='*.csproj' . 2>/dev/null; }

# --- Host operating system --------------------------------------------------
os="unknown"
case "$(uname -s 2>/dev/null || echo unknown)" in
  Linux*)               os="linux" ;;
  Darwin*)              os="macos" ;;
  MINGW*|MSYS*|CYGWIN*) os="windows" ;;
  *) case "${OS:-}" in Windows*) os="windows" ;; esac ;;
esac

# --- Package manager / language --------------------------------------------
pm="unknown"
if has pnpm-lock.yaml; then pm="pnpm"
elif has yarn.lock; then pm="yarn"
elif has bun.lockb; then pm="bun"
elif has package-lock.json; then pm="npm"
elif [ -n "$(find_any '*.sln')" ] || [ -n "$(find_any '*.csproj')" ]; then pm="dotnet"
elif has Cargo.toml; then pm="cargo"
elif has go.mod; then pm="go"
elif has pyproject.toml || has requirements.txt; then pm="python"
fi

monorepo="none"
if has turbo.json; then monorepo="turborepo"
elif has nx.json; then monorepo="nx"
elif has pnpm-workspace.yaml; then monorepo="pnpm-workspaces"
elif has lerna.json; then monorepo="lerna"
elif [ "$pm" = "dotnet" ] && [ -n "$(find_any '*.sln')" ]; then monorepo="dotnet-solution"
fi

framework="unknown"
if pkg_has "@tanstack/react-start" || pkg_has "@tanstack/start"; then framework="tanstack-start"
elif pkg_has "next"; then framework="next"
elif pkg_has "vite"; then framework="vite"
elif pkg_has "remix" || pkg_has "@remix-run/react"; then framework="remix"
elif pkg_has "svelte"; then framework="svelte"
elif pkg_has "express" || pkg_has "fastify"; then framework="node-server"
elif [ "$pm" = "dotnet" ]; then
  if csproj_has "Aspire.Hosting"; then framework="dotnet-aspire"
  elif csproj_has "Microsoft.NET.Sdk.Web"; then framework="aspnet-core"
  else framework="dotnet"
  fi
fi

testrunner="unknown"
if pkg_has "vitest"; then testrunner="vitest"
elif pkg_has "jest"; then testrunner="jest"
elif pkg_has "@playwright/test"; then testrunner="playwright"
elif [ "$pm" = "dotnet" ]; then
  if csproj_has "xunit"; then testrunner="xunit"
  elif csproj_has "nunit"; then testrunner="nunit"
  elif csproj_has "MSTest"; then testrunner="mstest"
  else testrunner="dotnet-test"
  fi
elif has Cargo.toml; then testrunner="cargo-test"
elif has pyproject.toml && grep -q pytest pyproject.toml 2>/dev/null; then testrunner="pytest"
fi

linter="unknown"
if pkg_has "oxlint"; then linter="oxlint"
elif pkg_has "biome" || pkg_has "@biomejs/biome"; then linter="biome"
elif pkg_has "eslint"; then linter="eslint"
elif [ "$pm" = "dotnet" ]; then linter="dotnet-format"
fi

orm="unknown"
if pkg_has "drizzle-orm"; then orm="drizzle"
elif pkg_has "prisma" || pkg_has "@prisma/client"; then orm="prisma"
elif pkg_has "typeorm"; then orm="typeorm"
elif [ "$pm" = "dotnet" ] && csproj_has "Microsoft.EntityFrameworkCore"; then orm="efcore"
fi

formlib="none"
if pkg_has "@tanstack/react-form"; then formlib="tanstack-form"
elif pkg_has "react-hook-form"; then formlib="react-hook-form"
fi

# Pull the script names (JS) so the skill can build a real commands block.
scripts="none"
if [ -f package.json ]; then
  scripts=$(grep -A 40 '"scripts"' package.json 2>/dev/null \
    | grep -oE '"[a-zA-Z0-9:_-]+":' \
    | tr -d '":' | tr '\n' ',' | sed 's/,$//')
  [ -z "$scripts" ] && scripts="none"
fi

has_claude_md="false"; has CLAUDE.md && has_claude_md="true"

printf '{\n'
printf '  "os": "%s",\n' "$os"
printf '  "package_manager": "%s",\n' "$pm"
printf '  "monorepo": "%s",\n' "$monorepo"
printf '  "framework": "%s",\n' "$framework"
printf '  "test_runner": "%s",\n' "$testrunner"
printf '  "linter": "%s",\n' "$linter"
printf '  "orm": "%s",\n' "$orm"
printf '  "form_library": "%s",\n' "$formlib"
printf '  "package_scripts": "%s",\n' "$scripts"
printf '  "claude_md_exists": %s\n' "$has_claude_md"
printf '}\n'
