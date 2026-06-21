import { z } from 'zod';
import { ArtifactRefSchema } from './eval.js';

/**
 * Anvil result contract (Ticket 1.1) — THE FROZEN CONTRACT for the UI.
 *
 * This module models everything produced by a run, from the raw transcript
 * (`RunTrace`) recovered from the session JSONL, through per-metric scores
 * (`MetricResult`) that always carry spread, up to the per-run `Scorecard`,
 * the `RunIndexEntry`, and the `index.json` shape the UI lists from.
 *
 * The `RunTrace` shape is designed to losslessly represent the transcript
 * facts verified in docs/spike-findings.md:
 *   - ordered events,
 *   - tool uses with name + input (incl. Skill/Agent activation),
 *   - per-message usage incl. cache_creation/cache_read token fields,
 *   - the final assistant text,
 *   - plugin load errors.
 *
 * Additive changes only without a `RESULT_SCHEMA_VERSION` bump.
 */

/** Current result-contract schema version. Bump on any breaking change. */
export const RESULT_SCHEMA_VERSION = 1 as const;

// ---------------------------------------------------------------------------
// RunTrace — normalized view of a session/subagent transcript
// ---------------------------------------------------------------------------

/**
 * Token usage for a single assistant message. Cache fields are present in real
 * transcripts (see spike-findings.md) and are required for accurate cost; they
 * default to 0 when a transcript omits them.
 */
export const UsageSchema = z
  .object({
    inputTokens: z.number().int().nonnegative(),
    outputTokens: z.number().int().nonnegative(),
    cacheCreationInputTokens: z.number().int().nonnegative().default(0),
    cacheReadInputTokens: z.number().int().nonnegative().default(0),
  })
  .strict();
export type Usage = z.infer<typeof UsageSchema>;

/**
 * A single tool invocation recovered from the transcript. `name` is the tool
 * name (e.g. "Skill", "Agent"/"Task", "Read", "WebFetch"); `input` is the raw
 * tool input object verbatim. `skill` and `subagentType` are convenience
 * fields lifted from `input` for the two activation-relevant tools so the
 * activation detector (Ticket 1.3) need not re-parse `input`.
 */
export const ToolUseSchema = z
  .object({
    /** Tool-use id from the transcript, if present. */
    id: z.string().optional(),
    name: z.string().min(1),
    /** Raw tool input; shape varies by tool, kept verbatim. */
    input: z.record(z.unknown()).default({}),
    /** Set when `name` === "Skill": the activated skill's name. */
    skill: z.string().optional(),
    /** Set when `name` is "Agent"/"Task": the dispatched subagent type. */
    subagentType: z.string().optional(),
  })
  .strict();
export type ToolUse = z.infer<typeof ToolUseSchema>;

/** Kind of an ordered transcript event. */
export const TraceEventKindSchema = z.enum([
  'user',
  'assistant',
  'tool_use',
  'tool_result',
  'system',
]);
export type TraceEventKind = z.infer<typeof TraceEventKindSchema>;

/**
 * One ordered event in the trace. Kept deliberately loose (`detail` is freeform)
 * so the introspection lib (Ticket 1.2) can preserve transcript nuance without
 * the contract churning. `toolUse` is populated for `tool_use` events.
 */
export const TraceEventSchema = z
  .object({
    /** Monotonic index within the trace (0-based). */
    index: z.number().int().nonnegative(),
    kind: TraceEventKindSchema,
    /** ISO-8601 timestamp if the transcript carried one. */
    timestamp: z.string().optional(),
    /** Text payload for user/assistant/system events. */
    text: z.string().optional(),
    /** Populated when kind === "tool_use". */
    toolUse: ToolUseSchema.optional(),
    /** Usage attached to this event's message, if any. */
    usage: UsageSchema.optional(),
    /** Anything else worth preserving from the raw line. */
    detail: z.record(z.unknown()).optional(),
  })
  .strict();
export type TraceEvent = z.infer<typeof TraceEventSchema>;

/** A plugin load error surfaced by the session. */
export const PluginErrorSchema = z
  .object({
    plugin: z.string().min(1),
    message: z.string().min(1),
  })
  .strict();
export type PluginError = z.infer<typeof PluginErrorSchema>;

/**
 * Normalized transcript of a single run (a main session OR a subagent session).
 * This is the introspection output and the UI's source for the tool-use timeline.
 */
export const RunTraceSchema = z
  .object({
    /** "main" for the parent session, or the dispatched agentId for a subagent. */
    agentId: z.string().min(1),
    /** Session id the trace belongs to. */
    sessionId: z.string().min(1).optional(),
    /** True when this trace is a dispatched subagent rather than the main session. */
    isSubagent: z.boolean().default(false),
    /** Ordered events. */
    events: z.array(TraceEventSchema).default([]),
    /**
     * Flattened tool uses in order — a convenience view over `events` for the
     * activation detector. Mirrors the `toolUse` of each `tool_use` event.
     */
    toolUses: z.array(ToolUseSchema).default([]),
    /** Summed usage across all assistant messages in this trace. */
    totalUsage: UsageSchema,
    /** The final assistant text (the run's "answer"). */
    finalText: z.string().default(''),
    /** Plugin load errors observed, if any. */
    pluginErrors: z.array(PluginErrorSchema).default([]),
  })
  .strict();
export type RunTrace = z.infer<typeof RunTraceSchema>;

// ---------------------------------------------------------------------------
// MetricResult — never a bare number; always carries spread
// ---------------------------------------------------------------------------

/**
 * A confidence interval. `level` is the nominal coverage (e.g. 0.95).
 * `lower`/`upper` bound the estimate.
 */
export const ConfidenceIntervalSchema = z
  .object({
    level: z.number().gt(0).lt(1),
    lower: z.number(),
    upper: z.number(),
  })
  .strict()
  .refine((ci) => ci.lower <= ci.upper, {
    message: 'confidence interval lower must be <= upper',
  });
export type ConfidenceInterval = z.infer<typeof ConfidenceIntervalSchema>;

/**
 * The result of one metric. The `value` is the point estimate; it is ALWAYS
 * accompanied by spread (`ci` and/or `stdDev`) and the sample size `n`, so the
 * UI can never render a bare number without uncertainty.
 */
export const MetricResultSchema = z
  .object({
    /** Metric identifier, e.g. "activation.f1", "quality.delta", "cost.tokens". */
    metric: z.string().min(1),
    /** Point estimate. */
    value: z.number(),
    /** Unit hint for display, e.g. "ratio", "tokens", "usd", "ms". */
    unit: z.string().min(1).optional(),
    /** Number of samples behind the estimate. */
    n: z.number().int().nonnegative(),
    /** Standard deviation across samples, when applicable. */
    stdDev: z.number().nonnegative().optional(),
    /** Confidence interval for the estimate. */
    ci: ConfidenceIntervalSchema.optional(),
  })
  .strict()
  .refine((m) => m.n <= 1 || m.ci !== undefined || m.stdDev !== undefined, {
    message: 'a metric with n > 1 must carry spread (ci or stdDev) — never a bare number',
  });
export type MetricResult = z.infer<typeof MetricResultSchema>;

// ---------------------------------------------------------------------------
// Activation confusion matrix (lifted into the scorecard for the UI)
// ---------------------------------------------------------------------------

/** Activation confusion matrix over a suite's buckets, with offending case ids. */
export const ConfusionMatrixSchema = z
  .object({
    truePositive: z.number().int().nonnegative(),
    falsePositive: z.number().int().nonnegative(),
    trueNegative: z.number().int().nonnegative(),
    falseNegative: z.number().int().nonnegative(),
    /** Case ids the artifact wrongly fired on (false positives). */
    falsePositiveCaseIds: z.array(z.string()).default([]),
    /** Case ids the artifact failed to fire on (false negatives). */
    falseNegativeCaseIds: z.array(z.string()).default([]),
  })
  .strict();
export type ConfusionMatrix = z.infer<typeof ConfusionMatrixSchema>;

// ---------------------------------------------------------------------------
// Per-case result
// ---------------------------------------------------------------------------

/** Verdict of the pairwise LLM judge for a case (treatment vs baseline). */
export const JudgeVerdictSchema = z.enum(['treatment', 'baseline', 'tie']);
export type JudgeVerdict = z.infer<typeof JudgeVerdictSchema>;

/** One pairwise judge sample (one rep, possibly position-swapped). */
export const JudgeSampleSchema = z
  .object({
    verdict: JudgeVerdictSchema,
    /** Whether treatment was shown as option B (position swapped) for this sample. */
    swapped: z.boolean().default(false),
    rationale: z.string().optional(),
  })
  .strict();
export type JudgeSample = z.infer<typeof JudgeSampleSchema>;

/** Result for a single case (rolled up across its repetitions). */
export const CaseResultSchema = z
  .object({
    caseId: z.string().min(1),
    /** Whether the target artifact actually fired (ground truth from the trace). */
    activated: z.boolean(),
    /** Whether activation matched the case's `shouldActivate` expectation. */
    activationCorrect: z.boolean(),
    /** Deterministic-expectation outcome: true iff all expectations passed. */
    expectationsPassed: z.boolean(),
    /** Per-expectation pass flags, in suite order. */
    expectationResults: z.array(z.boolean()).default([]),
    /** Pairwise judge samples across reps (empty for non-judged cases). */
    judgeSamples: z.array(JudgeSampleSchema).default([]),
    /** agentId of the treatment run trace, for drill-down. */
    treatmentTraceId: z.string().optional(),
    /** agentId of the baseline run trace, for drill-down. */
    baselineTraceId: z.string().optional(),
  })
  .strict();
export type CaseResult = z.infer<typeof CaseResultSchema>;

// ---------------------------------------------------------------------------
// Scorecard — the headline result of one run
// ---------------------------------------------------------------------------

/** The aggregated result of one eval run. */
export const ScorecardSchema = z
  .object({
    schemaVersion: z.literal(RESULT_SCHEMA_VERSION),
    /** Unique id for this run (also the results/<runId>.json filename stem). */
    runId: z.string().min(1),
    /** Suite name this run scored. */
    suiteName: z.string().min(1),
    /** The artifact under test (copied from the suite for self-contained results). */
    artifact: ArtifactRefSchema,
    /** ISO-8601 timestamp the run completed. */
    createdAt: z.string().min(1),
    judgeModel: z.string().min(1),
    runModel: z.string().min(1),
    repetitions: z.number().int().positive(),
    /** Headline metrics — each carries spread. Keyed by metric id for lookup. */
    metrics: z.record(MetricResultSchema),
    /** Activation confusion matrix across the suite. */
    confusion: ConfusionMatrixSchema,
    /** Per-case results for drill-down. */
    cases: z.array(CaseResultSchema).default([]),
    /** True if any plugin load error was observed during the run. */
    pluginLoadOk: z.boolean().default(true),
    /** Plugin load errors aggregated across traces. */
    pluginErrors: z.array(PluginErrorSchema).default([]),
    /**
     * Optional improvement-delta back-reference: the runId this run is being
     * compared against (set by the improvement loop, Epic 5).
     */
    comparedToRunId: z.string().optional(),
  })
  .strict();
export type Scorecard = z.infer<typeof ScorecardSchema>;

// ---------------------------------------------------------------------------
// Run index — results/index.json
// ---------------------------------------------------------------------------

/** A lightweight summary of one run, for listing without loading the full JSON. */
export const RunIndexEntrySchema = z
  .object({
    runId: z.string().min(1),
    suiteName: z.string().min(1),
    /** Artifact kind + name for quick filtering in the UI. */
    artifactKind: z.enum(['skill', 'subagent', 'plugin']),
    artifactName: z.string().min(1),
    createdAt: z.string().min(1),
    /** Headline metric values (point estimates only) for the leaderboard. */
    headline: z
      .object({
        activationF1: z.number().optional(),
        qualityDelta: z.number().optional(),
        costTokens: z.number().optional(),
      })
      .strict()
      .default({}),
    /** Relative path to the full result JSON, e.g. "demo/<runId>.json". */
    resultPath: z.string().min(1),
  })
  .strict();
export type RunIndexEntry = z.infer<typeof RunIndexEntrySchema>;

/** The `results/index.json` shape the UI lists runs from. */
export const RunIndexSchema = z
  .object({
    schemaVersion: z.literal(RESULT_SCHEMA_VERSION),
    /** Newest-first list of run summaries. */
    runs: z.array(RunIndexEntrySchema).default([]),
  })
  .strict();
export type RunIndex = z.infer<typeof RunIndexSchema>;
