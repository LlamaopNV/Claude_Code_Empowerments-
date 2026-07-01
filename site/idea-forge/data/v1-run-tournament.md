# run-tournament.md — idea-forge executor playbook

The operational companion to `SKILL.md`. Follow these steps literally to run a forge. `SKILL.md` defines the rules; this file defines the exact Agent-tool spawns, prompts, and logging. All agents are spawned with the **Opus** model and **high reasoning effort**. Use the `Agent` tool; send independent spawns in a single message so they run concurrently.

---

## Step 0 — Intake & cost gate
1. Confirm there is exactly ONE seed idea. If multiple, ask which one. If too vague to attack, stop and recommend `bake-to-completion`.
2. Decide mode:
   - **Full:** 8 contenders, 7 debates, final gauntlet (~24-30 Opus calls).
   - **Lite:** 4 contenders (axes 1,2,4,8), 3 debates, final gauntlet (~10-12 calls).
3. Tell the user the call count / rough cost and get an explicit go-ahead. Default to offering lite if they hesitate.
4. Initialize the log file `./idea-forge-runs/YYYY-MM-DD-<slug>.md` with the seed and chosen mode. (Create `idea-forge-runs/` if absent.)

---

## Step 1 — Spawn the 8 contenders (parallel)
Spawn N agents in ONE message (N = 8 full, 4 lite), each with its own axis. Use `subagent_type: general-purpose` (or any Opus-capable type), `model: opus`. Prompt template per contender:

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

Axes (full): 1 Sharpen core value · 2 Maximize differentiation · 3 Minimize feasibility risk · 4 Attack & repair core assumption · 5 Expand opportunity · 6 Narrow to a wedge · 7 Maximize defensibility · 8 Radical reframe.

Collect all VARIANT/RATIONALE/SELF-WEAKNESS blocks. Seed them 1..N in axis order. **Log all N variants verbatim** under "Round 0 — Contenders".

---

## Step 2 — Run each debate (per pair)
Bracket pairings:
- 8-entry: R1 = (1v8)(2v7)(3v6)(4v5); R2 = (W1v8 vs W4v5)(W2v7 vs W3v6); Final = the two R2 winners.
- 4-entry: R1 = (1v8)(2v4); Final = the two winners.

For each pair (Variant A vs Variant B):

### 2a. Debate — Exchange 1 (opening), spawn 2 agents in parallel
Prompt to each side (swap A/B):
```
DEBATE — you argue FOR Variant A, AGAINST Variant B.
Variant A: "<A text>"
Variant B: "<B text>"
Judging criteria: Impact, Feasibility, Robustness, Defensibility, Clarity.

Write your OPENING argument:
1. Why A beats B on these criteria (cite specifics).
2. The single strongest weakness in B.
Be concrete and adversarial. <=200 words.
```

### 2b. Debate — Exchange 2 (rebuttal), spawn 2 agents in parallel
Give each side BOTH openings and prompt:
```
REBUTTAL. Here is the opponent's opening attack on your variant:
"<opponent opening>"
Defend Variant <A/B> against that specific attack and reinforce your case. <=150 words.
```
Stop here — exactly 2 exchanges. Log all 4 messages under the debate.

### 2c. Judge, spawn 1 agent (panel-of-3 optional for the Final only)
```
You are the JUDGE. Decide this debate against explicit criteria.
Variant A: "<A>"   Variant B: "<B>"
Full debate transcript: <both openings + both rebuttals>

Score EACH variant 1-5 on: Impact, Feasibility, Robustness, Defensibility, Clarity. Sum each (max 25).
For each variant, QUOTE the specific line that earned its highest and lowest criterion.
Declare the winner = higher sum.
TIE-BREAK (only if equal sums, in order): (1) higher Robustness; (2) the side that raised an objection the other could not fully rebut; (3) higher Clarity. State which rule decided.
Then output WINNER, the LOSER'S SINGLE STRONGEST VALID OBJECTION (one sentence), and your scores table.
```
Log: scores table, quoted lines, winner, tie-break rule used, and the named loser-objection.

### 2d. Reinforcement carry-forward, spawn 1 agent
```
The winning variant must absorb the strongest valid objection raised against it.
Winning variant: "<winner text>"
Objection to neutralize: "<loser objection named by judge>"

Rewrite the winning variant so it incorporates/neutralizes this objection WITHOUT losing its core strength. Keep it a tight paragraph.
Return:
BEFORE: <original winner text>
AFTER: <amended text>
CHANGE: <one line: what you changed and why it answers the objection>
If the objection is already fully handled, return AFTER unchanged and CHANGE: "no-op — already addressed: <why>".
```
The **AFTER** text is what advances. Log the BEFORE->AFTER diff and CHANGE line. Track no-ops.

Repeat Step 2 for every pair in the round, then for each subsequent round, until ONE amended variant remains.

---

## Step 3 — Final gauntlet (1 agent)
```
FINAL GAUNTLET. This idea survived the tournament:
"<survivor text>"

Produce:
1. The STRONGEST steelmanned objection to it.
2. Its RISKIEST remaining assumption (kills it if false).
Then AMEND the idea to address or honestly acknowledge each.
Return:
OBJECTION / ASSUMPTION / AMENDED-IDEA (tight paragraph) / OPEN-RISKS (anything that could not be fully fixed).
```
Log under "Final Gauntlet". The AMENDED-IDEA is the final hardened output.

---

## Step 4 — Assemble output
Append to the log and present to the user:
1. **Hardened idea** — the final amended text.
2. **Before -> after summary** — seed vs. final + the 2-4 pivotal changes, each tagged with the round/objection that caused it.
3. **Bracket map** — who beat whom each round.
4. **Open risks** — from the gauntlet + any honesty notes (no-op pattern, low-divergence rounds).
Point the user to the saved transcript path.

---

## Log file skeleton (`./idea-forge-runs/YYYY-MM-DD-<slug>.md`)
```markdown
# idea-forge run — <slug>
Date: <YYYY-MM-DD> · Mode: <full|lite> · Seed: "<seed>"

## Round 0 — Contenders
### Contender #k (axis: <name>)
VARIANT / RATIONALE / SELF-WEAKNESS

## Debate R1 — #A vs #B
Opening A / Opening B / Rebuttal A / Rebuttal B
Judge: scores table · quoted lines · winner · tie-break used · loser-objection
Carry-forward: BEFORE -> AFTER · CHANGE
... (repeat per pair, per round) ...

## Final Gauntlet
Objection · Riskiest assumption · Amended idea · Open risks

## Result
Hardened idea · Before->after summary · Bracket map · Open risks
```

A JSON sidecar (`<same-name>.json`) with the same fields is optional but recommended for programmatic reuse: `{ seed, mode, contenders[], rounds[ { pair, exchanges, judge{scores,winner,objection}, carryForward{before,after,change} } ], gauntlet, result }`.

---

## Operator checklist
- [ ] One seed, cost stated, go-ahead received, log initialized.
- [ ] N contenders spawned with DISTINCT axes; all variants logged verbatim.
- [ ] Each debate = exactly 2 exchanges; judge quoted lines + named tie-break; loser-objection captured.
- [ ] Every winner carried forward via an explicit edit (no-ops flagged).
- [ ] Final gauntlet run and idea amended.
- [ ] Output = hardened idea + before->after + bracket map + open risks + saved transcript path.
