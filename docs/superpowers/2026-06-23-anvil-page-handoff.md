# Handoff: build the `anvil` showcase page on the shared shell

You are building a showcase landing page for the **anvil** skill (native effectiveness
evals for Claude Code skills, agents, and plugins). It must slot into an existing
multi-page "skill showcase" hub and reuse a shared design shell so every skill page
looks like one product.

This doc is self-contained. It includes the two shared files verbatim so you can drop
them in if they are not already present.

---

## 1. Where the page goes

The hub is a no-build static site (plain HTML + CDN Tailwind + vanilla JS). Layout:

```
skills-hub/
  index.html              landing (already built, do not touch)
  shared/site.css         design tokens, fonts, nav, footer, buttons, code panes
  shared/shell.js         injects nav + footer, sets per-page --accent
  symmetric-audit/index.html   reference page (already built)
  anvil/index.html        <-- YOU BUILD THIS. overwrite the placeholder here.
```

Your page lives at `anvil/index.html`. It links to the shared files one level up
(`../shared/...`). Keep all links **relative** so the site works under any repo or base path.

**anvil's identity accent is `#6ea8e6` (steel blue).** The landing grid already uses this
color for the anvil card. Match it.

---

## 2. Integration contract (the only wiring you must get right)

In `anvil/index.html`, include these. Everything else (nav bar, footer, accent) is then
handled for you by the shell.

In `<head>`:
```html
<link rel="stylesheet" href="../shared/site.css" />
```

Before `</body>`, set the page config, then load the shell:
```html
<script>
  window.SKILL_PAGE = {
    brand: 'skill showcase',     // nav brand label (keep identical across pages)
    brandIcon: 'ph-stack',       // phosphor icon class for the brand mark
    accent: '#6ea8e6',           // anvil identity colour. sets --accent for the whole page
    homeUrl: '../',              // path back to the hub landing
    repoUrl: 'https://github.com/llamaopnv',
    navLinks: [                  // your section anchors. keep to 2-4
      { label: 'The problem', href: '#problem' },
      { label: 'See it run',  href: '#demo' },
      { label: 'Install',     href: '#run' }
    ],
    cta: { label: 'Get the skill', href: '#run', icon: 'ph-download-simple' }, // optional
    footNote: 'anvil · part of the skill showcase'
  };
</script>
<script src="../shared/shell.js" defer></script>
```

Also load CDN Tailwind + Phosphor + the Tailwind config in `<head>` (see the skeleton in
section 4). Give your `<main>` `id="top"` (the footer "Back to top" link targets it).

**Do not** hand-write a nav bar or footer. `shell.js` injects them. If you add your own,
you get two.

---

## 3. The shared files (drop in only if missing)

### `shared/site.css`

```css
/* ============================================================
   Claude skill showcase - shared design shell
   One source of truth for tokens, type, nav, footer, and the
   common dev-tool components (buttons, code panes, reveal).
   Per-page identity is set with one variable: --accent.
   ============================================================ */

@font-face { font-family:'Geist'; font-style:normal; font-weight:400; font-display:swap;
  src:url('https://cdn.jsdelivr.net/fontsource/fonts/geist-sans@latest/latin-400-normal.woff2') format('woff2'); }
@font-face { font-family:'Geist'; font-style:normal; font-weight:500; font-display:swap;
  src:url('https://cdn.jsdelivr.net/fontsource/fonts/geist-sans@latest/latin-500-normal.woff2') format('woff2'); }
@font-face { font-family:'Geist'; font-style:normal; font-weight:600; font-display:swap;
  src:url('https://cdn.jsdelivr.net/fontsource/fonts/geist-sans@latest/latin-600-normal.woff2') format('woff2'); }
@font-face { font-family:'Geist'; font-style:normal; font-weight:700; font-display:swap;
  src:url('https://cdn.jsdelivr.net/fontsource/fonts/geist-sans@latest/latin-700-normal.woff2') format('woff2'); }
@font-face { font-family:'Geist Mono'; font-style:normal; font-weight:400; font-display:swap;
  src:url('https://cdn.jsdelivr.net/fontsource/fonts/geist-mono@latest/latin-400-normal.woff2') format('woff2'); }
@font-face { font-family:'Geist Mono'; font-style:normal; font-weight:500; font-display:swap;
  src:url('https://cdn.jsdelivr.net/fontsource/fonts/geist-mono@latest/latin-500-normal.woff2') format('woff2'); }

:root {
  --bg: #0a0a0b;
  --bg-2: #121214;
  --bg-3: #17171a;
  --border: #26262b;
  --border-2: #34343a;
  --text: #ededf0;
  --text-dim: #a6a6b0;
  --text-faint: #71717a;
  --accent: #e8a33d;          /* default; each page overrides via shell.js */
  --add: #5cbf8e;
  --miss: #d77068;
  --intent: #8b8b95;
  --radius: 10px;
  --maxw: 1180px;
  --font-sans: 'Geist', ui-sans-serif, system-ui, sans-serif;
  --font-mono: 'Geist Mono', ui-monospace, SFMono-Regular, Menlo, monospace;
}

* { box-sizing: border-box; }

html { scroll-behavior: smooth; }
@media (prefers-reduced-motion: reduce) { html { scroll-behavior: auto; } }

body {
  margin: 0;
  font-family: var(--font-sans);
  color: var(--text);
  background:
    radial-gradient(1100px 520px at 78% -8%, color-mix(in srgb, var(--accent) 7%, transparent), transparent 60%),
    radial-gradient(900px 600px at 8% 4%, rgba(92,191,142,0.035), transparent 55%),
    var(--bg);
  -webkit-font-smoothing: antialiased;
}

::selection { background: color-mix(in srgb, var(--accent) 30%, transparent); color: #fff; }

a { color: inherit; text-decoration: none; }

:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; border-radius: 4px; }

.wrap { max-width: var(--maxw); margin: 0 auto; padding-left: 20px; padding-right: 20px; }
.hairline { border-color: var(--border); }
.accent { color: var(--accent); }

/* ---- shared shell: nav ---- */
.site-nav {
  position: sticky; top: 0; z-index: 50;
  backdrop-filter: blur(10px);
  background: rgba(10,10,11,0.72);
  border-bottom: 1px solid var(--border);
}
.site-nav__inner {
  max-width: var(--maxw); margin: 0 auto; padding: 0 20px; height: 64px;
  display: flex; align-items: center; justify-content: space-between; gap: 16px;
}
.site-nav__brand { display: flex; align-items: center; gap: 10px; font-family: var(--font-mono); font-size: 14px; font-weight: 500; }
.site-nav__brand i { color: var(--accent); font-size: 18px; }
.site-nav__links { display: flex; align-items: center; gap: 26px; font-size: 14px; }
.site-nav__links a { color: var(--text-dim); transition: color .18s ease; }
.site-nav__links a:hover { color: #fff; }
@media (max-width: 680px) { .site-nav__links { display: none; } }

/* ---- shared shell: footer ---- */
.site-footer {
  max-width: var(--maxw); margin: 0 auto; padding: 48px 20px;
  border-top: 1px solid var(--border);
  display: flex; flex-wrap: wrap; gap: 16px; align-items: center; justify-content: space-between;
  font-size: 14px; color: var(--text-faint);
}
.site-footer__links { display: flex; align-items: center; gap: 26px; }
.site-footer a { transition: color .18s ease; }
.site-footer a:hover { color: #fff; }

/* ---- buttons ---- */
.btn-primary {
  display: inline-flex; align-items: center; gap: 8px;
  background: var(--accent); color: #14100a; font-weight: 600;
  padding: 12px 20px; border-radius: var(--radius); border: 0; cursor: pointer;
  transition: filter .18s ease, transform .12s ease;
}
.btn-primary:hover { filter: brightness(1.07); }
.btn-primary:active { transform: translateY(1px); }
.btn-ghost {
  display: inline-flex; align-items: center; gap: 8px;
  border: 1px solid var(--border-2); color: var(--text);
  padding: 12px 20px; border-radius: var(--radius); background: transparent; cursor: pointer;
  transition: border-color .18s ease, background .18s ease, transform .12s ease;
}
.btn-ghost:hover { border-color: #55555f; background: rgba(255,255,255,0.02); }
.btn-ghost:active { transform: translateY(1px); }
.btn-sm { padding: 8px 14px; font-size: 14px; }

/* ---- code panes (shared dev-tool component) ---- */
.pane {
  background: var(--bg-2); border: 1px solid var(--border); border-radius: var(--radius);
  font-family: var(--font-mono); font-size: 13px; line-height: 1.85; overflow: hidden;
}
.pane__bar {
  display: flex; align-items: center; gap: 8px; padding: 9px 13px;
  border-bottom: 1px solid var(--border); color: var(--text-dim); font-size: 12px;
}
.pane__body { padding: 12px 4px 14px; }
.row { display: grid; grid-template-columns: 22px 1fr; padding: 0 12px; white-space: pre; }
.row .gut { color: var(--text-faint); user-select: none; }
.row.ctx { color: #cfcfd6; }
.row.add  { color: var(--add);  background: rgba(92,191,142,0.08); }
.row.add .gut  { color: var(--add); }
.row.miss { color: var(--miss); background: rgba(215,112,104,0.09); }
.row.miss .gut { color: var(--miss); }
.row.fix  { color: var(--add);  background: rgba(92,191,142,0.12); }
.row.fix .gut  { color: var(--add); }
.row.intent { color: var(--intent); background: rgba(139,139,149,0.08); font-style: italic; }
.row.intent .gut { color: var(--intent); }
.row-anim { animation: rowIn .42s cubic-bezier(.16,1,.3,1) both; }
@keyframes rowIn { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: none; } }
@media (prefers-reduced-motion: reduce) { .row-anim { animation: none; } }

/* ---- misc shared ---- */
.dot { width: 8px; height: 8px; border-radius: 999px; display: inline-block; flex: 0 0 8px; }
.reveal { opacity: 0; transform: translateY(18px); transition: opacity .7s cubic-bezier(.16,1,.3,1), transform .7s cubic-bezier(.16,1,.3,1); }
.reveal.in { opacity: 1; transform: none; }
@media (prefers-reduced-motion: reduce) { .reveal { opacity: 1; transform: none; transition: none; } }
```

### `shared/shell.js`

```js
/* Shared shell injector. Each page sets window.SKILL_PAGE before loading this.
   Nav + footer are styled by site.css (plain classes), so they do not depend on
   Tailwind having processed yet. */
(() => {
  'use strict';
  const cfg = window.SKILL_PAGE || {};

  if (cfg.accent) {
    document.documentElement.style.setProperty('--accent', cfg.accent);
  }

  const home = cfg.homeUrl || '/';
  const esc = (s) => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

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
```

---

## 4. Page skeleton (`anvil/index.html`)

```html
<!doctype html>
<html lang="en" class="dark">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>anvil · showcase</title>
<meta name="description" content="anvil: native effectiveness evals for Claude Code skills, agents, and plugins." />

<script src="https://unpkg.com/@phosphor-icons/web@2.1.1"></script>
<script src="https://cdn.tailwindcss.com"></script>
<script>
  tailwind.config = { darkMode: 'class', theme: { extend: {
    fontFamily: { sans: ['Geist','ui-sans-serif','system-ui','sans-serif'], mono: ['"Geist Mono"','ui-monospace','monospace'] },
    colors: { accent: 'var(--accent)' },   // text-accent etc. follow --accent
    maxWidth: { content: '1180px' },
  } } };
</script>
<link rel="stylesheet" href="../shared/site.css" />

<style>
  /* anvil-specific styles only (your central visual, demo chrome, etc.) */
</style>
</head>

<body class="font-sans">
<main id="top">

  <!-- your sections: #problem, #demo, #run, etc. -->

</main>

<script>
  window.SKILL_PAGE = {
    brand: 'skill showcase', brandIcon: 'ph-stack', accent: '#6ea8e6',
    homeUrl: '../', repoUrl: 'https://github.com/llamaopnv',
    navLinks: [ { label:'The problem', href:'#problem' }, { label:'See it run', href:'#demo' }, { label:'Install', href:'#run' } ],
    cta: { label: 'Get the skill', href: '#run', icon: 'ph-download-simple' },
    footNote: 'anvil · part of the skill showcase',
  };
</script>
<script src="../shared/shell.js" defer></script>

<script>
  /* reveal-on-scroll: use IntersectionObserver, never a scroll listener */
  const io = new IntersectionObserver((es) => es.forEach((e) => {
    if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
  }), { threshold: 0.15 });
  document.querySelectorAll('.reveal').forEach((el) => io.observe(el));
</script>
</body>
</html>
```

---

## 5. Components you can reuse (from site.css)

- **Buttons:** `.btn-primary` (accent fill), `.btn-ghost` (outline), add `.btn-sm` for compact.
- **Code panes:** wrap in `.pane`, header row `.pane__bar`, body `.pane__body`. Each code line
  is `<div class="row STATE"><span class="gut">SIGIL</span><span>code</span></div>` where
  STATE is `ctx` (neutral), `add` / `fix` (green), `miss` (red), `intent` (grey italic).
  Add `.row-anim` to animate a line in.
- **Reveal on scroll:** put `.reveal` on a section, the IntersectionObserver adds `.in`.
- **Dots / legend:** `.dot` with an inline `style="background:var(--add|--miss|--intent)"`.
- **Tokens:** colors via `var(--bg|--bg-2|--bg-3|--border|--border-2|--text|--text-dim|--text-faint|--accent)`,
  plus `var(--add)` green, `var(--miss)` red, `var(--intent)` grey, `var(--radius)`,
  `var(--font-sans)`, `var(--font-mono)`.
- **Layout width:** Tailwind `max-w-content mx-auto px-5` matches the nav/footer width.

Tailwind Play CDN is available, so utility classes work for layout. Use plain CSS (vars +
your own `<style>`) for anything bespoke.

---

## 6. Non-negotiable design rules (this is what keeps the pages looking un-templated)

These come from the design-taste skill the rest of the hub was built to. Treat as hard gates.

- **ZERO em-dashes (`—`) and en-dashes (`–`) anywhere visible.** Headlines, body, code
  comments, captions, alt text, button labels. Use a period, comma, colon, or hyphen.
  This is the single most-checked tell. Grep your output for `—` before you finish.
- **One accent per page = anvil's `#6ea8e6`.** Do not introduce a second brand color.
  The green/red/grey are semantic *state* colors only (use them inside code panes /
  result readouts, like a diff or a pass/fail), not as decoration.
- **Dark theme locked.** No section flips to a light background mid-page.
- **One radius system.** Everything uses `var(--radius)` (10px). No mixed pill+square.
- **Motion must be motivated.** Every animation communicates something (storytelling,
  state change, feedback). Wrap anything non-trivial in `prefers-reduced-motion` and
  provide a static end-state. Use IntersectionObserver, never `window.addEventListener('scroll')`.
- **Hero discipline.** Headline max 2 lines, sub max ~20 words and max 4 lines, primary
  CTA visible without scrolling, `min-h-[calc(100dvh-4rem)]` (account for the 64px nav),
  max 4 text elements in the hero. No version badges, no scroll cues, no locale strips.
- **Icons from Phosphor only** (`<i class="ph ph-...">` or `ph-bold`). No hand-rolled SVG icons.
- **No fake product screenshots built from divs.** A *real* interactive component (an actual
  mini eval running, a real scorecard rendering) is fine and encouraged. A static fake
  dashboard made of styled rectangles is the #1 AI tell.
- **No generic 3-equal feature cards.** If you show multiple items, give the grid rhythm
  (asymmetric sizes, a featured tile).
- **Eyebrows rationed:** at most one small uppercase-tracking label per ~3 sections.
- **Copy self-audit:** re-read every visible string. No AI-cute filler, no fake-precise
  invented metrics unless labeled as example data.

---

## 7. Anvil concept starter (optional, take or leave)

anvil's story is **measurement**: it runs a skill/agent/plugin with and without the change,
has a judge score the A/B pair, and produces a scorecard with a before/after delta. Strong
central metaphors to consider (the hub's pattern is "one literal metaphor, made interactive"):

- **The forge / anvil:** a raw artifact gets hammered into a measured, scored shape. The
  "before" is rough, the "after" is tempered. Steel-blue accent already fits this.
- **The A/B scale:** a balance beam with treatment on one side, baseline on the other, the
  judge tipping it. The scorecard is the readout.
- **The scorecard reveal:** an interactive "run an eval" that streams treatment vs baseline
  cases, the judge verdicts landing one by one, building to a before/after delta number.

The reference page to match for feel is `symmetric-audit/index.html`: a hero with the core
metaphor, a "the problem" band, an interactive demo that plays out a real scenario, and an
install section. Reuse the `.pane` / `.row` components for any code or result readouts.

Build it interactive (a real component, scripted illustration is fine), apply section 6,
drop it at `anvil/index.html`, and it will appear correctly from the landing grid.
