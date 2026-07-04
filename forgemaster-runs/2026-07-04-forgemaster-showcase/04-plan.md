# 04 — Plan (light weight: task list, `superpowers:writing-plans` scaled out — see skips)

Tasks are sequential; each follows tests-first: the relevant ACs in `checks.mjs` must fail
(red) before the file they cover exists/changes, then pass (green).

1. **T1 — checks.mjs (the failing tests).** Write `checks.mjs` in this run dir encoding
   AC1–AC13. Run it; expect failures for every AC that targets not-yet-existing work
   (AC1–AC12 red, AC13 red). Record red in `05-build-log.md`.
2. **T2 — the page.** Invoke `design-taste-frontend` (per user instruction) and build
   `site/forgemaster/index.html` under it: hero, run-replay component, delegation strip,
   install section. Re-run checks: AC1–AC10, AC12 green.
3. **T3 — landing card + ledger.** Add the forgemaster card to `site/index.html` and the
   TODO.md ledger row. Re-run checks: AC11, AC13 green; full script green.
4. **T4 — visual verification.** Open the page (headless or browser) to confirm it renders,
   shell injects nav/footer, demo plays, reduced-motion path sane. Evidence into the log.

Then stage 5 (gates) per the skill.

Scale-downs recorded in run.json skips: brainstorming (light; design space fixed by shell +
taste rules + chosen metaphor), writing-plans (this task list), subagent-driven-development
(few strictly sequential tasks, direct execution), git worktree (light weight; page is
additive, no risk to existing work).
