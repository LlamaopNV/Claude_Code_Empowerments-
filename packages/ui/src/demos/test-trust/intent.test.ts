import { describe, it, expect } from 'vitest';
import {
  SHIPPING_INTENT_SCENARIO,
  isSafeResolution,
  safeResolutions,
} from './intent.js';

describe('shipping intent scenario', () => {
  it('offers exactly two candidate rules (inclusive vs exclusive)', () => {
    expect(SHIPPING_INTENT_SCENARIO.candidates.map((c) => c.id).sort()).toEqual([
      'exclusive',
      'inclusive',
    ]);
  });

  it('treats only "confirm intent" as safe', () => {
    expect(isSafeResolution('confirm-intent')).toBe(true);
    expect(isSafeResolution('guess-code-gte')).toBe(false);
    expect(isSafeResolution('guess-test-51')).toBe(false);
  });

  it('exposes a single safe resolution — confirming intent', () => {
    const safe = safeResolutions();
    expect(safe).toHaveLength(1);
    expect(safe[0]?.id).toBe('confirm-intent');
  });
});
