import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCliArgs, cacheIsFresh } from './nim.mjs';
import { DEFAULT_MODEL } from './nim-lib.mjs';

test('parses verify', () => {
  assert.deepEqual(parseCliArgs(['verify']).command, 'verify');
});

test('parses models --json', () => {
  const p = parseCliArgs(['models', '--json']);
  assert.equal(p.command, 'models');
  assert.equal(p.json, true);
});

test('parses chat with model, system and joined prompt', () => {
  const p = parseCliArgs(['chat', '--model', 'deepseek-ai/deepseek-v3.1', '--system', 'be terse', 'fix', 'this', 'bug']);
  assert.equal(p.command, 'chat');
  assert.equal(p.model, 'deepseek-ai/deepseek-v3.1');
  assert.equal(p.system, 'be terse');
  assert.equal(p.prompt, 'fix this bug');
});

test('parses chat --max-tokens as a number', () => {
  const p = parseCliArgs(['chat', '--max-tokens', '512', 'hello']);
  assert.equal(p.maxTokens, 512);
  assert.equal(parseCliArgs(['chat', 'hello']).maxTokens, undefined);
});

test('rejects a non-numeric --max-tokens', () => {
  assert.throws(() => parseCliArgs(['chat', '--max-tokens', 'lots', 'hello']), /--max-tokens/);
});

test('parses profile with a positional model id, defaulting when omitted', () => {
  const p = parseCliArgs(['profile', 'nvidia/nemotron-3-ultra-550b-a55b']);
  assert.equal(p.command, 'profile');
  assert.equal(p.model, 'nvidia/nemotron-3-ultra-550b-a55b');
  assert.equal(parseCliArgs(['profile']).model, DEFAULT_MODEL);
});

test('unknown command throws with usage', () => {
  assert.throws(() => parseCliArgs(['frobnicate']), /Usage/);
});

test('cacheIsFresh is true within 24h and false after', () => {
  const day = 24 * 60 * 60 * 1000;
  assert.equal(cacheIsFresh(1000, 1000 + day - 1), true);
  assert.equal(cacheIsFresh(1000, 1000 + day + 1), false);
});
