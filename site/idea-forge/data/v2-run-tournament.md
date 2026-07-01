# run-tournament.md — idea-forge executor playbook (v2)

The operational companion to `SKILL.md`. Follow these steps literally to run a forge. `SKILL.md` defines the rules; this file defines the exact Agent-tool spawns, prompts, and logging. All agents are spawned with the **Opus** model and **high reasoning effort**. Use the `Agent` tool; send independent spawns in a single message so they run concurrently.

**v2 architecture in one line:** generate 8 → pre-screen to name champion-zero + freeze a reserve → climb a king-of-the-hill ladder where each rung grafts the challenger's strongest *compatible* fix into a **running merge** (re-validated against a graft ledger and the previous champion) → finish with a mandatory **audit rung** that ships the champion ONLY if it beats the reserved original.

---

## Step 0 — Intake & cost gate
1. Confirm there is exactly ONE seed idea. If multiple, ask which one. If too vague to attack, stop and recommend `bake-to-completion`.
2. Decide mode:
   - **Full:** 8 contenders, pre-screen, 7-rung ladder, audit rung (~18-24 Opus calls).
   - **Lite:** 4 contenders (axes 1,3,4,8), pre-screen, 3-rung ladder, audit rung (~9-12 calls).
3. Tell the user the call count / rough cost and get an explicit go-ahead. Default to offering lite if they hesitate. Note it is *fewer* calls than a debate bracket (one call per rung vs six per debate) but still expensive.
4. Initialize the log file `./idea-forge-runs/YYYY-MM-DD-<slug>.md` with the seed and chosen mode. (Create `idea-forge-runs/` if absent.)

---

## Step 1 — Spawn the contenders (parallel)
Spawn N agents in ONE message (N = 8 full, 4 lite), each with its own axis. `subagent_type: general-purpose` (or any Opus-capable type), `model: opus`. Prompt template:

```
You are Contender #<k>, axis: "<AXIS NAME>".
Seed idea: "<SEED>"

Produce an IMPROVED variant of this idea, optimizing specifically for your axis:
<one-line axis description>.

Return EXACTLY this structure:
VARIANT: <one tight paragraph — the improved idea, specific and concrete>
RATIONALE: <2-4 sentences: why these changes make it stronger on your axis>
SELF-WEAKNESS: <the single biggest weakness a critic would attack in YOUR variant>

Be bold and genuinely divergent — do not just reword the seed. Do not hedge.
```

Axes (full): 1 Sharpen core value · 2 Maximize differentiation · **3 Minimize feasibility/cost risk** · 4 Attack & repair core assumption · 5 Expand opportunity · 6 Narrow to a wedge · 7 Maximize defensibility · 8 Radical reframe. (Lite: 1, 3, 4, 8.)

Collect all VARIANT/RATIONALE/SELF-WEAKNESS blocks. **Log all N variants verbatim** under "Round 0 — Contenders".

---

## Step 2 — Pre-screen, seed champion-zero, freeze the reserve (1 Opus call)
Spawn ONE agent over all N variants:

```
You are the PRE-SCREEN. Below are <N> improved variants of one seed idea.
Seed: "<SEED>"
<for each k: Variant #k (axis <axis>): "<text>">

Rubric — score each variant 1-5 on each, quoting the verbatim rubric line:
- "Impact — if true, it materially changes outcomes for the named target user, not a marginal nicety."
- "Feasibility & cost — it can be built and shipped with realistic resources, and the cost/effort risk of standing it up is low."
- "Robustness — it survives the strongest objection an adversary would raise."
- "Defensibility — it is hard for a competitor to copy or for time to erode."
- "Clarity — it is specific and unambiguous, with a concrete user and mechanism, not hand-wavy."

Return:
RANKING: an ordered list from strongest to weakest, each with its summed score (max 25) and a one-line reason.
CHAMPION-ZERO: the #1 variant's number.
```

From the result:
- **champion-zero** = the named #1. It becomes the champion and the running-merge base.
- **RESERVE** = copy champion-zero's text verbatim into a frozen field. **Never edit the reserve.**
- **Challenger queue** = the remaining N−1 variants in *descending* rank order (strongest challenger first).
- Initialize an **empty GRAFT LEDGER** on the champion.

Log under "Seed": the full ranking, champion-zero, the reserve text, the challenger order, and an honesty note that the pre-screen is a single unverified judgment backstopped only by the audit rung (Step 4).

---

## Step 3 — The ladder (one gated call per rung)
For each challenger in queue order, run a rung. **The champion always holds the hill and only accumulates; challengers are graft sources, never replacements.**

### 3a. The rung call (1 Opus agent) — ordered, gated chain
```
You are the RUNG JUDGE-SYNTHESIZER for rung <R>. Work the steps IN ORDER; do not skip or reorder. Label every block exactly as shown.

CHAMPION (the standing, accumulated idea):
"<champion text>"
GRAFT LEDGER (mechanisms already grafted — the champion must not contradict ANY of these):
<ledger lines, or "empty">
CHALLENGER #<k> (axis "<axis>"):
"<challenger text>"

Rubric — score 1-5; for EACH criterion you MUST quote the verbatim rubric line AND cite the steelman point that justifies the score:
- "Impact — if true, it materially changes outcomes for the named target user, not a marginal nicety."
- "Feasibility & cost — it can be built and shipped with realistic resources, and the cost/effort risk of standing it up is low."
- "Robustness — it survives the strongest objection raised against it in this rung's steelman."
- "Defensibility — it is hard for a competitor to copy or for time to erode."
- "Clarity — it is specific and unambiguous, with a concrete user and mechanism, not hand-wavy."

(a) STEELMAN-BOTH: one strong, honest paragraph FOR the champion and one FOR the challenger.
(b) SCORES: a table scoring CHAMPION and CHALLENGER 1-5 on each criterion. Each row quotes its verbatim rubric line and cites the steelman point. Sum each (max 25).
(c) WINNER: name CHAMPION or CHALLENGER. State MARGIN = winner_sum − loser_sum. One-sentence dominance assertion. (The named winner MUST be the higher-sum side. If you named the lower-sum side, you erred — correct it before continuing.)
(d) LOSER-SALVAGE: from the LOSER, give (i) the single strongest VALID OBJECTION it raises against the winner, and (ii) the single strongest MECHANISM from the loser that is mutually compatible with the CHAMPION and every ledger entry. If nothing is compatible, output exactly "NOTHING-COMPATIBLE" and STOP here.
(e) MERGE: graft BOTH the objection-fix and the compatible mechanism INTO THE CHAMPION (never the challenger).
    BEFORE: <champion text>
    AFTER: <merged champion — one tight paragraph>
    GRAFT: <one line naming the mechanism grafted and the guard it must not violate>
    LEDGER-CHECK: for EACH existing ledger entry, output "NON-CONTRADICTION: [<id>] ok" OR "CONFLICT: [<id>] — <why>".
    CHANGE: <one line: what changed and why it answers the objection>
(f) PREDECESSOR-AUDIT: re-score the AFTER champion vs the BEFORE (predecessor) champion on the 5 criteria. Output MERGED-SUM=<x> PREDECESSOR-SUM=<y> and VERDICT: "MATCH-OR-BEAT" (x ≥ y) or "REGRESSION".
```

**Orchestrator handling, in order:**

1. **Self-consistency retry (max once):** if (c)'s named winner is not the higher-sum side, re-spawn the identical rung call once. If it still contradicts itself, take the higher-sum side as winner and note it.

2. **Calibration (the noise floor = ~1 summed point):**
   - **MARGIN ≥ 2:** certify the verdict.
   - **MARGIN ≤ 1:** spawn ONE **swapped-position recheck** (3c) with the prior verdict hidden. **Agrees** → certify. **Disagrees** → variance: **incumbency holds**, the CHAMPION is the recorded rung winner.

3. **Salvage gate:** if (d) is `NOTHING-COMPATIBLE`, the champion is unchanged this rung; log the verdict and move on.

4. **Ledger conflict → escape-hatch resolve (3d, +1 call):** if any (e) LEDGER-CHECK row is `CONFLICT`, spawn the resolve-edit call. It keeps the stronger graft, drops/reconciles the weaker, and updates the ledger. The resolved AFTER replaces the raw AFTER, then continue to step 5.

5. **Predecessor audit → rollback:** if (f) is `REGRESSION`, confirm with ONE independent swapped predecessor judgment (3e, +1 call). If confirmed, **ROLL BACK**: champion reverts to BEFORE, the graft is discarded, the ledger is unchanged — **but the rung winner is still recorded**. If the confirm says MATCH-OR-BEAT, the merge stands.

6. **On a standing non-no-op merge:** set champion = AFTER and **append the graft to the ledger** (`[id] rung R, challenger #k (axis): <mechanism> — must not contradict: <guard>`).

Log per rung: both steelmans, the scores table with quoted rubric lines, winner + margin, any swapped recheck, the salvage, the merge BEFORE/AFTER/GRAFT/LEDGER-CHECK/CHANGE, any conflict resolution, the predecessor audit verdict, and any rollback.

### 3b. (reference) Cost per rung
1 call (clean, dominant rung) · +1 if contested (margin ≤ 1, swapped recheck) · +1 if a ledger conflict needs resolving OR a regression needs the confirm-and-rollback. Capped at ~3 — well under a debate's six.

### 3c. Swapped-position recheck prompt (1 agent)
```
You are a FRESH, independent judge. Two ideas, X and Y (no incumbent — judge them on the merits alone).
X: "<the side that was listed SECOND in the rung, now first>"
Y: "<the side that was listed FIRST in the rung, now second>"
Score each 1-5 on the 5 criteria (quote each verbatim rubric line), sum each (max 25). Name the higher-sum idea as WINNER with its MARGIN. Do not reference any prior judgment.
```
Map X/Y back to champion/challenger. "Agree" = same side as the rung verdict.

### 3d. Escape-hatch resolve-edit prompt (1 agent)
```
A new graft conflicts with an existing one in the running merge. Resolve it; do not let both stand in contradiction.
CHAMPION (post-merge, contains the conflict): "<AFTER text>"
GRAFT LEDGER: <ledger lines>
NEW GRAFT: <the (e) GRAFT line>
CONFLICT(S): <the CONFLICT rows from LEDGER-CHECK>

Decide which graft is stronger on the 5 criteria. Then rewrite the champion so the contradiction is gone:
RESOLUTION: keep <stronger> / drop or reconcile <weaker> — and why.
AFTER: <rewritten champion, one tight paragraph, internally consistent>
LEDGER-UPDATE: the corrected ledger lines (mark any dropped/merged entries).
```

### 3e. Independent predecessor-audit confirm prompt (1 agent)
```
You are an independent judge. Decide if the MERGED idea regressed against its PREDECESSOR.
PREDECESSOR: "<BEFORE text>"   MERGED: "<AFTER text>"
Score each 1-5 on the 5 criteria (quote each verbatim rubric line), sum each. 
VERDICT: "MATCH-OR-BEAT" if MERGED-SUM ≥ PREDECESSOR-SUM, else "REGRESSION". State both sums.
```

Repeat Step 3 for every challenger in queue order until the ladder is done.

---

## Step 4 — The audit rung (mandatory, 1 agent) — the floor guarantee
Pit the accumulated champion against the frozen reserve as a real challenger:
```
AUDIT RUNG. Decide whether the ACCUMULATED CHAMPION earned its place over the RESERVED BEST ORIGINAL (frozen, never grafted).
CHAMPION: "<accumulated champion text>"
RESERVED ORIGINAL: "<reserve text>"
Score each 1-5 on the 5 criteria (quote each verbatim rubric line), sum each (max 25).
Output: scores table, MARGIN = champion_sum − original_sum, and SHIP.
SHIP = CHAMPION only if MARGIN ≥ 2 (clears the noise floor); otherwise SHIP = RESERVED-ORIGINAL.
One-line justification.
```
- **MARGIN ≥ 2:** ship the champion.
- **MARGIN ≤ 1:** one swapped recheck (3c, champion vs reserve). If it still does not clear ≥ 2, **ship the RESERVED ORIGINAL.**

Log under "Audit Rung": scores, margin, swapped recheck if any, and the SHIP decision. This is the measured gate behind the claim "no worse than the best original."

---

## Step 5 — Assemble output
Append to the log and present:
1. **Hardened idea** — the shipped text (champion, or reserve if it failed the audit).
2. **Before -> after summary** — seed vs. shipped + the 2-4 pivotal changes, each tagged with the rung/objection/graft that caused it, and the **audit-rung margin** stated explicitly.
3. **Graft ledger** — every accepted graft, every conflict resolved, every merge rolled back.
4. **Ladder map** — champion-zero, challenger order, and per-rung winner/margin.
5. **Open risks & honesty notes** — residual path dependence (order shaped which mechanisms compounded; not a global optimum), any no-op/rollback pattern, echo-chamber caveat, and whether the audit shipped the champion or fell back to the reserve.
Point the user to the saved transcript path.

---

## Log file skeleton (`./idea-forge-runs/YYYY-MM-DD-<slug>.md`)
```markdown
# idea-forge run — <slug>
Date: <YYYY-MM-DD> · Mode: <full|lite> · Seed: "<seed>"

## Round 0 — Contenders
### Contender #k (axis: <name>)
VARIANT / RATIONALE / SELF-WEAKNESS

## Seed
Pre-screen RANKING (scores) · CHAMPION-ZERO: #k · RESERVE (frozen text) · Challenger order · Honesty note

## Ladder
### Rung R — Champion vs Challenger #k (axis)
(a) Steelman champion / Steelman challenger
(b) Scores table (quoted rubric lines + steelman cites)
(c) Winner · MARGIN · dominance  [· swapped recheck: agree/disagree → certified/incumbency-holds]
(d) Loser-salvage: OBJECTION · MECHANISM   (or NOTHING-COMPATIBLE)
(e) Merge: BEFORE -> AFTER · GRAFT · LEDGER-CHECK · CHANGE   [· conflict resolution]
(f) Predecessor audit: MERGED-SUM / PREDECESSOR-SUM · VERDICT   [· rollback]
Ledger now: <lines>
... (repeat per rung) ...

## Audit Rung
Champion vs Reserved Original · scores · MARGIN · [swapped recheck] · SHIP: <champion|reserved-original>

## Result
Hardened idea · Before->after summary (with audit margin) · Graft ledger · Ladder map · Open risks
```

A JSON sidecar (`<same-name>.json`) is optional but recommended: `{ seed, mode, contenders[], preScreen{ranking,championZero,reserve}, ledger[], rungs[ { challenger, steelmans, scores, winner, margin, swappedRecheck?, salvage, merge{before,after,graft,ledgerCheck,change,resolution?}, predecessorAudit{mergedSum,predSum,verdict,rollback?} } ], auditRung{scores,margin,ship}, result }`.

---

## Operator checklist
- [ ] One seed, cost stated, go-ahead received, log initialized.
- [ ] N contenders spawned with DISTINCT axes (incl. "Minimize feasibility/cost risk"); all variants logged verbatim.
- [ ] Pre-screen ran: champion-zero named, reserve frozen, challengers ordered strongest-first, ledger initialized empty.
- [ ] Each rung = one gated call; winner names higher-sum side (retry once if not); rubric lines quoted; margin computed.
- [ ] Margin ≤ 1 triggered a swapped recheck; incumbency held on disagreement.
- [ ] Every non-no-op merge asserted ledger non-contradiction; conflicts forced a resolve-edit and ledger update.
- [ ] Every non-no-op merge passed the predecessor audit or was rolled back (winner still recorded).
- [ ] Champion never wholesale-replaced by a challenger — only accumulated.
- [ ] Audit rung ran: champion ships only if it cleared the noise floor over the reserve, else the reserve shipped.
- [ ] Output = hardened idea + before->after (with audit margin) + graft ledger + ladder map + open risks + saved transcript path.