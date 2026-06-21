#!/usr/bin/env bash
# Shared helpers for Bitbucket API scripts. Source this, don't execute it.
#
# Authentication: Bitbucket Cloud App Password (NOT OAuth token)
#   BB_USER  = your Bitbucket username
#   BB_TOKEN = an App Password (create at: Bitbucket > Personal settings > App passwords)
#              Grant permissions: Repositories (read/write), Pull requests (read/write), Pipelines (read/write)
#   BB_WORKSPACE = default workspace slug
#   BB_REPO      = default repository slug
#
# Resolution order: env vars > ~/.bitbucket config > git remote (workspace/repo only)

# Load config from ~/.bitbucket if env vars missing
if [[ -z "${BB_USER:-}" || -z "${BB_TOKEN:-}" ]]; then
  if [[ -f "$HOME/.bitbucket" ]]; then
    while IFS='=' read -r key val; do
      key="${key## }"; key="${key%% }"
      val="${val## }"; val="${val%% }"
      [[ -n "$key" && "$key" != \#* ]] && export "$key"="$val"
    done < "$HOME/.bitbucket"
  fi
fi

# Auto-detect workspace/repo from git remote if not set
if [[ -z "${BB_WORKSPACE:-}" || -z "${BB_REPO:-}" ]]; then
  _bb_remote=$(git remote get-url origin 2>/dev/null || true)
  if [[ "$_bb_remote" =~ bitbucket\.org[:/]([^/]+)/([^/.]+) ]]; then
    : "${BB_WORKSPACE:=${BASH_REMATCH[1]}}"
    : "${BB_REPO:=${BASH_REMATCH[2]}}"
  fi
  unset _bb_remote
fi

: "${BB_USER:?BB_USER required (set env or add to ~/.bitbucket)}"
: "${BB_TOKEN:?BB_TOKEN required (set env or add to ~/.bitbucket)}"

_BB_BASE="https://api.bitbucket.org/2.0"

_bb_auth() {
  printf "Basic %s" "$(printf '%s:%s' "$BB_USER" "$BB_TOKEN" | base64 | tr -d '\n')"
}

# Build repo-scoped URL: _bb_repo_url <path> [workspace] [repo]
_bb_repo_url() {
  local path="$1"
  local ws="${2:-${BB_WORKSPACE:-}}"
  local repo="${3:-${BB_REPO:-}}"
  if [[ -z "$ws" || -z "$repo" ]]; then
    echo "Error: workspace and repo required (set BB_WORKSPACE/BB_REPO or pass as args)" >&2
    return 1
  fi
  echo "$_BB_BASE/repositories/$ws/$repo$path"
}

# Build workspace-scoped URL: _bb_ws_url [path] [workspace]
_bb_ws_url() {
  local path="${1:-}"
  local ws="${2:-${BB_WORKSPACE:-}}"
  if [[ -z "$ws" ]]; then
    echo "Error: workspace required (set BB_WORKSPACE or pass as arg)" >&2
    return 1
  fi
  echo "$_BB_BASE/repositories/$ws$path"
}

# Internal: execute curl, check status, return body or error
_bb_curl() {
  local resp http_code body
  resp=$(curl -sS -w $'\n''%{http_code}' "$@")
  http_code=$(echo "$resp" | tail -1)
  body=$(echo "$resp" | sed '$d')
  if [[ "$http_code" -ge 400 ]]; then
    echo "Error $http_code: $body" >&2
    return 1
  fi
  echo "$body"
}

# GET JSON
bb_get() {
  _bb_curl -H "Authorization: $(_bb_auth)" -H "Accept: application/json" "$1"
}

# GET raw text (diffs, logs, file content)
bb_get_raw() {
  _bb_curl -H "Authorization: $(_bb_auth)" "$1"
}

# POST JSON: bb_post <url> [json_body]
bb_post() {
  local args=(-X POST -H "Authorization: $(_bb_auth)" -H "Content-Type: application/json" -H "Accept: application/json")
  [[ -n "${2:-}" ]] && args+=(-d "$2")
  _bb_curl "${args[@]}" "$1"
}

# PUT JSON: bb_put <url> <json_body>
bb_put() {
  _bb_curl -X PUT -H "Authorization: $(_bb_auth)" -H "Content-Type: application/json" -H "Accept: application/json" -d "$2" "$1"
}

# DELETE: bb_delete <url>
bb_delete() {
  _bb_curl -X DELETE -H "Authorization: $(_bb_auth)" "$1"
}
