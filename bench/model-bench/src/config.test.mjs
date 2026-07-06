import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { defaultConfig, validateConfig, saveConfig, loadConfig, samplingPlan } from './config.mjs';

test('defaultConfig applies spec rule 1 defaults', () => {
  const plain = defaultConfig('meta/llama-3.3-70b-instruct', { reasoning: false });
  assert.equal(plain.temperature, 0);
  assert.equal(plain.top_p, 1);
  assert.equal(plain.max_tokens, 8192);
  assert.equal(plain.reasoning_field, 'none');
  const think = defaultConfig('deepseek-ai/deepseek-v4-pro', { reasoning: true });
  assert.equal(think.temperature, 0.6);
  assert.equal(think.top_p, 0.95);
  assert.equal(think.max_tokens, 32768);
  assert.equal(think.reasoning_field, 'inline_think');
});

test('validateConfig rejects bad reasoning_field and missing numbers', () => {
  const cfg = defaultConfig('m', { reasoning: false });
  assert.throws(() => validateConfig({ ...cfg, reasoning_field: 'sometimes' }), /reasoning_field/);
  assert.throws(() => validateConfig({ ...cfg, temperature: null }), /temperature/);
});

test('save/load round-trips via the model slug', () => {
  const dir = mkdtempSync(join(tmpdir(), 'cfg-'));
  const cfg = defaultConfig('qwen/qwen3.5-397b-a17b', { reasoning: true });
  saveConfig(cfg, dir);
  assert.deepEqual(loadConfig('qwen/qwen3.5-397b-a17b', dir), cfg);
});

test('samplingPlan: greedy gets 1 deterministic + 4 at temp 0.2; sampled gets n at card settings', () => {
  const greedy = samplingPlan(defaultConfig('m', { reasoning: false }), 5);
  assert.equal(greedy.length, 5);
  assert.equal(greedy[0].temperature, 0);
  assert.deepEqual(new Set(greedy.slice(1).map((p) => p.temperature)), new Set([0.2]));
  const sampled = samplingPlan(defaultConfig('m', { reasoning: true }), 5);
  assert.equal(sampled.length, 5);
  assert.ok(sampled.every((p) => p.temperature === 0.6 && p.top_p === 0.95));
});

test('validateConfig rejects NaN and out-of-range numbers, listing every problem', () => {
  const cfg = defaultConfig('m', { reasoning: false });
  assert.throws(() => validateConfig({ ...cfg, temperature: NaN }), /temperature/);
  assert.throws(() => validateConfig({ ...cfg, temperature: 3 }), /temperature/);
  assert.throws(() => validateConfig({ ...cfg, top_p: 5 }), /top_p/);
  assert.throws(() => validateConfig({ ...cfg, top_p: 0 }), /top_p/);
  assert.throws(() => validateConfig({ ...cfg, max_tokens: -100 }), /max_tokens/);
  assert.throws(() => validateConfig({ ...cfg, max_tokens: 1.5 }), /max_tokens/);
  assert.throws(
    () => validateConfig({ ...cfg, temperature: NaN, top_p: 5 }),
    (e) => /temperature/.test(e.message) && /top_p/.test(e.message),
  );
});
