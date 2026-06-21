/**
 * MCP stdio server (Ticket 2.2).
 *
 * Exposes the tools the in-session orchestration skills (Epic 3) call. Each tool
 * validates its input/output through `@anvil/core` and returns a JSON text block
 * (plus `structuredContent` for machine consumption). Errors are returned as MCP
 * tool errors (`isError: true`) with a readable message — never thrown across
 * the protocol boundary so a bad call doesn't kill the server.
 *
 * Tools:
 *   - anvil_list_suites          → list+parse evals/*.yaml
 *   - anvil_get_suite            → one suite by name
 *   - anvil_validate_suite       → validate a suite YAML (no write)
 *   - anvil_save_suite           → validate + persist a suite YAML
 *   - anvil_introspect_transcript→ readTranscriptById → RunTrace (the activation/usage source)
 *   - anvil_score                → buildScorecard → Scorecard (no write)
 *   - anvil_save_scorecard       → persist a pre-built Scorecard + update the index
 *   - anvil_record_run           → buildScorecard + persist in one step (the recording flow)
 *
 * `inputSchema` uses RAW Zod shapes (the @modelcontextprotocol/sdk v1 form): an
 * object whose values are zod fields. We reuse `@anvil/core` schemas wherever a
 * nested object must be validated.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import {
  readTranscriptById,
  buildScorecard,
  ArtifactRefSchema,
  ScorecardSchema,
  JudgeSampleSchema,
  UsageSchema,
  RunTraceSchema,
  parseEvalSuiteYaml,
  formatZodError,
  type BuildScorecardArgs,
  type ScoringCaseInput,
} from '@anvil/core';
import type { Storage } from './storage.js';
import type { Logger } from './logger.js';

/** Wrap a JSON-serializable value into a successful CallToolResult. */
function ok(value: unknown): CallToolResult {
  return {
    content: [{ type: 'text', text: JSON.stringify(value, null, 2) }],
    structuredContent: value as Record<string, unknown>,
  };
}

/** Wrap an error message into a failed CallToolResult. */
function fail(message: string): CallToolResult {
  return { content: [{ type: 'text', text: message }], isError: true };
}

/** Turn an unknown thrown value into a readable message (ZodError-aware). */
function messageOf(err: unknown): string {
  if (err instanceof z.ZodError) return formatZodError(err);
  if (err instanceof Error) return err.message;
  return String(err);
}

// ---------------------------------------------------------------------------
// Tool input shapes (raw Zod shapes for the SDK).
// ---------------------------------------------------------------------------

/** Per-case scoring input, as a Zod object reused by score/record tools. */
const ScoringCaseInputSchema = z
  .object({
    caseId: z.string().min(1),
    shouldActivate: z.boolean(),
    activated: z.boolean(),
    expectationResults: z.array(z.boolean()).default([]),
    judgeSamples: z.array(JudgeSampleSchema).default([]),
    treatmentUsage: UsageSchema.optional(),
    treatmentTraceId: z.string().optional(),
    baselineTraceId: z.string().optional(),
  })
  .strict();

/** The shared body for score + record_run (everything buildScorecard needs). */
const buildScorecardShape = {
  runId: z.string().min(1),
  suiteName: z.string().min(1),
  artifact: ArtifactRefSchema,
  createdAt: z.string().min(1).optional(),
  judgeModel: z.string().min(1),
  runModel: z.string().min(1),
  repetitions: z.number().int().positive(),
  cases: z.array(ScoringCaseInputSchema),
  traces: z.array(RunTraceSchema).optional(),
  level: z.number().gt(0).lt(1).optional(),
  comparedToRunId: z.string().optional(),
} as const;

/** Coerce validated score-tool args into core's {@link BuildScorecardArgs}. */
function toBuildArgs(a: {
  runId: string;
  suiteName: string;
  artifact: BuildScorecardArgs['artifact'];
  createdAt?: string;
  judgeModel: string;
  runModel: string;
  repetitions: number;
  cases: ScoringCaseInput[];
  traces?: BuildScorecardArgs['traces'];
  level?: number;
  comparedToRunId?: string;
}): BuildScorecardArgs {
  return {
    runId: a.runId,
    suiteName: a.suiteName,
    artifact: a.artifact,
    createdAt: a.createdAt ?? new Date().toISOString(),
    judgeModel: a.judgeModel,
    runModel: a.runModel,
    repetitions: a.repetitions,
    cases: a.cases,
    ...(a.traces !== undefined ? { traces: a.traces } : {}),
    ...(a.level !== undefined ? { level: a.level } : {}),
    ...(a.comparedToRunId !== undefined ? { comparedToRunId: a.comparedToRunId } : {}),
  };
}

/** Options for {@link buildMcpServer}. */
export interface BuildMcpServerArgs {
  storage: Storage;
  /** Claude config-dir root used to resolve transcripts by id. */
  configRoot: string;
  logger?: Logger;
  name?: string;
  version?: string;
}

/**
 * Build (but do not connect) the Anvil MCP server with all tools registered.
 * Returned so callers can connect it to a stdio transport (production) or an
 * in-memory transport (tests).
 */
export function buildMcpServer(args: BuildMcpServerArgs): McpServer {
  const { storage, configRoot } = args;
  const server = new McpServer({
    name: args.name ?? 'anvil',
    version: args.version ?? '0.1.0',
  });

  // -- suites -------------------------------------------------------------
  server.registerTool(
    'anvil_list_suites',
    {
      title: 'List eval suites',
      description: 'List and parse all eval suites (evals/*.yaml). Returns valid suites + parse errors.',
      inputSchema: {},
    },
    async () => {
      try {
        const { suites, errors } = await storage.listSuites();
        return ok({ suites, errors });
      } catch (err) {
        return fail(messageOf(err));
      }
    },
  );

  server.registerTool(
    'anvil_get_suite',
    {
      title: 'Get an eval suite by name',
      description: 'Return the single eval suite whose `name` matches. Errors if not found.',
      inputSchema: { name: z.string().min(1) },
    },
    async ({ name }) => {
      try {
        const { suites } = await storage.listSuites();
        const match = suites.find((s) => s.name === name);
        if (!match) return fail(`no suite named "${name}"`);
        return ok(match);
      } catch (err) {
        return fail(messageOf(err));
      }
    },
  );

  server.registerTool(
    'anvil_validate_suite',
    {
      title: 'Validate an eval suite (no write)',
      description: 'Parse+validate a suite YAML string against EvalSuiteSchema. Returns {valid, suite?, error?}.',
      inputSchema: { yaml: z.string().min(1) },
    },
    async ({ yaml }) => {
      try {
        const suite = parseEvalSuiteYaml(yaml);
        return ok({ valid: true, suite });
      } catch (err) {
        return ok({ valid: false, error: messageOf(err) });
      }
    },
  );

  server.registerTool(
    'anvil_save_suite',
    {
      title: 'Save an eval suite',
      description: 'Validate a suite YAML and persist it to the evals dir. `fileName` optional (slug from name).',
      inputSchema: { yaml: z.string().min(1), fileName: z.string().min(1).optional() },
    },
    async ({ yaml, fileName }) => {
      try {
        const suite = parseEvalSuiteYaml(yaml);
        const name =
          fileName ??
          `${suite.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')}.yaml`;
        const path = await storage.saveSuiteYaml(yaml, name);
        return ok({ saved: true, path, name: suite.name });
      } catch (err) {
        return fail(messageOf(err));
      }
    },
  );

  // -- introspection ------------------------------------------------------
  server.registerTool(
    'anvil_introspect_transcript',
    {
      title: 'Introspect a session/subagent transcript',
      description:
        'Resolve + parse a Claude Code transcript by ids into a RunTrace (ordered events, tool uses incl. Skill/Task activation, usage tokens, finalText, pluginErrors). Returns {found, trace?}. `configRoot` defaults to the server config. Pass `agentId` for a subagent transcript; if `sessionId` is OMITTED the subagent transcript is located by globbing `agentId` across the project\'s sessions (resolves the session-id seam for a skill running in-session). `sessionId` is required when `agentId` is omitted (main-session transcript).',
      inputSchema: {
        sessionId: z.string().min(1).optional(),
        projectHash: z.string().min(1),
        agentId: z.string().min(1).optional(),
        configRoot: z.string().min(1).optional(),
      },
    },
    async ({ sessionId, projectHash, agentId, configRoot: root }) => {
      try {
        if (sessionId === undefined && agentId === undefined) {
          return fail('anvil_introspect_transcript requires either a sessionId or an agentId');
        }
        const trace = readTranscriptById({
          configRoot: root ?? configRoot,
          projectHash,
          ...(sessionId !== undefined ? { sessionId } : {}),
          ...(agentId !== undefined ? { agentId } : {}),
        });
        if (trace === null) return ok({ found: false, trace: null });
        return ok({ found: true, trace });
      } catch (err) {
        return fail(messageOf(err));
      }
    },
  );

  // -- scoring ------------------------------------------------------------
  server.registerTool(
    'anvil_score',
    {
      title: 'Build a scorecard (no write)',
      description:
        'Roll per-case inputs into a schema-valid Scorecard via core buildScorecard. Does NOT persist. `createdAt` defaults to now.',
      inputSchema: buildScorecardShape,
    },
    async (raw) => {
      try {
        const card = buildScorecard(toBuildArgs(raw as Parameters<typeof toBuildArgs>[0]));
        return ok(card);
      } catch (err) {
        return fail(messageOf(err));
      }
    },
  );

  server.registerTool(
    'anvil_save_scorecard',
    {
      title: 'Persist a scorecard',
      description:
        'Validate + atomically write a full Scorecard to results/<runId>.json and idempotently update results/index.json. Returns the index entry.',
      inputSchema: { scorecard: ScorecardSchema },
    },
    async ({ scorecard }) => {
      try {
        const { entry } = await storage.saveScorecard(scorecard);
        return ok({ saved: true, entry });
      } catch (err) {
        return fail(messageOf(err));
      }
    },
  );

  server.registerTool(
    'anvil_record_run',
    {
      title: 'Record a completed run (score + persist)',
      description:
        'Build a Scorecard from per-case inputs AND persist it in one step (the recording flow). Returns {runId, entry, scorecard}.',
      inputSchema: buildScorecardShape,
    },
    async (raw) => {
      try {
        const card = buildScorecard(toBuildArgs(raw as Parameters<typeof toBuildArgs>[0]));
        const { entry, scorecard } = await storage.saveScorecard(card);
        return ok({ runId: scorecard.runId, entry, scorecard });
      } catch (err) {
        return fail(messageOf(err));
      }
    },
  );

  return server;
}

/**
 * Start the MCP server on a stdio transport (production entry). Logs to stderr
 * ONLY (stdout is the JSON-RPC channel). Resolves once connected.
 */
export async function startMcpStdio(args: BuildMcpServerArgs): Promise<McpServer> {
  const server = buildMcpServer(args);
  const transport = new StdioServerTransport();
  await server.connect(transport);
  args.logger?.info('MCP stdio server connected (8 tools registered)');
  return server;
}
