# Idea Brief — AI Coach for Intimidated Gym Beginners

_Date: 2026-06-18_

## One-line pitch
A mobile app that gives nervous gym beginners structured, AI-generated workout plans with simple in-the-moment swaps — so they actually follow through instead of feeling lost and quitting.

## Problem & evidence
Beginner/intermediate gym-goers often don't know what to do once they're at the gym, so they cobble routines from Google and Instagram, feel lost, and churn. Evidence is currently **anecdotal only** — founder has watched friends join a gym and quit within ~a month from feeling lost. No hard data yet. (Validation is therefore the priority, not the tech.)

## Target user
**Nervous newcomers to the gym** — beginner-to-early-intermediate, intimidated, currently improvising from Google/Instagram. Explicitly NOT "anyone who works out"; the focus on the intimidated-beginner segment is itself part of the strategy.

## Value proposition
The product is **structure and trust, not raw AI generation.** A beginner who won't (or can't) prompt ChatGPT and doesn't trust a chat window gets a guided, structured app that simply tells them what to do next — making it feel safe enough to follow.

## Scope
**MVP (build first):**
- Structured beginner workout plans (AI-generated up front).
- Basic exercise swaps (e.g., equipment busy / substitute movement).
- Guided, low-intimidation UX a non-prompter will actually follow.

**Explicitly OUT of scope for MVP (hold back until trust/retention is proven):**
- Real-time in-session adaptation engine (equipment-busy / low-energy day rebuilds).
- Wearable/recovery-score integration.
- Broader audiences beyond nervous beginners.

## Differentiation
Incumbents (Fitbod, Freeletics, Caliber, JuggernautAI) and ChatGPT itself already generate adaptive plans. The wedge is **(1)** beginner-only focus — the segment incumbents underserve because it's their least lucrative — and **(2)** trust/structure UX rather than a plan-generator or chat window. Longer-term hypothesis: **real-time in-session adaptation** (equipment busy / low-energy day) as a differentiator — recorded as a hypothesis to validate, NOT proven.

## Key risks & assumptions
- **[OPEN — killer assumption]** Intimidated beginners will trust an app's in-the-moment instructions enough to follow them in a busy gym instead of churning anyway. Founder agrees this is unproven. Must be tested before building the hard part.
- **[Mitigated]** "It's just a ChatGPT wrapper" → mitigated by structure/trust UX for users who won't prompt or trust a chat window.
- **[Tailwind]** Why now: cheap conversational LLMs make hand-holding affordable in a way they weren't when Fitbod launched (2015); beginner-only focus avoids incumbents' core market.
- **[Constraint]** Solo founder, frontend-capable, weak on backend/AI, small budget, ~3-month horizon → argues for a tiny MVP and against the real-time engine on day one.

## Validation plan
**Cheapest test of the killer assumption (trust → follow-through → retention):**
Before building the adaptation engine, ship/wizard-of-oz a structured beginner plan to a small group of real nervous beginners (founder's network + a beginner-fitness community). Measure whether they actually follow the prescribed sessions and come back.
**Success criteria:** a meaningful fraction of testers complete multiple guided sessions over 2–4 weeks and report feeling less lost — i.e., evidence of follow-through/retention, not just signups.

## Open questions for the design phase
- What's the minimum guided-UX pattern that makes a non-prompter follow instructions (cards? step-by-step? check-off)?
- How are plans generated and constrained for safety/quality for true beginners?
- What does "basic swap" cover in v1 without a full real-time engine?
- What's the lightest tech footprint a frontend-strong / backend-weak solo founder can ship in ~3 months?
