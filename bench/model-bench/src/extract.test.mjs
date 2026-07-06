import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stripReasoning, extractSolution } from './extract.mjs';

test('stripReasoning removes paired and unclosed <think> blocks for inline_think', () => {
  assert.equal(stripReasoning('<think>a</think>X', 'inline_think'), 'X');
  assert.equal(stripReasoning('X<think>trailing, never closed', 'inline_think'), 'X');
  assert.equal(stripReasoning('<think>keep</think>', 'reasoning_content'), '<think>keep</think>');
});

test('extractSolution takes the LAST fenced block', () => {
  const reply = 'First try:\n```python\nold\n```\nFinal:\n```python\nnew = 1\n```\ndone';
  const r = extractSolution(reply, 'none');
  assert.equal(r.code, 'new = 1\n');
  assert.equal(r.decision, 'last_fence');
  assert.equal(r.fenceCount, 2);
});

test('extractSolution ignores fences inside <think> for inline_think models', () => {
  const reply = '<think>```python\ndraft\n```</think>```python\nfinal\n```';
  assert.equal(extractSolution(reply, 'inline_think').code, 'final\n');
});

test('extractSolution falls back to raw reply when it looks like source', () => {
  const r = extractSolution('def f(x):\n    return x + 1\n', 'none');
  assert.equal(r.decision, 'raw_fallback');
  assert.match(r.code, /def f/);
});

test('extractSolution returns none for prose', () => {
  const r = extractSolution('Sorry, I cannot help with that.', 'none');
  assert.equal(r.code, null);
  assert.equal(r.decision, 'none');
});
