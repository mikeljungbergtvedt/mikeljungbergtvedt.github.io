'use strict';

/**
 * JR car.info adapter — try-require Mini V3/V3G collectors at runtime.
 * Does not copy or edit those files. Twin pick is not done here.
 *
 * Mini paths (when runner lives at /Users/bot/peasy-auto/loop2):
 *   ../v2/v3-eval.js
 *   ../v2/v3-eval-runner.js
 *   ../v3g/v3g-eval.js
 *   ../origin-cv.js
 *   ../ident-comps-score.js
 *   ../finn-origin.js
 *   ../ai-finn-comp-filter.js
 *   ../peasy-auto.js          (Easy v20 — process, never required)
 */

const mini = require('./mini-load');

const CARINFO_REL = [
  'v2/v3-eval.js',
  'v2/v3-eval-runner.js',
  'v3g/v3g-eval.js',
  'origin-cv.js',
  'ident-comps-score.js',
  'finn-origin.js',
  'ai-finn-comp-filter.js',
  'peasy-auto.js',
];

const CARINFO_EXPORTS = [
  'searchRaw',
  'search',
  'fetchComps',
  'finnSearch',
  'fetchCarInfo',
  'collectAllData',
  'collectOnly',
  'getCarInfoApi',
  'fetchClassifieds',
];

function empty(reason, extra) {
  return Object.assign({
    available: false,
    reason: reason || 'Mini car.info searcher unavailable',
    own_sold: [],
    extra: [],
  }, extra || {});
}

function mapCarinfoResult(result) {
  const raw = mini.flattenListings(result);
  let ownSold = [];
  if (result && Array.isArray(result.own_sold)) ownSold = result.own_sold.map(mini.normListing).filter(Boolean);
  if (!ownSold.length) {
    ownSold = raw.filter((l) => mini.isSold(l) && mini.isOwnDealer(l));
  }
  if (!ownSold.length) {
    const dealer = raw.filter((l) => mini.isOwnDealer(l));
    ownSold = dealer.length ? dealer.filter(mini.isSold) : raw.filter(mini.isSold);
  }
  return {
    available: true,
    own_sold: ownSold,
    extra: raw,
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
    const paths = mini.resolveMiniPaths(CARINFO_REL, o);
    const loaded = await mini.tryLoadFirst(paths, Object.assign({}, o, { exportNames: CARINFO_EXPORTS }));
    if (!loaded.available) {
      return empty('Mini car.info module missing or not a library. Tried: ' + (loaded.tried || []).join('; '), { tried: loaded.tried });
    }
    const result = await mini.callSearcher(loaded.fn, origin || {}, flags);
    const mapped = mapCarinfoResult(result);
    mapped.used = { file: loaded.file, export: loaded.name };
    return mapped;
  } catch (e) {
    return empty('Mini car.info search failed: ' + String(e && e.message || e));
  }
}

module.exports = {
  searchRaw,
  CARINFO_REL,
  CARINFO_EXPORTS,
  mapCarinfoResult,
};
