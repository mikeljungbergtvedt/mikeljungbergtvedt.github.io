'use strict';

/**
 * JR car.info client — Mini files in this order, then the autoringen license-plate API.
 *   /Users/bot/peasy-auto/v2/v3-trinn3-carinfo.js
 *   /Users/bot/peasy-auto/v3g/v3g-carinfo.js
 *   /Users/bot/peasy-auto/bot4/market.js
 * Never require peasy-auto.js. No ±km / ±year lock. Chefs pick twins.
 */

const fs = require('fs');
const path = require('path');
const { normListing } = require('./listing');

const CARINFO_PATHS = [
  '/Users/bot/peasy-auto/v2/v3-trinn3-carinfo.js',
  '/Users/bot/peasy-auto/v3g/v3g-carinfo.js',
  '/Users/bot/peasy-auto/bot4/market.js',
];

function empty(reason, extra) {
  return Object.assign({
    available: false,
    reason: reason || 'car.info unavailable',
    own_sold: [],
  }, extra || {});
}

function carInfoKey(opts) {
  const o = opts || {};
  if (o.carInfoKey != null) return String(o.carInfoKey).trim();
  return String(process.env.CAR_INFO_KEY || '').trim();
}

function loadCarinfoMini(opts) {
  const o = opts || {};
  if (o.carinfoMini) return { mod: o.carinfoMini, file: '(injected)' };
  const paths = o.carinfoPaths || CARINFO_PATHS;
  const tried = [];
  for (const file of paths) {
    tried.push(file);
    if (path.basename(file) === 'peasy-auto.js') continue;
    if (!fs.existsSync(file)) {
      tried[tried.length - 1] = file + ' (missing)';
      continue;
    }
    try {
      return { mod: require(file), file, tried };
    } catch (e) {
      tried[tried.length - 1] = file + ' (' + String(e && e.message || e).slice(0, 80) + ')';
    }
  }
  return { mod: null, file: null, tried };
}

function identityFromPayload(result) {
  if (!result || typeof result !== 'object') return null;
  const extra = {
    merke: result.brand || result.make || null,
    modell: result.series || result.model || null,
    aar: result.model_year || result.year || null,
    drivstoff: result.engine_type || result.fuel || null,
    hk: result.horsepower || result.hp || null,
    vin: result.vin || null,
    drivlinje: result.drive || result.drivlinje || null,
    car_name: result.car_name || null,
    engine: result.engine_name || result.engine || null,
    trim_package: result.trim_package || null,
    chassis: result.chassis || null,
  };
  const any = Object.keys(extra).some((k) => extra[k] != null && extra[k] !== '');
  return any ? extra : null;
}

function soldBags(payload) {
  const result = (payload && (payload.result || payload)) || {};
  const val = result.valuation || {};
  return [
    result.company_classifieds,
    result.private_classifieds,
    result.own_sold,
    val.company_classifieds,
    val.private_classifieds,
    val.own_sold,
  ].filter(Array.isArray);
}

function mapOwnSold(payload) {
  const out = [];
  const seen = new Set();
  for (const bag of soldBags(payload)) {
    for (const item of bag) {
      const sold = item && (item.ca_sold_date || item.sold_date || item.classified_removed_date);
      if (!sold) continue;
      const n = normListing(item);
      if (!n) continue;
      const key = [n.regnr || '', n.url || '', n.pris || '', n.sold_date || ''].join('|');
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(n);
    }
  }
  return out;
}

function buildCarInfoUrl(regnr, km) {
  const plate = encodeURIComponent(String(regnr || '').toUpperCase().replace(/\s+/g, ''));
  const mileage = Number.isFinite(Number(km)) ? Number(km) : 0;
  return 'https://api.car.info/v2/app/autoringen/license-plate/N/' + plate + '/' + mileage;
}

async function readJson(res) {
  if (!res) return null;
  if (res.json && typeof res.json === 'object' && !res.json.then) return res.json;
  if (typeof res.json === 'function') {
    try { return await res.json(); } catch (_e) { /* fall through */ }
  }
  if (typeof res.text === 'function') {
    const t = await res.text();
    try { return t ? JSON.parse(t) : null; } catch (_e) { return null; }
  }
  return null;
}

async function searchRaw(origin, opts) {
  const o = opts || {};
  const src = origin || {};
  const key = carInfoKey(o);
  if (!key) return empty('CAR_INFO_KEY missing');

  const loaded = loadCarinfoMini(o);

  try {
    const url = buildCarInfoUrl(src.regnr, src.km);
    const fetchFn = o.fetch || global.fetch;
    if (typeof fetchFn !== 'function') return empty('fetch unavailable for car.info');
    const res = await fetchFn(url, {
      headers: {
        'x-auth-identifier': 'autoringen',
        'x-auth-key': key,
        Accept: 'application/json',
        'Accept-Language': 'nb',
      },
    });
    const ok = res && (res.ok === true || (res.status >= 200 && res.status < 300));
    if (!ok) {
      return empty('car.info HTTP ' + ((res && res.status) || 'fail'), { used: loaded.file });
    }
    const payload = await readJson(res);
    const ownSold = mapOwnSold(payload);
    const result = (payload && (payload.result || payload)) || {};
    return {
      available: true,
      own_sold: ownSold,
      identity: ownSold.length ? null : identityFromPayload(result),
      used: { file: loaded.file || CARINFO_PATHS[0] },
    };
  } catch (e) {
    return empty('car.info search failed: ' + String(e && e.message || e), { used: loaded.file });
  }
}

module.exports = {
  searchRaw,
  buildCarInfoUrl,
  mapOwnSold,
  CARINFO_PATHS,
};
