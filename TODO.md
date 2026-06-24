# TODO

## Skill showcase site

Static no-build hub in `site/`, deployed to GitHub Pages on every push to `main`.
Live at https://llamaopnv.github.io/Claude_Code_Empowerments-/

Each page is self-contained HTML on the shared shell (`site/shared/site.css` +
`site/shared/shell.js`), with one central metaphor, its own locked accent, and the taste
rules in `docs/superpowers/2026-06-23-anvil-page-handoff.md`. Links stay relative.

### Pages done
- [x] Landing hub (`site/index.html`)
- [x] symmetric-audit (`site/symmetric-audit/index.html`)
- [x] anvil (`site/anvil/index.html`)
- [x] tdd-heartbeat (external, linked from the grid)

### Build pages for the rest of the skills
All built on the shared shell, each with a locked distinct accent, a central interactive
metaphor, and a grid tile. Strongest interactive-metaphor candidates were done first:
- [x] workflow-forge (forge stamps disciplines into a repo) `#9d8cf5`
- [x] bake-to-completion (doneness probe climbs as the idea is sharpened) `#ee6f9e`
- [x] design-taste-frontend (slop-vs-passed toggle of the same layout) `#cd7cf0`
- [x] skill-installer (catalog shelf you pick from and install) `#3fc9b0`
- [x] new-aspire-project (blueprint assembles in clean-architecture layers) `#a87cf0`
- [x] md-with-mermaid-to-pdf (real mermaid render onto a paged sheet) `#2fc7d6`
- [x] jira-api (JQL request out, issue rows back) `#5b8def`
- [x] bitbucket-pr (PR advances through its lifecycle) `#4aa8f0`
- [x] bitbucket-pipeline (CI stages stream pass/fail) `#3bb6e8`
- [x] bitbucket-repo (browse the tree at any ref) `#7d90f5`

The last four (jira-api + the three bitbucket pages) share a cool-blue accent family on
purpose: they read as one Atlassian integration suite in the grid.

For each new page: drop it at `site/<slug>/index.html`, pick a distinct accent, and add a
tile to the grid in `site/index.html` with that accent. Reuse `.pane` / `.row` / `.btn-*` /
`.reveal`. Keep the em-dash ban, one accent per page, motivated motion, and Phosphor icons.

### Follow-ups
- [ ] Maintainer-gated pre-commit sync skill: regenerate the landing grid from
      `marketplace.json` and warn when a plugin has no showcase page. Gate to
      `user.email == llama.op@gmail.com` so forks and contributors never trigger it.
- [ ] After the first Pages deploy, confirm the site renders at the project-site subpath
      and that the old Anvil dashboard is fully retired from Pages.
