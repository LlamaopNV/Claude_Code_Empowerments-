// Shared NVIDIA NIM client. Zero dependencies; every network/env touch is
// injectable so tests run with no key and no network.
import { readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export const BASE_URL = 'https://integrate.api.nvidia.com/v1';
export const PROFILE_BASE_URL = 'https://build.nvidia.com';
export const DEFAULT_MODEL = 'openai/gpt-oss-120b';
export const SETUP_HINT = 'Run /nim-setup in Claude Code to create and persist one.';

const PROFILE_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const GENERIC_MAX_TOKENS = 4096;
const RATE_LIMIT_BACKOFF_MS = 30_000;

// Fields from a model's request schema that must never be forwarded from a
// profile: identity/transport fields we set ourselves, and etiquette fields
// (a pinned seed or penalty defaults are playground niceties, not invocation
// requirements).
const PROFILE_EXCLUDED_FIELDS = new Set([
  'model',
  'messages',
  'stream',
  'stop',
  'seed',
  'frequency_penalty',
  'presence_penalty',
  'response_format',
]);

export class NimError extends Error {
  constructor(message, { status, hint } = {}) {
    super(message);
    this.name = 'NimError';
    this.status = status;
    this.hint = hint;
  }
}

export function getApiKey(env = process.env) {
  const key = (env.NVIDIA_API_KEY ?? '').trim();
  if (!key) {
    throw new NimError('NVIDIA_API_KEY is not set.', { hint: SETUP_HINT });
  }
  return key;
}

function mapHttpError(status, bodyText) {
  if (status === 401) {
    return new NimError('NVIDIA API rejected the key (401 Unauthorized).', {
      status,
      hint: 'The key is invalid or expired. Run /nim-setup in Claude Code to create a fresh one.',
    });
  }
  if (status === 429) {
    return new NimError('NVIDIA API rate limit hit (429 Too Many Requests).', {
      status,
      hint: 'Back off and retry after a pause. Do not hammer the endpoint.',
    });
  }
  return new NimError(`NVIDIA API error ${status}: ${bodyText.slice(0, 300)}`, { status });
}

async function nimFetch(path, { method = 'GET', body, env = process.env, fetchImpl = fetch } = {}) {
  const key = getApiKey(env);
  const res = await fetchImpl(`${BASE_URL}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${key}`,
      Accept: 'application/json',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!res.ok) throw mapHttpError(res.status, await res.text());
  return res.json();
}

export async function listModels(opts = {}) {
  const data = await nimFetch('/models', opts);
  return data.data.map((m) => m.id).sort();
}

// --- per-model invocation profiles -------------------------------------------
// Every build.nvidia.com/<model-id> page embeds the model's request-body JSON
// schema (inside Next.js flight-data chunks) with per-parameter defaults —
// the same setup the NVIDIA playground uses. We extract those defaults so any
// catalog model gets invoked the way its own page prescribes.

function reassembleFlightData(html) {
  const chunks = [];
  const re = /self\.__next_f\.push\(\[1,\s*"((?:[^"\\]|\\.)*)"\]\)/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    try {
      chunks.push(JSON.parse(`"${m[1]}"`));
    } catch {
      // a chunk that is not a valid string literal is not flight data; skip it
    }
  }
  return chunks.join('');
}

// Parse the JSON object starting at openIdx, tracking strings so braces inside
// descriptions don't unbalance the scan. Returns null if it never closes or
// does not parse.
function parseObjectAt(text, openIdx) {
  let depth = 0;
  let inStr = false;
  let escaped = false;
  for (let i = openIdx; i < text.length; i++) {
    const c = text[i];
    if (inStr) {
      if (escaped) escaped = false;
      else if (c === '\\') escaped = true;
      else if (c === '"') inStr = false;
    } else if (c === '"') {
      inStr = true;
    } else if (c === '{') {
      depth++;
    } else if (c === '}') {
      depth--;
      if (depth === 0) {
        try {
          return JSON.parse(text.slice(openIdx, i + 1));
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

function isPlainObject(v) {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

export function extractProfileParams(html) {
  const blob = reassembleFlightData(html);
  let idx = 0;
  while ((idx = blob.indexOf('"properties"', idx)) !== -1) {
    const openIdx = blob.lastIndexOf('{', idx);
    const schema = openIdx === -1 ? null : parseObjectAt(blob, openIdx);
    idx += '"properties"'.length;
    if (!schema || !isPlainObject(schema.properties)) continue;
    const props = schema.properties;
    if (!props.model || !props.messages) continue; // not the request-body schema
    const params = {};
    for (const [name, prop] of Object.entries(props)) {
      if (PROFILE_EXCLUDED_FIELDS.has(name)) continue;
      if (!isPlainObject(prop) || prop.default === undefined || prop.default === null) continue;
      const d = prop.default;
      const t = typeof d;
      if (t === 'number' || t === 'string' || t === 'boolean' || isPlainObject(d)) {
        params[name] = d;
      }
    }
    return params;
  }
  return null;
}

function profileCacheFile(modelId, cacheDir) {
  const slug = modelId.toLowerCase().replace(/[^a-z0-9._-]+/g, '-');
  return join(cacheDir, `bellows-profile-${slug}.json`);
}

// Resolve a model's invocation profile: live page fetch, 24h temp-dir cache,
// and a never-fatal fallback to generic params. No API key required — the
// pages are public.
export async function getModelProfile(modelId, opts = {}) {
  const { fetchImpl = fetch, cacheDir = tmpdir(), now = Date.now } = opts;
  const cacheFile = profileCacheFile(modelId, cacheDir);
  try {
    const { fetchedAt, params } = JSON.parse(readFileSync(cacheFile, 'utf8'));
    if (now() - fetchedAt < PROFILE_CACHE_TTL_MS) return { params, source: 'cache' };
  } catch {
    // no cache or unreadable: fall through to a live fetch
  }
  try {
    const res = await fetchImpl(`${PROFILE_BASE_URL}/${modelId}`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (bellows)', Accept: 'text/html' },
    });
    if (!res.ok) return { params: {}, source: 'fallback' };
    const params = extractProfileParams(await res.text());
    if (!params) return { params: {}, source: 'fallback' };
    try {
      writeFileSync(cacheFile, JSON.stringify({ fetchedAt: now(), params }));
    } catch {
      // cache write failure is not worth failing the call over
    }
    return { params, source: 'live' };
  } catch {
    return { params: {}, source: 'fallback' };
  }
}

// --- streaming chat -----------------------------------------------------------

async function postChat(body, { env, fetchImpl = fetch, sleepImpl } = {}) {
  const key = getApiKey(env);
  const sleep = sleepImpl ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
  for (let attempt = 0; ; attempt++) {
    const res = await fetchImpl(`${BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        Accept: body.stream ? 'text/event-stream' : 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    if (res.ok) return res;
    if (res.status === 429 && attempt === 0) {
      await sleep(RATE_LIMIT_BACKOFF_MS);
      continue;
    }
    if (res.status === 404) {
      throw new NimError(
        `Model "${body.model}" is in the catalog but not invocable on this account (404).`,
        { status: 404, hint: 'Pick another id from /nim-models.' },
      );
    }
    throw mapHttpError(res.status, await res.text());
  }
}

// Accumulate the two SSE channels separately: `delta.content` is the answer,
// `delta.reasoning_content` is the model's thinking (which some models emit
// exclusively — discarding it made replies look empty).
async function readSseChannels(body) {
  const decoder = new TextDecoder();
  let buffer = '';
  let content = '';
  let reasoning = '';
  const feed = (line) => {
    if (!line.startsWith('data:')) return;
    const payload = line.slice(5).trim();
    if (!payload || payload === '[DONE]') return;
    let obj;
    try {
      obj = JSON.parse(payload);
    } catch {
      return; // partial or malformed event; nothing usable
    }
    const delta = obj.choices?.[0]?.delta;
    if (!delta) return;
    if (typeof delta.content === 'string') content += delta.content;
    if (typeof delta.reasoning_content === 'string') reasoning += delta.reasoning_content;
  };
  for await (const chunk of body) {
    buffer += typeof chunk === 'string' ? chunk : decoder.decode(chunk, { stream: true });
    let nl;
    while ((nl = buffer.indexOf('\n')) !== -1) {
      feed(buffer.slice(0, nl).replace(/\r$/, ''));
      buffer = buffer.slice(nl + 1);
    }
  }
  feed(buffer.replace(/\r$/, ''));
  return { content, reasoning };
}

function pickChannel({ content, reasoning }) {
  if (content) return { text: content, fromReasoning: false };
  if (reasoning) return { text: reasoning, fromReasoning: true };
  return null;
}

// Streaming chat: request body = the model's profile params, overlaid by
// explicit caller args, plus stream:true. Streaming keeps long generations
// alive (non-streaming dies at undici's ~300s body timeout); the one known
// exception (kimi-style endpoints that stream zero tokens) gets a single
// non-streaming retry.
export async function chat({ model = DEFAULT_MODEL, prompt, system, maxTokens }, opts = {}) {
  if (!prompt || !prompt.trim()) throw new NimError('chat() requires a non-empty prompt.');
  const messages = [];
  if (system) messages.push({ role: 'system', content: system });
  messages.push({ role: 'user', content: prompt });

  const profile = await getModelProfile(model, opts);
  const body = { ...profile.params };
  if (maxTokens != null) body.max_tokens = maxTokens;
  if (body.max_tokens == null) body.max_tokens = GENERIC_MAX_TOKENS;
  body.model = model;
  body.messages = messages;

  const streamRes = await postChat({ ...body, stream: true }, opts);
  const streamed = pickChannel(await readSseChannels(streamRes.body));
  if (streamed) return streamed;

  // Zero tokens on both channels: retry once without streaming (kimi quirk).
  const retryRes = await postChat(body, opts);
  const message = (await retryRes.json()).choices?.[0]?.message ?? {};
  const retried = pickChannel({
    content: message.content ?? '',
    reasoning: message.reasoning_content ?? '',
  });
  if (retried) return retried;
  throw new NimError(`Model "${model}" returned no output on both the stream and a non-streaming retry.`, {
    hint: 'Try another model from /nim-models.',
  });
}
