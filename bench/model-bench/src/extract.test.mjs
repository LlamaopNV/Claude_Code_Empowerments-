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
  for (const prose of [
    'Sorry, I cannot help with that.',
    '# Solution\nI cannot write this because it violates policy.',
    'From what I understand, this task is unclear, please clarify.',
  ]) {
    const r = extractSolution(prose, 'none');
    assert.equal(r.code, null, prose);
    assert.equal(r.decision, 'none', prose);
  }
});

test('raw_fallback still fires for real unfenced source', () => {
  assert.equal(extractSolution('const x = 1;\nexport default x;\n', 'none').decision, 'raw_fallback');
  assert.equal(extractSolution('from collections import deque\n\ndef f():\n    return deque()\n', 'none').decision, 'raw_fallback');
});

test('CRLF fences and think-stripped fences are counted correctly', () => {
  const crlf = 'Draft:\r\n```python\r\nold\r\n```\r\nFinal:\r\n```python\r\nnew = 1\r\n```\r\n';
  const r = extractSolution(crlf, 'none');
  assert.equal(r.fenceCount, 2);
  assert.equal(r.code, 'new = 1\r\n');
  const think = '<think>```python\ndraft\n```</think>```python\nfinal\n```';
  const t = extractSolution(think, 'inline_think');
  assert.equal(t.fenceCount, 1);
  assert.equal(t.decision, 'last_fence');
});
