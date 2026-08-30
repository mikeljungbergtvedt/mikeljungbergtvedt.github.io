'use strict';

/**
 * JR Finn client — wires Mini `/Users/bot/peasy-auto/finn-origin.js` only.
 * Never require peasy-auto.js (that file starts Easy).
 *
 * Mini exports used:
 *   findFinnOrigin, parseCollectionHits, fetchFinnSearch (origin fallback only)
 * Mini exports NOT called (Easy twin windows — chefs pick twins):
 *   buildSisterSearch, kmWindow, yearWindow
 */

const fs = require('fs');
const path = require('path');
const { normListing, asHits } = require('./listing');

const FINN_ORIGIN_PATH = '/Users/bot/peasy-auto/finn-origin.js';

const FINN_ORIGIN_EXPORTS = [
  'fetchFinnSearch',
  'parseCollectionHits',
  'findFinnOrigin',
  'buildSisterSearch',
  'kmWindow',
  'yearWindow',
];

const FORBIDDEN_QUERY = ['year_from', 'year_to', 'mileage_from', 'mileage_to'];

const DEFAULT_FINN_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Accept-Language': 'nb-NO,nb;q=0.9,no;q=0.8,en;q=0.7',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
};

function empty(reason, extra) {
  return Object.assign({
    available: false,
    reason: reason || 'Mini finn-origin.js unavailable',
    finn_now: [],
    sold_under_3m: [],
    origin_on_finn: null,
  }, extra || {});
}

function buildRawSearchUrl(origin) {
  const merke = String((origin && origin.merke) || '').trim();
  const modell = String((origin && origin.modell) || '').trim();
  const q = encodeURIComponent((merke + ' ' + modell).trim()).replace(/%20/g, '+');
  return 'https://www.finn.no/mobility/search/car?q=' + q + '&registration_class=1';
}

function urlHasForbiddenQuery(url) {
  try {
    const u = new URL(url);
    return FORBIDDEN_QUERY.filter((k) => u.searchParams.has(k));
  } catch (_e) {
    return FORBIDDEN_QUERY.filter((k) => String(url).indexOf(k + '=') >= 0);
  }
}

function headersLikeFinnOrigin(filePath) {
  const h = Object.assign({}, DEFAULT_FINN_HEADERS);
  try {
    const src = fs.readFileSync(filePath || FINN_ORIGIN_PATH, 'utf8');
    const ua = src.match(/User-Agent['"]\s*:\s*['"]([^'"]+)/);
    const al = src.match(/Accept-Language['"]\s*:\s*['"]([^'"]+)/);
    if (ua) h['User-Agent'] = ua[1];
    if (al) h['Accept-Language'] = al[1];
  } catch (_e) { /* use defaults that match Mini / Easy */ }
  return h;
}

function loadFinnOrigin(opts) {
  const o = opts || {};
  if (o.finnOrigin) return { mod: o.finnOrigin, file: '(injected)' };
  const file = o.finnOriginPath || FINN_ORIGIN_PATH;
  if (path.basename(file) === 'peasy-auto.js') {
    return { mod: null, file, error: 'peasy-auto.js is not a library — never require' };
  }
  if (!fs.existsSync(file)) {
    return { mod: null, file, error: 'missing' };
  }
  try {
    return { mod: require(file), file };
  } catch (e) {
    return { mod: null, file, error: String(e && e.message || e) };
  }
}

function pickOriginHit(hit) {
  if (!hit) return null;
  if (hit.origin_on_finn) return normListing(hit.origin_on_finn) || hit.origin_on_finn;
  if (hit.hit && !Array.isArray(hit.hit)) return normListing(hit.hit) || hit.hit;
  if (hit.origin && !Array.isArray(hit.origin)) return normListing(hit.origin) || hit.origin;
  return normListing(hit) || hit;
}

async function readBody(res) {
  if (!res) return '';
  if (typeof res.text === 'function') return await res.text();
  if (typeof res.text === 'string') return res.text;
  return '';
}

async function searchRaw(origin, opts) {
  const o = opts || {};
  const src = origin || {};
  try {
    const loaded = loadFinnOrigin(o);
    if (!loaded.mod) {
      return empty('Mini finn-origin.js missing at ' + FINN_ORIGIN_PATH);
    }
    const mod = loaded.mod;
    if (typeof mod.findFinnOrigin !== 'function' || typeof mod.parseCollectionHits !== 'function') {
      return empty('finn-origin.js must export findFinnOrigin and parseCollectionHits');
    }

    let originOnFinn = null;
    try {
      originOnFinn = pickOriginHit(await mod.findFinnOrigin(src.regnr, { vin: src.vin, erpId: src.erpId }));
    } catch (_e) {
      originOnFinn = null;
    }
    if (!originOnFinn && typeof mod.fetchFinnSearch === 'function') {
      try {
        originOnFinn = pickOriginHit(await mod.fetchFinnSearch(src.regnr, { vin: src.vin, erpId: src.erpId }));
      } catch (_e) {
        originOnFinn = null;
      }
    }

    const url = buildRawSearchUrl(src);
    const forbidden = urlHasForbiddenQuery(url);
    if (forbidden.length) {
      return empty('Finn raw URL must not include ' + forbidden.join(', '), { url });
    }

    const fetchFn = o.fetch || global.fetch;
    if (typeof fetchFn !== 'function') {
      return empty('fetch unavailable for Finn raw folder', { origin_on_finn: originOnFinn });
    }
    const headers = Object.assign({}, headersLikeFinnOrigin(loaded.file === '(injected)' ? FINN_ORIGIN_PATH : loaded.file), o.headers || {});
    const res = await fetchFn(url, { headers });
    const html = await readBody(res);
    const hits = asHits(mod.parseCollectionHits(html));
    const finnNow = hits.map(normListing).filter(Boolean);

    return {
      available: true,
      finn_now: finnNow,
      sold_under_3m: [],
      origin_on_finn: originOnFinn,
      url,
      used: { file: loaded.file, export: 'findFinnOrigin+parseCollectionHits' },
    };
  } catch (e) {
    return empty('Finn search failed: ' + String(e && e.message || e));
  }
}

module.exports = {
  searchRaw,
  buildRawSearchUrl,
  urlHasForbiddenQuery,
  headersLikeFinnOrigin,
  FINN_ORIGIN_PATH,
  FINN_ORIGIN_EXPORTS,
  FORBIDDEN_QUERY,
  DEFAULT_FINN_HEADERS,
};
