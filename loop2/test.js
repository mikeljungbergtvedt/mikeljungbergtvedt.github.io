'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const schema = require('./schema');
const jr = require('./jr');
const chefs = require('./chefs');
const publish = require('./publish');
const run = require('./run');

function tmpFile(name) {
  return path.join(os.tmpdir(), 'loop2-test-' + process.pid + '-' + name);
}

async function testSchemaContract() {
  const rec = schema.measurement({
    evaluator: 'Claude',
    ok: true,
    internnr: 26001,
    erpId: 26001,
    regnr: 'xx26001',
    km: 120000,
    merke: 'VOLVO',
    modell: 'V60',
    aar: 2018,
    finn_utpris: 185000,
    rationale: 'line1\nline2\nline3\nline4 dropped',
    n_comps: 3,
    writes_erp: true,
    error: null,
  });
  assert.strictEqual(rec.evaluator, 'claude');
  assert.strictEqual(rec.regnr, 'XX26001');
  assert.strictEqual(rec.finn_utpris, 185000);
  assert.strictEqual(rec.writes_erp, false);
  assert.strictEqual(rec.error, null);
  assert.strictEqual(rec.rationale.split('\n').length, 3);
  assert.ok(!('finn_pris' in rec));
  assert.ok(!('at' in rec));
  assert.ok(!('why' in rec));
  const required = ['evaluator', 'ok', 'timestamp', 'internnr', 'erpId', 'regnr', 'km', 'merke', 'modell', 'aar', 'finn_utpris', 'rationale', 'n_comps', 'writes_erp', 'error'];
  for (const k of required) assert.ok(k in rec, 'missing ' + k);

  assert.throws(() => schema.measurement({ evaluator: 'bot4', regnr: 'AA11111' }));
  assert.throws(() => schema.assertNoForbiddenAliases({ finn_pris: 1 }));
  assert.throws(() => schema.assertNoForbiddenAliases({ at: 'x' }));
  assert.throws(() => schema.assertNoForbiddenAliases({ why: 'x' }));
}

async function testLatestWinsAndDots() {
  const recs = [
    schema.measurement({ evaluator: 'claude', ok: true, regnr: 'AA11111', timestamp: '2026-08-30T10:00:00.000Z', finn_utpris: 100000 }),
    schema.measurement({ evaluator: 'claude', ok: true, regnr: 'AA11111', timestamp: '2026-08-30T12:00:00.000Z', finn_utpris: 110000 }),
    schema.measurement({ evaluator: 'grok', ok: false, regnr: 'AA11111', timestamp: '2026-08-30T13:00:00.000Z', error: 'dry-run' }),
    schema.measurement({ evaluator: 'gemini', ok: true, regnr: 'AA11111', timestamp: '2026-08-30T11:00:00.000Z', finn_utpris: 105000 }),
  ];
  const win = schema.latestWins(recs);
  assert.strictEqual(win.AA11111.claude.finn_utpris, 110000);
  assert.strictEqual(schema.pulseDot(win.AA11111.claude), 110000);
  assert.strictEqual(schema.pulseDot(win.AA11111.grok), null);
  assert.strictEqual(schema.pulseDot(win.AA11111.gemini), 105000);
}

async function testJrNoTwinLock() {
  const d = await jr.gatherIdentity({ internnr: 2, regnr: 'AA11111', merke: 'X', modell: 'Y', aar: 2019, km: 50000 });
  assert.strictEqual(d.role, 'jr');
  assert.strictEqual(d.search.km_cut, false);
  assert.strictEqual(d.search.year_cut, false);
  assert.strictEqual(d.search.twin_rules_locked, false);
  assert.strictEqual(d.listings_ready, false);
  assert.ok(Array.isArray(d.listings.finn_now));
  assert.ok(Array.isArray(d.listings.sold_under_3m));
  assert.ok(Array.isArray(d.listings.own_sold));
  assert.strictEqual(d.origin.regnr, 'AA11111');
  assert.strictEqual(d.origin.internnr, 2);
}

async function testEvenOddDoesNotPickChefs() {
  const even = await run.evaluateCar({ internnr: 2, erpId: 2, regnr: 'AA11111', merke: 'A', modell: 'B', aar: 2018, km: 1 }, { dryRun: true });
  const odd = await run.evaluateCar({ internnr: 3, erpId: 3, regnr: 'BB22222', merke: 'A', modell: 'B', aar: 2018, km: 1 }, { dryRun: true });
  assert.deepStrictEqual(even.map((r) => r.evaluator), ['claude', 'grok', 'gemini']);
  assert.deepStrictEqual(odd.map((r) => r.evaluator), ['claude', 'grok', 'gemini']);
  for (const r of even.concat(odd)) {
    assert.strictEqual(r.ok, false);
    assert.strictEqual(r.writes_erp, false);
    assert.strictEqual(schema.pulseDot(r), null);
    assert.ok(r.error);
  }
}

async function testWriteErpRejected() {
  assert.throws(() => run.parseArgs(['node', 'run.js', '--write-erp']));
  assert.throws(() => run.parseArgs(['node', 'run.js', '--writes-erp']));
  assert.throws(() => run.parseArgs(['node', 'run.js', '--write_erp=true']));
  await assert.rejects(() => run.evaluateCar({ internnr: 1, regnr: 'AA11111' }, { writes_erp: true }));
  await assert.rejects(() => run.evaluateCar({ internnr: 4, regnr: 'AA11111' }, { dryRun: true, routeByInternnrParity: true }));
}

async function testDryRunWritesJsonl() {
  const out = tmpFile('meas.jsonl');
  try {
    if (fs.existsSync(out)) fs.unlinkSync(out);
    const res = await run.run(['node', 'run.js', '--dry-run', '--cars', path.join(__dirname, 'cars.example.json'), '--out', out]);
    assert.strictEqual(res.cars, 2);
    assert.strictEqual(res.records.length, 6);
    const parsed = schema.parseJsonl(fs.readFileSync(out, 'utf8'));
    assert.strictEqual(parsed.length, 6);
    assert.deepStrictEqual([...new Set(parsed.map((r) => r.evaluator))].sort(), ['claude', 'gemini', 'grok']);
    for (const r of parsed) {
      assert.strictEqual(r.writes_erp, false);
      assert.strictEqual(r.ok, false);
      assert.ok(!('finn_pris' in r) && !('at' in r) && !('why' in r));
    }
  } finally {
    try { fs.unlinkSync(out); } catch (_e) { /* ignore */ }
  }
}

async function testCommentStubStillParses() {
  const stub = fs.readFileSync(path.join(__dirname, '..', 'loop2-measurements.jsonl'), 'utf8');
  const recs = schema.parseJsonl(stub);
  assert.strictEqual(recs.length, 0, 'comment stub must not become Pulse records');
}

async function testSourceGuards() {
  const files = [
    'run.js', 'jr.js', 'chefs.js', 'schema.js', 'publish.js',
    'clients/finn.js', 'clients/carinfo.js', 'clients/erp-read.js',
  ];
  for (const rel of files) {
    const src = fs.readFileSync(path.join(__dirname, rel), 'utf8');
    assert.ok(!/writes_erp\s*:\s*true/.test(src), rel + ' sets writes_erp true');
    assert.ok(!/internnr\s*%\s*2/.test(src), rel + ' uses internnr % 2');
    assert.ok(!/confirmFinalEstimate\s*\(/.test(src), rel + ' calls confirmFinalEstimate');
    assert.ok(!/\/final_estimate/.test(src), rel + ' hits /final_estimate');
    assert.ok(!/\bwrites_erp\s*=\s*true\b/.test(src), rel + ' assigns writes_erp true');
  }
  const chefsSrc = fs.readFileSync(path.join(__dirname, 'chefs.js'), 'utf8');
  assert.ok(chefsSrc.includes("'claude'") && chefsSrc.includes("'grok'") && chefsSrc.includes("'gemini'"));
  assert.strictEqual(chefs.CHEFS.join(','), 'claude,grok,gemini');
}

async function testPublishAppend() {
  const out = tmpFile('append.jsonl');
  try {
    fs.writeFileSync(out, '# header\n');
    const rec = schema.measurement({ evaluator: 'grok', ok: false, regnr: 'CC33333', error: 'dry-run' });
    const pub = publish.appendMeasurements(out, [rec]);
    assert.strictEqual(pub.appended, 1);
    const text = fs.readFileSync(out, 'utf8');
    assert.ok(text.startsWith('# header'));
    assert.strictEqual(schema.parseJsonl(text).length, 1);
  } finally {
    try { fs.unlinkSync(out); } catch (_e) { /* ignore */ }
  }
}

async function testLoadCars() {
  const fromFile = run.loadCars(path.join(__dirname, 'cars.example.json'));
  assert.strictEqual(fromFile.length, 2);
  assert.strictEqual(fromFile[0].internnr, 26001);
  const tokens = run.loadCars('26001,XX26001,3:YY26002');
  assert.ok(tokens.length >= 2);
  assert.strictEqual(run.parseCarToken('4355').internnr, 4355);
  assert.strictEqual(run.parseCarToken('BT63926').regnr, 'BT63926');
}

async function main() {
  const tests = [
    testSchemaContract,
    testLatestWinsAndDots,
    testJrNoTwinLock,
    testEvenOddDoesNotPickChefs,
    testWriteErpRejected,
    testDryRunWritesJsonl,
    testCommentStubStillParses,
    testSourceGuards,
    testPublishAppend,
    testLoadCars,
  ];
  for (const fn of tests) {
    await fn();
    process.stdout.write('ok  ' + fn.name + '\n');
  }
  process.stdout.write(tests.length + ' tests passed\n');
}

main().catch((e) => {
  process.stderr.write(e.stack || String(e) + '\n');
  process.exit(1);
});
