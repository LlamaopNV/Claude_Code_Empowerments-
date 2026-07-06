import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseSseText, benchChat } from './client.mjs';

const sse = (objs) => objs.map((o) => `data: ${JSON.stringify(o)}`).join('\n\n') + '\n\ndata: [DONE]\n\n';

test('parseSseText accumulates content, reasoning, finish_reason, usage and tool_calls', () => {
  const text = sse([
    { choices: [{ delta: { reasoning_content: 'thinking' } }] },
    { choices: [{ delta: { content: 'Hello ' } }] },
    { choices: [{ delta: { content: 'world', tool_calls: [{ index: 0, id: 'c1', function: { name: 'read_file', arguments: '{"pa' } }] } }] },
    { choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: 'th":"a"}' } }] }, finish_reason: 'tool_calls' }] },
    { choices: [], usage: { prompt_tokens: 10, completion_tokens: 20 } },
  ]);
  const r = parseSseText(text);
  assert.equal(r.content, 'Hello world');
  assert.equal(r.reasoning, 'thinking');
  assert.equal(r.finishReason, 'tool_calls');
  assert.deepEqual(r.usage, { prompt_tokens: 10, completion_tokens: 20 });
  assert.deepEqual(r.toolCalls, [{ id: 'c1', name: 'read_file', arguments: '{"path":"a"}' }]);
});

test('benchChat rejects requests without explicit sampling params', async () => {
  await assert.rejects(
    () => benchChat({ model: 'm', messages: [{ role: 'user', content: 'x' }], params: { temperature: 0 } }, { env: { NVIDIA_API_KEY: 'k' } }),
    /explicit/i,
  );
});

test('benchChat sends explicit body, logs request+response, returns metrics', async () => {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, body: JSON.parse(init.body) });
    return {
      ok: true,
      status: 200,
      text: async () =>
        sse([
          { choices: [{ delta: { content: 'hi' }, finish_reason: 'stop' }] },
          { choices: [], usage: { prompt_tokens: 3, completion_tokens: 1 } },
        ]),
    };
  };
  const dir = mkdtempSync(join(tmpdir(), 'bench-'));
  const logFile = join(dir, 'run.json');
  let t = 1000;
  const r = await benchChat(
    { model: 'test/model', messages: [{ role: 'user', content: 'hello' }], params: { temperature: 0, top_p: 1, max_tokens: 64 } },
    { env: { NVIDIA_API_KEY: 'k' }, fetchImpl, logFile, now: () => (t += 500) },
  );
  assert.equal(r.content, 'hi');
  assert.equal(r.finishReason, 'stop');
  assert.equal(r.latencyMs, 500);
  assert.equal(r.httpStatus, 200);
  const body = calls[0].body;
  assert.equal(body.temperature, 0);
  assert.equal(body.top_p, 1);
  assert.equal(body.max_tokens, 64);
  assert.equal(body.stream, true);
  assert.deepEqual(body.stream_options, { include_usage: true });
  const logged = JSON.parse(readFileSync(logFile, 'utf8'));
  assert.equal(logged.request.model, 'test/model');
  assert.equal(logged.response.content, 'hi');
  assert.deepEqual(logged.response.usage, { prompt_tokens: 3, completion_tokens: 1 });
});

test('benchChat retries once without stream_options on a 400 that names it', async () => {
  let n = 0;
  const fetchImpl = async (url, init) => {
    n++;
    const body = JSON.parse(init.body);
    if (body.stream_options) return { ok: false, status: 400, text: async () => 'unknown field stream_options' };
    return { ok: true, status: 200, text: async () => sse([{ choices: [{ delta: { content: 'ok' }, finish_reason: 'stop' }] }]) };
  };
  const r = await benchChat(
    { model: 'm', messages: [{ role: 'user', content: 'x' }], params: { temperature: 0, top_p: 1, max_tokens: 8 } },
    { env: { NVIDIA_API_KEY: 'k' }, fetchImpl },
  );
  assert.equal(n, 2);
  assert.equal(r.content, 'ok');
});
