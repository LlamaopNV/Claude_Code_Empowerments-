#!/usr/bin/env bash
# Jira Cloud API helpers. Source this, don't execute it.
#
# Authentication: Jira Cloud API Token (NOT OAuth)
#   JIRA_API_TOKEN = API token (create at: https://id.atlassian.com/manage-profile/security/api-tokens)
#   JIRA_EMAIL     = Atlassian account email (defaults to git config user.email)
#
# Instance: set JIRA_BASE_URL to your Jira Cloud site (e.g. https://your-org.atlassian.net)
# Project & board: set JIRA_PROJECT and JIRA_BOARD per project
#   (Claude Code: .claude/settings.json env block; other agents: shell env)
#
# Resolution order: env vars > git config (email only)

: "${JIRA_BASE_URL:?JIRA_BASE_URL required (e.g. https://your-org.atlassian.net)}"
: "${JIRA_API_TOKEN:?JIRA_API_TOKEN required (set env or add to settings.json)}"
: "${JIRA_PROJECT:?JIRA_PROJECT required (set in .claude/settings.json env or shell env)}"
: "${JIRA_BOARD:?JIRA_BOARD required (set in .claude/settings.json env or shell env)}"
JIRA_EMAIL="${JIRA_EMAIL:-$(git config user.email)}"
JIRA_BASE_URL="${JIRA_BASE_URL%/}"

_JIRA_REST="$JIRA_BASE_URL/rest/api/3"
_JIRA_AGILE="$JIRA_BASE_URL/rest/agile/1.0"
_JIRA_BROWSE="$JIRA_BASE_URL/browse"
_JIRA_PROJECT="$JIRA_PROJECT"
_JIRA_BOARD="$JIRA_BOARD"

# Internal: execute curl with auth, check status, return body or error
_jira_curl() {
  local resp http_code body
  resp=$(curl -sS -w $'\n''%{http_code}' -u "$JIRA_EMAIL:$JIRA_API_TOKEN" "$@")
  http_code=$(echo "$resp" | tail -1)
  body=$(echo "$resp" | sed '$d')
  if [[ "$http_code" -ge 400 ]]; then
    echo "Error $http_code: $body" >&2
    return 1
  fi
  echo "$body"
}

# GET JSON
jira_get() {
  _jira_curl -H "Accept: application/json" "$1"
}

# POST JSON: jira_post <url> <json_body>
jira_post() {
  _jira_curl -X POST -H "Content-Type: application/json" -H "Accept: application/json" -d "$2" "$1"
}

# PUT JSON: jira_put <url> <json_body>
jira_put() {
  _jira_curl -X PUT -H "Content-Type: application/json" -H "Accept: application/json" -d "$2" "$1"
}

# URL-encode a string (for JQL)
_jira_encode() {
  python3 -c "import urllib.parse, sys; print(urllib.parse.quote(sys.argv[1]))" "$1"
}
