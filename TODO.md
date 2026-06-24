# TODO

## Skill showcase site

Static no-build hub in `site/`, deployed to GitHub Pages on every push to `main`.
Live at https://llamaopnv.github.io/Claude_Code_Empowerments-/

Each page is self-contained HTML on the shared shell (`site/shared/site.css` +
`site/shared/shell.js`), with one central metaphor, its own locked accent, and the taste
rules in `docs/superpowers/2026-06-23-anvil-page-handoff.md`. Links stay relative.

### Showcase pages (one per owned skill)
The grid is two horizontal feature cards framing a uniform middle row, each card with an
accent icon. Owned skills only:
- [x] Landing hub (`site/index.html`)
- [x] anvil (feature) `#6ea8e6`
- [x] symmetric-audit `#e8a33d`
- [x] workflow-forge `#9d8cf5`
- [x] bake-to-completion `#ee6f9e`
- [x] design-taste-frontend `#cd7cf0`
- [x] skill-installer (feature) `#3fc9b0`
- [x] tdd-heartbeat `#e5675f` (external, linked from the grid)

### Removed 2026-06-24 (not the user's; pulled from repo + marketplace + site)
new-aspire-project, md-with-mermaid-to-pdf, jira-api, bitbucket-pr, bitbucket-pipeline,
bitbucket-repo. Their plugin dirs, `site/<slug>/`, and `marketplace.json` entries were deleted.

### Ideas
- [ ] Branch the per-skill pages into more depth (the skill-installer page is the front
      door; each showcase can go deeper on real usage).

For each page: `site/<slug>/index.html` on the shared shell, a distinct locked accent, a tile
in the grid. Reuse `.pane` / `.row` / `.btn-*` / `.reveal`. Keep the em-dash ban, one accent
per page, motivated motion, Phosphor icons.

### Follow-ups
- [ ] Maintainer-gated pre-commit sync skill: regenerate the landing grid from
      `marketplace.json` and warn when a plugin has no showcase page. Gate to
      `user.email == llama.op@gmail.com` so forks and contributors never trigger it.
- [ ] After the first Pages deploy, confirm the site renders at the project-site subpath
      and that the old Anvil dashboard is fully retired from Pages.
