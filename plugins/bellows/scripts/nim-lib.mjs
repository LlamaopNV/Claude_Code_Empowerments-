// Shared NVIDIA NIM client. Zero dependencies; every network/env touch is
// injectable so tests run with no key and no network.
export const BASE_URL = 'https://integrate.api.nvidia.com/v1';
export const DEFAULT_MODEL = 'qwen/qwen3-coder-480b-a35b-instruct';
export const SETUP_HINT = 'Run /nim-setup in Claude Code to create and persist one.';

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

export async function chat({ model = DEFAULT_MODEL, prompt, system, maxTokens = 4096 }, opts = {}) {
  if (!prompt || !prompt.trim()) throw new NimError('chat() requires a non-empty prompt.');
  const messages = [];
  if (system) messages.push({ role: 'system', content: system });
  messages.push({ role: 'user', content: prompt });
  const data = await nimFetch('/chat/completions', {
    ...opts,
    method: 'POST',
    body: { model, messages, max_tokens: maxTokens },
  });
  return data.choices[0].message.content;
}
