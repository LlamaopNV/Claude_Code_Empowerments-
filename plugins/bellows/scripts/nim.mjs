#!/usr/bin/env node
// bellows CLI: verify | models [--json] | chat [--model id] [--system text] <prompt...>
// Reads NVIDIA_API_KEY from the environment. Prompt falls back to stdin for piping.
// `models` caches the (public) model list in the OS temp dir for 24h; `verify` never caches.
import { parseArgs } from 'node:util';
import { readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { listModels, chat, NimError, DEFAULT_MODEL } from './nim-lib.mjs';

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
  nim.mjs chat [--model <id>] [--system <text>] <prompt...>   (prompt may be piped on stdin)`;

export function parseCliArgs(argv) {
  const [command, ...rest] = argv;
  if (!['verify', 'models', 'chat'].includes(command)) {
    throw new Error(`Unknown command: ${command ?? '(none)'}\n${USAGE}`);
  }
  const { values, positionals } = parseArgs({
    args: rest,
    options: {
      model: { type: 'string' },
      system: { type: 'string' },
      json: { type: 'boolean', default: false },
    },
    allowPositionals: true,
  });
  return {
    command,
    model: values.model ?? DEFAULT_MODEL,
    system: values.system,
    json: values.json,
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
  // chat
  const prompt = args.prompt || (await readStdin());
  if (!prompt) throw new Error(`chat needs a prompt (argument or stdin).\n${USAGE}`);
  console.log(await chat({ model: args.model, system: args.system, prompt }));
}

const isDirectRun = process.argv[1] && import.meta.url === new URL(`file:///${process.argv[1].replace(/\\/g, '/')}`).href;
if (isDirectRun) {
  main().catch((err) => {
    console.error(err instanceof NimError && err.hint ? `${err.message}\n${err.hint}` : err.message);
    process.exit(1);
  });
}
