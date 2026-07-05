import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getApiKey, listModels, chat, NimError, SETUP_HINT, DEFAULT_MODEL } from './nim-lib.mjs';

const KEY_ENV = { NVIDIA_API_KEY: 'nvapi-test-key' };

function fakeFetch(status, jsonBody) {
  const calls = [];
  const impl = async (url, init) => {
    calls.push({ url, init });
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => jsonBody,
      text: async () => JSON.stringify(jsonBody),
    };
  };
  return { impl, calls };
}

test('getApiKey throws NimError with setup hint when unset', () => {
  assert.throws(() => getApiKey({}), (err) => err instanceof NimError && err.hint === SETUP_HINT);
  assert.throws(() => getApiKey({ NVIDIA_API_KEY: '  ' }), NimError);
});

test('getApiKey returns trimmed key', () => {
  assert.equal(getApiKey({ NVIDIA_API_KEY: ' nvapi-abc ' }), 'nvapi-abc');
});

test('listModels returns sorted ids and sends bearer auth', async () => {
  const { impl, calls } = fakeFetch(200, { data: [{ id: 'z/model' }, { id: 'a/model' }] });
  const ids = await listModels({ env: KEY_ENV, fetchImpl: impl });
  assert.deepEqual(ids, ['a/model', 'z/model']);
  assert.equal(calls[0].url, 'https://integrate.api.nvidia.com/v1/models');
  assert.equal(calls[0].init.headers.Authorization, 'Bearer nvapi-test-key');
});

test('chat posts OpenAI-shaped body and returns message content', async () => {
  const { impl, calls } = fakeFetch(200, { choices: [{ message: { content: 'hi there' } }] });
  const out = await chat({ prompt: 'hello', system: 'be terse' }, { env: KEY_ENV, fetchImpl: impl });
  assert.equal(out, 'hi there');
  const body = JSON.parse(calls[0].init.body);
  assert.equal(body.model, DEFAULT_MODEL);
  assert.deepEqual(body.messages, [
    { role: 'system', content: 'be terse' },
    { role: 'user', content: 'hello' },
  ]);
});

test('401 maps to invalid-key NimError pointing at /nim-setup', async () => {
  const { impl } = fakeFetch(401, { error: 'unauthorized' });
  await assert.rejects(
    () => listModels({ env: KEY_ENV, fetchImpl: impl }),
    (err) => err instanceof NimError && err.status === 401 && /nim-setup/.test(err.hint),
  );
});

test('429 maps to back-off NimError', async () => {
  const { impl } = fakeFetch(429, { error: 'slow down' });
  await assert.rejects(
    () => chat({ prompt: 'x' }, { env: KEY_ENV, fetchImpl: impl }),
    (err) => err instanceof NimError && err.status === 429 && /back off/i.test(err.hint),
  );
});
