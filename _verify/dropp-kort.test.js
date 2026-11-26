'use strict';
// node _verify/dropp-kort.test.js — oppdiktede rader og biler. Ingen nettverk.
const assert = require('assert');
const A = require('../dropp-kort.js');
const srcKey = (r) => { const s = String(r[11] || '').toLowerCase(), u = String(r[23] || '').toLowerCase(); return s === 'autodb' || u === 'autodb' ? 'autodb' : s === 'driveno' ? 'drive' : s; };
const rad = (id, kilde, sd, utm) => { const r = []; r[0] = id; r[1] = 'XX' + id; r[11] = kilde; r[14] = sd; r[23] = utm || ''; return r; };
const rows = [[], rad(1, 'peasy', '20.11.2026 10:00'), rad(2, 'peasy', '21.11.2026 10:00'), rad(3, 'peasy', '01.11.2026 10:00'), rad(4, 'driveno', '20.11.2026 10:00'),
  rad(5, 'peasy', '20.11.2026 10:00', 'autodb'), rad(6, 'peasy', '02.11.2026'), rad(7, 'peasy', '03.11.2026'), rad(8, 'peasy', '04.11.2026'), rad(9, 'peasy', '05.11.2026')];
const hentLev = { ok: true, biler: [
  { id: 1, regnr: 'XX1', type: 'hent', b: '2026-11-05', mo: '2026-11-20', m: '2026-11-20', pv: false, s: 'RECEIVED' },         // ankommet i f14, kohort f
  { id: 3, regnr: 'XX3', type: 'lev', b: '2026-11-06', mo: null, m: null, pv: false, s: 'REJECTED_BY_ADMIN' },                   // dropp, kohort f
  { id: 6, regnr: 'XX6', type: 'hent', b: '2026-11-07', mo: null, m: null, pv: true, s: 'AR_CAR_CREATED' },                      // på vei, utenfor nevneren
  { id: 7, regnr: 'XX7', type: 'hent', b: '2026-11-08', mo: null, m: null, pv: false, s: 'REJECTED_BY_TIMEOUT' },                // dropp
  { id: 8, regnr: 'XX7', type: 'hent', b: '2026-11-10', mo: null, m: null, pv: false, s: 'REJECTED_BY_TIMEOUT' },                // samme regnr: telles én gang
  { id: 9, regnr: 'XX9', type: 'hent', b: '2026-11-21', mo: '2026-11-24', m: '2026-11-24', pv: false, s: 'RECEIVED' },          // for ny for kohort f, ankommet i f14
  { id: 4, regnr: 'XX4', type: 'hent', b: '2026-11-05', mo: '2026-11-20', m: '2026-11-20', pv: false, s: 'RECEIVED' },          // Drive: ute
  { id: 5, regnr: 'XX5', type: 'hent', b: '2026-11-05', mo: '2026-11-20', m: '2026-11-20', pv: false, s: 'RECEIVED' },          // AutoDB: ute
  { id: 2, regnr: 'XX2', type: 'lev', b: '2026-10-01', mo: '2026-10-10', m: '2026-10-10', pv: false, s: 'RECEIVED' },           // kohort p, ankommet i forrige 30 d
] };
const R = A.beregn({ rows, hentLev, iGaar: new Date(2026, 10, 25), srcKey });
assert.deepStrictEqual([R.naa.fra, R.naa.til, R.naa.leads, R.naa.ank], ['2026-10-27', '2026-11-25', 7, 2], '30 d: 7 Peasy-leads (ikke Drive/AutoDB), 2 ankommet');
assert.strictEqual(R.naa.pct, 28.6);
assert.deepStrictEqual([R.forrige.fra, R.forrige.til, R.forrige.leads, R.forrige.ank, R.forrige.pct], ['2026-09-27', '2026-10-26', 0, 1, null]);
const f = R.dropp.f;
assert.deepStrictEqual([f.fra, f.til, f.bestilt, f.ank, f.pv, f.dropp], ['2026-10-20', '2026-11-18', 4, 1, 1, 2], 'bestilt i 30 dager, 7 dagers ventetid (id 9 er for ny)');
assert.deepStrictEqual([R.dropp.p.fra, R.dropp.p.til], ['2026-09-20', '2026-10-19']);
assert.strictEqual(f.pct, 66.7, 'dropp / (ankommet + dropp), på vei utenfor');
assert.deepStrictEqual([f.hent.pct, f.lev.pct], [50, 100]);
assert.deepStrictEqual(f.arsak, { 'avvist av admin': 1, 'utløpt': 1 });
assert.deepStrictEqual([R.dropp.p.bestilt, R.dropp.p.pct], [1, 0]);
assert.strictEqual(R.uker.length, 4);
const h = A.kort(R);
assert.ok(/Ankommet \/ leads/.test(h) && /Dropp-off <b>66,7 %<\/b>/.test(h) && /Mål 15 %/.test(h));
assert.ok(/<div class="target-tag">30 d<\/div>/.test(h) && /forrige 30 d/.test(h) && !/14 d/.test(h), 'etikett og tekst 30 d');
assert.ok(/Siste 30 dager t\.o\.m\. i går/.test(h), 'hovertekst');
assert.ok(/Venter på Minien/.test(A.kort(null)));
assert.ok(!/XX\d/.test(h), 'ingen regnr i kortet');
console.log('dropp-kort.test.js OK');
