import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCli } from './run.mjs';

test('parseCli parses phases, model lists, n and dry-run', () => {
  assert.deepEqual(parseCli(['--phase', '0', '--models', 'a/x,b/y']), { phase: '0', models: ['a/x', 'b/y'], dryRun: false, n: 5 });
  assert.deepEqual(parseCli(['--phase', '1', '--models', 'a/x', '--n', '3']), { phase: '1', models: ['a/x'], dryRun: false, n: 3 });
  assert.deepEqual(parseCli(['--dry-run']), { phase: null, models: ['meta/llama-3.3-70b-instruct'], dryRun: true, n: 1 });
  assert.throws(() => parseCli(['--phase', '1']), /--models/);
});
