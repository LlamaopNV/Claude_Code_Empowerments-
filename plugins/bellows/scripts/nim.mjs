#!/usr/bin/env node
// bellows CLI: verify | models [--json] | chat [--model id] [--system text] <prompt...>
// Reads NVIDIA_API_KEY from the environment. Prompt falls back to stdin for piping.
// `models` caches the (public) model list in the OS temp dir for 24h; `verify` never caches.
import { parseArgs } from 'node:util';
import { readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { listModels, chat, getModelProfile, NimError, DEFAULT_MODEL } from './nim-lib.mjs';

const CACHE_FILE = join(tmpdir(), 'bellows-models-cache.json');
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

export function cacheIsFresh(fetchedAtMs, nowMs) {
  return nowMs - fetchedAtMs < CACHE_TTL_MS;
}

function cachedListModels() {
  try {
    const { fetchedAt, models } = JSON.parse(readFileSync(CACHE_FILE, 'utf8'));
    if (cacheIsFresh(fetchedAt, Date.now())) return models;
  } catch {
    // no cache or unreadable: fall through to a live fetch
  }
  return null;
}

const USAGE = `Usage:
  nim.mjs verify
  nim.mjs models [--json]
  nim.mjs profile [<model-id>]
  nim.mjs chat [--model <id>] [--system <text>] [--max-tokens <n>] [--] <prompt...>   (prompt may be piped on stdin)`;

export function parseCliArgs(argv) {
  const [command, ...rest] = argv;
  if (!['verify', 'models', 'profile', 'chat'].includes(command)) {
    throw new Error(`Unknown command: ${command ?? '(none)'}\n${USAGE}`);
  }
  const { values, positionals } = parseArgs({
    args: rest,
    options: {
      model: { type: 'string' },
      system: { type: 'string' },
      json: { type: 'boolean', default: false },
      'max-tokens': { type: 'string' },
    },
    allowPositionals: true,
  });
  let maxTokens;
  if (values['max-tokens'] !== undefined) {
    maxTokens = Number(values['max-tokens']);
    if (!Number.isInteger(maxTokens) || maxTokens <= 0) {
      throw new Error(`--max-tokens must be a positive integer, got: ${values['max-tokens']}\n${USAGE}`);
    }
  }
  return {
    command,
    // `profile` names its model as a positional; the other commands use --model.
    model: (command === 'profile' ? positionals[0] : values.model) ?? DEFAULT_MODEL,
    system: values.system,
    json: values.json,
    maxTokens,
    prompt: positionals.join(' '),
  };
}

async function readStdin() {
  let data = '';
  for await (const chunk of process.stdin) data += chunk;
  return data.trim();
}

async function main() {
  const args = parseCliArgs(process.argv.slice(2));
  if (args.command === 'verify') {
    const models = await listModels();
    console.log(`OK: key valid, ${models.length} models available`);
    return;
  }
  if (args.command === 'models') {
    let models = cachedListModels();
    if (!models) {
      models = await listModels();
      try {
        writeFileSync(CACHE_FILE, JSON.stringify({ fetchedAt: Date.now(), models }));
      } catch {
        // cache write failure is not worth failing the command over
      }
    }
    console.log(args.json ? JSON.stringify(models, null, 2) : models.join('\n'));
    return;
  }
  if (args.command === 'profile') {
    const { params, source } = await getModelProfile(args.model);
    console.log(JSON.stringify({ model: args.model, source, params }, null, 2));
    if (source === 'fallback') {
      console.error('No profile could be resolved; calls to this model will use generic parameters.');
    }
    return;
  }
  // chat
  const prompt = args.prompt || (await readStdin());
  if (!prompt) throw new Error(`chat needs a prompt (argument or stdin).\n${USAGE}`);
  const { text, fromReasoning } = await chat({
    model: args.model,
    system: args.system,
    prompt,
    maxTokens: args.maxTokens,
  });
  if (fromReasoning) {
    console.error('[bellows] model produced no final answer; showing its reasoning channel instead');
  }
  console.log(text);
}

const isDirectRun = process.argv[1] && import.meta.url === new URL(`file:///${process.argv[1].replace(/\\/g, '/')}`).href;
if (isDirectRun) {
  main().catch((err) => {
    console.error(err instanceof NimError && err.hint ? `${err.message}\n${err.hint}` : err.message);
    process.exit(1);
  });
}
