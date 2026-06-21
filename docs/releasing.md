# Releasing Anvil — versioning, schema migration, and cutting a release

How Anvil is versioned, what the `schemaVersion` fields guarantee, and the exact steps to ship a release.

## Two kinds of version

Anvil carries **two independent version axes** — keep them distinct:

| Axis | Where | Bumped when |
| --- | --- | --- |
| **Package semver** | `package.json` of each workspace (`@anvil/core`, `@anvil/server`, `@anvil/ui`), `plugins/anvil/.claude-plugin/plugin.json`, and the marketplace `version` in `.claude-plugin/marketplace.json` | Any release — features, fixes, docs. Standard [SemVer](https://semver.org/). |
| **Data schema version** | `EVAL_SCHEMA_VERSION` and `RESULT_SCHEMA_VERSION` in `@anvil/core` (both currently `1`), stamped into every `EvalSuite`, `Scorecard`, and `index.json` as `schemaVersion` | Only on a **breaking** change to the on-disk eval/result contract. |

A code release (e.g. 0.1.0 → 0.2.0) does **not** imply a schema bump. The schema version moves far more
slowly than the package version, and that is intentional — committed suites and scorecards must keep parsing.

### Current versions (MVP)

- `@anvil/core`, `@anvil/server`, `@anvil/ui`, `plugins/anvil`: **0.1.0** (initial, pre-1.0 — the API may
  still move in minor releases per SemVer's 0.x allowance).
- Marketplace catalog (`.claude-plugin/marketplace.json`): **0.3.0** (this repo's marketplace, which also
  ships the Bitbucket/Jira/etc. plugins).
- `EVAL_SCHEMA_VERSION` = **1**, `RESULT_SCHEMA_VERSION` = **1**.

## Schema-migration policy

The eval and result contracts (`@anvil/core` `eval.ts` / `result.ts`) are the **frozen contract** the
server, UI, and committed fixtures all depend on. The rules:

1. **Additive changes are NOT a breaking change** and do NOT bump the schema version. Adding an *optional*
   field (e.g. a new optional metric key, a new optional artifact attribute) is backward-compatible:
   old data still validates, old readers ignore the new field. The doc comments in `eval.ts`/`result.ts`
   state this explicitly ("Additive changes only without a `schemaVersion` bump").
2. **Breaking changes bump the schema version** — removing/renaming a field, changing a type, tightening a
   constraint that previously-valid data would now fail, or changing the meaning of a value. When this
   happens:
   - Bump `EVAL_SCHEMA_VERSION` and/or `RESULT_SCHEMA_VERSION` to the next integer.
   - The Zod schema pins `schemaVersion` with `z.literal(...)`, so old-version data fails validation
     loudly rather than being silently mis-read — this is the desired fail-closed behaviour.
   - Provide a migration: either a one-shot converter that reads vN and writes vN+1, or accept both
     versions in a transition window. Do not silently coerce.
3. **Pricing is versioned data, not schema.** The cost table (`pricing.ts`, `PRICING_VERSION`, date-based)
   is append-only: add a new dated entry rather than mutating an existing one, so historical scorecards
   remain reproducible. Bumping prices is not a schema change.
4. **Unknown future versions warn clearly.** A reader encountering a `schemaVersion` it doesn't recognise
   should surface a readable error (the `z.literal` mismatch message) telling the user to upgrade — never
   crash opaquely and never guess.

## Cutting a release

1. **Green gate.** From the repo root:
   ```bash
   npm ci
   npm run build           # all workspaces (core before ui/server is handled by the build order)
   npm run lint
   npm run typecheck
   npm test
   npm run validate:data -w @anvil/ui   # the committed demo dataset still validates against core
   ```
   All must pass on Windows, macOS, and Linux (the CI matrix enforces this on push/PR).
2. **Decide the version bumps.** Pick the SemVer level for the package(s) that changed. Decide whether the
   data schema changed (see the policy above) — usually it has NOT.
3. **Update versions.** Edit the relevant `package.json` `version` fields, `plugins/anvil/.claude-plugin/
   plugin.json`, and (if the marketplace catalog changed) the `version` in `.claude-plugin/marketplace.json`.
   If the schema changed, also bump `EVAL_SCHEMA_VERSION` / `RESULT_SCHEMA_VERSION` and write the migration.
4. **Update the CHANGELOG.** Add a new dated section at the TOP of `CHANGELOG.md` (append, never clobber the
   existing history) describing Added / Changed / Fixed / Removed.
5. **Validate the plugin + marketplace.**
   ```bash
   claude plugin validate .
   ```
6. **Commit + tag.** Commit (GPG-signed — this repo's memory requires a running `gpg-agent`; start it first,
   do not bypass signing). Tag the release, e.g. `git tag anvil-v0.1.0`. Push the tag.
7. **Pages deploy is automatic.** Pushing to `main` runs `.github/workflows/pages-deploy.yml`, which rebuilds
   the dashboard (with the committed illustrative demo data) and publishes it to GitHub Pages at the
   project-site base path `/<repo>/`.

## See also

- [Architecture](architecture.md) — what each package does and the data flow.
- [Metrics Reference](metrics-reference.md) — the result contract's metrics and methodology.
