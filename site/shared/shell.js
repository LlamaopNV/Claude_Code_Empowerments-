/* ============================================================
   Shared shell injector.
   Each page sets window.SKILL_PAGE before loading this script:

     window.SKILL_PAGE = {
       brand:    'skill showcase',           // nav brand label
       brandIcon:'ph-stack',                 // phosphor icon class
       accent:   '#e8a33d',                  // per-page identity colour
       homeUrl:  '../',                      // path back to the hub index
       repoUrl:  'https://github.com/...',   // source link
       navLinks: [ {label, href}, ... ],     // section anchors (optional)
       cta:      {label, href},              // right-hand nav button (optional)
       footNote: 'symmetric-audit ...'       // left footer text (optional)
     };

   Nav + footer are styled by site.css (plain classes), so they do not
   depend on Tailwind having processed yet.
   ============================================================ */
(() => {
  'use strict';
  const cfg = window.SKILL_PAGE || {};

  if (cfg.accent) {
    document.documentElement.style.setProperty('--accent', cfg.accent);
  }

  const home = cfg.homeUrl || '/';
  const esc = (s) => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  // ---- nav ----
  const links = (cfg.navLinks || [])
    .map((l) => `<a href="${esc(l.href)}">${esc(l.label)}</a>`)
    .join('');

  const cta = cfg.cta
    ? `<a href="${esc(cfg.cta.href)}" class="btn-ghost btn-sm">${
        cfg.cta.icon ? `<i class="ph ${esc(cfg.cta.icon)}" aria-hidden="true"></i>` : ''
      }${esc(cfg.cta.label)}</a>`
    : '';

  const header = document.createElement('header');
  header.className = 'site-nav';
  header.innerHTML =
    `<nav class="site-nav__inner" aria-label="Primary">
       <a class="site-nav__brand" href="${esc(home)}">
         <i class="ph-bold ${esc(cfg.brandIcon || 'ph-stack')}" aria-hidden="true"></i>
         <span>${esc(cfg.brand || 'skill showcase')}</span>
       </a>
       <div class="site-nav__links">${links}</div>
       ${cta}
     </nav>`;
  document.body.insertBefore(header, document.body.firstChild);

  // ---- footer ----
  const footer = document.createElement('footer');
  footer.innerHTML =
    `<div class="site-footer">
       <span style="font-family:var(--font-mono)">${esc(cfg.footNote || 'part of the Claude skill showcase')}</span>
       <div class="site-footer__links">
         <a href="${esc(home)}">All skills</a>
         ${cfg.repoUrl ? `<a href="${esc(cfg.repoUrl)}">Source</a>` : ''}
         <a href="#top">Back to top</a>
       </div>
     </div>`;
  document.body.appendChild(footer);
})();
