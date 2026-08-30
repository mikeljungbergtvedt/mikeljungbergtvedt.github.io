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
const finn = require('./clients/finn');
const carinfo = require('./clients/carinfo');

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
  const d = await jr.gatherIdentity(
    { internnr: 2, regnr: 'AA11111', merke: 'X', modell: 'Y', aar: 2019, km: 50000 },
    { finnOriginPath: path.join(os.tmpdir(), 'no-finn-origin.js'), carInfoKey: '' }
  );
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
    'clients/finn.js', 'clients/carinfo.js', 'clients/erp-read.js', 'clients/listing.js',
  ];
  for (const rel of files) {
    const src = fs.readFileSync(path.join(__dirname, rel), 'utf8');
    assert.ok(!/writes_erp\s*:\s*true/.test(src), rel + ' sets writes_erp true');
    assert.ok(!/internnr\s*%\s*2/.test(src), rel + ' uses internnr % 2');
    assert.ok(!/confirmFinalEstimate\s*\(/.test(src), rel + ' calls confirmFinalEstimate');
    assert.ok(!/\/final_estimate/.test(src), rel + ' hits /final_estimate');
    assert.ok(!/\bwrites_erp\s*=\s*true\b/.test(src), rel + ' assigns writes_erp true');
    assert.ok(!/require\([^)]*peasy-auto\.js/.test(src), rel + ' requires peasy-auto.js');
  }
  const finnSrc = fs.readFileSync(path.join(__dirname, 'clients/finn.js'), 'utf8');
  const ciSrc = fs.readFileSync(path.join(__dirname, 'clients/carinfo.js'), 'utf8');
  assert.ok(!/TODO:/.test(finnSrc), 'finn.js still has TODO stub');
  assert.ok(!/TODO:/.test(ciSrc), 'carinfo.js still has TODO stub');
  assert.ok(finnSrc.includes('/Users/bot/peasy-auto/finn-origin.js'), 'finn.js must require Mini finn-origin.js');
  assert.ok(finnSrc.includes('findFinnOrigin') && finnSrc.includes('parseCollectionHits') && finnSrc.includes('fetchFinnSearch'));
  assert.ok(!/mod\.buildSisterSearch\s*\(/.test(finnSrc), 'JR must not call buildSisterSearch');
  assert.ok(!/mod\.kmWindow\s*\(/.test(finnSrc), 'JR must not call kmWindow');
  assert.ok(!/mod\.yearWindow\s*\(/.test(finnSrc), 'JR must not call yearWindow');
  assert.ok(ciSrc.includes('/Users/bot/peasy-auto/v2/v3-trinn3-carinfo.js'));
  assert.ok(ciSrc.includes('/Users/bot/peasy-auto/v3g/v3g-carinfo.js'));
  assert.ok(ciSrc.includes('/Users/bot/peasy-auto/bot4/market.js'));
  assert.ok(ciSrc.includes('https://api.car.info/v2/app/autoringen/license-plate/N/'));
  assert.ok(!/tryLoadFirst/.test(finnSrc + ciSrc), 'stop guessed tryLoadFirst');
  assert.ok(!fs.existsSync(path.join(__dirname, 'clients/mini-load.js')), 'mini-load.js guessed-export loader must stay gone');
  const chefsSrc = fs.readFileSync(path.join(__dirname, 'chefs.js'), 'utf8');
  assert.ok(chefsSrc.includes("'claude'") && chefsSrc.includes("'grok'") && chefsSrc.includes("'gemini'"));
  assert.strictEqual(chefs.CHEFS.join(','), 'claude,grok,gemini');
  assert.ok(fs.existsSync(path.join(__dirname, 'copy-to-mini.sh')));
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

function fakeFinnOrigin(overrides) {
  const calls = { findFinnOrigin: 0, parseCollectionHits: 0, fetchFinnSearch: 0, buildSisterSearch: 0, kmWindow: 0, yearWindow: 0 };
  const mod = {
    findFinnOrigin: async function (regnr, opts) {
      calls.findFinnOrigin += 1;
      assert.ok(opts && ('vin' in opts) && ('erpId' in opts));
      return { regnr, price: 210000, link: 'https://www.finn.no/mobility/item/9', status: 'Til salgs' };
    },
    parseCollectionHits: function (html) {
      calls.parseCollectionHits += 1;
      assert.ok(typeof html === 'string');
      return [
        { regnr: 'AB11111', price: 199000, km: 80000, year: 2019, link: 'https://www.finn.no/mobility/item/1', heading: 'Volvo V60' },
      ];
    },
    fetchFinnSearch: async function () {
      calls.fetchFinnSearch += 1;
      throw new Error('fetchFinnSearch is origin fallback only');
    },
    buildSisterSearch: function () { calls.buildSisterSearch += 1; throw new Error('do not call buildSisterSearch'); },
    kmWindow: function () { calls.kmWindow += 1; throw new Error('do not call kmWindow'); },
    yearWindow: function () { calls.yearWindow += 1; throw new Error('do not call yearWindow'); },
  };
  return { mod: Object.assign(mod, overrides || {}), calls };
}

async function testMissingMiniDoesNotCrash() {
  const origin = { internnr: 26001, regnr: 'XX26001', merke: 'VOLVO', modell: 'V60', aar: 2018, km: 120000 };
  const f = await finn.searchRaw(origin, { finnOriginPath: path.join(os.tmpdir(), 'no-finn-origin-' + process.pid + '.js') });
  const c = await carinfo.searchRaw(origin, { carInfoKey: '' });
  assert.strictEqual(f.available, false);
  assert.strictEqual(c.available, false);
  assert.ok(/finn-origin\.js/.test(f.reason || ''));
  assert.strictEqual(c.reason, 'CAR_INFO_KEY missing');
  assert.ok(!/TODO/.test(f.reason || ''));
  assert.ok(!/TODO/.test(c.reason || ''));
  assert.ok(Array.isArray(f.finn_now) && Array.isArray(f.sold_under_3m));
  assert.ok(Array.isArray(c.own_sold));
}

async function testFinnRawUrlHasNoYearOrKmCut() {
  const origin = { internnr: 26001, regnr: 'XX26001', merke: 'VOLVO', modell: 'V60', aar: 2018, km: 120000 };
  const url = finn.buildRawSearchUrl(origin);
  assert.strictEqual(url, 'https://www.finn.no/mobility/search/car?q=VOLVO+V60&registration_class=1');
  assert.deepStrictEqual(finn.urlHasForbiddenQuery(url), []);
  assert.ok(!/year_from|year_to|mileage_from|mileage_to/.test(url));
  const fake = fakeFinnOrigin();
  const seen = [];
  const out = await finn.searchRaw(origin, {
    finnOrigin: fake.mod,
    fetch: async function (u, init) {
      seen.push({ url: u, headers: init && init.headers });
      assert.deepStrictEqual(finn.urlHasForbiddenQuery(u), []);
      assert.ok(!/year_from|mileage_from|mileage_to/.test(u));
      assert.ok(init.headers['User-Agent']);
      assert.ok(init.headers['Accept-Language']);
      return { ok: true, status: 200, text: async () => '<html><article>199 000 kr</article></html>' };
    },
  });
  assert.strictEqual(out.available, true);
  assert.strictEqual(seen.length, 1);
  assert.strictEqual(seen[0].url, url);
  assert.strictEqual(fake.calls.findFinnOrigin, 1);
  assert.strictEqual(fake.calls.parseCollectionHits, 1);
  assert.strictEqual(fake.calls.fetchFinnSearch, 0);
  assert.strictEqual(fake.calls.buildSisterSearch, 0);
  assert.strictEqual(fake.calls.kmWindow, 0);
  assert.strictEqual(fake.calls.yearWindow, 0);
  assert.strictEqual(out.finn_now.length, 1);
  assert.strictEqual(out.finn_now[0].pris, 199000);
  assert.strictEqual(out.origin_on_finn.regnr, 'XX26001');
  assert.deepStrictEqual(finn.FINN_ORIGIN_EXPORTS, [
    'fetchFinnSearch', 'parseCollectionHits', 'findFinnOrigin', 'buildSisterSearch', 'kmWindow', 'yearWindow',
  ]);
  assert.strictEqual(finn.FINN_ORIGIN_PATH, '/Users/bot/peasy-auto/finn-origin.js');
}

async function testFinnOriginFallbackFetchFinnSearch() {
  const fake = fakeFinnOrigin({
    findFinnOrigin: async function () { return null; },
    fetchFinnSearch: async function (regnr, opts) {
      fake.calls.fetchFinnSearch += 1;
      assert.strictEqual(regnr, 'ZZ99999');
      assert.strictEqual(opts.erpId, 7);
      return { regnr, price: 150000, link: 'https://www.finn.no/mobility/item/3' };
    },
  });
  const out = await finn.searchRaw({ internnr: 7, erpId: 7, regnr: 'ZZ99999', merke: 'BMW', modell: 'X3' }, {
    finnOrigin: fake.mod,
    fetch: async function () {
      return { ok: true, status: 200, text: async () => '<html></html>' };
    },
  });
  assert.strictEqual(out.available, true);
  assert.strictEqual(out.origin_on_finn.regnr, 'ZZ99999');
  assert.strictEqual(out.origin_on_finn.pris, 150000);
  assert.strictEqual(fake.calls.fetchFinnSearch, 1);
  assert.strictEqual(fake.calls.buildSisterSearch + fake.calls.kmWindow + fake.calls.yearWindow, 0);
}

async function testCarinfoSoldClassifieds() {
  const seen = [];
  const out = await carinfo.searchRaw({ internnr: 26002, regnr: 'YY26002', km: 70000 }, {
    carInfoKey: 'test-key',
    carinfoMini: { note: 'injected Mini v3-trinn3-carinfo' },
    fetch: async function (url, init) {
      seen.push({ url, headers: init && init.headers });
      assert.strictEqual(url, 'https://api.car.info/v2/app/autoringen/license-plate/N/YY26002/70000');
      assert.ok(!/year_from|mileage_to/.test(url));
      assert.strictEqual(init.headers['x-auth-identifier'], 'autoringen');
      assert.strictEqual(init.headers['x-auth-key'], 'test-key');
      assert.strictEqual(init.headers['Accept-Language'], 'nb');
      return {
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          result: {
            brand: 'Volvo',
            series: 'V60',
            valuation: {
              company_classifieds: [
                { licence_plate: 'JJ55555', classified_price: 175000, mileage_km: 70000, ca_sold_date: '2026-08-01', classified_url: 'https://www.finn.no/mobility/item/5' },
                { licence_plate: 'KK66666', classified_price: 190000, mileage_km: 60000, classified_url: 'https://www.finn.no/mobility/item/6' },
              ],
            },
          },
        }),
      };
    },
  });
  assert.strictEqual(out.available, true);
  assert.ok(!/TODO/.test(JSON.stringify(out)));
  assert.strictEqual(out.own_sold.length, 1);
  assert.strictEqual(out.own_sold[0].pris, 175000);
  assert.strictEqual(seen.length, 1);
  assert.deepStrictEqual(carinfo.CARINFO_PATHS, [
    '/Users/bot/peasy-auto/v2/v3-trinn3-carinfo.js',
    '/Users/bot/peasy-auto/v3g/v3g-carinfo.js',
    '/Users/bot/peasy-auto/bot4/market.js',
  ]);
}

async function testInjectedMiniMakesJrReady() {
  const fake = fakeFinnOrigin();
  const d = await jr.gatherIdentity(
    { internnr: 11, regnr: 'NN11111', merke: 'X', modell: 'Y', aar: 2020, km: 10000 },
    {
      finnClient: {
        searchRaw: (o) => finn.searchRaw(o, {
          finnOrigin: fake.mod,
          fetch: async () => ({ ok: true, status: 200, text: async () => '<html></html>' }),
        }),
      },
      carinfoClient: {
        searchRaw: (o) => carinfo.searchRaw(o, {
          carInfoKey: 'k',
          fetch: async () => ({
            ok: true,
            status: 200,
            json: async () => ({
              result: { company_classifieds: [{ licence_plate: 'MM88888', classified_price: 90000, ca_sold_date: '2026-07-01' }] },
            }),
          }),
        }),
      },
    }
  );
  assert.strictEqual(d.listings_ready, true);
  assert.strictEqual(d.search.km_cut, false);
  assert.strictEqual(d.search.twin_rules_locked, false);
  assert.strictEqual(d.listings.finn_now[0].pris, 199000);
  assert.strictEqual(d.listings.own_sold[0].regnr, 'MM88888');
  assert.strictEqual(d.origin.internnr, 11);
}

async function testPeasyAutoJsNeverRequired() {
  const finnSrc = fs.readFileSync(path.join(__dirname, 'clients/finn.js'), 'utf8');
  const ciSrc = fs.readFileSync(path.join(__dirname, 'clients/carinfo.js'), 'utf8');
  assert.ok(!/require\(\s*['"][^'"]*peasy-auto\.js['"]\s*\)/.test(finnSrc + ciSrc));
  assert.strictEqual(finn.FINN_ORIGIN_PATH, '/Users/bot/peasy-auto/finn-origin.js');
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
    testMissingMiniDoesNotCrash,
    testFinnRawUrlHasNoYearOrKmCut,
    testFinnOriginFallbackFetchFinnSearch,
    testCarinfoSoldClassifieds,
    testInjectedMiniMakesJrReady,
    testPeasyAutoJsNeverRequired,
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
