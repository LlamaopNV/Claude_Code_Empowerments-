/**
 * Pinned token pricing table (Ticket 1.5, cost math).
 *
 * IMPORTANT — subscription caveat:
 *   When Anvil runs in-session on a Claude subscription, the transcript's
 *   `total_cost_usd` (when present) is an ESTIMATE the CLI computes; it is NOT
 *   what the subscription is billed (a subscription is a flat fee, not metered).
 *   Anvil therefore reports cost from **token math against this pinned table**,
 *   which is a deterministic, reproducible "what an equivalent metered API call
 *   would have cost" figure — explicitly a comparison/΄estimate, not a bill.
 *
 * Prices are USD per 1,000,000 tokens. This table is VERSIONED DATA: bump
 * {@link PRICING_VERSION} and add an entry rather than mutating an existing one,
 * so historical scorecards remain reproducible. Figures here are the published
 * list prices as pinned on the date in {@link PRICING_VERSION}; they are data,
 * not a live feed.
 */

/** Version stamp for the pinned pricing table. Date-based for traceability. */
export const PRICING_VERSION = '2026-06-21' as const;

/** Per-million-token prices for one model. */
export interface ModelPricing {
  /** USD per 1e6 base input tokens. */
  inputPerMTok: number;
  /** USD per 1e6 output tokens. */
  outputPerMTok: number;
  /** USD per 1e6 tokens written to the prompt cache (cache-creation). */
  cacheWritePerMTok: number;
  /** USD per 1e6 tokens read from the prompt cache (cache-read / hit). */
  cacheReadPerMTok: number;
}

/**
 * Pinned price list, keyed by model id. Keys are matched case-sensitively and
 * also by a normalized prefix (see {@link priceFor}) so dated model ids like
 * `claude-opus-4-20250514` resolve to the family entry.
 */
export const PRICING_TABLE: Readonly<Record<string, ModelPricing>> = Object.freeze({
  // Claude Opus 4.x family
  'claude-opus-4': {
    inputPerMTok: 15,
    outputPerMTok: 75,
    cacheWritePerMTok: 18.75,
    cacheReadPerMTok: 1.5,
  },
  // Claude Sonnet 4.x family
  'claude-sonnet-4': {
    inputPerMTok: 3,
    outputPerMTok: 15,
    cacheWritePerMTok: 3.75,
    cacheReadPerMTok: 0.3,
  },
  // Claude Haiku 3.5 / 4 family
  'claude-haiku': {
    inputPerMTok: 0.8,
    outputPerMTok: 4,
    cacheWritePerMTok: 1,
    cacheReadPerMTok: 0.08,
  },
});

/** Fallback used when a model id matches nothing in the table. */
export const DEFAULT_PRICING: ModelPricing = Object.freeze({
  inputPerMTok: 3,
  outputPerMTok: 15,
  cacheWritePerMTok: 3.75,
  cacheReadPerMTok: 0.3,
});

/**
 * Resolve the pricing for a model id. Tries an exact key first, then the
 * longest matching family prefix (so `claude-opus-4-20250514` → `claude-opus-4`).
 * Returns {@link DEFAULT_PRICING} when nothing matches (callers can detect this
 * by identity). Never throws.
 */
export function priceFor(modelId: string): ModelPricing {
  const exact = PRICING_TABLE[modelId];
  if (exact) return exact;

  // Longest-prefix match: prefer the most specific family key.
  let best: { key: string; pricing: ModelPricing } | undefined;
  for (const [key, pricing] of Object.entries(PRICING_TABLE)) {
    if (modelId.startsWith(key) && (best === undefined || key.length > best.key.length)) {
      best = { key, pricing };
    }
  }
  return best?.pricing ?? DEFAULT_PRICING;
}
