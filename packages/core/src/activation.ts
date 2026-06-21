/**
 * Activation detector + confusion matrix (Ticket 1.3).
 *
 * Given one or more {@link RunTrace}s and a target {@link ArtifactRef}, decide
 * whether the target artifact FIRED, and classify HOW (the right skill, a wrong
 * skill, via a plugin command, a subagent dispatch, or not at all). Over a
 * suite's cases (each with `shouldActivate`), roll the per-case decisions into a
 * {@link ConfusionMatrix} + precision/recall/F1.
 *
 * Pure functions only — no I/O. Activation is read directly from the transcript
 * tool_uses (verified ground truth, see docs/spike-findings.md), not heuristics.
 */

import type { ArtifactRef } from './eval.js';
import type { RunTrace, ToolUse, ConfusionMatrix } from './result.js';

/** How the target artifact was (or was not) activated in a set of traces. */
export type ActivationKind =
  /** The exact target skill fired (name matches). */
  | 'skill-fired'
  /** A Skill tool_use fired, but for a DIFFERENT skill than the target. */
  | 'wrong-skill'
  /** The target subagent was dispatched (Task/Agent with matching subagent_type). */
  | 'subagent-fired'
  /** Activation attributable to a plugin command (a slash-command tool_use). */
  | 'plugin-command'
  /** Nothing matching the target fired. */
  | 'not-fired';

/** Detailed activation outcome for one target over one or more traces. */
export interface ActivationDecision {
  /** Whether the TARGET artifact specifically fired. */
  fired: boolean;
  /** The most specific classification of what happened. */
  kind: ActivationKind;
  /** The skill name that fired, if any Skill tool_use was seen (target or not). */
  firedSkill?: string;
  /** The subagent type dispatched, if any Task/Agent tool_use was seen. */
  firedSubagentType?: string;
}

/** Collect every trace's tool uses into one ordered list. */
function allToolUses(traces: RunTrace | RunTrace[]): ToolUse[] {
  const list = Array.isArray(traces) ? traces : [traces];
  const out: ToolUse[] = [];
  for (const t of list) out.push(...t.toolUses);
  return out;
}

/** The slash-command-style tool name a plugin command surfaces as, if any. */
function isPluginCommandToolUse(tu: ToolUse, ref: ArtifactRef): boolean {
  // Plugin commands appear as a SlashCommand tool_use whose input names the
  // command. We treat any SlashCommand referencing the plugin's name (or, for a
  // plugin artifact, the plugin itself) as a plugin-command activation.
  if (tu.name !== 'SlashCommand' && tu.name !== 'Command') return false;
  const cmd =
    (typeof tu.input['command'] === 'string' && (tu.input['command'] as string)) ||
    (typeof tu.input['name'] === 'string' && (tu.input['name'] as string)) ||
    '';
  if (cmd.length === 0) return false;
  const needle = ref.name.toLowerCase();
  return cmd.toLowerCase().includes(needle);
}

/**
 * Decide whether `ref` fired across `traces`, and classify how. The target's
 * `name` is matched against Skill `skill` / Task `subagent_type` exactly.
 */
export function detectActivation(
  traces: RunTrace | RunTrace[],
  ref: ArtifactRef,
): ActivationDecision {
  const uses = allToolUses(traces);

  // First pass: gather what we saw, for diagnostics + wrong-skill detection.
  let firedSkill: string | undefined;
  let firedSubagentType: string | undefined;
  for (const tu of uses) {
    if (tu.name === 'Skill' && tu.skill !== undefined && firedSkill === undefined) {
      firedSkill = tu.skill;
    }
    if (
      (tu.name === 'Task' || tu.name === 'Agent') &&
      tu.subagentType !== undefined &&
      firedSubagentType === undefined
    ) {
      firedSubagentType = tu.subagentType;
    }
  }

  const base: Pick<ActivationDecision, 'firedSkill' | 'firedSubagentType'> = {
    ...(firedSkill !== undefined ? { firedSkill } : {}),
    ...(firedSubagentType !== undefined ? { firedSubagentType } : {}),
  };

  if (ref.kind === 'skill') {
    const exact = uses.some((tu) => tu.name === 'Skill' && tu.skill === ref.name);
    if (exact) return { fired: true, kind: 'skill-fired', ...base };
    // A plugin command can be the legitimate activation path for a skill that
    // ships in a plugin (e.g. `/anvil-eval` drives a skill).
    const viaCommand = uses.some((tu) => isPluginCommandToolUse(tu, ref));
    if (viaCommand) return { fired: true, kind: 'plugin-command', ...base };
    if (firedSkill !== undefined) return { fired: false, kind: 'wrong-skill', ...base };
    return { fired: false, kind: 'not-fired', ...base };
  }

  if (ref.kind === 'subagent') {
    const exact = uses.some(
      (tu) => (tu.name === 'Task' || tu.name === 'Agent') && tu.subagentType === ref.name,
    );
    if (exact) return { fired: true, kind: 'subagent-fired', ...base };
    return { fired: false, kind: 'not-fired', ...base };
  }

  // plugin artifact: fired if any of its surfaces activated — a plugin command,
  // or (best-effort) a skill/subagent we can attribute to it by name match.
  const viaCommand = uses.some((tu) => isPluginCommandToolUse(tu, ref));
  if (viaCommand) return { fired: true, kind: 'plugin-command', ...base };
  const viaSubagent = uses.some(
    (tu) => (tu.name === 'Task' || tu.name === 'Agent') && tu.subagentType === ref.name,
  );
  if (viaSubagent) return { fired: true, kind: 'subagent-fired', ...base };
  const viaSkill = uses.some((tu) => tu.name === 'Skill' && tu.skill === ref.name);
  if (viaSkill) return { fired: true, kind: 'skill-fired', ...base };
  return { fired: false, kind: 'not-fired', ...base };
}

// ---------------------------------------------------------------------------
// Confusion matrix over a suite
// ---------------------------------------------------------------------------

/** One case's activation ground truth + observed traces. */
export interface ActivationCase {
  caseId: string;
  /** Ground truth: should the target fire for this case? */
  shouldActivate: boolean;
  /** The traces produced for this case (treatment run; may be several reps). */
  traces: RunTrace | RunTrace[];
}

/** Per-case activation result, surfaced for drill-down. */
export interface CaseActivation {
  caseId: string;
  shouldActivate: boolean;
  fired: boolean;
  /** True iff `fired === shouldActivate`. */
  correct: boolean;
  kind: ActivationKind;
}

/** The full confusion result: matrix + per-case detail. */
export interface ActivationResult {
  confusion: ConfusionMatrix;
  perCase: CaseActivation[];
}

/**
 * Compute the activation {@link ConfusionMatrix} over a suite's cases.
 * - TP: shouldActivate && fired
 * - FP: !shouldActivate && fired      (offending id recorded)
 * - TN: !shouldActivate && !fired
 * - FN: shouldActivate && !fired      (offending id recorded)
 */
export function computeConfusion(cases: ActivationCase[], ref: ArtifactRef): ActivationResult {
  let truePositive = 0;
  let falsePositive = 0;
  let trueNegative = 0;
  let falseNegative = 0;
  const falsePositiveCaseIds: string[] = [];
  const falseNegativeCaseIds: string[] = [];
  const perCase: CaseActivation[] = [];

  for (const c of cases) {
    const decision = detectActivation(c.traces, ref);
    const fired = decision.fired;
    const correct = fired === c.shouldActivate;
    perCase.push({
      caseId: c.caseId,
      shouldActivate: c.shouldActivate,
      fired,
      correct,
      kind: decision.kind,
    });

    if (c.shouldActivate && fired) truePositive += 1;
    else if (!c.shouldActivate && fired) {
      falsePositive += 1;
      falsePositiveCaseIds.push(c.caseId);
    } else if (!c.shouldActivate && !fired) trueNegative += 1;
    else {
      falseNegative += 1;
      falseNegativeCaseIds.push(c.caseId);
    }
  }

  return {
    confusion: {
      truePositive,
      falsePositive,
      trueNegative,
      falseNegative,
      falsePositiveCaseIds,
      falseNegativeCaseIds,
    },
    perCase,
  };
}

/** Precision/recall/F1 derived from a confusion matrix. */
export interface ActivationMetrics {
  precision: number;
  recall: number;
  f1: number;
  /** TP+FP — denominator of precision (predicted-positive count). */
  predictedPositive: number;
  /** TP+FN — denominator of recall (actual-positive count). */
  actualPositive: number;
}

/**
 * Precision = TP/(TP+FP); Recall = TP/(TP+FN); F1 = harmonic mean.
 * Edge cases follow the standard convention: a 0/0 ratio is reported as 1 when
 * there were no errors of that type (vacuously perfect), else 0. F1 is 0 when
 * precision+recall is 0.
 */
export function confusionMetrics(m: ConfusionMatrix): ActivationMetrics {
  const predictedPositive = m.truePositive + m.falsePositive;
  const actualPositive = m.truePositive + m.falseNegative;
  const precision = predictedPositive === 0 ? 1 : m.truePositive / predictedPositive;
  const recall = actualPositive === 0 ? 1 : m.truePositive / actualPositive;
  const f1 = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);
  return { precision, recall, f1, predictedPositive, actualPositive };
}
