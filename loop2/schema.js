'use strict';

/** Live Pulse c328 / Bot 4 measurement contract. Do not invent parallel names. */
const CHEFS = Object.freeze(['claude', 'grok', 'gemini']);
const FORBIDDEN_ALIASES = Object.freeze(['finn_pris', 'at', 'why']);

function normalizeChef(name) {
  const s = String(name || '').toLowerCase().trim();
  return CHEFS.includes(s) ? s : null;
}

function clipRationale(text, maxLines) {
  const n = maxLines == null ? 3 : maxLines;
  if (text == null) return '';
  const lines = String(text).replace(/\r\n/g, '\n').split('\n').map((l) => l.trimEnd());
  while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
  return lines.slice(0, n).join('\n');
}

function numOrNull(v) {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function isoNow(d) {
  return (d instanceof Date ? d : new Date()).toISOString();
}

/**
 * Build one JSONL object (one chef × one car).
 * writes_erp is hardcoded false — there is no write path.
 */
function measurement(partial) {
  const p = partial || {};
  const evaluator = normalizeChef(p.evaluator);
  if (!evaluator) {
    throw new Error('measurement.evaluator must be claude | grok | gemini');
  }
  const ok = p.ok === true;
  const finn = numOrNull(p.finn_utpris);
  const err = p.error == null || p.error === '' ? null : String(p.error);
  const rec = {
    evaluator,
    ok,
    timestamp: p.timestamp || isoNow(),
    internnr: p.internnr == null || p.internnr === '' ? null : (Number.isFinite(Number(p.internnr)) ? Number(p.internnr) : p.internnr),
    erpId: p.erpId == null || p.erpId === '' ? (p.internnr == null || p.internnr === '' ? null : (Number.isFinite(Number(p.internnr)) ? Number(p.internnr) : p.internnr)) : (Number.isFinite(Number(p.erpId)) ? Number(p.erpId) : p.erpId),
    regnr: String(p.regnr || '').toUpperCase().replace(/\s+/g, ''),
    km: numOrNull(p.km),
    merke: p.merke == null ? null : String(p.merke),
    modell: p.modell == null ? null : String(p.modell),
    aar: numOrNull(p.aar),
    finn_utpris: ok ? finn : (finn != null ? finn : null),
    rationale: clipRationale(p.rationale || ''),
    n_comps: p.n_comps == null ? 0 : (Number.isFinite(Number(p.n_comps)) ? Number(p.n_comps) : 0),
    writes_erp: false,
    error: ok ? null : (err || 'dry-run or chef failed'),
  };
  if (!rec.regnr) throw new Error('measurement.regnr mangler');
  assertNoForbiddenAliases(rec);
  if (rec.writes_erp !== false) throw new Error('writes_erp must be false');
  return rec;
}

function assertNoForbiddenAliases(obj) {
  const keys = Object.keys(obj || {});
  for (const k of FORBIDDEN_ALIASES) {
    if (keys.includes(k)) throw new Error('forbidden parallel field: ' + k);
  }
}

function parseJsonl(text) {
  const recs = [];
  String(text || '').split('\n').forEach((line) => {
    const t = line.trim();
    if (!t || t.charAt(0) === '#') return;
    try {
      recs.push(JSON.parse(t));
    } catch (_e) { /* Pulse drops corrupt lines */ }
  });
  return recs;
}

/** Pulse rule: latest timestamp string wins per regnr + evaluator. */
function latestWins(records) {
  const by = {};
  for (const r of records || []) {
    const chef = normalizeChef(r && r.evaluator);
    const rg = String((r && r.regnr) || '').toUpperCase();
    if (!chef || !rg) continue;
    if (!by[rg]) by[rg] = {};
    const prev = by[rg][chef];
    if (!prev || (r.timestamp || '') > (prev.timestamp || '')) by[rg][chef] = r;
  }
  return by;
}

/** Same light-up rule as Pulse qaLoop2Finn. */
function pulseDot(r) {
  if (!r) return null;
  if (r.ok === false || (r.error && !Number.isFinite(Number(r.finn_utpris)))) return null;
  const n = Number(r.finn_utpris);
  return Number.isFinite(n) && n > 0 ? n : null;
}

module.exports = {
  CHEFS,
  FORBIDDEN_ALIASES,
  normalizeChef,
  clipRationale,
  numOrNull,
  isoNow,
  measurement,
  assertNoForbiddenAliases,
  parseJsonl,
  latestWins,
  pulseDot,
};
