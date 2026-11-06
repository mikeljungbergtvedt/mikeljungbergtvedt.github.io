/* c696: SEND-lås under drift-pause. Kjør: node qa-gronn.test.js */
var assert = require('assert');
var Q = require('./qa-gronn.js');
var now = Date.parse('2026-11-06T22:24:00Z');

var drift = { erp: { skrevet: false, grunn: 'drift-pause', blokkert: 'drift-pause' }, fsd: { pris: 205000, stopp: false }, benchmark: { pris: 205000, stopp: false }, mid_pris: 205000 };
var bil = { id: 1, erp_lav: null, erp_hoy: null };

assert.strictEqual(Q.sendLas(drift, bil, null, now), 'drift-pause', 'uten ERP-pris låses SEND, med egen tekst');
assert.strictEqual(Q.manuellSend(drift, bil, null, now), false);

var skrevet = { dLav: 135000, dHoy: 151000, t: now - 20 * 60000 };
assert.strictEqual(Q.manuellSend(drift, bil, skrevet, now), true, 'bekreftet /qa/anker utløper ikke mens snapshot sier drift-pause');
assert.strictEqual(Q.sendLas(drift, bil, skrevet, now), '', 'SEND åpnes etter bekreftet Lav/Høy');

var fersk = { dLav: 135000, dHoy: 151000, t: now - 60000 };
assert.strictEqual(Q.manuellSend(drift, bil, fersk, now), true);

var stopp = { erp: { skrevet: false, grunn: 'drift-pause', blokkert: 'drift-pause' }, fsd: { stopp: true, pris: 219000 }, benchmark: { stopp: true } };
assert.strictEqual(Q.sendLas(stopp, bil, null, now), 'stopp', 'stopp sperrer fortsatt til manuell pris');
assert.strictEqual(Q.sendLas(stopp, bil, skrevet, now), '', 'manuell ERP-pris låser opp også ved stopp');

var mangler = { erp: { skrevet: false, grunn: 'mangler' }, fsd: { stopp: false }, benchmark: { stopp: false } };
assert.strictEqual(Q.sendLas(mangler, bil, null, now), 'Pris er ikke skrevet til ERP ennå');

var medLav = { id: 2, erp_lav: 135000, erp_hoy: 151000 };
assert.strictEqual(Q.manuellSend(drift, medLav, null, now), true, 'lav og høy i ERP teller selv om skrevet=false');
assert.strictEqual(Q.sendLas(drift, medLav, null, now), '');

assert.strictEqual(Q.sendLas({ erp: { skrevet: true }, fsd: { stopp: false }, benchmark: { stopp: false } }, bil, null, now), '');
assert.strictEqual(Q.verifisertSkriv({ dLav: 0, dHoy: 10 }), false);
assert.strictEqual(Q.verifisertSkriv(null), false);

console.log('qa-gronn.test.js ok');
