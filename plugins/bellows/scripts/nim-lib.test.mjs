import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  getApiKey,
  listModels,
  chat,
  extractProfileParams,
  getModelProfile,
  NimError,
  SETUP_HINT,
  DEFAULT_MODEL,
} from './nim-lib.mjs';

const KEY_ENV = { NVIDIA_API_KEY: 'nvapi-test-key' };
const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');
const GLM_PAGE = readFileSync(join(FIXTURES, 'glm-page.html'), 'utf8');
const NEMOTRON_PAGE = readFileSync(join(FIXTURES, 'nemotron-page.html'), 'utf8');

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

// Escape a plain string the way it appears inside a JS string literal.
const esc = (s) => JSON.stringify(s).slice(1, -1);

function sseResponse(events) {
  const payload = events.map((e) => `data: ${typeof e === 'string' ? e : JSON.stringify(e)}\n\n`);
  return {
    ok: true,
    status: 200,
    body: (async function* () {
      for (const p of payload) yield Buffer.from(p);
    })(),
    text: async () => payload.join(''),
  };
}

// Routes fetches: build.nvidia.com pages vs integrate.api.nvidia.com calls.
function routedFetch({ page, api }) {
  const calls = { page: [], api: [] };
  const impl = async (url, init) => {
    if (String(url).startsWith('https://build.nvidia.com')) {
      calls.page.push({ url, init });
      if (typeof page === 'function') return page(url, init);
      return { ok: true, status: 200, text: async () => page };
    }
    calls.api.push({ url, init });
    return api(calls.api.length, url, init);
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

test('401 maps to invalid-key NimError pointing at /nim-setup', async () => {
  const { impl } = fakeFetch(401, { error: 'unauthorized' });
  await assert.rejects(
    () => listModels({ env: KEY_ENV, fetchImpl: impl }),
    (err) => err instanceof NimError && err.status === 401 && /nim-setup/.test(err.hint),
  );
});

test('new default model is the 2026-07-05 bakeoff winner', () => {
  assert.equal(DEFAULT_MODEL, 'openai/gpt-oss-120b');
});

// --- profile extraction -----------------------------------------------------

test('extractProfileParams pulls invocation defaults from a captured glm page', () => {
  const params = extractProfileParams(GLM_PAGE);
  assert.deepEqual(params, { temperature: 1, top_p: 1, max_tokens: 16384 });
});

test('extractProfileParams keeps model-specific extras (nemotron reasoning knobs)', () => {
  const params = extractProfileParams(NEMOTRON_PAGE);
  assert.equal(params.temperature, 1);
  assert.equal(params.top_p, 0.95);
  assert.equal(params.max_tokens, 16384);
  assert.equal(params.reasoning_effort, 'high');
  // excluded per spec: identity, transport and etiquette fields
  for (const k of ['model', 'messages', 'stream', 'stop', 'seed', 'frequency_penalty', 'presence_penalty']) {
    assert.equal(k in params, false, `${k} must not be forwarded`);
  }
});

test('extractProfileParams reassembles a schema split across push chunks', () => {
  const schema = JSON.stringify({
    properties: {
      model: { type: 'string', default: 'test/model' },
      messages: { type: 'array' },
      temperature: { default: 0.6 },
      chat_template_kwargs: { default: { enable_thinking: true } },
      stream: { default: true },
    },
    required: ['messages'],
  });
  const payload = `9:["x",${schema}]`;
  const cut = 30;
  const html =
    `<script>self.__next_f.push([1,"${esc(payload.slice(0, cut))}"])</script>\n` +
    `<script>self.__next_f.push([1,"${esc(payload.slice(cut))}"])</script>`;
  assert.deepEqual(extractProfileParams(html), {
    temperature: 0.6,
    chat_template_kwargs: { enable_thinking: true },
  });
});

test('extractProfileParams returns null when no request schema is present', () => {
  assert.equal(extractProfileParams('<html><body>no flight data here</body></html>'), null);
  assert.equal(
    extractProfileParams('<script>self.__next_f.push([1,"just text, no schema"])</script>'),
    null,
  );
});

// --- profile resolver (fetch + cache + fallback) -----------------------------

test('getModelProfile fetches the model page live and caches the result', async () => {
  const cacheDir = mkdtempSync(join(tmpdir(), 'bellows-test-'));
  const { impl, calls } = routedFetch({ page: GLM_PAGE });
  const p = await getModelProfile('z-ai/glm-5.2', { fetchImpl: impl, cacheDir, now: () => 1000 });
  assert.equal(p.source, 'live');
  assert.deepEqual(p.params, { temperature: 1, top_p: 1, max_tokens: 16384 });
  assert.equal(calls.page[0].url, 'https://build.nvidia.com/z-ai/glm-5.2');
  assert.equal(readdirSync(cacheDir).some((f) => /^bellows-profile-.*\.json$/.test(f)), true);

  // second resolve within TTL: no network, served from cache
  const failing = async () => { throw new Error('network must not be touched'); };
  const p2 = await getModelProfile('z-ai/glm-5.2', { fetchImpl: failing, cacheDir, now: () => 2000 });
  assert.equal(p2.source, 'cache');
  assert.deepEqual(p2.params, p.params);
});

test('getModelProfile refetches once the cache is stale', async () => {
  const cacheDir = mkdtempSync(join(tmpdir(), 'bellows-test-'));
  const { impl, calls } = routedFetch({ page: GLM_PAGE });
  await getModelProfile('z-ai/glm-5.2', { fetchImpl: impl, cacheDir, now: () => 0 });
  const dayPlus = 24 * 60 * 60 * 1000 + 1;
  const p = await getModelProfile('z-ai/glm-5.2', { fetchImpl: impl, cacheDir, now: () => dayPlus });
  assert.equal(p.source, 'live');
  assert.equal(calls.page.length, 2);
});

test('getModelProfile falls back to empty params on any failure', async () => {
  const cacheDir = mkdtempSync(join(tmpdir(), 'bellows-test-'));
  const boom = async () => { throw new Error('offline'); };
  const p = await getModelProfile('z-ai/glm-5.2', { fetchImpl: boom, cacheDir });
  assert.deepEqual(p, { params: {}, source: 'fallback' });

  const notFound = async () => ({ ok: false, status: 404, text: async () => 'nope' });
  const p2 = await getModelProfile('gone/model', { fetchImpl: notFound, cacheDir });
  assert.deepEqual(p2, { params: {}, source: 'fallback' });

  const noSchema = async () => ({ ok: true, status: 200, text: async () => '<html>redesigned</html>' });
  const p3 = await getModelProfile('odd/model', { fetchImpl: noSchema, cacheDir });
  assert.deepEqual(p3, { params: {}, source: 'fallback' });
});

// --- streaming chat -----------------------------------------------------------

function chatOpts(fetchImpl, extra = {}) {
  return {
    env: KEY_ENV,
    fetchImpl,
    cacheDir: mkdtempSync(join(tmpdir(), 'bellows-test-')),
    ...extra,
  };
}

test('chat streams with profile params, caller overrides winning', async () => {
  const { impl, calls } = routedFetch({
    page: GLM_PAGE,
    api: () => sseResponse([
      { choices: [{ delta: { role: 'assistant' } }] },
      { choices: [{ delta: { content: 'hel' } }] },
      { choices: [{ delta: { content: 'lo' } }] },
      '[DONE]',
    ]),
  });
  const out = await chat(
    { model: 'z-ai/glm-5.2', prompt: 'hi', system: 'be terse', maxTokens: 512 },
    chatOpts(impl),
  );
  assert.equal(out.text, 'hello');
  assert.equal(out.fromReasoning, false);
  const body = JSON.parse(calls.api[0].init.body);
  assert.equal(body.model, 'z-ai/glm-5.2');
  assert.equal(body.temperature, 1); // from profile
  assert.equal(body.top_p, 1); // from profile
  assert.equal(body.max_tokens, 512); // caller override beats profile's 16384
  assert.equal(body.stream, true);
  assert.deepEqual(body.messages, [
    { role: 'system', content: 'be terse' },
    { role: 'user', content: 'hi' },
  ]);
});

test('chat without caller maxTokens uses the profile default', async () => {
  const { impl, calls } = routedFetch({
    page: GLM_PAGE,
    api: () => sseResponse([{ choices: [{ delta: { content: 'ok' } }] }, '[DONE]']),
  });
  await chat({ model: 'z-ai/glm-5.2', prompt: 'hi' }, chatOpts(impl));
  assert.equal(JSON.parse(calls.api[0].init.body).max_tokens, 16384);
});

test('chat proceeds generically when the profile is unavailable', async () => {
  const { impl, calls } = routedFetch({
    page: () => { throw new Error('offline'); },
    api: () => sseResponse([{ choices: [{ delta: { content: 'still works' } }] }, '[DONE]']),
  });
  const out = await chat({ model: 'x/y', prompt: 'hi' }, chatOpts(impl));
  assert.equal(out.text, 'still works');
  const body = JSON.parse(calls.api[0].init.body);
  assert.equal(body.temperature, undefined);
  assert.equal(body.max_tokens, 4096); // generic fallback cap
});

test('chat returns reasoning text when content is empty but reasoning is not', async () => {
  const { impl } = routedFetch({
    page: GLM_PAGE,
    api: () => sseResponse([
      { choices: [{ delta: { reasoning_content: 'thinking ' } }] },
      { choices: [{ delta: { reasoning_content: 'hard' } }] },
      '[DONE]',
    ]),
  });
  const out = await chat({ model: 'z-ai/glm-5.2', prompt: 'hi' }, chatOpts(impl));
  assert.equal(out.text, 'thinking hard');
  assert.equal(out.fromReasoning, true);
});

test('chat retries non-streaming once when the stream yields zero tokens', async () => {
  const { impl, calls } = routedFetch({
    page: GLM_PAGE,
    api: (n) => {
      if (n === 1) return sseResponse([{ choices: [{ delta: { role: 'assistant' } }] }, '[DONE]']);
      return {
        ok: true,
        status: 200,
        json: async () => ({ choices: [{ message: { content: 'from retry' } }] }),
        text: async () => '',
      };
    },
  });
  const out = await chat({ model: 'z-ai/glm-5.2', prompt: 'hi' }, chatOpts(impl));
  assert.equal(out.text, 'from retry');
  assert.equal(calls.api.length, 2);
  assert.equal(JSON.parse(calls.api[1].init.body).stream, undefined);
});

test('chat errors when both the stream and the retry come back empty', async () => {
  const { impl, calls } = routedFetch({
    page: GLM_PAGE,
    api: (n) =>
      n === 1
        ? sseResponse(['[DONE]'])
        : { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: '' } }] }), text: async () => '' },
  });
  await assert.rejects(
    () => chat({ model: 'z-ai/glm-5.2', prompt: 'hi' }, chatOpts(impl)),
    (err) => err instanceof NimError && /no output/i.test(err.message),
  );
  assert.equal(calls.api.length, 2);
});

test('chat backs off 30s once on 429 then succeeds', async () => {
  const sleeps = [];
  const { impl, calls } = routedFetch({
    page: GLM_PAGE,
    api: (n) =>
      n === 1
        ? { ok: false, status: 429, text: async () => 'slow down' }
        : sseResponse([{ choices: [{ delta: { content: 'after backoff' } }] }, '[DONE]']),
  });
  const out = await chat(
    { model: 'z-ai/glm-5.2', prompt: 'hi' },
    chatOpts(impl, { sleepImpl: async (ms) => sleeps.push(ms) }),
  );
  assert.equal(out.text, 'after backoff');
  assert.deepEqual(sleeps, [30000]);
  assert.equal(calls.api.length, 2);
});

test('chat surfaces the rate limit after a second 429', async () => {
  const sleeps = [];
  const { impl } = routedFetch({
    page: GLM_PAGE,
    api: () => ({ ok: false, status: 429, text: async () => 'slow down' }),
  });
  await assert.rejects(
    () => chat({ model: 'z-ai/glm-5.2', prompt: 'hi' }, chatOpts(impl, { sleepImpl: async (ms) => sleeps.push(ms) })),
    (err) => err instanceof NimError && err.status === 429,
  );
  assert.deepEqual(sleeps, [30000]);
});

test('404 on invocation maps to listed-but-not-invocable', async () => {
  const { impl } = routedFetch({
    page: () => { throw new Error('no profile either'); },
    api: () => ({ ok: false, status: 404, text: async () => 'not found' }),
  });
  await assert.rejects(
    () => chat({ model: 'mistralai/codestral-22b-instruct-v0.1', prompt: 'hi' }, chatOpts(impl)),
    (err) => err instanceof NimError && err.status === 404 && /not invocable/i.test(err.message),
  );
});
