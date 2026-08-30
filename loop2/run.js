'use strict';

/**
 * Mini shadow runner for Peasy loop2.
 * Always writes_erp: false. Never SEND. Never ERP write.
 * Three named chefs per car: Claude, Grok 4.6, Gemini.
 * internnr even/odd does not pick chefs.
 */

const fs = require('fs');
const path = require('path');
const { CHEFS, measurement, pulseDot } = require('./schema');
const { gatherIdentity } = require('./jr');
const { runAllChefs, dryChefResults, keyFor } = require('./chefs');
const { defaultJsonlPath, appendMeasurements, commitPages } = require('./publish');

const WRITES_ERP = false;

function failHard(msg) {
  throw new Error(msg);
}

function parseArgs(argv) {
  const a = argv.slice(2);
  const out = {
    cars: null,
    carsFile: null,
    dryRun: false,
    out: null,
    commit: false,
    push: true,
    help: false,
  };
  for (let i = 0; i < a.length; i++) {
    const x = a[i];
    if (x === '-h' || x === '--help') out.help = true;
    else if (x === '--dry-run') out.dryRun = true;
    else if (x === '--commit') out.commit = true;
    else if (x === '--no-push') out.push = false;
    else if (x === '--out') out.out = a[++i];
    else if (x === '--cars') out.cars = a[++i];
    else if (x === '--write-erp' || x === '--writes-erp' || x === '--write_erp' || x === '--writes_erp') {
      failHard('HARD: loop2 never writes ERP. writes_erp is always false. Refusing ' + x);
    } else if (x.startsWith('--write') && /erp/i.test(x)) {
      failHard('HARD: loop2 never writes ERP. Refusing ' + x);
    } else {
      failHard('ukjent flagg: ' + x);
    }
  }
  return out;
}

function parseCarToken(tok) {
  const s = String(tok || '').trim();
  if (!s) return null;
  if (/^\d+$/.test(s)) return { internnr: Number(s), erpId: Number(s), regnr: '' };
  if (/^[A-Za-z]{2}\d{5}$/.test(s) || /^[A-Za-z]{1,3}\d{4,6}$/.test(s)) {
    return { internnr: null, erpId: null, regnr: s.toUpperCase() };
  }
  if (s.includes(':')) {
    const [a, b] = s.split(':');
    const intern = /^\d+$/.test(a) ? Number(a) : (/^\d+$/.test(b) ? Number(b) : null);
    const reg = /^[A-Za-z]/.test(a) ? a : b;
    return { internnr: intern, erpId: intern, regnr: String(reg || '').toUpperCase() };
  }
  return { internnr: null, erpId: null, regnr: s.toUpperCase() };
}

function loadCars(spec) {
  if (!spec) return [];
  const asPath = path.resolve(spec);
  if (fs.existsSync(asPath) && fs.statSync(asPath).isFile()) {
    const raw = JSON.parse(fs.readFileSync(asPath, 'utf8'));
    const list = Array.isArray(raw) ? raw : (raw.cars || []);
    return list.map((c) => {
      if (typeof c === 'string' || typeof c === 'number') return parseCarToken(c);
      return {
        internnr: c.internnr != null ? c.internnr : c.erpId,
        erpId: c.erpId != null ? c.erpId : c.internnr,
        regnr: c.regnr || '',
        merke: c.merke,
        modell: c.modell,
        aar: c.aar,
        km: c.km,
        drivstoff: c.drivstoff,
        gir: c.gir,
        hk: c.hk,
        drivlinje: c.drivlinje,
        vin: c.vin,
      };
    }).filter(Boolean);
  }
  return String(spec).split(',').map((t) => parseCarToken(t)).filter(Boolean);
}

function chefErrorMeasurement(origin, evaluator, error, extra) {
  return measurement(Object.assign({
    evaluator,
    ok: false,
    internnr: origin.internnr,
    erpId: origin.erpId,
    regnr: origin.regnr || 'UNKNOWN',
    km: origin.km,
    merke: origin.merke,
    modell: origin.modell,
    aar: origin.aar,
    finn_utpris: null,
    rationale: '',
    n_comps: 0,
    writes_erp: false,
    error,
  }, extra || {}));
}

function chefOkMeasurement(origin, evaluator, payload) {
  const finn = payload && payload.finn_utpris;
  const rationale = payload && payload.rationale;
  const twins = (payload && payload.twins) || [];
  let why = rationale || '';
  if (twins.length && !/twin/i.test(why) && !/tvill/i.test(why)) {
    const ids = twins.map((t) => t.regnr || t.url || t.kilde).filter(Boolean).slice(0, 6).join(', ');
    why = clip3(why, ids ? ('Twins: ' + ids) : '');
  }
  return measurement({
    evaluator,
    ok: Number.isFinite(Number(finn)) && Number(finn) > 0,
    internnr: origin.internnr,
    erpId: origin.erpId,
    regnr: origin.regnr,
    km: origin.km,
    merke: origin.merke,
    modell: origin.modell,
    aar: origin.aar,
    finn_utpris: finn,
    rationale: why,
    n_comps: payload && payload.n_comps != null ? payload.n_comps : twins.length,
    writes_erp: false,
    error: (Number.isFinite(Number(finn)) && Number(finn) > 0) ? null : 'chef returnerte ikke gyldig finn_utpris',
  });
}

function clip3(a, b) {
  const lines = [a, b].filter(Boolean).join('\n').split('\n').filter((l) => l.trim());
  return lines.slice(0, 3).join('\n');
}

function shouldLiveCall(dossier, flags) {
  if (flags.dryRun) return { live: false, reason: 'dry-run (writes_erp false)' };
  if (!dossier.listings_ready) {
    return { live: false, reason: 'JR listings not ready — Finn/car.info clients not wired. Dry-run measurement (writes_erp false).' };
  }
  const missing = CHEFS.filter((c) => !keyFor(c));
  if (missing.length === CHEFS.length) {
    return { live: false, reason: 'API keys missing (ANTHROPIC_API_KEY, XAI_API_KEY/GROK, GEMINI/GOOGLE). Dry-run measurement (writes_erp false).' };
  }
  return { live: true, reason: null };
}

/**
 * One car → exactly three measurements (claude, grok, gemini).
 * internnr is identity only.
 */
async function evaluateCar(hint, flags) {
  const f = Object.assign({ dryRun: false, writes_erp: WRITES_ERP }, flags || {});
  if (f.writes_erp === true) failHard('HARD: writes_erp cannot be true');
  const intern = hint && hint.internnr;
  if (intern != null && f.routeByInternnrParity) {
    failHard('HARD: internnr even/odd must not pick chefs');
  }

  const dossier = await gatherIdentity(hint, f);
  const origin = dossier.origin;
  if (!origin.regnr && origin.internnr == null) {
    return CHEFS.map((c) => chefErrorMeasurement({ regnr: 'UNKNOWN' }, c, 'car hint mangler internnr og regnr'));
  }
  if (!origin.regnr) {
    return CHEFS.map((c) => chefErrorMeasurement(Object.assign({}, origin, { regnr: 'UNKNOWN' }), c, 'regnr mangler (JR). Dry-run measurement.'));
  }

  const gate = shouldLiveCall(dossier, f);
  let chefRows;
  if (!gate.live) {
    chefRows = dryChefResults(gate.reason);
  } else {
    chefRows = await runAllChefs(dossier, f);
  }

  const recs = [];
  for (const row of chefRows) {
    const ev = row.evaluator;
    const r = row.result || {};
    if (!r.ok) {
      recs.push(chefErrorMeasurement(origin, ev, r.error || gate.reason || 'chef failed'));
      continue;
    }
    recs.push(chefOkMeasurement(origin, ev, r.payload || {}));
  }
  if (recs.length !== 3) failHard('expected 3 chef measurements, got ' + recs.length);
  if (recs.some((m) => m.writes_erp !== false)) failHard('HARD: writes_erp leaked true');
  const names = recs.map((m) => m.evaluator);
  if (names.join(',') !== CHEFS.join(',')) failHard('chefs must be claude,grok,gemini in that order — internnr must not reorder');
  return recs;
}

async function run(argv) {
  const flags = parseArgs(argv);
  if (flags.help) {
    process.stdout.write(helpText());
    return { ok: true, help: true };
  }
  const cars = loadCars(flags.cars || path.join(__dirname, 'cars.json'));
  if (!cars.length) {
    process.stderr.write('Ingen biler. Gi --cars cars.json eller --cars internnr,regnr (weekend 26 senere).\n');
    return { ok: true, cars: 0, records: [] };
  }

  const all = [];
  for (const car of cars) {
    const recs = await evaluateCar(car, flags);
    all.push.apply(all, recs);
  }

  const outFile = flags.out || defaultJsonlPath();
  const pub = appendMeasurements(outFile, all);
  process.stdout.write('[loop2] appended ' + pub.appended + ' → ' + pub.file + ' (total ' + pub.total + ', writes_erp=false)\n');
  for (const r of all) {
    const dot = pulseDot(r);
    process.stdout.write('  ' + r.regnr + ' ' + r.evaluator + ' ok=' + r.ok + ' finn_utpris=' + (dot == null ? '—' : dot) + (r.error ? ' err=' + r.error : '') + '\n');
  }

  if (flags.commit) {
    const c = commitPages(outFile, { push: flags.push });
    process.stdout.write('[loop2] publish ' + JSON.stringify(c) + '\n');
  }
  return { ok: true, cars: cars.length, records: all, file: outFile };
}

function helpText() {
  return [
    'loop2 Mini shadow runner — Claude / Grok 4.6 / Gemini. writes_erp always false.',
    '',
    '  node run.js --cars cars.json',
    '  node run.js --cars 4237,UN35424 --dry-run',
    '  node run.js --cars cars.json --out /path/loop2-measurements.jsonl --commit',
    '',
    'Flags:',
    '  --cars    JSON-fil eller kommaseparert internnr/regnr (weekend 26 senere)',
    '  --dry-run skriv ok:false (ingen API). Default når Finn/car.info mangler.',
    '  --out     jsonl-sti (default: GitHub Pages-repo / loop2-measurements.jsonl)',
    '  --commit  git add/commit/push samme mønster som bot4-measurements.jsonl',
    '  --no-push commit uten push',
    '',
    'Det finnes ingen --write-erp. Internnr partall/oddetall velger ikke chef.',
    '',
  ].join('\n');
}

if (require.main === module) {
  run(process.argv).catch((e) => {
    process.stderr.write('[loop2] FATAL: ' + (e && e.message || e) + '\n');
    process.exit(1);
  });
}

module.exports = {
  WRITES_ERP,
  parseArgs,
  parseCarToken,
  loadCars,
  evaluateCar,
  shouldLiveCall,
  run,
  helpText,
};
