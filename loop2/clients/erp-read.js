'use strict';

/**
 * TODO (Mini): optional READ-ONLY lookup of origin CV from ERP / liste 3.
 *
 * HARD RULES
 * - Never POST/PUT/PATCH to ERP.
 * - Never send an eval or persist prices. Read only.
 * - This file must stay read-only. writes_erp is always false in the runner.
 */

async function readOrigin(_hint, _opts) {
  return {
    available: false,
    reason: 'TODO: ERP read client is not in this repo. Hook a GET-only Mini lookup if you have internnr/regnr without a full CV.',
    origin: null,
  };
}

module.exports = { readOrigin };
