---
name: standup-from-worklog
description: Use when the user asks for a standup update, a daily summary, a progress recap, or wants to turn WORKLOG.md into a status update or Jira comment. Reads the recent WORKLOG.md entries (and optionally git history) and produces a concise yesterday / today / blockers summary.
---

# Standup From Worklog

Turn the work you have actually logged into a short standup or status update.
Pairs with the workflow-forge `WORKLOG.md` convention (append-only, one line per
meaningful action).

## When to Use

- "Write my standup", "what did I do yesterday", "summarise progress", "post a
  status update on the ticket".

## When NOT to Use

- There is no `WORKLOG.md` and no useful git history to summarise. Say so and
  offer to start a WORKLOG instead.

## Procedure

1. **Gather the source.**
   - Read `WORKLOG.md` at the repo root. Take the entries since the last working
     day (or a window the user specifies, e.g. "since Monday").
   - If `WORKLOG.md` is missing or thin, supplement with
     `git log --since=...` for the user's own commits.

2. **Group into the standup shape:**

   ```
   *Yesterday*
   - <what shipped / progressed>

   *Today*
   - <what is planned next — from open TODO.md items or the current branch>

   *Blockers*
   - <anything waiting on a person, decision, or external system; "none" if clear>
   ```

   Pull "Today" from `TODO.md` open items when present. Pull blockers from
   WORKLOG lines that note a pause, a question, or a missing dependency.

3. **Keep it tight.** A few bullets per section, plain language, no filler. This
   is a status update, not a diff.

4. **Offer the destination.** Ask whether to:
   - just print it (default),
   - format it for Slack/Teams, or
   - post it as a Jira comment via the Atlassian MCP (only if connected, and
     only after the user confirms the ticket and the text — never post silently).

## Notes

- Honour the project's house style (for example, no em dashes) from `CLAUDE.md`.
- Read-only by default. Do not modify WORKLOG.md or post anywhere without the
  user's explicit go-ahead.
