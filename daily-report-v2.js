// Peasy dagsanalyse — sender daglig rapport til mike@autoringen.no
// Kjøres av launchd hver dag kl 23:59 (com.peasy.daily-report)
// Test-kjør: node daily-report.js --dry-run [YYYY-MM-DD]
//
// Datakilder:
//   - Master XLSX fra biladministrasjon.no (offentlig)
//   - Lokal measurements.jsonl (V3-evalueringer)
// Sender via nodemailer -> exchange.tornado.email

import 'dotenv/config';
import fs from 'fs/promises';
import * as XLSX from 'xlsx';
import nodemailer from 'nodemailer';

const XLSX_URL = 'https://api.biladministrasjon.no/public/reports/peasy/dhqui7Hkl54?output=xlsx';
const MEAS_FILE = '/Users/bot/peasy-auto/v2/logs.nosync/measurements.jsonl';
const MAIL_TO = process.env.DAILY_REPORT_TO || 'mike@autoringen.no';

// ---------- Helpers ----------
const pad = n => (n < 10 ? '0' : '') + n;
const fmtDate = d => pad(d.getDate()) + '.' + pad(d.getMonth() + 1) + '.' + d.getFullYear();
const fmtKr = n => n == null || !Number.isFinite(n) ? '–' : Math.round(n).toLocaleString('nb-NO');

function parseNorwegianDate(s) {
  if (!s) return null;
  const str = String(s).trim();
  // Format: "11.08.2026 14:23" or "11.08.2026"
  const m = str.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})(?:\s+(\d{1,2}):(\d{2}))?/);
  if (!m) return null;
  return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]), Number(m[4] || 0), Number(m[5] || 0));
}

function isDateOn(s, target) {
  const d = parseNorwegianDate(s);
  if (!d) return false;
  return d.getFullYear() === target.getFullYear() && d.getMonth() === target.getMonth() && d.getDate() === target.getDate();
}

function daysBetween(a, b) { return Math.floor((b - a) / (1000 * 60 * 60 * 24)); }

// ---------- Fetch + Parse ----------
async function fetchXlsx() {
  const res = await fetch(XLSX_URL);
  if (!res.ok) throw new Error('XLSX fetch failed: ' + res.status);
  const buf = Buffer.from(await res.arrayBuffer());
  const wb = XLSX.read(buf, { type: 'buffer' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json(ws, { header: 1 });
}

function headerIndex(H) {
  const idx = {};
  H.forEach((h, i) => { idx[h] = i; });
  return idx;
}

async function loadMeasurements() {
  try {
    const text = await fs.readFile(MEAS_FILE, 'utf8');
    const recs = text.split('\n').filter(Boolean).map(l => { try { return JSON.parse(l); } catch (e) { return null; } }).filter(Boolean);
    // latest per regnr
    const byReg = {};
    for (const r of recs) {
      const rg = (r.regnr || '').toUpperCase();
      if (!rg) continue;
      if (!byReg[rg] || (r.timestamp || '') > (byReg[rg].timestamp || '')) byReg[rg] = r;
    }
    return byReg;
  } catch (e) { return {}; }
}

// ---------- Metrics ----------
function computeMetrics(rows, target, v3ByReg) {
  const H = rows[0]; const I = headerIndex(H);
  const cars = [];
  for (let i = 1; i < rows.length; i++) {
    cars.push(rows[i]);
  }

  const on = col => cars.filter(r => isDateOn(r[I[col]], target));

  const leadsToday = on('SD mottatt på');
  const leadsPeasy = leadsToday.filter(r => String(r[I['Kilde']] || '').toLowerCase() === 'peasy');
  const leadsDrive = leadsToday.filter(r => String(r[I['Kilde']] || '').toLowerCase() === 'driveno');

  const estToday = on('Estimering');
  const bestGire = on('Gire bestilt på');
  const bestLev = on('Levere selv');
  const bestiltToday = [...bestGire, ...bestLev.filter(r => !bestGire.includes(r))];

  const mottattToday = on('Mottatt');
  const solgtToday = on('Solgt på');
  const returnertToday = on('Returnert på');

  // Solgt-analyse: for hver solgt bil, sammenlign salgspris med D-lav som ble sendt til kunde
  const solgtAnalysis = solgtToday.map(r => {
    const rg = String(r[I['RegNr.']] || '').toUpperCase();
    const v3m = v3ByReg[rg];
    const dLavSendt = v3m?.easy?.dLav ?? null;
    const dHoySendt = v3m?.easy?.dHoy ?? null;
    // Salgspris = Høyeste bud (kolonne E i ERP) = faktisk oppnådd auksjonspris
    const hoyeste = Number(r[I['Høyeste bud']]) || null;
    const bud = Number(r[I['Bud']]) || null;
    const salgspris = hoyeste;
    const pctOverDlav = (dLavSendt && salgspris) ? Math.round(((salgspris / dLavSendt) - 1) * 100) : null;
    const krDiff = (dLavSendt && salgspris) ? salgspris - dLavSendt : null;
    return {
      regnr: rg,
      internnr: r[I['Internnr.']],
      merke: r[I['Merke']],
      modell: r[I['Modell']],
      aar: r[I['År']],
      km: r[I['KM']],
      variant: v3m?.identifikasjon?.variant,
      d_lav_sendt: dLavSendt,
      d_hoy_sendt: dHoySendt,
      salgspris,
      bud, hoyeste,
      pct_over_dlav: pctOverDlav,
      kr_diff: krDiff
    };
  });

  // V3 vs Easy for leads today (or estimert today)
  const evalPool = leadsToday.length > 0 ? leadsToday : estToday;
  const evalRows = evalPool.map(r => {
    const rg = String(r[I['RegNr.']] || '').toUpperCase();
    const v3m = v3ByReg[rg];
    const v3 = v3m?.v2 || null;
    const easy = v3m?.easy || null;
    const em = easy && easy.dLav && easy.dHoy ? (easy.dLav + easy.dHoy) / 2 : null;
    const vm = v3 && v3.dLav && v3.dHoy ? (v3.dLav + v3.dHoy) / 2 : null;
    return {
      regnr: rg,
      internnr: r[I['Internnr.']],
      status: r[I['Status']],
      merke: r[I['Merke']],
      modell: r[I['Modell']],
      aar: r[I['År']],
      km: r[I['KM']],
      easy_lav: easy?.dLav, easy_hoy: easy?.dHoy, easy_mid: em,
      v3_lav: v3?.dLav, v3_hoy: v3?.dHoy, v3_mid: vm, v3_anker: v3?.anchor?.anker_beregning?.anker,
      diff_pct: (em && vm) ? Math.round(((vm / em) - 1) * 100) : null,
      bp: v3?.anchor?.bulletproof_score ? Math.round(v3.anchor.bulletproof_score * 100) : null,
      conf: v3?.anchor?.confidence,
      variant: v3m?.identifikasjon?.variant,
      has_v3: !!vm
    };
  });

  // 30-day averages (for leads context)
  const start30 = new Date(target); start30.setDate(target.getDate() - 30);
  let leads30 = 0, leadsDays = new Set();
  for (const r of cars) {
    const d = parseNorwegianDate(r[I['SD mottatt på']]);
    if (d && d >= start30 && d < target) { leads30++; leadsDays.add(fmtDate(d)); }
  }
  const leadsAvg = leadsDays.size > 0 ? leads30 / leadsDays.size : 0;

  return {
    leads: { total: leadsToday.length, peasy: leadsPeasy.length, drive: leadsDrive.length, avg30: leadsAvg },
    estimering_sendt: estToday.length,
    akseptert: { total: bestiltToday.length, gire: bestGire.length, levere_selv: bestLev.length },
    mottatt: mottattToday.length,
    solgt: solgtToday.length,
    returnert: returnertToday.length,
    // For rejected — note: XLSX doesn't have transition timestamp, so we approximate:
    // "biler med Estimering=i går som nå har status starting with Avvist"
    avvist_approx: estToday.filter(r => (r[I['Status']] || '').toLowerCase().startsWith('avvist')),
    eval_rows: evalRows,
    solgt_analysis: solgtAnalysis
  };
}

// ---------- Render ----------
function statusBadge(diff) {
  if (diff == null) return '<span style="color:#888">–</span>';
  const c = Math.abs(diff) > 20 ? '#A8221C' : Math.abs(diff) > 10 ? '#8A6708' : '#0F6E66';
  return '<b style="color:' + c + '">' + (diff >= 0 ? '+' : '') + diff + '%</b>';
}

function renderHtml(target, m) {
  const withV3 = m.eval_rows.filter(r => r.has_v3);
  const meanDiff = withV3.length ? Math.round(withV3.reduce((s, r) => s + r.diff_pct, 0) / withV3.length) : null;
  const bigDiff = withV3.filter(r => Math.abs(r.diff_pct) > 15);
  const leadsDelta = m.leads.avg30 > 0 ? Math.round(((m.leads.total / m.leads.avg30) - 1) * 100) : null;

  const rowsHtml = m.eval_rows
    .sort((a, b) => (a.regnr || '').localeCompare(b.regnr || ''))
    .map(r => {
      const easy = (r.easy_lav && r.easy_hoy) ? Math.round(r.easy_lav / 1000) + '-' + Math.round(r.easy_hoy / 1000) + 'k' : '–';
      const v3 = (r.v3_lav != null && r.v3_hoy != null) ? Math.round(r.v3_lav / 1000) + '-' + Math.round(r.v3_hoy / 1000) + 'k' : '–';
      const variant = (r.variant || (r.merke + ' ' + r.modell)).slice(0, 42);
      return '<tr><td style="padding:4px 6px;border:1px solid #ddd;font-family:monospace;">' + r.regnr +
        '</td><td style="padding:4px 6px;border:1px solid #ddd;">' + variant +
        '</td><td style="padding:4px 6px;border:1px solid #ddd;text-align:right;">' + (r.km ? Math.round(r.km / 1000) + 'k' : '?') +
        '</td><td style="padding:4px 6px;border:1px solid #ddd;text-align:right;">' + easy +
        '</td><td style="padding:4px 6px;border:1px solid #ddd;text-align:right;">' + v3 +
        '</td><td style="padding:4px 6px;border:1px solid #ddd;text-align:right;">' + statusBadge(r.diff_pct) +
        '</td><td style="padding:4px 6px;border:1px solid #ddd;font-size:11px;">' + (r.status || '–') + '</td></tr>';
    }).join('');

  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"></head><body style="font-family:-apple-system,Helvetica,Arial,sans-serif;color:#1a1a1a;line-height:1.5;max-width:820px;margin:0 auto;padding:20px">
<h1 style="color:#004225;border-bottom:2px solid #004225;padding-bottom:8px;margin-bottom:4px">Peasy dagsanalyse</h1>
<p style="color:#666;margin-top:0">Dato: <strong>${fmtDate(target)}</strong> · Generert: ${fmtDate(new Date())} kl ${pad(new Date().getHours())}:${pad(new Date().getMinutes())}</p>

<h2 style="color:#004225;border-bottom:1px solid #ddd;padding-bottom:4px">Nøkkeltall</h2>
<table style="border-collapse:collapse;width:100%;margin-bottom:20px">
<tr style="background:#f5f5f0"><td style="padding:8px;border:1px solid #ddd;font-weight:600">Leads mottatt</td><td style="padding:8px;border:1px solid #ddd">${m.leads.total} <span style="color:#666">(Peasy: ${m.leads.peasy} · Drive: ${m.leads.drive})</span> · 30d-snitt: ${m.leads.avg30.toFixed(1)} ${leadsDelta != null ? '<b style="color:' + (leadsDelta >= 0 ? '#0F6E66' : '#A8221C') + '">(' + (leadsDelta >= 0 ? '+' : '') + leadsDelta + '%)</b>' : ''}</td></tr>
<tr><td style="padding:8px;border:1px solid #ddd;font-weight:600">Estimering sendt til kunde</td><td style="padding:8px;border:1px solid #ddd">${m.estimering_sendt}</td></tr>
<tr style="background:#f5f5f0"><td style="padding:8px;border:1px solid #ddd;font-weight:600">Akseptert (Bestilt hent/lev)</td><td style="padding:8px;border:1px solid #ddd"><strong style="color:#0F6E66">${m.akseptert.total}</strong> <span style="color:#666">(Gire: ${m.akseptert.gire} · Levere selv: ${m.akseptert.levere_selv})</span></td></tr>
<tr><td style="padding:8px;border:1px solid #ddd;font-weight:600">Mottatt anlegg</td><td style="padding:8px;border:1px solid #ddd">${m.mottatt}</td></tr>
<tr style="background:#f5f5f0"><td style="padding:8px;border:1px solid #ddd;font-weight:600">Solgt på auksjon</td><td style="padding:8px;border:1px solid #ddd">${m.solgt}</td></tr>
<tr><td style="padding:8px;border:1px solid #ddd;font-weight:600">Returnert</td><td style="padding:8px;border:1px solid #ddd">${m.returnert}</td></tr>
<tr style="background:#f5f5f0"><td style="padding:8px;border:1px solid #ddd;font-weight:600">Avvist (approx: est. sendt = dagens dato + status=avvist)</td><td style="padding:8px;border:1px solid #ddd"><span style="color:#A8221C">${m.avvist_approx.length}</span> <span style="color:#888;font-size:11px">— presis timing kommer når soft.team leverer rejected-endpoint</span></td></tr>
<tr><td style="padding:8px;border:1px solid #ddd;font-weight:600">V3-dekning</td><td style="padding:8px;border:1px solid #ddd">${withV3.length}/${m.eval_rows.length} ${m.eval_rows.length > 0 ? '(' + Math.round(withV3.length / m.eval_rows.length * 100) + '%)' : ''}</td></tr>
<tr style="background:#f5f5f0"><td style="padding:8px;border:1px solid #ddd;font-weight:600">Mean V3 vs Easy</td><td style="padding:8px;border:1px solid #ddd">${meanDiff != null ? (meanDiff >= 0 ? '+' : '') + meanDiff + '%' : '–'}</td></tr>
</table>

<h2 style="color:#004225;border-bottom:1px solid #ddd;padding-bottom:4px">Markedskommentar</h2>
<p style="line-height:1.7">
${m.leads.total === 0 ? 'Ingen leads mottatt i dag.' :
  'Leads i dag: <b>' + m.leads.total + '</b> (30d-snitt ' + m.leads.avg30.toFixed(1) +
  (leadsDelta != null ? ', <b style="color:' + (leadsDelta >= 0 ? '#0F6E66' : '#A8221C') + '">' + (leadsDelta >= 0 ? '+' : '') + leadsDelta + '%</b>' : '') +
  '). Kildemix: ' + m.leads.peasy + ' Peasy vs ' + m.leads.drive + ' Drive' +
  (m.leads.peasy + m.leads.drive > 0 ? ' (' + Math.round(m.leads.peasy / (m.leads.peasy + m.leads.drive) * 100) + '% Peasy).' : '.')}
${m.akseptert.total > 0 ? ' Aksept-rate i dag: <b>' + m.akseptert.total + '/' + m.eval_rows.length + '</b> (' + (m.eval_rows.length > 0 ? Math.round(m.akseptert.total / m.eval_rows.length * 100) : 0) + '% av dagens eval).' : ''}
</p>

${m.solgt_analysis && m.solgt_analysis.length > 0 ? `<h2 style="color:#004225;border-bottom:1px solid #ddd;padding-bottom:4px">Solgte biler — salgspris vs D-lav sendt til kunde</h2>
<p style="line-height:1.6"><em>Hentet D-lav fra V3-measurements-loggen for hver solgt regnr. Prosent viser hvor mye salgsprisen ligger over/under D-lav som ble kommunisert til kunde.</em></p>
<table style="border-collapse:collapse;width:100%;font-size:13px;margin-bottom:20px">
<tr style="background:#004225;color:#fff">
<th style="padding:6px;border:1px solid #ddd;text-align:left">Regnr</th>
<th style="padding:6px;border:1px solid #ddd;text-align:left">Bil</th>
<th style="padding:6px;border:1px solid #ddd;text-align:right">D-lav sendt</th>
<th style="padding:6px;border:1px solid #ddd;text-align:right">Salgspris</th>
<th style="padding:6px;border:1px solid #ddd;text-align:right">Δ kr</th>
<th style="padding:6px;border:1px solid #ddd;text-align:right">% over D-lav</th>
</tr>
${m.solgt_analysis.map(s => {
  const variant = (s.variant || (s.merke + ' ' + s.modell)).slice(0, 42);
  const dlav = s.d_lav_sendt != null ? Math.round(s.d_lav_sendt).toLocaleString('nb-NO') : '–';
  const salg = s.salgspris != null ? Math.round(s.salgspris).toLocaleString('nb-NO') : '–';
  const krD = s.kr_diff != null ? (s.kr_diff >= 0 ? '+' : '') + Math.round(s.kr_diff).toLocaleString('nb-NO') : '–';
  const pctColor = s.pct_over_dlav == null ? '#888' : s.pct_over_dlav >= 5 ? '#0F6E66' : s.pct_over_dlav >= -5 ? '#8A6708' : '#A8221C';
  const pctText = s.pct_over_dlav != null ? '<b style="color:' + pctColor + '">' + (s.pct_over_dlav >= 0 ? '+' : '') + s.pct_over_dlav + '%</b>' : '<span style="color:#888">–</span>';
  return '<tr><td style="padding:6px;border:1px solid #ddd;font-family:monospace">' + s.regnr +
    '</td><td style="padding:6px;border:1px solid #ddd">' + variant +
    '</td><td style="padding:6px;border:1px solid #ddd;text-align:right;font-family:monospace">' + dlav +
    '</td><td style="padding:6px;border:1px solid #ddd;text-align:right;font-family:monospace;font-weight:600">' + salg +
    '</td><td style="padding:6px;border:1px solid #ddd;text-align:right;font-family:monospace">' + krD +
    '</td><td style="padding:6px;border:1px solid #ddd;text-align:right">' + pctText + '</td></tr>';
}).join('')}
${(() => {
  const withPct = m.solgt_analysis.filter(s => s.pct_over_dlav != null);
  if (withPct.length === 0) return '';
  const avg = Math.round(withPct.reduce((a, s) => a + s.pct_over_dlav, 0) / withPct.length);
  const avgKr = Math.round(withPct.reduce((a, s) => a + s.kr_diff, 0) / withPct.length);
  return '<tr style="background:#f5f5f0;font-weight:600"><td colspan="4" style="padding:6px;border:1px solid #ddd;text-align:right">Snitt (' + withPct.length + ' biler):</td>' +
    '<td style="padding:6px;border:1px solid #ddd;text-align:right;font-family:monospace">' + (avgKr >= 0 ? '+' : '') + avgKr.toLocaleString('nb-NO') + '</td>' +
    '<td style="padding:6px;border:1px solid #ddd;text-align:right;color:' + (avg >= 0 ? '#0F6E66' : '#A8221C') + '">' + (avg >= 0 ? '+' : '') + avg + '%</td></tr>';
})()}
</table>` : ''}

${bigDiff.length > 0 ? `<h2 style="color:#004225;border-bottom:1px solid #ddd;padding-bottom:4px">V3 vs Easy — store avvik (&gt;15%)</h2>
<table style="border-collapse:collapse;width:100%;font-size:13px;margin-bottom:20px">
<tr style="background:#004225;color:#fff"><th style="padding:6px;border:1px solid #ddd;text-align:left">Regnr</th><th style="padding:6px;border:1px solid #ddd;text-align:left">Bil</th><th style="padding:6px;border:1px solid #ddd;text-align:right">Easy</th><th style="padding:6px;border:1px solid #ddd;text-align:right">V3</th><th style="padding:6px;border:1px solid #ddd;text-align:right">Diff</th></tr>
${bigDiff.map(r => {
  const easy = (r.easy_lav && r.easy_hoy) ? Math.round(r.easy_lav / 1000) + '-' + Math.round(r.easy_hoy / 1000) + 'k' : '–';
  const v3 = (r.v3_lav != null && r.v3_hoy != null) ? Math.round(r.v3_lav / 1000) + '-' + Math.round(r.v3_hoy / 1000) + 'k' : '–';
  return `<tr><td style="padding:6px;border:1px solid #ddd;font-family:monospace">${r.regnr}</td><td style="padding:6px;border:1px solid #ddd">${(r.variant || r.merke + ' ' + r.modell).slice(0, 42)}</td><td style="padding:6px;border:1px solid #ddd;text-align:right">${easy}</td><td style="padding:6px;border:1px solid #ddd;text-align:right">${v3}</td><td style="padding:6px;border:1px solid #ddd;text-align:right">${statusBadge(r.diff_pct)}</td></tr>`;
}).join('')}
</table>` : ''}

<h2 style="color:#004225;border-bottom:1px solid #ddd;padding-bottom:4px">Dagens biler (sortert alfabetisk)</h2>
<table style="border-collapse:collapse;width:100%;font-size:12px;margin-bottom:20px">
<tr style="background:#004225;color:#fff">
<th style="padding:4px 6px;border:1px solid #ddd;text-align:left">Regnr</th>
<th style="padding:4px 6px;border:1px solid #ddd;text-align:left">Bil</th>
<th style="padding:4px 6px;border:1px solid #ddd;text-align:right">Km</th>
<th style="padding:4px 6px;border:1px solid #ddd;text-align:right">Easy</th>
<th style="padding:4px 6px;border:1px solid #ddd;text-align:right">V3</th>
<th style="padding:4px 6px;border:1px solid #ddd;text-align:right">Δ</th>
<th style="padding:4px 6px;border:1px solid #ddd;text-align:left">Status</th>
</tr>
${rowsHtml || '<tr><td colspan="7" style="padding:20px;text-align:center;color:#888">Ingen biler i eval-poolen</td></tr>'}
</table>

<p style="margin-top:30px;color:#888;font-size:11px;font-style:italic">
Auto-generert av <code>daily-report.js</code> · Kilder: master XLSX (biladministrasjon.no offentlig) + lokal measurements.jsonl (V3-eval).
Avvist-timing er approksimasjon inntil soft.team leverer rejected-list-endpoint med rejected_at + reason-felt.
</p>
</body></html>`;
}

// ---------- Send ----------
async function sendReport(subject, html, dryRun) {
  if (dryRun) {
    const path = '/tmp/daily-report-preview.html';
    await fs.writeFile(path, html, 'utf8');
    console.log('DRY-RUN preview written to:', path);
    return { ok: true, dry: true };
  }
  const user = process.env.IMAP_USER || process.env.EMAIL_USER;
  const pass = process.env.IMAP_PASS;
  if (!user || !pass) throw new Error('IMAP_USER / IMAP_PASS mangler i .env');
  const t = nodemailer.createTransport({
    host: 'exchange.tornado.email', port: 587, secure: false,
    auth: { user, pass },
    connectionTimeout: 10000, greetingTimeout: 10000
  });
  const info = await t.sendMail({
    from: 'Peasy Bot <' + user + '>',
    to: MAIL_TO,
    subject, html
  });
  console.log('mail sendt til', MAIL_TO, ':', info.response);
  return { ok: true, response: info.response };
}

// ---------- Main ----------
async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const dateArg = args.find(a => /^\d{4}-\d{2}-\d{2}$/.test(a));
  let target;
  if (dateArg) {
    const [y, mo, d] = dateArg.split('-').map(Number);
    target = new Date(y, mo - 1, d);
  } else {
    target = new Date(); target.setDate(target.getDate() - 1);
  }
  target.setHours(0, 0, 0, 0);

  console.log('Peasy dagsanalyse for', fmtDate(target), dryRun ? '(DRY RUN)' : '');
  const rows = await fetchXlsx();
  console.log('Master rows:', rows.length - 1);
  const v3 = await loadMeasurements();
  console.log('V3 records:', Object.keys(v3).length);
  const metrics = computeMetrics(rows, target, v3);
  console.log('Metrics:', {
    leads: metrics.leads.total, est: metrics.estimering_sendt,
    akseptert: metrics.akseptert.total, mottatt: metrics.mottatt,
    solgt: metrics.solgt, returnert: metrics.returnert
  });
  const html = renderHtml(target, metrics);
  const subject = 'Peasy dagsanalyse ' + fmtDate(target) +
    ' (' + metrics.leads.total + ' leads, ' + metrics.akseptert.total + ' aksept, ' + metrics.avvist_approx.length + ' avvist)';
  const r = await sendReport(subject, html, dryRun);
  console.log('Result:', r);
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });
