import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { loadRunIndex, loadScorecard, sortByNewest } from './dataLayer.js';

const here = dirname(fileURLToPath(import.meta.url));
// UI builds against the core fixtures (the canonical UI build target).
const fixtures = resolve(here, '../../core/fixtures');

function readFixture(name: string): unknown {
  return JSON.parse(readFileSync(resolve(fixtures, name), 'utf8'));
}

describe('@anvil/ui data layer (skeleton)', () => {
  it('loads the run index fixture through the core contract', () => {
    const idx = loadRunIndex(readFixture('index.json'));
    expect(idx.runs.length).toBe(1);
  });

  it('loads the full scorecard fixture through the core contract', () => {
    const card = loadScorecard(readFixture('result.scorecard.json'));
    expect(card.suiteName).toBe('bake-to-completion effectiveness');
  });

  it('sorts entries newest-first', () => {
    const sorted = sortByNewest([
      { createdAt: '2026-01-01T00:00:00.000Z' } as never,
      { createdAt: '2026-06-21T00:00:00.000Z' } as never,
    ]);
    expect(sorted[0]?.createdAt).toBe('2026-06-21T00:00:00.000Z');
  });
});
