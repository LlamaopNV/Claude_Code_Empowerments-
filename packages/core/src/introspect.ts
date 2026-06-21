/**
 * Transcript-introspection library (Ticket 1.2).
 *
 * Parses Claude Code session/subagent transcript JSONL into a normalized
 * {@link RunTrace} (the frozen result contract from `result.ts`), and resolves
 * the on-disk path of a transcript from a session/agent id + config-dir root.
 *
 * Transcript shape (verified in docs/spike-findings.md + Claude Code internals):
 *   - Each line is one JSON object ("record").
 *   - `type` ∈ {"user","assistant","system","summary", ...}.
 *   - Assistant records carry `message` = the raw Anthropic API message:
 *       { role:"assistant", content: Block[], usage: {...snake_case...} }.
 *   - Content blocks: { type:"text", text }, { type:"tool_use", id, name, input },
 *     and tool_result blocks live inside USER records' `message.content`.
 *   - Skill activation: a tool_use block, name "Skill", with the skill name in
 *     its `input` (field "skill"; we also accept "name"/"command" defensively).
 *   - Subagent dispatch (in the PARENT transcript): a tool_use block, name
 *     "Task" or "Agent", with `input.subagent_type`.
 *   - Usage is snake_case on disk; we normalize to the camelCase {@link Usage}.
 *
 * Robustness contract: unknown/partial/malformed lines are SKIPPED, never throw.
 * Reading a missing file returns `null`.
 */

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import {
  RunTraceSchema,
  type RunTrace,
  type TraceEvent,
  type ToolUse,
  type Usage,
  type PluginError,
} from './result.js';

// ---------------------------------------------------------------------------
// Path resolution
// ---------------------------------------------------------------------------

/**
 * Compute the Claude Code project-hash directory name for a given project path.
 * Claude Code derives the folder under `<root>/projects/` by replacing EACH
 * path separator, the drive colon, and whitespace of the absolute cwd with a
 * single `-` — NOT collapsing runs. So `C:\Code\Agent Eval pipeline` becomes
 * `C--Code-Agent-Eval-pipeline` (the colon → `-` and the `\` → `-` produce the
 * double dash after `C`), as VERIFIED in docs/spike-findings.md.
 */
export function projectHashFromCwd(cwd: string): string {
  // Map each separator/colon/whitespace char to one '-' individually.
  return cwd.replace(/[\\/:\s]/g, '-');
}

/** Inputs to {@link resolveTranscriptPath}. */
export interface ResolveTranscriptArgs {
  /** The Claude config-dir root (e.g. `C:\Users\me\.claude`). */
  configRoot: string;
  /** The project-hash directory name, e.g. `C--Code-Agent-Eval-pipeline`. */
  projectHash: string;
  /**
   * The session id (the main transcript's filename stem). MAY be omitted ONLY
   * when {@link agentId} is set — in that case the subagent transcript is
   * located by globbing across the project's sessions (see
   * {@link findSubagentTranscriptByAgentId}). For a main-session transcript or a
   * direct subagent path, `sessionId` is required.
   */
  sessionId?: string;
  /**
   * When set, resolves a SUBAGENT transcript for this agent id instead of the
   * main session transcript.
   */
  agentId?: string;
}

/** Strip a leading `agent-` from an agentId so the filename isn't double-prefixed. */
function agentFileName(agentId: string): string {
  return agentId.startsWith('agent-') ? `${agentId}.jsonl` : `agent-${agentId}.jsonl`;
}

/**
 * Resolve the on-disk transcript path from explicit ids.
 *   - main session: `<root>/projects/<projectHash>/<sessionId>.jsonl`
 *   - subagent:     `<root>/projects/<projectHash>/<sessionId>/subagents/agent-<agentId>.jsonl`
 *
 * The subagent filename is `agent-<agentId>.jsonl`; if the caller already
 * passes an id prefixed with `agent-` we don't double-prefix.
 *
 * Requires `sessionId`. To resolve a subagent transcript WITHOUT a session id,
 * use {@link findSubagentTranscriptByAgentId} (glob by agentId alone).
 */
export function resolveTranscriptPath(args: ResolveTranscriptArgs): string {
  const { configRoot, projectHash, sessionId, agentId } = args;
  if (sessionId === undefined) {
    throw new Error(
      'resolveTranscriptPath requires a sessionId; to resolve a subagent transcript by agentId alone use findSubagentTranscriptByAgentId',
    );
  }
  const projectDir = join(configRoot, 'projects', projectHash);
  if (agentId === undefined) {
    return join(projectDir, `${sessionId}.jsonl`);
  }
  return join(projectDir, sessionId, 'subagents', agentFileName(agentId));
}

/**
 * Locate a SUBAGENT transcript by its `agentId` alone, without knowing the main
 * session id. Globs `<configRoot>/projects/<projectHash>/<session>/subagents/`
 * across every session directory under the project hash and returns the path of
 * the first `agent-<agentId>.jsonl` found (the agentId filename is unique).
 *
 * Returns the absolute path, or `null` when the project dir is absent or no
 * matching transcript exists. Never throws on a missing/permission-denied dir —
 * unreadable session dirs are skipped (a skill running in-session must not crash
 * the whole eval because one stray dir can't be stat'd).
 *
 * Resolves the "session-id seam": a skill running in-session knows the agentId
 * it dispatched (the `Task` tool returns it) but not necessarily the parent
 * session id; this lets it recover the subagent's transcript regardless.
 */
export function findSubagentTranscriptByAgentId(
  configRoot: string,
  projectHash: string,
  agentId: string,
): string | null {
  const projectDir = join(configRoot, 'projects', projectHash);
  if (!existsSync(projectDir)) return null;
  const wanted = agentFileName(agentId);

  let sessionDirs: string[];
  try {
    sessionDirs = readdirSync(projectDir);
  } catch {
    return null;
  }

  for (const sessionDir of sessionDirs) {
    const candidate = join(projectDir, sessionDir, 'subagents', wanted);
    try {
      if (statSync(candidate).isFile()) return candidate;
    } catch {
      // Not a dir, no subagents folder, or no such file — skip this session.
      continue;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Low-level field helpers (defensive)
// ---------------------------------------------------------------------------

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function asString(v: unknown): string | undefined {
  return typeof v === 'string' ? v : undefined;
}

function asNonNegInt(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.trunc(v) : 0;
}

/** Normalize a raw API `usage` object (snake_case) into the {@link Usage} shape. */
function normalizeUsage(raw: unknown): Usage | undefined {
  if (!isObject(raw)) return undefined;
  // Accept both snake_case (on disk) and camelCase (already-normalized inputs).
  const inputTokens = asNonNegInt(raw['input_tokens'] ?? raw['inputTokens']);
  const outputTokens = asNonNegInt(raw['output_tokens'] ?? raw['outputTokens']);
  const cacheCreationInputTokens = asNonNegInt(
    raw['cache_creation_input_tokens'] ?? raw['cacheCreationInputTokens'],
  );
  const cacheReadInputTokens = asNonNegInt(
    raw['cache_read_input_tokens'] ?? raw['cacheReadInputTokens'],
  );
  // Treat a usage object with no recognizable token fields as absent.
  if (
    !('input_tokens' in raw) &&
    !('inputTokens' in raw) &&
    !('output_tokens' in raw) &&
    !('outputTokens' in raw)
  ) {
    return undefined;
  }
  return { inputTokens, outputTokens, cacheCreationInputTokens, cacheReadInputTokens };
}

/** Extract the activated skill name from a Skill tool_use's input, defensively. */
function skillNameFromInput(input: Record<string, unknown>): string | undefined {
  return (
    asString(input['skill']) ?? asString(input['name']) ?? asString(input['command']) ?? undefined
  );
}

/** Extract the subagent type from a Task/Agent tool_use's input, defensively. */
function subagentTypeFromInput(input: Record<string, unknown>): string | undefined {
  return asString(input['subagent_type']) ?? asString(input['subagentType']) ?? undefined;
}

/** Build a {@link ToolUse} from a raw tool_use content block. Returns null if unusable. */
function toolUseFromBlock(block: Record<string, unknown>): ToolUse | null {
  const name = asString(block['name']);
  if (name === undefined || name.length === 0) return null;
  const input = isObject(block['input']) ? block['input'] : {};
  const tu: ToolUse = { name, input };
  const id = asString(block['id']);
  if (id !== undefined) tu.id = id;
  if (name === 'Skill') {
    // Prefer the name from `input`; fall back to a sibling `skill` field on the
    // block (the spike grep snapshot is ambiguous about placement).
    const skill = skillNameFromInput(input) ?? asString(block['skill']);
    if (skill !== undefined) tu.skill = skill;
  }
  if (name === 'Task' || name === 'Agent') {
    const subagentType =
      subagentTypeFromInput(input) ??
      asString(block['subagent_type']) ??
      asString(block['subagentType']);
    if (subagentType !== undefined) tu.subagentType = subagentType;
  }
  return tu;
}

/** Pull joined text from an array of content blocks. */
function textFromBlocks(blocks: unknown[]): string {
  const parts: string[] = [];
  for (const b of blocks) {
    if (isObject(b) && b['type'] === 'text') {
      const t = asString(b['text']);
      if (t !== undefined) parts.push(t);
    }
  }
  return parts.join('');
}

// ---------------------------------------------------------------------------
// Record → events
// ---------------------------------------------------------------------------

interface MutableTrace {
  events: TraceEvent[];
  toolUses: ToolUse[];
  total: Usage;
  finalText: string;
  pluginErrors: PluginError[];
  sessionId?: string;
  isSubagent: boolean;
}

function addUsage(total: Usage, u: Usage): void {
  total.inputTokens += u.inputTokens;
  total.outputTokens += u.outputTokens;
  total.cacheCreationInputTokens += u.cacheCreationInputTokens;
  total.cacheReadInputTokens += u.cacheReadInputTokens;
}

/**
 * Detect a plugin load error in a system record. Claude Code surfaces these as
 * `type:"system"` records; the exact shape is not formally documented, so we
 * match defensively on level/subtype + a "plugin" hint and a named plugin.
 */
function pluginErrorFromSystem(rec: Record<string, unknown>): PluginError | undefined {
  const level = asString(rec['level']);
  const subtype = asString(rec['subtype']);
  const isError = level === 'error' || subtype === 'plugin_error' || subtype === 'plugin_load_error';
  if (!isError) return undefined;
  const plugin = asString(rec['plugin']) ?? asString(rec['pluginName']);
  const message = asString(rec['message']) ?? asString(rec['content']) ?? asString(rec['text']);
  if (plugin === undefined || message === undefined) {
    // Only treat as a plugin error when it plausibly names a plugin.
    if (plugin === undefined) return undefined;
  }
  return { plugin: plugin ?? 'unknown', message: message ?? 'plugin load error' };
}

/** Process one already-parsed record object into the mutable trace. */
function ingestRecord(rec: Record<string, unknown>, trace: MutableTrace): void {
  const type = asString(rec['type']);
  const sid = asString(rec['sessionId']);
  if (sid !== undefined && trace.sessionId === undefined) trace.sessionId = sid;
  if (rec['isSidechain'] === true) trace.isSubagent = true;

  const timestamp = asString(rec['timestamp']);

  if (type === 'system') {
    const pe = pluginErrorFromSystem(rec);
    if (pe) trace.pluginErrors.push(pe);
    const text = asString(rec['content']) ?? asString(rec['message']) ?? asString(rec['text']);
    trace.events.push({
      index: trace.events.length,
      kind: 'system',
      ...(timestamp !== undefined ? { timestamp } : {}),
      ...(text !== undefined ? { text } : {}),
    });
    return;
  }

  // user / assistant records carry an inner API `message`.
  const message = isObject(rec['message']) ? rec['message'] : undefined;
  const role = message ? asString(message['role']) ?? type : type;
  const content = message ? message['content'] : undefined;
  const usage = message ? normalizeUsage(message['usage']) : undefined;

  // content can be a string (simple user text) or an array of blocks.
  if (typeof content === 'string') {
    const ev: TraceEvent = {
      index: trace.events.length,
      kind: role === 'assistant' ? 'assistant' : 'user',
      ...(timestamp !== undefined ? { timestamp } : {}),
      text: content,
      ...(usage !== undefined ? { usage } : {}),
    };
    trace.events.push(ev);
    if (usage) addUsage(trace.total, usage);
    if (role === 'assistant' && content.length > 0) trace.finalText = content;
    return;
  }

  if (Array.isArray(content)) {
    const text = textFromBlocks(content);
    // Emit the message-level event (assistant/user) with its text + usage.
    const ev: TraceEvent = {
      index: trace.events.length,
      kind: role === 'assistant' ? 'assistant' : 'user',
      ...(timestamp !== undefined ? { timestamp } : {}),
      ...(text.length > 0 ? { text } : {}),
      ...(usage !== undefined ? { usage } : {}),
    };
    trace.events.push(ev);
    if (usage) addUsage(trace.total, usage);
    if (role === 'assistant' && text.length > 0) trace.finalText = text;

    // Emit a tool_use event per tool_use block, in order.
    for (const block of content) {
      if (isObject(block) && block['type'] === 'tool_use') {
        const tu = toolUseFromBlock(block);
        if (tu) {
          trace.events.push({
            index: trace.events.length,
            kind: 'tool_use',
            ...(timestamp !== undefined ? { timestamp } : {}),
            toolUse: tu,
          });
          trace.toolUses.push(tu);
        }
      }
      // tool_result blocks (inside user records) become tool_result events.
      if (isObject(block) && block['type'] === 'tool_result') {
        const resultText =
          typeof block['content'] === 'string'
            ? block['content']
            : Array.isArray(block['content'])
              ? textFromBlocks(block['content'])
              : undefined;
        trace.events.push({
          index: trace.events.length,
          kind: 'tool_result',
          ...(timestamp !== undefined ? { timestamp } : {}),
          ...(resultText !== undefined && resultText.length > 0 ? { text: resultText } : {}),
        });
      }
    }
    return;
  }

  // No usable content: still record a bare event so ordering is preserved when
  // there is at least a role/type, but skip entirely meaningless lines.
  if (role === 'assistant' || role === 'user') {
    trace.events.push({
      index: trace.events.length,
      kind: role === 'assistant' ? 'assistant' : 'user',
      ...(timestamp !== undefined ? { timestamp } : {}),
      ...(usage !== undefined ? { usage } : {}),
    });
    if (usage) addUsage(trace.total, usage);
  }
}

// ---------------------------------------------------------------------------
// Public parse API
// ---------------------------------------------------------------------------

/** Options for the parse functions. */
export interface ParseTranscriptOptions {
  /**
   * The agentId to stamp on the resulting trace. Defaults to `"main"` for a
   * main-session transcript; pass the dispatched agentId for a subagent.
   */
  agentId?: string;
  /** Force `isSubagent`. If omitted, it is inferred from `isSidechain` records. */
  isSubagent?: boolean;
}

/**
 * Parse raw transcript lines (an array of JSONL strings, or one big string with
 * embedded newlines) into a normalized {@link RunTrace}.
 *
 * Malformed/blank/unknown lines are skipped — never throws on bad input. The
 * returned trace always validates against {@link RunTraceSchema}.
 */
export function parseTranscriptLines(
  lines: string[] | string,
  options: ParseTranscriptOptions = {},
): RunTrace {
  const arr = Array.isArray(lines) ? lines : lines.split(/\r?\n/);
  const trace: MutableTrace = {
    events: [],
    toolUses: [],
    total: {
      inputTokens: 0,
      outputTokens: 0,
      cacheCreationInputTokens: 0,
      cacheReadInputTokens: 0,
    },
    finalText: '',
    pluginErrors: [],
    isSubagent: options.isSubagent ?? false,
  };

  for (const line of arr) {
    const trimmed = line.trim();
    if (trimmed.length === 0) continue;
    let rec: unknown;
    try {
      rec = JSON.parse(trimmed);
    } catch {
      continue; // malformed line: skip, don't crash
    }
    if (!isObject(rec)) continue;
    try {
      ingestRecord(rec, trace);
    } catch {
      // A single pathological record must not sink the whole parse.
      continue;
    }
  }

  const candidate = {
    agentId: options.agentId ?? 'main',
    ...(trace.sessionId !== undefined ? { sessionId: trace.sessionId } : {}),
    isSubagent: options.isSubagent ?? trace.isSubagent,
    events: trace.events,
    toolUses: trace.toolUses,
    totalUsage: trace.total,
    finalText: trace.finalText,
    pluginErrors: trace.pluginErrors,
  };

  // Validate against the frozen contract. This should always pass given the
  // construction above; if a future schema change breaks it, fail loudly.
  return RunTraceSchema.parse(candidate);
}

/**
 * Read a transcript file from disk and parse it. Returns `null` if the file does
 * not exist (per the ticket's robustness contract). Throws only on unexpected
 * I/O errors other than "missing file".
 */
export function readTranscript(
  filePath: string,
  options: ParseTranscriptOptions = {},
): RunTrace | null {
  if (!existsSync(filePath)) return null;
  let content: string;
  try {
    content = readFileSync(filePath, 'utf8');
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === 'ENOENT') return null;
    throw err;
  }
  return parseTranscriptLines(content, options);
}

/**
 * Resolve a transcript path from ids and read+parse it. Returns `null` if the
 * file is absent. Convenience over {@link resolveTranscriptPath} + {@link readTranscript}.
 * When `agentId` is provided the trace is marked as a subagent.
 *
 * Glob-by-agentId mode: when `sessionId` is OMITTED but `agentId` is set, the
 * subagent transcript is located by {@link findSubagentTranscriptByAgentId}
 * (globbing every session under the project hash) — the caller need not know the
 * parent session id. Returns `null` if no matching transcript is found.
 */
export function readTranscriptById(
  args: ResolveTranscriptArgs,
  options: ParseTranscriptOptions = {},
): RunTrace | null {
  const isSubagent = options.isSubagent ?? args.agentId !== undefined;
  const parseOpts: ParseTranscriptOptions = {
    agentId: args.agentId ?? options.agentId ?? 'main',
    isSubagent,
  };

  // Glob-by-agentId: no sessionId, but we have an agentId → locate across sessions.
  if (args.sessionId === undefined) {
    if (args.agentId === undefined) {
      throw new Error('readTranscriptById requires either a sessionId or an agentId');
    }
    const path = findSubagentTranscriptByAgentId(args.configRoot, args.projectHash, args.agentId);
    if (path === null) return null;
    return readTranscript(path, parseOpts);
  }

  return readTranscript(resolveTranscriptPath(args), parseOpts);
}
