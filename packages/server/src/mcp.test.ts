import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { parseScorecard, parseRunTrace, projectHashFromCwd } from '@anvil/core';
import { Storage } from './storage.js';
import { buildMcpServer } from './mcp.js';

const here = dirname(fileURLToPath(import.meta.url));
const coreFixtures = resolve(here, '../../core/fixtures');

/** Extract + JSON-parse the structuredContent (or first text block) of a result. */
function payload(result: CallToolResult): unknown {
  if (result.structuredContent !== undefined) return result.structuredContent;
  const block = result.content?.[0];
  if (block && block.type === 'text') return JSON.parse(block.text);
  return undefined;
}

describe('MCP server — in-process client (acceptance #5)', () => {
  let dir: string;
  let configRoot: string;
  let client: Client;
  const sessionId = 'sess-abc';
  const agentId = 'agent-aa11bb22cc33dd44';
  const projectHash = projectHashFromCwd('C:/proj/anvil');

  beforeAll(async () => {
    dir = await fs.mkdtemp(join(tmpdir(), 'anvil-mcp-'));
    configRoot = join(dir, '.claude');

    // Materialize a subagent transcript at the path readTranscriptById expects:
    //   <configRoot>/projects/<hash>/<sessionId>/subagents/agent-<id>.jsonl
    const subDir = join(configRoot, 'projects', projectHash, sessionId, 'subagents');
    await fs.mkdir(subDir, { recursive: true });
    const transcript = await fs.readFile(
      join(coreFixtures, 'transcripts', 'subagent-skill-fired.jsonl'),
      'utf8',
    );
    await fs.writeFile(join(subDir, `${agentId}.jsonl`), transcript, 'utf8');

    const storage = new Storage({
      resultsDir: join(dir, 'results'),
      evalsDir: join(dir, 'evals'),
    });
    const server = buildMcpServer({ storage, configRoot });

    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    client = new Client({ name: 'test-client', version: '1.0.0' });
    await Promise.all([client.connect(clientTransport), server.connect(serverTransport)]);
  });

  afterAll(async () => {
    await client.close();
    await fs.rm(dir, { recursive: true, force: true });
  });

  it('lists all eight Anvil tools', async () => {
    const { tools } = await client.listTools();
    const names = tools.map((t) => t.name).sort();
    expect(names).toEqual(
      [
        'anvil_get_suite',
        'anvil_introspect_transcript',
        'anvil_list_suites',
        'anvil_record_run',
        'anvil_save_scorecard',
        'anvil_save_suite',
        'anvil_score',
        'anvil_validate_suite',
      ].sort(),
    );
  });

  it('anvil_introspect_transcript reads a real subagent transcript fixture', async () => {
    const result = (await client.callTool({
      name: 'anvil_introspect_transcript',
      arguments: { sessionId, projectHash, agentId },
    })) as CallToolResult;
    expect(result.isError).not.toBe(true);
    const body = payload(result) as { found: boolean; trace: unknown };
    expect(body.found).toBe(true);
    const trace = parseRunTrace(body.trace);
    expect(trace.toolUses.some((t) => t.skill === 'bake-to-completion')).toBe(true);
    expect(trace.totalUsage.inputTokens).toBe(1840 + 2100);
  });

  it('anvil_introspect_transcript globs by agentId alone (no sessionId)', async () => {
    const result = (await client.callTool({
      name: 'anvil_introspect_transcript',
      arguments: { projectHash, agentId },
    })) as CallToolResult;
    expect(result.isError).not.toBe(true);
    const body = payload(result) as { found: boolean; trace: unknown };
    expect(body.found).toBe(true);
    const trace = parseRunTrace(body.trace);
    expect(trace.isSubagent).toBe(true);
    expect(trace.toolUses.some((t) => t.skill === 'bake-to-completion')).toBe(true);
  });

  it('anvil_introspect_transcript glob-by-agentId returns found:false for unknown id', async () => {
    const result = (await client.callTool({
      name: 'anvil_introspect_transcript',
      arguments: { projectHash, agentId: 'agent-not-on-disk' },
    })) as CallToolResult;
    const body = payload(result) as { found: boolean };
    expect(body.found).toBe(false);
  });

  it('anvil_introspect_transcript errors when neither sessionId nor agentId given', async () => {
    const result = (await client.callTool({
      name: 'anvil_introspect_transcript',
      arguments: { projectHash },
    })) as CallToolResult;
    expect(result.isError).toBe(true);
  });

  it('anvil_introspect_transcript returns found:false for an unknown id', async () => {
    const result = (await client.callTool({
      name: 'anvil_introspect_transcript',
      arguments: { sessionId, projectHash, agentId: 'agent-does-not-exist' },
    })) as CallToolResult;
    const body = payload(result) as { found: boolean };
    expect(body.found).toBe(false);
  });

  it('anvil_score produces a valid Scorecard from per-case inputs', async () => {
    const result = (await client.callTool({
      name: 'anvil_score',
      arguments: {
        runId: 'run-mcp-test-1',
        suiteName: 'mcp test suite',
        artifact: { kind: 'skill', name: 'bake-to-completion' },
        judgeModel: 'claude-judge',
        runModel: 'claude-run',
        repetitions: 2,
        cases: [
          {
            caseId: 'c-fire',
            shouldActivate: true,
            activated: true,
            expectationResults: [true],
            judgeSamples: [
              { verdict: 'treatment', swapped: false },
              { verdict: 'treatment', swapped: true },
            ],
            treatmentUsage: { inputTokens: 100, outputTokens: 50 },
          },
          {
            caseId: 'c-nofire',
            shouldActivate: false,
            activated: false,
            expectationResults: [true],
            judgeSamples: [],
          },
        ],
      },
    })) as CallToolResult;
    expect(result.isError).not.toBe(true);
    const card = parseScorecard(payload(result));
    expect(card.runId).toBe('run-mcp-test-1');
    expect(card.confusion.truePositive).toBe(1);
    expect(card.confusion.trueNegative).toBe(1);
    expect(card.metrics['quality.delta']?.value).toBeCloseTo(1);
  });

  it('anvil_record_run scores AND persists in one step', async () => {
    const result = (await client.callTool({
      name: 'anvil_record_run',
      arguments: {
        runId: 'run-mcp-record-1',
        suiteName: 'mcp record suite',
        artifact: { kind: 'skill', name: 'bake-to-completion' },
        judgeModel: 'j',
        runModel: 'r',
        repetitions: 1,
        cases: [
          { caseId: 'c1', shouldActivate: true, activated: true, expectationResults: [] },
        ],
      },
    })) as CallToolResult;
    expect(result.isError).not.toBe(true);
    const body = payload(result) as { runId: string; entry: { runId: string } };
    expect(body.runId).toBe('run-mcp-record-1');

    // It actually persisted: a subsequent results read finds it.
    const list = (await client.callTool({
      name: 'anvil_list_suites',
      arguments: {},
    })) as CallToolResult;
    expect(list.isError).not.toBe(true);
    const fileExists = await fs
      .stat(join(dir, 'results', 'run-mcp-record-1.json'))
      .then(() => true)
      .catch(() => false);
    expect(fileExists).toBe(true);
  });

  it('anvil_validate_suite reports invalid YAML without throwing', async () => {
    const result = (await client.callTool({
      name: 'anvil_validate_suite',
      arguments: { yaml: 'name: incomplete' },
    })) as CallToolResult;
    expect(result.isError).not.toBe(true);
    const body = payload(result) as { valid: boolean; error?: string };
    expect(body.valid).toBe(false);
    expect(typeof body.error).toBe('string');
  });

  it('anvil_save_suite + anvil_get_suite round-trip a suite', async () => {
    const yaml = [
      'schemaVersion: 1',
      'name: round-trip suite',
      'artifact: { kind: skill, name: rt }',
      'judgeModel: j',
      'runModel: r',
      'cases:',
      '  - id: a',
      '    prompt: hi',
      '    bucket: should-fire',
      '    shouldActivate: true',
    ].join('\n');
    const saved = (await client.callTool({
      name: 'anvil_save_suite',
      arguments: { yaml },
    })) as CallToolResult;
    expect(saved.isError).not.toBe(true);

    const got = (await client.callTool({
      name: 'anvil_get_suite',
      arguments: { name: 'round-trip suite' },
    })) as CallToolResult;
    expect(got.isError).not.toBe(true);
    const suite = payload(got) as { name: string };
    expect(suite.name).toBe('round-trip suite');
  });
});
