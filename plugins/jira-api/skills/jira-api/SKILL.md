---
name: jira-api
description: |
  Jira REST API reference and prebuilt scripts for skills that interact with Jira.
  Covers auth, search, issue CRUD, transitions, comments, sprints, and ADF format.
  Use when any skill needs to call the Jira API.
user-invocable: false
---

# Jira REST API reference

## Setup

Auth and project config are handled by `_lib.sh` (sourced automatically by every script):
- `JIRA_BASE_URL` — required. Your Jira Cloud site, e.g. `https://your-org.atlassian.net`
- `JIRA_API_TOKEN` — required (create at: https://id.atlassian.com/manage-profile/security/api-tokens)
- `JIRA_EMAIL` — defaults to `git config user.email`
- `JIRA_PROJECT` — required. Jira project key (e.g. `ABC`)
- `JIRA_BOARD` — required. Agile board ID (e.g. `42`)

Set these per project via the `.claude/settings.json` env block (Claude Code) or shell env (other agents).

## Scripts

All scripts in `${CLAUDE_SKILL_DIR}/scripts/`. Each handles auth, URL construction, error handling.

### Search (JQL)
```
${CLAUDE_SKILL_DIR}/scripts/jira-search.sh <jql> [fields] [max_results]
```
Output: TSV — key, summary, status, assignee, priority, issuetype

**The old `/rest/api/3/search` endpoint has been removed.** Scripts use `/rest/api/3/search/jql`.

### Get issue
```
${CLAUDE_SKILL_DIR}/scripts/jira-get-issue.sh <key> [fields]
```
Returns raw JSON. Pipe through `jq` for specific fields.

### Create issue
```
${CLAUDE_SKILL_DIR}/scripts/jira-create-issue.sh '<json_body>'
```
Auto-injects the project key (from `JIRA_PROJECT`) and defaults issuetype to Story. Output: `KEY — browse_url`

### Update issue
```
${CLAUDE_SKILL_DIR}/scripts/jira-update-issue.sh <key> '<json_body>'
```

### Transition issue (smart — accepts name, looks up ID)
```
${CLAUDE_SKILL_DIR}/scripts/jira-transition.sh <key> <transition_name>
```
e.g. `jira-transition.sh ABC-42 "In Progress"` — no need to fetch transition IDs manually.

### List transitions
```
${CLAUDE_SKILL_DIR}/scripts/jira-get-transitions.sh <key>
```
Output: TSV — id, name

### Add comment
```
${CLAUDE_SKILL_DIR}/scripts/jira-comment.sh <key> <text>
```
Auto-wraps plain text in ADF paragraph format.

### Active sprint
```
${CLAUDE_SKILL_DIR}/scripts/jira-active-sprint.sh
```
Returns sprint ID, name, start/end dates for the configured board (`JIRA_BOARD`).

### Move issue to sprint
```
${CLAUDE_SKILL_DIR}/scripts/jira-move-to-sprint.sh <sprint_id> <issue_key> [issue_key...]
```

### List epics
```
${CLAUDE_SKILL_DIR}/scripts/jira-list-epics.sh
```
Output: TSV — key, summary, status

## ADF (Atlassian Document Format)

Descriptions and comments use ADF. The `jira-comment.sh` script auto-wraps plain text, but for structured content (checklists, headings, code blocks), build ADF manually and pass to `jira-update-issue.sh` or `jira-create-issue.sh`.

**Plain text paragraph:**
```json
{
  "type": "doc",
  "version": 1,
  "content": [
    {
      "type": "paragraph",
      "content": [{"type": "text", "text": "Hello world"}]
    }
  ]
}
```

**Heading + checklist:**
```json
{
  "type": "doc",
  "version": 1,
  "content": [
    {
      "type": "heading",
      "attrs": {"level": 2},
      "content": [{"type": "text", "text": "Acceptance criteria"}]
    },
    {
      "type": "taskList",
      "attrs": {"localId": "1"},
      "content": [
        {
          "type": "taskItem",
          "attrs": {"localId": "1", "state": "TODO"},
          "content": [{"type": "text", "text": "First criterion"}]
        }
      ]
    }
  ]
}
```

**Code block:**
```json
{
  "type": "codeBlock",
  "attrs": {"language": "bash"},
  "content": [{"type": "text", "text": "make test"}]
}
```

## Useful fields

| Field | API name | Notes |
|---|---|---|
| Story points | `customfield_10016` | Number. Set via create or update. |
| Sprint | (use agile endpoint) | Cannot set via REST v3 fields — use `jira-move-to-sprint.sh`. |

## Pagination

Search results page via `nextPageToken`. If `isLast` is `false`, append `&nextPageToken=<token>` to fetch the next page. Most queries return under 50 results so pagination is rarely needed.

## Defaults

- Default issue type: `Story`
- Bug issue type: `Bug`
