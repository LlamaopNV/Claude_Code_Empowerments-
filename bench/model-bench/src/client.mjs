// Benchmark NIM client. Differs from bellows' chat() on purpose: every sampling
// parameter must be passed explicitly (spec fairness rule 2), and the full
// request/response is logged per call (rule 3).
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { getApiKey, NimError, BASE_URL } from '../../../plugins/bellows/scripts/nim-lib.mjs';

const RATE_LIMIT_BACKOFF_MS = 30_000;

export function parseSseText(sseText) {
  let content = '';
  let reasoning = '';
  let finishReason = null;
  let usage = null;
  const toolAcc = new Map();
  for (const line of sseText.split(/\r?\n/)) {
    if (!line.startsWith('data:')) continue;
    const payload = line.slice(5).trim();
    if (!payload || payload === '[DONE]') continue;
    let obj;
    try {
      obj = JSON.parse(payload);
    } catch {
      continue; // malformed event; nothing usable
    }
    if (obj.usage) usage = obj.usage;
    const choice = obj.choices?.[0];
    if (!choice) continue;
    if (choice.finish_reason) finishReason = choice.finish_reason;
    const delta = choice.delta ?? {};
    if (typeof delta.content === 'string') content += delta.content;
    if (typeof delta.reasoning_content === 'string') reasoning += delta.reasoning_content;
    for (const tc of delta.tool_calls ?? []) {
      const slot = toolAcc.get(tc.index ?? 0) ?? { id: null, name: null, arguments: '' };
      if (tc.id) slot.id = tc.id;
      if (tc.function?.name) slot.name = tc.function.name;
      if (typeof tc.function?.arguments === 'string') slot.arguments += tc.function.arguments;
      toolAcc.set(tc.index ?? 0, slot);
    }
  }
  const toolCalls = [...toolAcc.entries()].sort((a, b) => a[0] - b[0]).map(([, v]) => v);
  return { content, reasoning, toolCalls, finishReason, usage };
}

function requireExplicit(params) {
  const missing = ['temperature', 'top_p', 'max_tokens'].filter((k) => params?.[k] == null);
  if (missing.length) {
    throw new NimError(`benchChat requires explicit sampling params; missing: ${missing.join(', ')}.`);
  }
}

export async function benchChat(
  { model, messages, params, tools },
  { env = process.env, fetchImpl = fetch, logFile = null, now = Date.now, sleepImpl } = {},
) {
  requireExplicit(params);
  const key = getApiKey(env);
  const sleep = sleepImpl ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
  const base = {
    model,
    messages,
    ...params,
    ...(tools ? { tools } : {}),
    stream: true,
  };

  let body = { ...base, stream_options: { include_usage: true } };
  let retried429 = false;
  for (;;) {
    const started = now();
    const res = await fetchImpl(`${BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        Accept: 'text/event-stream',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      const text = await res.text();
      const parsed = parseSseText(text);
      const result = { ...parsed, latencyMs: now() - started, httpStatus: res.status };
      if (logFile) {
        mkdirSync(dirname(logFile), { recursive: true });
        writeFileSync(logFile, JSON.stringify({ request: body, response: parsed, latencyMs: result.latencyMs }, null, 2));
      }
      return result;
    }
    const errText = await res.text();
    if (res.status === 429 && !retried429) {
      retried429 = true;
      await sleep(RATE_LIMIT_BACKOFF_MS);
      continue;
    }
    if (res.status === 400 && body.stream_options && /stream_options/i.test(errText)) {
      body = { ...base }; // endpoint rejects the field; usage will be absent
      continue;
    }
    throw new NimError(`NVIDIA API error ${res.status} for ${model}: ${errText.slice(0, 300)}`, { status: res.status });
  }
}
