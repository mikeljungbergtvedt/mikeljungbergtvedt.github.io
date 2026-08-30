'use strict';

/**
 * JR Finn adapter — try-require Mini Easy/V3/V3G searchers at runtime.
 * Does not copy or edit those files. Does not start peasy-auto.js.
 *
 * Mini paths (when runner lives at /Users/bot/peasy-auto/loop2):
 *   ../finn-origin.js
 *   ../ai-finn-comp-filter.js
 *   ../origin-cv.js
 *   ../ident-comps-score.js
 *   ../v2/v3-eval.js
 *   ../v2/v3-eval-runner.js
 *   ../v3g/v3g-eval.js
 *   ../peasy-auto.js          (Easy v20 — process, never required)
 */

const mini = require('./mini-load');

const FINN_REL = [
  'finn-origin.js',
  'ai-finn-comp-filter.js',
  'v2/v3-eval.js',
  'v2/v3-eval-runner.js',
  'v3g/v3g-eval.js',
  'origin-cv.js',
  'ident-comps-score.js',
  'peasy-auto.js',
];

const FINN_EXPORTS = ['searchRaw', 'search', 'fetchComps', 'finnSearch', 'getFinnComps', 'checkFinnListing', 'scrapeFinnUrl', 'searchListings'];

function empty(reason, extra) {
  return Object.assign({
    available: false,
    reason: reason || 'Mini Finn searcher unavailable',
    finn_now: [],
    sold_under_3m: [],
    origin_on_finn: null,
  }, extra || {});
}

function mapFinnResult(result, origin) {
  const now = Date.now();
  const raw = mini.flattenListings(result);
  let finnNow = [];
  let sold3 = [];
  if (result && Array.isArray(result.finn_now)) finnNow = result.finn_now.map(mini.normListing).filter(Boolean);
  if (result && Array.isArray(result.sold_under_3m)) sold3 = result.sold_under_3m.map(mini.normListing).filter(Boolean);
  if (!finnNow.length) finnNow = raw.filter((l) => !mini.isSold(l));
  if (!sold3.length) sold3 = raw.filter((l) => mini.soldWithin3m(l, now));
  const originOnFinn = mini.pickOriginOnFinn(result, raw, origin);
  return {
    available: true,
    finn_now: finnNow,
    sold_under_3m: sold3,
    origin_on_finn: originOnFinn,
    used: null,
  };
}

async function searchRaw(origin, opts) {
  const o = Object.assign({ kmCut: false, yearCut: false, twinLock: false }, opts || {});
  const flags = Object.assign({}, mini.UNBOUNDED, {
    kmCut: false,
    yearCut: false,
    twinLock: false,
  });
  try {
    const paths = mini.resolveMiniPaths(FINN_REL, o);
    const loaded = await mini.tryLoadFirst(paths, Object.assign({}, o, { exportNames: FINN_EXPORTS }));
    if (!loaded.available) {
      return empty('Mini Finn module missing or not a library. Tried: ' + (loaded.tried || []).join('; '), { tried: loaded.tried });
    }
    const result = await mini.callSearcher(loaded.fn, origin || {}, flags);
    const mapped = mapFinnResult(result, origin || {});
    mapped.used = { file: loaded.file, export: loaded.name };
    return mapped;
  } catch (e) {
    return empty('Mini Finn search failed: ' + String(e && e.message || e));
  }
}

module.exports = {
  searchRaw,
  FINN_REL,
  FINN_EXPORTS,
  mapFinnResult,
};
