'use strict';

/**
 * TODO (Mini): wire car.info when the client lives on Mini.
 * This repo does not ship car.info credentials.
 *
 * JR contract — raw listings only, no twin lock:
 *   searchRaw(origin) → { available, reason, own_sold, extra }
 */

async function searchRaw(_origin, _opts) {
  return {
    available: false,
    reason: 'TODO: car.info client is not in this repo. Hook Mini peasy-auto car.info here (no ±km / ±year lock).',
    own_sold: [],
    extra: [],
  };
}

module.exports = { searchRaw };
