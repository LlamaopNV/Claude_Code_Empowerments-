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

test('every result now carries a codes array; blockCount 1 keeps old behavior', () => {
  const one = extractSolution('x\n```python\na = 1\n```\n', 'none');
  assert.deepEqual(one.codes, ['a = 1\n']);
  assert.equal(one.code, 'a = 1\n');
  const raw = extractSolution('def f(x):\n    return x\n', 'none');
  assert.deepEqual(raw.codes, [raw.code]);
  const none = extractSolution('Sorry, no.', 'none');
  assert.deepEqual(none.codes, []);
});

test('blockCount 2 takes the LAST two blocks in reply order', () => {
  const reply = 'Draft:\n```python\nold\n```\nPython:\n```python\nPY\n```\nGo:\n```go\nGO\n```\n';
  const r = extractSolution(reply, 'none', { blockCount: 2 });
  assert.deepEqual(r.codes, ['PY\n', 'GO\n']);
  assert.equal(r.code, 'GO\n');
  assert.equal(r.decision, 'last_fence');
  assert.equal(r.fenceCount, 3);
});

test('blockCount 2 with a single fence returns one code (right-aligned by the grader)', () => {
  const r = extractSolution('```go\nGO\n```\n', 'none', { blockCount: 2 });
  assert.deepEqual(r.codes, ['GO\n']);
  assert.equal(r.decision, 'last_fence');
});

test('blockCount 2 never raw-falls-back: a fence-less reply is none', () => {
  const r = extractSolution('def f():\n    return 1\n', 'none', { blockCount: 2 });
  assert.equal(r.decision, 'none');
  assert.deepEqual(r.codes, []);
});

test('4-backtick fences are blocks and can wrap 3-backtick content', () => {
  const wrapped = 'Here you go:\n````text\nouter\n```js\ninner\n```\nmore\n````\ndone';
  const r = extractSolution(wrapped, 'none');
  assert.equal(r.fenceCount, 1);
  assert.equal(r.code, 'outer\n```js\ninner\n```\nmore\n');
  const two = extractSolution('```python\na\n```\n````python\nb\n````\n', 'none');
  assert.equal(two.fenceCount, 2);
  assert.equal(two.code, 'b\n');
});

test('homograph prose starting with let/var/class/package no longer raw-falls-back', () => {
  for (const prose of [
    'let me explain what happened here.',
    'var ious approaches could work for this.',
    'class dismissed — the answer is no.',
    'package deal for you today only.',
  ]) {
    assert.equal(extractSolution(prose, 'none').decision, 'none', prose);
  }
});

test('real single-token-keyword source still raw-falls-back', () => {
  assert.equal(extractSolution('let total = 0;\ntotal += 1;\n', 'none').decision, 'raw_fallback');
  assert.equal(extractSolution('var count = compute();\n', 'none').decision, 'raw_fallback');
  assert.equal(extractSolution('class Tokenizer:\n    pass\n', 'none').decision, 'raw_fallback');
  assert.equal(extractSolution('package main\n\nfunc main() {}\n', 'none').decision, 'raw_fallback');
  assert.equal(extractSolution('WITH t AS (SELECT 1) SELECT * FROM t;\n', 'none').decision, 'raw_fallback');
});
