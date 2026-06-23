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
Strongest interactive-metaphor candidates first:
- [ ] workflow-forge (bootstrap, iterative review, pre-commit gate, capability sync)
- [ ] bake-to-completion (interview-driven idea strengthening)
- [ ] design-taste-frontend (anti-slop preflight)
- [ ] skill-installer (browse + install from a catalog)
- [ ] new-aspire-project (clean-architecture scaffold)
- [ ] md-with-mermaid-to-pdf (mermaid render to PDF)
- [ ] jira-api (Jira REST reference + scripts)
- [ ] bitbucket-pr (PR lifecycle)
- [ ] bitbucket-pipeline (CI/CD runs)
- [ ] bitbucket-repo (browse repos at any ref)

For each new page: drop it at `site/<slug>/index.html`, pick a distinct accent, and add a
tile to the grid in `site/index.html` with that accent. Reuse `.pane` / `.row` / `.btn-*` /
`.reveal`. Keep the em-dash ban, one accent per page, motivated motion, and Phosphor icons.

### Follow-ups
- [ ] Maintainer-gated pre-commit sync skill: regenerate the landing grid from
      `marketplace.json` and warn when a plugin has no showcase page. Gate to
      `user.email == llama.op@gmail.com` so forks and contributors never trigger it.
- [ ] After the first Pages deploy, confirm the site renders at the project-site subpath
      and that the old Anvil dashboard is fully retired from Pages.
