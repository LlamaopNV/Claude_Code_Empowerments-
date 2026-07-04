# 02 — Approach (inline mini-diverge, light weight)

idea-forge is installed, but a full (or lite) forge for a single static page with nine
sibling precedents is cost malpractice per the skill; light weight prescribes the inline
mini-diverge. Recorded in `skips`.

## Candidate A — "The run, replayed": an interactive scripted pipeline run

The page's central component plays a forgemaster run end to end: the stage rail advances
(intake → diverge → spec → plan → build → gates → deliver), a file-tree pane fills with the
numbered artifacts (`00-intake.md` … `07-summary.md`), and a live `run.json` pane mutates as
the state machine ticks. The finale is the gate ledger: six seals stamp from `pending` to
`pass`, including one `fail` → fix → re-run beat, and a "mark done" attempt that the
done-gate hook visibly blocks until the ledger is green. A closing band notes this very page
shipped through its own pipeline, linking to the real run directory in the repo.

- Strength: shows the two invariants (every stage ends in a file; done is measured) as one
  literal, real-artifact-shaped interaction. Matches the hub's "one metaphor, interactive"
  pattern. No fake-screenshot risk: the panes render real file names and real JSON shape.
- Weakness: the most build effort of the three; needs careful staging so it reads at a
  glance and not as a wall of animation.

## Candidate B — "The forge floor": stations and delegation

A horizontal forge-floor diagram: seven stations, each manned by the specialist skill that
owns it (bake-to-completion, idea-forge, superpowers, workflow-forge...), a workpiece moving
station to station. The story is orchestration: forgemaster writes almost nothing itself.

- Strength: uniquely tells the "top of the toolchain" story and cross-links the sibling
  showcase pages (good for the hub).
- Weakness: static-diagram gravity; the delegation story is org-chart-ish and the interactive
  version tends toward decorated boxes, close to the banned fake-dashboard territory. The
  gates (the plugin's sharpest teeth) become a footnote.

## Candidate C — "The refusal": lead with the done-gate

Build the page around the single most opinionated behavior: you cannot mark the run done.
Hero is a blocked `status: "done"` write; the demo is an interactive attempt to cheat the
manifest that the hook rejects, gate by gate, until real evidence lands.

- Strength: dramatic, memorable, differentiated; one crisp interaction.
- Weakness: leads with a negative, and covers one hook rather than the pipeline; a visitor
  learns what forgemaster refuses before learning what it does. Thin for a full page.

## Evaluation against the intake goal

The goal is a showcase for the whole plugin on the hub's established pattern. A carries the
pipeline story AND the gate story through the plugin's own literal artifacts (run dir +
run.json), stays interactive without faking a product UI, and can absorb C's best beat (the
blocked done-write) as its finale. B's delegation story survives as a compact "who owns each
stage" strip inside A rather than the centerpiece.

## Chosen: A, with C's blocked-write as the finale and B reduced to a delegation strip

- Metaphor: **the run record**. A forgemaster run replayed from its artifacts.
- Accent: **`#f2c94c` (forge-spark gold)** — the master's hallmark stamp. Distinct hue
  family from all ten sibling accents (closest is symmetric-audit's amber `#e8a33d`, which
  sits clearly toward orange); green was rejected because the page leans on the semantic
  `--add`/`--miss` state colors for gate verdicts, and a green accent would blur them.
- Strongest rejected alternative: B ("forge floor" delegation diagram) — rejected because it
  showcases the org chart instead of the guarantees, and drifts toward the banned
  static-fake-diagram feel.
