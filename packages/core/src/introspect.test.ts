import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join, sep } from 'node:path';
import {
  parseTranscriptLines,
  readTranscript,
  resolveTranscriptPath,
  projectHashFromCwd,
  readTranscriptById,
  findSubagentTranscriptByAgentId,
  RunTraceSchema,
} from './index.js';

const here = dirname(fileURLToPath(import.meta.url));
const fixtures = resolve(here, '../fixtures/transcripts');

function readFixture(name: string): string {
  return readFileSync(resolve(fixtures, name), 'utf8');
}

describe('resolveTranscriptPath + projectHashFromCwd', () => {
  it('hashes a Windows cwd by stripping the colon and dashing separators', () => {
    expect(projectHashFromCwd('C:\\Code\\Agent Eval pipeline')).toBe(
      'C--Code-Agent-Eval-pipeline',
    );
  });

  it('hashes a POSIX cwd', () => {
    expect(projectHashFromCwd('/home/me/proj dir')).toBe('-home-me-proj-dir');
  });

  it('resolves the MAIN session path', () => {
    const p = resolveTranscriptPath({
      configRoot: '/root/.claude',
      projectHash: 'P--hash',
      sessionId: 'sess-1',
    });
    expect(p.split(sep)).toEqual(
      expect.arrayContaining(['projects', 'P--hash', 'sess-1.jsonl']),
    );
  });

  it('resolves the SUBAGENT path under subagents/agent-<id>.jsonl', () => {
    const p = resolveTranscriptPath({
      configRoot: '/root/.claude',
      projectHash: 'P--hash',
      sessionId: 'sess-1',
      agentId: 'aa11bb22',
    });
    const parts = p.split(sep);
    expect(parts).toContain('sess-1');
    expect(parts).toContain('subagents');
    expect(parts[parts.length - 1]).toBe('agent-aa11bb22.jsonl');
  });

  it('does not double-prefix an agentId already starting with agent-', () => {
    const p = resolveTranscriptPath({
      configRoot: '/r',
      projectHash: 'h',
      sessionId: 's',
      agentId: 'agent-xyz',
    });
    expect(p.endsWith(`agent-xyz.jsonl`)).toBe(true);
  });

  it('returns null for a missing file', () => {
    expect(readTranscript(resolve(fixtures, 'does-not-exist.jsonl'))).toBeNull();
    expect(
      readTranscriptById({
        configRoot: resolve(fixtures, 'nope'),
        projectHash: 'x',
        sessionId: 'y',
        agentId: 'z',
      }),
    ).toBeNull();
  });
});

describe('findSubagentTranscriptByAgentId — glob by agentId alone', () => {
  let root: string;
  const projectHash = 'C--Code-Agent-Eval-pipeline';

  /** Create `<root>/projects/<hash>/<sessionId>/subagents/agent-<id>.jsonl`. */
  function makeSubagent(sessionId: string, agentId: string, body = '{}\n'): string {
    const dir = join(root, 'projects', projectHash, sessionId, 'subagents');
    mkdirSync(dir, { recursive: true });
    const file = join(dir, `agent-${agentId}.jsonl`);
    writeFileSync(file, body, 'utf8');
    return file;
  }

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'anvil-glob-'));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('finds a subagent transcript under one session without knowing the sessionId', () => {
    const expected = makeSubagent('sess-AAAA', 'aa11bb22cc33dd44');
    const found = findSubagentTranscriptByAgentId(root, projectHash, 'aa11bb22cc33dd44');
    expect(found).toBe(expected);
  });

  it('finds the transcript across MULTIPLE sessions (globs every session dir)', () => {
    makeSubagent('sess-OLD', 'unrelated0000');
    const expected = makeSubagent('sess-NEW', 'targetAgent999');
    const found = findSubagentTranscriptByAgentId(root, projectHash, 'targetAgent999');
    expect(found).toBe(expected);
  });

  it('accepts an agentId already prefixed with "agent-" (no double prefix)', () => {
    const expected = makeSubagent('sess-X', 'prefixed123');
    const found = findSubagentTranscriptByAgentId(root, projectHash, 'agent-prefixed123');
    expect(found).toBe(expected);
  });

  it('returns null when no matching transcript exists', () => {
    makeSubagent('sess-X', 'somethingelse');
    expect(findSubagentTranscriptByAgentId(root, projectHash, 'missing-id')).toBeNull();
  });

  it('returns null when the project dir does not exist', () => {
    expect(findSubagentTranscriptByAgentId(root, 'no-such-hash', 'whatever')).toBeNull();
  });

  it('readTranscriptById globs by agentId when sessionId is omitted', () => {
    const sub = join(root, 'projects', projectHash, 'sess-Z', 'subagents');
    mkdirSync(sub, { recursive: true });
    const transcript = readFixture('subagent-skill-fired.jsonl');
    writeFileSync(join(sub, 'agent-globme777.jsonl'), transcript, 'utf8');

    const trace = readTranscriptById({
      configRoot: root,
      projectHash,
      agentId: 'globme777',
    });
    expect(trace).not.toBeNull();
    expect(trace?.isSubagent).toBe(true);
    expect(trace?.agentId).toBe('globme777');
    expect(trace?.toolUses.some((t) => t.skill === 'bake-to-completion')).toBe(true);
  });

  it('readTranscriptById returns null when globbing finds nothing', () => {
    mkdirSync(join(root, 'projects', projectHash, 'sess-Q', 'subagents'), { recursive: true });
    const trace = readTranscriptById({
      configRoot: root,
      projectHash,
      agentId: 'nope-not-here',
    });
    expect(trace).toBeNull();
  });
});

describe('parseTranscriptLines — subagent transcript with a Skill tool_use', () => {
  const trace = parseTranscriptLines(readFixture('subagent-skill-fired.jsonl'), {
    agentId: 'agent-aa11bb22cc33dd44',
  });

  it('produces a schema-valid RunTrace', () => {
    expect(() => RunTraceSchema.parse(trace)).not.toThrow();
  });

  it('marks it as a subagent (inferred from isSidechain)', () => {
    expect(trace.isSubagent).toBe(true);
    expect(trace.agentId).toBe('agent-aa11bb22cc33dd44');
    expect(trace.sessionId).toBe('2b67b33f-0000-4000-8000-000000000000');
  });

  it('extracts the Skill tool use with the skill field lifted from input', () => {
    const skillUses = trace.toolUses.filter((t) => t.name === 'Skill');
    expect(skillUses).toHaveLength(1);
    expect(skillUses[0]?.skill).toBe('bake-to-completion');
  });

  it('aggregates usage across assistant messages (snake_case → camelCase)', () => {
    // a1: 1840/62/0/12030 ; a2: 2100/410/1840/12030
    expect(trace.totalUsage.inputTokens).toBe(1840 + 2100);
    expect(trace.totalUsage.outputTokens).toBe(62 + 410);
    expect(trace.totalUsage.cacheCreationInputTokens).toBe(0 + 1840);
    expect(trace.totalUsage.cacheReadInputTokens).toBe(12030 + 12030);
  });

  it('captures finalText from the last assistant message', () => {
    expect(trace.finalText).toContain('who exactly forgets to water plants');
  });

  it('records a tool_result event', () => {
    expect(trace.events.some((e) => e.kind === 'tool_result')).toBe(true);
  });
});

describe('parseTranscriptLines — main transcript with a Task dispatch + plugin error', () => {
  const trace = parseTranscriptLines(readFixture('main-dispatch-and-pluginerror.jsonl'));

  it('defaults agentId to "main" and is not a subagent', () => {
    expect(trace.agentId).toBe('main');
    expect(trace.isSubagent).toBe(false);
  });

  it('extracts the Agent dispatch with subagentType lifted from input', () => {
    const agentUses = trace.toolUses.filter((t) => t.name === 'Agent');
    expect(agentUses).toHaveLength(1);
    expect(agentUses[0]?.subagentType).toBe('anvil-task-runner');
  });

  it('captures the plugin load error', () => {
    expect(trace.pluginErrors).toEqual([
      { plugin: 'broken-plugin', message: 'failed to load .mcp.json: ENOENT' },
    ]);
  });
});

describe('parseTranscriptLines — robustness', () => {
  it('skips malformed/blank/unknown lines without crashing', () => {
    const trace = parseTranscriptLines(readFixture('malformed-mixed.jsonl'));
    // The two valid assistant messages survive.
    expect(trace.finalText).toBe('final');
    expect(trace.totalUsage.inputTokens).toBe(10 + 3);
    expect(trace.totalUsage.outputTokens).toBe(5 + 2);
  });

  it('lifts a Skill name from a sibling field when input lacks it', () => {
    const line = JSON.stringify({
      type: 'assistant',
      message: {
        role: 'assistant',
        content: [{ type: 'tool_use', id: 't', name: 'Skill', input: {}, skill: 'sibling-skill' }],
        usage: { input_tokens: 1, output_tokens: 1 },
      },
    });
    const trace = parseTranscriptLines([line]);
    expect(trace.toolUses.find((t) => t.name === 'Skill')?.skill).toBe('sibling-skill');
  });

  it('handles an empty input gracefully', () => {
    const trace = parseTranscriptLines('');
    expect(trace.toolUses).toHaveLength(0);
    expect(trace.totalUsage.inputTokens).toBe(0);
    expect(() => RunTraceSchema.parse(trace)).not.toThrow();
  });

  it('reads a fixture file from disk and parses it', () => {
    const trace = readTranscript(resolve(fixtures, 'subagent-skill-fired.jsonl'), {
      agentId: 'agent-x',
      isSubagent: true,
    });
    expect(trace).not.toBeNull();
    expect(trace?.toolUses.some((t) => t.skill === 'bake-to-completion')).toBe(true);
  });
});
