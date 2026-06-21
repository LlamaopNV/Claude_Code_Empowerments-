/**
 * @anvil/core — the FROZEN CONTRACT.
 *
 * Public API consumed by the server, the UI, and downstream agents. Import
 * schemas + inferred types + parse helpers from here:
 *
 *   import { EvalSuiteSchema, type EvalSuite, parseEvalSuiteYaml } from '@anvil/core';
 *
 * Two schema versions are exported:
 *   - EVAL_SCHEMA_VERSION   (eval-suite contract)
 *   - RESULT_SCHEMA_VERSION (result contract — RunTrace/Scorecard/RunIndex)
 */

// Eval-suite contract
export {
  EVAL_SCHEMA_VERSION,
  PluginRefSchema,
  SkillArtifactSchema,
  SubagentArtifactSchema,
  PluginArtifactSchema,
  ArtifactRefSchema,
  ExpectationSchema,
  CaseBucketSchema,
  EvalCaseSchema,
  EvalSuiteSchema,
} from './eval.js';
export type {
  PluginRef,
  SkillArtifact,
  SubagentArtifact,
  PluginArtifact,
  ArtifactRef,
  Expectation,
  CaseBucket,
  EvalCase,
  EvalSuite,
} from './eval.js';

// Result contract
export {
  RESULT_SCHEMA_VERSION,
  UsageSchema,
  ToolUseSchema,
  TraceEventKindSchema,
  TraceEventSchema,
  PluginErrorSchema,
  RunTraceSchema,
  ConfidenceIntervalSchema,
  MetricResultSchema,
  ConfusionMatrixSchema,
  JudgeVerdictSchema,
  JudgeSampleSchema,
  CaseResultSchema,
  ScorecardSchema,
  RunIndexEntrySchema,
  RunIndexSchema,
} from './result.js';
export type {
  Usage,
  ToolUse,
  TraceEventKind,
  TraceEvent,
  PluginError,
  RunTrace,
  ConfidenceInterval,
  MetricResult,
  ConfusionMatrix,
  JudgeVerdict,
  JudgeSample,
  CaseResult,
  Scorecard,
  RunIndexEntry,
  RunIndex,
} from './result.js';

// Parse helpers
export {
  ParseError,
  formatZodError,
  parseEvalSuite,
  safeParseEvalSuite,
  parseEvalSuiteYaml,
  parseScorecard,
  safeParseScorecard,
  parseRunIndex,
  safeParseRunIndex,
  parseRunTrace,
  safeParseRunTrace,
} from './parse.js';

// Transcript introspection (Ticket 1.2)
export {
  projectHashFromCwd,
  resolveTranscriptPath,
  findSubagentTranscriptByAgentId,
  parseTranscriptLines,
  readTranscript,
  readTranscriptById,
} from './introspect.js';
export type { ResolveTranscriptArgs, ParseTranscriptOptions } from './introspect.js';

// Activation detection + confusion matrix (Ticket 1.3)
export {
  detectActivation,
  computeConfusion,
  confusionMetrics,
} from './activation.js';
export type {
  ActivationKind,
  ActivationDecision,
  ActivationCase,
  CaseActivation,
  ActivationResult,
  ActivationMetrics,
} from './activation.js';

// Mock orchestrator (Ticket 1.4)
export { MockOrchestrator, loadOrchestratorFixture } from './orchestrator.js';
export type {
  Orchestrator,
  RunnerRole,
  RunnerDispatch,
  RunnerResult,
  JudgeDispatch,
  JudgeResult,
  RecordedRunner,
  RecordedJudge,
  OrchestratorFixture,
} from './orchestrator.js';

// Pricing table (Ticket 1.5)
export {
  PRICING_VERSION,
  PRICING_TABLE,
  DEFAULT_PRICING,
  priceFor,
} from './pricing.js';
export type { ModelPricing } from './pricing.js';

// Scoring math (Ticket 1.5)
export {
  evaluateExpectation,
  evaluateExpectations,
  aggregateJudgeSamples,
  buildSwappedPair,
  costUsage,
  sumUsage,
  sampleStats,
  tCritical,
  meanConfidenceInterval,
  metricFromSamples,
  metricFromPoint,
  pluginIntegrity,
  buildScorecard,
} from './scoring.js';
export type {
  ExpectationOutcome,
  ExpectationContext,
  JudgeAggregate,
  CostBreakdown,
  SampleStats,
  PluginIntegrity,
  ScoringCaseInput,
  BuildScorecardArgs,
} from './scoring.js';

// Run cache for incremental re-runs (Ticket 3.5)
export { artifactVersion, runCacheKey, RunCache } from './cache.js';
export type {
  ArtifactFile,
  RunCacheKeyParts,
  CachedRun,
  RunCacheBundle,
  RunCacheMode,
  RunCacheStats,
} from './cache.js';

// Suite coverage & balance check (Ticket 4.3)
export { checkSuiteCoverage } from './coverage.js';
export type { BucketCounts, CoverageReport } from './coverage.js';

// Improvement-loop delta tracking (Ticket 5.3)
export { computeRunDelta } from './delta.js';
export type { AppliedEdit, MetricDelta, RunDelta, ComputeRunDeltaArgs } from './delta.js';
