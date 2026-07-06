import { test } from 'node:test';
import assert from 'node:assert/strict';
import { slugify } from './slug.mjs';

test('slugify lowercases and collapses non [a-z0-9._-] runs to a dash', () => {
  assert.equal(slugify('deepseek-ai/deepseek-v4-pro'), 'deepseek-ai-deepseek-v4-pro');
  assert.equal(slugify('qwen/qwen3.5-397b-a17b'), 'qwen-qwen3.5-397b-a17b');
  assert.equal(slugify('Meta/Llama 3.3 70B'), 'meta-llama-3.3-70b');
});
