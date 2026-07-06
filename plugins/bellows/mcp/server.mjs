#!/usr/bin/env node
// bellows MCP server: newline-delimited JSON-RPC 2.0 over stdio.
// Zero dependencies by design; the MCP surface is small enough that the
// protocol is hand-rolled rather than pulling in an SDK.
import { createInterface } from 'node:readline';
import { listModels, chat, NimError, DEFAULT_MODEL } from '../scripts/nim-lib.mjs';

const TOOLS = [
  {
    name: 'nim_list_models',
    description:
      'List the model ids currently available on the NVIDIA build.nvidia.com endpoint (integrate.api.nvidia.com). Requires NVIDIA_API_KEY.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'nim_chat',
    description:
      `Send a prompt to an NVIDIA-hosted model and return the completion text. Defaults to ${DEFAULT_MODEL}. ` +
      "Each model is invoked with its own published profile (the parameter defaults from the model's " +
      'build.nvidia.com page), streamed, with reasoning-only replies surfaced instead of dropped. ' +
      'Treat the output as a draft to verify, not ground truth. Requires NVIDIA_API_KEY.',
    inputSchema: {
      type: 'object',
      properties: {
        prompt: { type: 'string', description: 'The user prompt.' },
        model: { type: 'string', description: `Model id (default ${DEFAULT_MODEL}).` },
        system: { type: 'string', description: 'Optional system prompt.' },
        max_tokens: {
          type: 'integer',
          description: "Optional completion-token cap; overrides the model profile's default.",
        },
      },
      required: ['prompt'],
      additionalProperties: false,
    },
  },
];

function textResult(text, isError = false) {
  return { content: [{ type: 'text', text }], isError };
}

async function callTool(name, args) {
  try {
    if (name === 'nim_list_models') {
      const models = await listModels();
      return textResult(models.join('\n'));
    }
    if (name === 'nim_chat') {
      const { text, fromReasoning } = await chat({
        model: args.model,
        system: args.system,
        prompt: args.prompt,
        maxTokens: args.max_tokens,
      });
      return textResult(
        fromReasoning
          ? `[note: the model produced no final answer; this is its reasoning channel]\n${text}`
          : text,
      );
    }
    return textResult(`Unknown tool: ${name}`, true);
  } catch (err) {
    const msg = err instanceof NimError && err.hint ? `${err.message} ${err.hint}` : String(err.message ?? err);
    return textResult(msg, true);
  }
}

function respond(id, result) {
  process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id, result }) + '\n');
}

function respondError(id, code, message) {
  process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id, error: { code, message } }) + '\n');
}

const rl = createInterface({ input: process.stdin });
rl.on('line', async (line) => {
  if (!line.trim()) return;
  let msg;
  try {
    msg = JSON.parse(line);
  } catch {
    return; // ignore garbage rather than crash the transport
  }
  // Non-object payloads (e.g. a literal `null` line) parse fine but are not
  // JSON-RPC messages; ignore them rather than crash the transport. Objects
  // without an id are notifications; nothing to do for those either.
  if (msg === null || typeof msg !== 'object' || msg.id === undefined) return;
  try {
    if (msg.method === 'initialize') {
      respond(msg.id, {
        protocolVersion: msg.params?.protocolVersion ?? '2025-06-18',
        capabilities: { tools: {} },
        serverInfo: { name: 'bellows', version: '0.2.0' },
      });
    } else if (msg.method === 'tools/list') {
      respond(msg.id, { tools: TOOLS });
    } else if (msg.method === 'tools/call') {
      respond(msg.id, await callTool(msg.params.name, msg.params.arguments ?? {}));
    } else if (msg.method === 'ping') {
      respond(msg.id, {});
    } else {
      respondError(msg.id, -32601, `Method not found: ${msg.method}`);
    }
  } catch (err) {
    respondError(msg.id, -32603, String(err?.message ?? err));
  }
});
