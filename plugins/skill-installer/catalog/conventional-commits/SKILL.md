---
name: conventional-commits
description: Use when the user asks to commit, requests commit messages, or when you need to create git commits — enforces Conventional Commits 1.0.0 with structured grouping and Co-Authored-By footer
---

# Conventional Commits

Enforce [Conventional Commits 1.0.0](https://www.conventionalcommits.org/) for all git commits.

## Format

```
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

- **Description**: imperative mood, lowercase start, no period, max 72 chars
- **Body**: blank line after description, wrap at 72 chars, explain _why_ not _what_
- **Footer**: `Co-Authored-By`, `BREAKING CHANGE`, `Refs: #123`, etc.

## Types

| Type       | When                                      |
| ---------- | ----------------------------------------- |
| `feat`     | New feature or capability                 |
| `fix`      | Bug fix                                   |
| `refactor` | Code change that neither fixes nor adds   |
| `chore`    | Tooling, deps, config, no production code |
| `docs`     | Documentation only                        |
| `style`    | Formatting, whitespace, no logic change   |
| `test`     | Adding or updating tests                  |
| `perf`     | Performance improvement                   |
| `ci`       | CI/CD pipeline changes                    |
| `build`    | Build system or external deps             |

## Scope

Use the feature area or module name: `feat(onboarding):`, `fix(auth):`, `refactor(api):`

Omit scope only when the change is truly cross-cutting.

## Commit Workflow

1. Run `git status` and `git diff --staged` to understand what's being committed
2. Run `git log --oneline -5` to check existing message style
3. **Group changes logically** — one commit per logical unit, not one giant commit
4. Stage specific files per group (`git add <files>`) — never `git add -A` blindly
5. Write message using HEREDOC:

```bash
git commit -m "$(cat <<'EOF'
feat(auth): add OAuth2 login flow with PKCE

Adds Authorization Code Flow with PKCE for public clients, replacing
the implicit grant which is deprecated in OAuth 2.1.

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

6. Run `git status` after to verify success

## Grouping Strategy

When committing multiple related changes, group by:

- **Layer**: core logic, API, UI as separate commits
- **Purpose**: feature, fix, refactor as separate commits
- **Dependency**: if B depends on A, commit A first

## Breaking Changes

```
feat(api)!: change authentication to OAuth2

BREAKING CHANGE: JWT tokens are no longer accepted, all clients must use OAuth2 flow.
```

## Ticket References

If the project uses a ticket tracker (Jira, Linear, GitHub Issues), append a `Refs:` trailer before the `Co-Authored-By` line:

```
feat(billing): add Stripe webhook handler

Refs: PROJ-123
Co-Authored-By: Claude <noreply@anthropic.com>
```

## Common Mistakes

- Mixing `feat` and `fix` in one commit — split them
- Using past tense ("added") instead of imperative ("add")
- Scope too broad ("app") or too narrow ("button-color")
- Body explaining _what_ changed (the diff shows that) instead of _why_
