import { z } from 'zod';

/**
 * Anvil eval-suite contract (Ticket 1.1).
 *
 * An {@link EvalSuite} describes WHAT to test (a Claude Code artifact) and the
 * cases to test it with. It is authored as YAML and parsed/validated here.
 *
 * This module is half of the FROZEN CONTRACT. Downstream agents (server, UI,
 * test-data generator) build against the exported schemas and inferred types.
 * Additive changes only without a `schemaVersion` bump.
 */

/** Current eval-suite schema version. Bump on any breaking change. */
export const EVAL_SCHEMA_VERSION = 1 as const;

// ---------------------------------------------------------------------------
// ArtifactRef — discriminated union on `kind`
// ---------------------------------------------------------------------------

/**
 * Reference to a plugin a skill/subagent belongs to. `name` is the plugin's
 * manifest name; `marketplace` is an optional marketplace identifier so a
 * suite can be shared/imported across repos.
 */
export const PluginRefSchema = z
  .object({
    name: z.string().min(1, 'pluginRef.name is required'),
    marketplace: z.string().min(1).optional(),
  })
  .strict();
export type PluginRef = z.infer<typeof PluginRefSchema>;

/** A skill artifact (a `SKILL.md`-backed capability). */
export const SkillArtifactSchema = z
  .object({
    kind: z.literal('skill'),
    /** The skill's invocation name (what appears as `Skill` tool_use `skill` field). */
    name: z.string().min(1, 'skill artifact requires a name'),
    /** Path to the skill directory or SKILL.md, repo-relative. */
    path: z.string().min(1).optional(),
    /** Owning plugin, if the skill ships inside a plugin. */
    pluginRef: PluginRefSchema.optional(),
  })
  .strict();
export type SkillArtifact = z.infer<typeof SkillArtifactSchema>;

/** A subagent artifact (a specialized agent definition). */
export const SubagentArtifactSchema = z
  .object({
    kind: z.literal('subagent'),
    /** The subagent type, i.e. the `subagent_type` passed to the Task/Agent tool. */
    name: z.string().min(1, 'subagent artifact requires a name'),
    /** Path to the agent definition file, repo-relative. */
    path: z.string().min(1).optional(),
    /** Owning plugin, if the subagent ships inside a plugin. */
    pluginRef: PluginRefSchema.optional(),
    /**
     * Baseline subagent to A/B against. Defaults to the built-in
     * `general-purpose` agent when omitted.
     */
    baselineSubagent: z.string().min(1).default('general-purpose'),
  })
  .strict();
export type SubagentArtifact = z.infer<typeof SubagentArtifactSchema>;

/** A whole-plugin artifact (load integrity + an end-to-end command case). */
export const PluginArtifactSchema = z
  .object({
    kind: z.literal('plugin'),
    /** The plugin manifest name. */
    name: z.string().min(1, 'plugin artifact requires a name'),
    /** Path to the plugin directory, repo-relative. */
    path: z.string().min(1).optional(),
    /** Marketplace the plugin is registered in, if any. */
    marketplace: z.string().min(1).optional(),
  })
  .strict();
export type PluginArtifact = z.infer<typeof PluginArtifactSchema>;

/** Discriminated union identifying the artifact under test. */
export const ArtifactRefSchema = z.discriminatedUnion('kind', [
  SkillArtifactSchema,
  SubagentArtifactSchema,
  PluginArtifactSchema,
]);
export type ArtifactRef = z.infer<typeof ArtifactRefSchema>;

// ---------------------------------------------------------------------------
// Expectation — discriminated union on `type`
// ---------------------------------------------------------------------------

/**
 * A deterministic, ground-truth assertion evaluated against a run's output or
 * filesystem side effects. Distinct from the LLM-judge rubric, which is
 * subjective. Expectations are how a case earns a hard pass/fail.
 */
export const ExpectationSchema = z.discriminatedUnion('type', [
  z
    .object({
      type: z.literal('regex'),
      /** RegExp source tested against the run's final text. */
      pattern: z.string().min(1),
      /** RegExp flags, e.g. "i", "m". */
      flags: z.string().optional(),
    })
    .strict(),
  z
    .object({
      type: z.literal('contains'),
      /** Substring that MUST appear in the run's final text. */
      value: z.string().min(1),
      caseSensitive: z.boolean().default(true),
    })
    .strict(),
  z
    .object({
      type: z.literal('not-contains'),
      /** Substring that MUST NOT appear in the run's final text. */
      value: z.string().min(1),
      caseSensitive: z.boolean().default(true),
    })
    .strict(),
  z
    .object({
      type: z.literal('file-exists'),
      /** Path (relative to the run's working dir) that must exist afterwards. */
      path: z.string().min(1),
    })
    .strict(),
  z
    .object({
      type: z.literal('file-contains'),
      path: z.string().min(1),
      value: z.string().min(1),
      caseSensitive: z.boolean().default(true),
    })
    .strict(),
  z
    .object({
      type: z.literal('exit-code'),
      /** Expected process exit code of a command the case ran. */
      code: z.number().int(),
    })
    .strict(),
]);
export type Expectation = z.infer<typeof ExpectationSchema>;

// ---------------------------------------------------------------------------
// EvalCase
// ---------------------------------------------------------------------------

/**
 * The bucket a case belongs to:
 * - `should-fire`     — the artifact SHOULD activate for this prompt.
 * - `should-not-fire` — a near-miss; the artifact should NOT activate (trigger precision).
 * - `task`            — a quality/process case; activation may be assumed, the focus is output quality.
 */
export const CaseBucketSchema = z.enum(['should-fire', 'should-not-fire', 'task']);
export type CaseBucket = z.infer<typeof CaseBucketSchema>;

/** A single test case. */
export const EvalCaseSchema = z
  .object({
    /** Stable, unique-within-suite identifier. */
    id: z.string().min(1),
    /** The user prompt to drive the run with. */
    prompt: z.string().min(1),
    bucket: CaseBucketSchema,
    /**
     * Ground truth for activation: whether the target artifact is expected to
     * fire. Must be consistent with the bucket (validated by the suite refine).
     */
    shouldActivate: z.boolean(),
    /** Deterministic assertions (may be empty for pure-judge cases). */
    expectations: z.array(ExpectationSchema).default([]),
    /** Optional rubric text the LLM judge uses to score output quality. */
    rubric: z.string().min(1).optional(),
  })
  .strict();
export type EvalCase = z.infer<typeof EvalCaseSchema>;

// ---------------------------------------------------------------------------
// EvalSuite
// ---------------------------------------------------------------------------

/** A complete eval suite for one artifact. */
export const EvalSuiteSchema = z
  .object({
    /** Schema version; downstream tools warn on an unknown version. */
    schemaVersion: z.literal(EVAL_SCHEMA_VERSION),
    /** Human-readable suite name. */
    name: z.string().min(1),
    /** The artifact under test. */
    artifact: ArtifactRefSchema,
    /** Model id used for LLM-judge calls (e.g. an Anthropic model id). */
    judgeModel: z.string().min(1),
    /** Model id used for the task runs under test. */
    runModel: z.string().min(1),
    /** Repetitions per case for variance estimation. Must be >= 1. */
    repetitions: z.number().int().positive().default(1),
    /** The cases; at least one required. */
    cases: z.array(EvalCaseSchema).min(1, 'a suite needs at least one case'),
  })
  .strict()
  .superRefine((suite, ctx) => {
    // Case ids must be unique.
    const seen = new Set<string>();
    suite.cases.forEach((c, i) => {
      if (seen.has(c.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `duplicate case id "${c.id}"`,
          path: ['cases', i, 'id'],
        });
      }
      seen.add(c.id);

      // bucket / shouldActivate consistency.
      if (c.bucket === 'should-fire' && !c.shouldActivate) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `case "${c.id}" is in bucket "should-fire" but shouldActivate is false`,
          path: ['cases', i, 'shouldActivate'],
        });
      }
      if (c.bucket === 'should-not-fire' && c.shouldActivate) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `case "${c.id}" is in bucket "should-not-fire" but shouldActivate is true`,
          path: ['cases', i, 'shouldActivate'],
        });
      }
    });
  });
export type EvalSuite = z.infer<typeof EvalSuiteSchema>;
