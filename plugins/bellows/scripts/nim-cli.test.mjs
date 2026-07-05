import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCliArgs, cacheIsFresh } from './nim.mjs';

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

test('unknown command throws with usage', () => {
  assert.throws(() => parseCliArgs(['frobnicate']), /Usage/);
});

test('cacheIsFresh is true within 24h and false after', () => {
  const day = 24 * 60 * 60 * 1000;
  assert.equal(cacheIsFresh(1000, 1000 + day - 1), true);
  assert.equal(cacheIsFresh(1000, 1000 + day + 1), false);
});
