import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const SERVER = join(dirname(fileURLToPath(import.meta.url)), 'server.mjs');

function startServer() {
  const child = spawn(process.execPath, [SERVER], {
    env: { ...process.env, NVIDIA_API_KEY: '' },
    stdio: ['pipe', 'pipe', 'inherit'],
  });
  const lines = createInterface({ input: child.stdout });
  const pending = new Map();
  lines.on('line', (line) => {
    const msg = JSON.parse(line);
    if (msg.id !== undefined && pending.has(msg.id)) {
      pending.get(msg.id)(msg);
      pending.delete(msg.id);
    }
  });
  let nextId = 1;
  function request(method, params = {}) {
    const id = nextId++;
    return new Promise((resolve, reject) => {
      pending.set(id, resolve);
      setTimeout(() => reject(new Error(`timeout waiting for ${method}`)), 5000);
      child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
    });
  }
  function notify(method, params = {}) {
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method, params }) + '\n');
  }
  return { child, request, notify };
}

test('MCP handshake, tools/list, and keyless tool call', async () => {
  const { child, request, notify } = startServer();
  try {
    const init = await request('initialize', {
      protocolVersion: '2025-06-18',
      capabilities: {},
      clientInfo: { name: 'test', version: '0' },
    });
    assert.equal(init.result.serverInfo.name, 'bellows');
    notify('notifications/initialized');

    const list = await request('tools/list');
    const names = list.result.tools.map((t) => t.name).sort();
    assert.deepEqual(names, ['nim_chat', 'nim_list_models']);

    const call = await request('tools/call', { name: 'nim_list_models', arguments: {} });
    assert.equal(call.result.isError, true);
    assert.match(call.result.content[0].text, /nim-setup/);

    // Malformed input must not kill the transport: a JSON `null` line and a
    // non-JSON garbage line should both be ignored, and the server must still
    // answer the next request.
    child.stdin.write('null\n');
    child.stdin.write('not json\n');
    const pong = await request('ping');
    assert.deepEqual(pong.result, {});

    const unknown = await request('no/such_method');
    assert.equal(unknown.error.code, -32601);
    assert.match(unknown.error.message, /no\/such_method/);
  } finally {
    child.kill();
  }
});
