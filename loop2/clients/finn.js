'use strict';

/**
 * TODO (Mini): wire the live Finn client from /Users/bot/peasy-auto when it exists.
 * This GitHub Pages repo does not ship Finn HTTP credentials or scrapers.
 *
 * JR contract — no km/year cut, no locked twin window:
 *   searchRaw(origin) → { available, reason, finn_now, sold_under_3m, origin_on_finn }
 */

async function searchRaw(_origin, _opts) {
  return {
    available: false,
    reason: 'TODO: Finn client is not in this repo. Hook Mini peasy-auto Finn search here (no km/year cut).',
    finn_now: [],
    sold_under_3m: [],
    origin_on_finn: null,
  };
}

module.exports = { searchRaw };
