'use strict';

const finnClient = require('./clients/finn');
const carinfoClient = require('./clients/carinfo');
const erpRead = require('./clients/erp-read');

/**
 * JR = identity, not chef.
 * One origin CV + a raw folder of listings. Twin pick is the chef's job.
 * No km/year cut in the search. No locked ±n km / ±n year twin rules.
 */

function emptyListings() {
  return {
    finn_now: [],
    sold_under_3m: [],
    own_sold: [],
    origin_on_finn: null,
  };
}

function normalizeOrigin(hint, erpOrigin) {
  const src = Object.assign({}, erpOrigin || {}, hint || {});
  const internnr = src.internnr != null && src.internnr !== ''
    ? (Number.isFinite(Number(src.internnr)) ? Number(src.internnr) : src.internnr)
    : (src.erpId != null && src.erpId !== '' ? (Number.isFinite(Number(src.erpId)) ? Number(src.erpId) : src.erpId) : null);
  const erpId = src.erpId != null && src.erpId !== ''
    ? (Number.isFinite(Number(src.erpId)) ? Number(src.erpId) : src.erpId)
    : internnr;
  return {
    regnr: String(src.regnr || '').toUpperCase().replace(/\s+/g, ''),
    internnr,
    erpId,
    merke: src.merke != null ? String(src.merke) : (src.make != null ? String(src.make) : null),
    modell: src.modell != null ? String(src.modell) : (src.model != null ? String(src.model) : null),
    aar: src.aar != null ? Number(src.aar) : (src.year != null ? Number(src.year) : null),
    km: src.km != null ? Number(src.km) : (src.mileage != null ? Number(src.mileage) : null),
    drivstoff: src.drivstoff != null ? String(src.drivstoff) : null,
    gir: src.gir != null ? String(src.gir) : null,
    hk: src.hk != null ? Number(src.hk) : null,
    drivlinje: src.drivlinje != null ? String(src.drivlinje) : null,
    vin: src.vin != null ? String(src.vin) : null,
  };
}

function searchPolicy() {
  return {
    km_cut: false,
    year_cut: false,
    twin_rules_locked: false,
    note: 'JR søker uten km- og årskutt. Ingen ±n km / ±n år. Chef velger tvillinger.',
  };
}

async function gatherIdentity(hint, opts) {
  const o = opts || {};
  const finn = o.finnClient || finnClient;
  const carinfo = o.carinfoClient || carinfoClient;
  const erp = o.erpRead || erpRead;

  let erpOrigin = null;
  let erpNote = null;
  try {
    const looked = await erp.readOrigin(hint, { readOnly: true });
    if (looked && looked.available && looked.origin) erpOrigin = looked.origin;
    else erpNote = (looked && looked.reason) || null;
  } catch (e) {
    erpNote = 'ERP-read hook failed: ' + (e && e.message || e);
  }

  const origin = normalizeOrigin(hint, erpOrigin);
  const listings = emptyListings();
  const notes = [];
  if (erpNote) notes.push(erpNote);

  let finnReady = false;
  let carinfoReady = false;
  try {
    const f = await finn.searchRaw(origin, { kmCut: false, yearCut: false, twinLock: false });
    if (f && f.available) {
      finnReady = true;
      listings.finn_now = Array.isArray(f.finn_now) ? f.finn_now : [];
      listings.sold_under_3m = Array.isArray(f.sold_under_3m) ? f.sold_under_3m : [];
      listings.origin_on_finn = f.origin_on_finn || null;
    } else {
      notes.push((f && f.reason) || 'Finn client unavailable');
    }
  } catch (e) {
    notes.push('Finn hook failed: ' + (e && e.message || e));
  }

  try {
    const c = await carinfo.searchRaw(origin, { kmCut: false, yearCut: false, twinLock: false });
    if (c && c.available) {
      carinfoReady = true;
      listings.own_sold = Array.isArray(c.own_sold) ? c.own_sold : [];
    } else {
      notes.push((c && c.reason) || 'car.info client unavailable');
    }
  } catch (e) {
    notes.push('car.info hook failed: ' + (e && e.message || e));
  }

  return {
    origin,
    listings,
    search: searchPolicy(),
    listings_ready: finnReady || carinfoReady,
    notes,
    role: 'jr',
  };
}

module.exports = {
  emptyListings,
  normalizeOrigin,
  searchPolicy,
  gatherIdentity,
};
