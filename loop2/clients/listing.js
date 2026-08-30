'use strict';

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
  return {
    regnr: regnr || null,
    pris,
    km,
    aar,
    status,
    kilde: raw.kilde || raw.type || raw.source || null,
    url,
    title,
    sold_date: sold || null,
    published: raw.published_date || raw.publisert || raw.classified_published_date || null,
  };
}

function asHits(parsed) {
  if (!parsed) return [];
  if (Array.isArray(parsed)) return parsed;
  if (Array.isArray(parsed.hits)) return parsed.hits;
  if (Array.isArray(parsed.items)) return parsed.items;
  return [];
}

module.exports = { num, normListing, asHits };
