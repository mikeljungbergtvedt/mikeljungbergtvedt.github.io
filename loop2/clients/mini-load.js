'use strict';

/**
 * Runtime loader for Mini Easy / V3 / V3G searchers.
 * Never starts peasy-auto.js (that file calls main() on load).
 * Never copies or patches those modules.
 */

const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const SEARCH_EXPORTS = [
  'searchRaw',
  'search',
  'fetchComps',
  'finnSearch',
  'getFinnComps',
  'checkFinnListing',
  'scrapeFinnUrl',
  'scrapeFinn',
  'searchListings',
  'fetchClassifieds',
  'fetchCarInfo',
  'collectAllData',
  'collectOnly',
  'getCarInfoApi',
  'getCarInfoFetch',
  'findOrigin',
  'getOrigin',
];

const MINI_REL = [
  'finn-origin.js',
  'ai-finn-comp-filter.js',
  'origin-cv.js',
  'ident-comps-score.js',
  'v2/v3-eval.js',
  'v2/v3-eval-runner.js',
  'v3g/v3g-eval.js',
  'peasy-auto.js',
];

const UNBOUNDED = Object.freeze({
  kmCut: false,
  yearCut: false,
  twinLock: false,
  km_cut: false,
  year_cut: false,
  twin_lock: false,
  year_from: null,
  year_to: null,
  mileage_from: null,
  mileage_to: null,
  unbounded: true,
});

function peasyAutoRoot(opts) {
  const o = opts || {};
  if (o.peasyAutoDir) return path.resolve(o.peasyAutoDir);
  if (process.env.PEASY_AUTO_DIR) return path.resolve(process.env.PEASY_AUTO_DIR);
  const fromLoop2 = path.resolve(__dirname, '..', '..');
  if (path.basename(fromLoop2) === 'peasy-auto') return fromLoop2;
  return '/Users/bot/peasy-auto';
}

function resolveMiniPaths(relPaths, opts) {
  const root = peasyAutoRoot(opts);
  return (relPaths || MINI_REL).map((rel) => path.join(root, rel));
}

function isPeasyAutoProcess(file) {
  return path.basename(file) === 'peasy-auto.js';
}

function looksSafeToRequire(file) {
  if (isPeasyAutoProcess(file)) return false;
  let src = '';
  try { src = fs.readFileSync(file, 'utf8'); } catch (_e) { return false; }
  const hasExport = /module\.exports\s*=/.test(src)
    || /exports\.\w+\s*=/.test(src)
    || /export\s+(async\s+)?function/.test(src)
    || /export\s+\{/.test(src)
    || /export\s+async\s+function/.test(src);
  if (!hasExport) return false;
  const startsMain = /^\s*main\s*\(\s*\)/m.test(src) && !/require\.main\s*===\s*module/.test(src);
  if (startsMain) return false;
  return true;
}

function pickFirstFunction(mod, extraNames) {
  if (typeof mod === 'function') return { fn: mod, name: 'default' };
  if (!mod || typeof mod !== 'object') return null;
  const names = (extraNames || []).concat(SEARCH_EXPORTS);
  const seen = new Set();
  for (const n of names) {
    if (seen.has(n)) continue;
    seen.add(n);
    if (typeof mod[n] === 'function') return { fn: mod[n], name: n };
  }
  return null;
}

async function loadModule(file, opts) {
  const o = opts || {};
  if (o.requireFn) return o.requireFn(file);
  if (!fs.existsSync(file)) {
    const err = new Error('ENOENT ' + file);
    err.code = 'ENOENT';
    throw err;
  }
  if (!looksSafeToRequire(file)) {
    const err = new Error('skip unsafe require: ' + file);
    err.code = 'LOOP2_SKIP_REQUIRE';
    throw err;
  }
  try {
    return require(file);
  } catch (e) {
    if (e && (e.code === 'ERR_REQUIRE_ESM' || /Cannot use import/.test(String(e.message || e)))) {
      return import(pathToFileURL(file).href);
    }
    throw e;
  }
}

async function tryLoadFirst(paths, opts) {
  const o = opts || {};
  if (o.mini) {
    const hit = pickFirstFunction(o.mini, o.exportNames);
    if (!hit) return { available: false, reason: 'injected Mini module has no search export', tried: ['(injected)'] };
    return { available: true, mod: o.mini, fn: hit.fn, name: hit.name, file: '(injected)', tried: ['(injected)'] };
  }
  const tried = [];
  for (const file of paths) {
    tried.push(file);
    try {
      const mod = await loadModule(file, o);
      const hit = pickFirstFunction(mod, o.exportNames);
      if (hit) return { available: true, mod, fn: hit.fn, name: hit.name, file, tried };
      tried[tried.length - 1] = file + ' (no search export)';
    } catch (e) {
      const code = e && e.code;
      if (code === 'ENOENT') tried[tried.length - 1] = file + ' (missing)';
      else if (code === 'LOOP2_SKIP_REQUIRE') tried[tried.length - 1] = file + ' (not a library — skip, Easy/V3 untouched)';
      else tried[tried.length - 1] = file + ' (' + String(e && e.message || e).slice(0, 80) + ')';
    }
  }
  return { available: false, reason: 'Mini searcher not loadable', tried };
}

async function callSearcher(fn, origin, flags) {
  const f = Object.assign({}, UNBOUNDED, flags || {});
  const attempts = [
    () => fn(origin, f),
    () => fn(origin.regnr, origin.km, f),
    () => fn(origin.regnr, f),
    () => fn(Object.assign({}, origin, f)),
  ];
  let lastErr = null;
  for (const a of attempts) {
    try {
      return await a();
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr || new Error('searcher call failed');
}

function num(v) {
  if (v == null || v === '') return null;
  const n = Number(String(v).replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

function normListing(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const regnr = String(raw.regnr || raw.licence_plate || raw.license_plate || raw.skilt || '').toUpperCase().replace(/\s+/g, '');
  const pris = num(raw.pris != null ? raw.pris : (raw.price != null ? raw.price : (raw.classified_price != null ? raw.classified_price : raw.ask)));
  const km = num(raw.km != null ? raw.km : (raw.mileage != null ? raw.mileage : raw.mileage_km));
  const aar = num(raw.aar != null ? raw.aar : (raw.year != null ? raw.year : raw.model_year));
  const url = raw.url || raw.link || raw.finn_url || raw.classified_url || null;
  const sold = raw.sold_date || raw.ca_sold_date || raw.solgt || raw.sold || null;
  const status = raw.status || (sold ? 'solgt' : (raw.is_active === false ? 'solgt' : 'til_salgs'));
  const title = raw.title || raw.heading || raw.classified_title || raw.tittel || null;
  const kilde = raw.kilde || raw.type || raw.source || null;
  return {
    regnr: regnr || null,
    pris,
    km,
    aar,
    status,
    kilde,
    url,
    title,
    sold_date: sold || null,
    published: raw.published_date || raw.publisert || raw.classified_published_date || null,
  };
}

function asArray(v) {
  if (!v) return [];
  if (Array.isArray(v)) return v;
  if (Array.isArray(v.comps)) return v.comps;
  if (Array.isArray(v.pool)) return v.pool;
  if (Array.isArray(v.listings)) return v.listings;
  if (Array.isArray(v.classifieds)) return v.classifieds;
  return [];
}

/** Prefer raw/unbounded arrays. Do not keep Easy/V3 km/year windows. */
function rawListingArrays(result) {
  if (result == null) return [];
  if (Array.isArray(result)) return [result];
  const keys = [
    'classifieds', 'allComps', 'all_comps', 'raw', 'listings', 'deduped',
    'company_classifieds', 'private_classifieds', 'finn_now', 'sold_under_3m',
    'own_sold', 'activeComps', 'comps', 'pool',
  ];
  const out = [];
  for (const k of keys) {
    if (Array.isArray(result[k]) && result[k].length) out.push(result[k]);
  }
  const val = result.valuation || (result.result && result.result.valuation) || {};
  for (const k of ['company_classifieds', 'private_classifieds']) {
    if (Array.isArray(val[k]) && val[k].length) out.push(val[k]);
  }
  const src = result.sources && result.sources.car_info;
  const srcVal = src && src.result && src.result.valuation;
  if (srcVal) {
    for (const k of ['company_classifieds', 'private_classifieds']) {
      if (Array.isArray(srcVal[k]) && srcVal[k].length) out.push(srcVal[k]);
    }
  }
  if (!out.length && result.data) return rawListingArrays(result.data);
  return out;
}

function flattenListings(result) {
  const bags = rawListingArrays(result);
  const flat = [];
  const seen = new Set();
  for (const bag of bags) {
    for (const item of bag) {
      const n = normListing(item);
      if (!n) continue;
      const key = [n.regnr || '', n.url || '', n.pris || '', n.km || ''].join('|');
      if (seen.has(key)) continue;
      seen.add(key);
      flat.push(n);
    }
  }
  return flat;
}

function soldWithin3m(item, now) {
  const t = Date.parse(item && item.sold_date);
  if (!Number.isFinite(t)) return false;
  return (now - t) <= 93 * 24 * 60 * 60 * 1000;
}

function isSold(item) {
  if (!item) return false;
  if (item.sold_date) return true;
  const s = String(item.status || '').toLowerCase();
  return s.indexOf('solgt') >= 0 || s === 'sold';
}

function isOwnDealer(item) {
  const k = String((item && item.kilde) || '').toLowerCase();
  return k === 'forhandler' || k === 'company' || k === 'own' || k === 'autoringen' || k === 'peasy' || k === 'dealer';
}

function pickOriginOnFinn(result, listings, origin) {
  if (result && result.origin_on_finn) return normListing(result.origin_on_finn) || result.origin_on_finn;
  if (result && result.origin && !Array.isArray(result.origin)) return normListing(result.origin);
  if (result && Array.isArray(result.origin) && result.origin[0]) return normListing(result.origin[0]);
  const rg = String((origin && origin.regnr) || '').toUpperCase();
  if (!rg) return null;
  return listings.find((l) => l.regnr === rg) || null;
}

module.exports = {
  SEARCH_EXPORTS,
  MINI_REL,
  UNBOUNDED,
  peasyAutoRoot,
  resolveMiniPaths,
  isPeasyAutoProcess,
  looksSafeToRequire,
  pickFirstFunction,
  loadModule,
  tryLoadFirst,
  callSearcher,
  normListing,
  flattenListings,
  soldWithin3m,
  isSold,
  isOwnDealer,
  pickOriginOnFinn,
};
