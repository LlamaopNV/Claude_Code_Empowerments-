/**
 * @anvil/ui — data-layer facade.
 *
 * Re-exports the dual-mode data source (live API / static Pages JSON) and the
 * pure transforms, plus the original thin parse helpers the skeleton test
 * exercises. App code imports from here.
 */
import {
  parseRunIndex,
  parseScorecard,
  type RunIndex,
  type Scorecard,
} from '@anvil/core';

export * from './data/index.js';
export * from './data/transforms.js';

/** Load + validate the run index (the leaderboard source). */
export function loadRunIndex(raw: unknown): RunIndex {
  return parseRunIndex(raw);
}

/** Load + validate a single full result. */
export function loadScorecard(raw: unknown): Scorecard {
  return parseScorecard(raw);
}
