// Acceptance checks for the forgemaster showcase page (03-spec.md AC1..AC13).
// Run from the repo root:  node forgemaster-runs/2026-07-04-forgemaster-showcase/checks.mjs
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const pagePath = join(root, 'site', 'forgemaster', 'index.html');
const landingPath = join(root, 'site', 'index.html');
const todoPath = join(root, 'TODO.md');

const ACCENT = '#f2c94c';
const SIBLING_ACCENTS = ['#6ea8e6', '#e8a33d', '#9d8cf5', '#ee6f9e', '#cd7cf0',
  '#3fc9b0', '#ff7849', '#7c6cf0', '#e5675f', '#3bbdd6'];

let failures = 0;
const check = (id, desc, fn) => {
  let ok = false, detail = '';
  try { const r = fn(); ok = r === true; detail = r === true ? '' : String(r); }
  catch (e) { detail = e.message; }
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${id}  ${desc}${ok ? '' : `  [${detail}]`}`);
  if (!ok) failures++;
};

const page = existsSync(pagePath) ? readFileSync(pagePath, 'utf8') : null;
const landing = readFileSync(landingPath, 'utf8');
const todo = readFileSync(todoPath, 'utf8');

check('AC1', 'page exists and is non-empty', () =>
  page !== null && page.length > 500 || 'missing or too small');

const p = () => { if (page === null) throw new Error('page missing'); return page; };

check('AC2', 'links shared site.css and shell.js', () =>
  p().includes('../shared/site.css') && p().includes('../shared/shell.js') || 'shell refs missing');

check('AC3', `SKILL_PAGE with accent ${ACCENT} and homeUrl ../`, () =>
  /window\.SKILL_PAGE\s*=/.test(p()) && p().includes(`accent: '${ACCENT}'`) &&
  p().includes(`homeUrl: '../'`) || 'SKILL_PAGE config wrong');

check('AC4a', 'accent used by no sibling page', () => {
  const dirs = readdirSync(join(root, 'site'), { withFileTypes: true })
    .filter(d => d.isDirectory() && d.name !== 'forgemaster' && d.name !== 'shared');
  for (const d of dirs) {
    const f = join(root, 'site', d.name, 'index.html');
    if (existsSync(f) && readFileSync(f, 'utf8').toLowerCase().includes(ACCENT))
      return `${d.name} already uses ${ACCENT}`;
  }
  return true;
});

check('AC4b', 'no sibling accent hex inside the new page', () => {
  const hit = SIBLING_ACCENTS.find(h => p().toLowerCase().includes(h));
  return hit ? `page contains sibling accent ${hit}` : true;
});

check('AC5', 'zero em/en dashes in changed files', () => {
  const files = [['page', page ?? ''], ['landing', landing], ['todo', todo]];
  const hit = files.find(([, s]) => /[–—]/.test(s));
  return hit ? `${hit[0]} contains an em/en dash` : true;
});

check('AC6', 'Phosphor CDN loaded, no inline <svg', () =>
  p().includes('@phosphor-icons/web') && !p().toLowerCase().includes('<svg') || 'icon rule broken');

check('AC7', 'main id="top", no hand-written header/footer', () =>
  p().includes('<main id="top"') && !/<header[\s>]/.test(p()) && !/<footer[\s>]/.test(p())
  || 'shell-injection contract broken');

check('AC8', 'Tailwind CDN + accent var mapping', () =>
  p().includes('cdn.tailwindcss.com') && p().includes(`accent: 'var(--accent)'`)
  || 'tailwind config wrong');

check('AC9', 'motivated motion: no scroll listener, reduced-motion handled, IO used', () =>
  !p().includes("addEventListener('scroll'") && p().includes('prefers-reduced-motion') &&
  p().includes('IntersectionObserver') || 'motion rules broken');

check('AC10', 'every navLinks anchor has a matching id', () => {
  const m = p().match(/navLinks:\s*\[([\s\S]*?)\]/);
  if (!m) return 'navLinks not found';
  const anchors = [...m[1].matchAll(/href:\s*'#([^']+)'/g)].map(x => x[1]);
  if (anchors.length < 2 || anchors.length > 4) return `expected 2-4 anchors, got ${anchors.length}`;
  const missing = anchors.find(a => !p().includes(`id="${a}"`));
  return missing ? `no element with id="${missing}"` : true;
});

check('AC11', 'landing grid card ./forgemaster/ with --c accent', () =>
  landing.includes('href="./forgemaster/"') && landing.includes(`--c:${ACCENT}`)
  || 'landing card missing');

check('AC12', 'no root-absolute local asset refs in the page', () =>
  !/(?:src|href)="\/(?!\/)/.test(p()) || 'root-absolute path found');

check('AC13', 'TODO.md ledger lists forgemaster with the accent', () =>
  todo.includes('forgemaster') && todo.includes(ACCENT) || 'ledger row missing');

console.log(failures === 0 ? '\nALL CHECKS GREEN' : `\n${failures} CHECK(S) RED`);
process.exit(failures === 0 ? 0 : 1);
