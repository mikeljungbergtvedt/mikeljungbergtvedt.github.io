// Peasy ukesanalyse — sender ukentlig rapport til mike@autoringen.no
// Kjøres av launchd hver søndag kl 23:59 (com.peasy.weekly-report)
// Test-kjør: node weekly-report.js --dry-run [YYYY-MM-DD]  (YYYY-MM-DD = uke som slutter denne dagen)
//
// Uke = mandag 00:00 → søndag 23:59

import 'dotenv/config';
import fs from 'fs/promises';
import * as XLSX from 'xlsx';
import nodemailer from 'nodemailer';

const XLSX_URL = 'https://api.biladministrasjon.no/public/reports/peasy/dhqui7Hkl54?output=xlsx';
const MEAS_FILE = '/Users/bot/peasy-auto/v2/logs.nosync/measurements.jsonl';
const MAIL_TO = process.env.DAILY_REPORT_TO || 'mike@autoringen.no';

const pad = n => (n < 10 ? '0' : '') + n;
const fmtDate = d => pad(d.getDate()) + '.' + pad(d.getMonth() + 1) + '.' + d.getFullYear();
const fmtKr = n => n == null || !Number.isFinite(n) ? '–' : Math.round(n).toLocaleString('nb-NO');
const parsePrice = s => { const m = String(s || '').replace(/\s|kr|,/gi, '').match(/(\d+)/); return m ? Number(m[1]) : null; };

function parseNorwegianDate(s) {
  if (!s) return null;
  const m = String(s).trim().match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})(?:\s+(\d{1,2}):(\d{2}))?/);
  if (!m) return null;
  return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]), Number(m[4] || 0), Number(m[5] || 0));
}

function isInRange(s, start, end) {
  const d = parseNorwegianDate(s);
  if (!d) return false;
  return d >= start && d <= end;
}

async function fetchXlsx() {
  const res = await fetch(XLSX_URL);
  if (!res.ok) throw new Error('XLSX fetch failed: ' + res.status);
  const buf = Buffer.from(await res.arrayBuffer());
  const wb = XLSX.read(buf, { type: 'buffer' });
  return XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 });
}

function headerIndex(H) { const idx = {}; H.forEach((h, i) => { idx[h] = i; }); return idx; }

async function loadMeasurements() {
  try {
    const text = await fs.readFile(MEAS_FILE, 'utf8');
    const recs = text.split('\n').filter(Boolean).map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
    const byReg = {};
    for (const r of recs) {
      const rg = (r.regnr || '').toUpperCase();
      if (!rg) continue;
      if (!byReg[rg] || (r.timestamp || '') > (byReg[rg].timestamp || '')) byReg[rg] = r;
    }
    return byReg;
  } catch { return {}; }
}

function computeMetrics(rows, weekStart, weekEnd, v3ByReg) {
  const H = rows[0]; const I = headerIndex(H);
  const cars = rows.slice(1);
  const inWeek = col => cars.filter(r => isInRange(r[I[col]], weekStart, weekEnd));

  const leads = inWeek('SD mottatt på');
  const leadsPeasy = leads.filter(r => String(r[I['Kilde']] || '').toLowerCase() === 'peasy');
  const leadsDrive = leads.filter(r => String(r[I['Kilde']] || '').toLowerCase() === 'driveno');
  const estRows = inWeek('Estimering');
  const bestGire = inWeek('Gire bestilt på');
  const bestLev = inWeek('Levere selv');
  const akseptert = [...bestGire, ...bestLev.filter(r => !bestGire.includes(r))];
  const mottatt = inWeek('Mottatt');
  const solgt = inWeek('Solgt på');
  const returnert = inWeek('Returnert på');

  // Solgt-analyse: for hver solgt bil i uken
  const solgtAnalysis = solgt.map(r => {
    const rg = String(r[I['RegNr.']] || '').toUpperCase();
    const v3m = v3ByReg[rg];
    const dLavSendt = v3m?.easy?.dLav ?? null;
    const dHoySendt = v3m?.easy?.dHoy ?? null;
    const hoyeste = Number(r[I['Høyeste bud']]) || null; // kolonne E = salgspris
    const bud = Number(r[I['Bud']]) || null;
    const salgspris = hoyeste;
    const pctOverDlav = (dLavSendt && salgspris) ? Math.round(((salgspris / dLavSendt) - 1) * 100) : null;
    const krDiff = (dLavSendt && salgspris) ? salgspris - dLavSendt : null;
    return {
      regnr: rg, internnr: r[I['Internnr.']],
      merke: r[I['Merke']], modell: r[I['Modell']], aar: r[I['År']],
      km: r[I['KM']], variant: v3m?.identifikasjon?.variant,
      d_lav_sendt: dLavSendt, d_hoy_sendt: dHoySendt,
      salgspris, bud, hoyeste,
      pct_over_dlav: pctOverDlav, kr_diff: krDiff,
      solgt_dato: r[I['Solgt på']]
    };
  });

  // Per-dag breakdown for tabell
  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart); d.setDate(weekStart.getDate() + i);
    const dEnd = new Date(d); dEnd.setHours(23, 59, 59, 999);
    days.push({
      date: d,
      leads: cars.filter(r => isInRange(r[I['SD mottatt på']], d, dEnd)).length,
      akseptert: cars.filter(r => isInRange(r[I['Gire bestilt på']], d, dEnd) || isInRange(r[I['Levere selv']], d, dEnd)).length,
      solgt: cars.filter(r => isInRange(r[I['Solgt på']], d, dEnd)).length,
      returnert: cars.filter(r => isInRange(r[I['Returnert på']], d, dEnd)).length,
    });
  }

  return {
    leads: { total: leads.length, peasy: leadsPeasy.length, drive: leadsDrive.length },
    estimering_sendt: estRows.length,
    akseptert: { total: akseptert.length, gire: bestGire.length, levere_selv: bestLev.length },
    mottatt: mottatt.length,
    solgt: solgt.length,
    returnert: returnert.length,
    days,
    solgt_analysis: solgtAnalysis
  };
}

function pctBadge(diff) {
  if (diff == null) return '<span style="color:#888">–</span>';
  const c = Math.abs(diff) > 20 ? '#A8221C' : Math.abs(diff) > 10 ? '#8A6708' : '#0F6E66';
  return '<b style="color:' + c + '">' + (diff >= 0 ? '+' : '') + diff + '%</b>';
}

function renderHtml(weekStart, weekEnd, m) {
  const dayRows = m.days.map(d => `<tr>
    <td style="padding:4px 8px;border:1px solid #ddd">${fmtDate(d.date)}</td>
    <td style="padding:4px 8px;border:1px solid #ddd;text-align:right">${d.leads}</td>
    <td style="padding:4px 8px;border:1px solid #ddd;text-align:right">${d.akseptert}</td>
    <td style="padding:4px 8px;border:1px solid #ddd;text-align:right">${d.solgt}</td>
    <td style="padding:4px 8px;border:1px solid #ddd;text-align:right">${d.returnert}</td>
  </tr>`).join('');

  const withPct = m.solgt_analysis.filter(s => s.pct_over_dlav != null);
  const avgPct = withPct.length ? Math.round(withPct.reduce((a, s) => a + s.pct_over_dlav, 0) / withPct.length) : null;
  const avgKr = withPct.length ? Math.round(withPct.reduce((a, s) => a + s.kr_diff, 0) / withPct.length) : null;

  const solgtRows = m.solgt_analysis
    .sort((a, b) => (a.regnr || '').localeCompare(b.regnr || ''))
    .map(s => {
      const variant = (s.variant || (s.merke + ' ' + s.modell)).slice(0, 42);
      const dlav = s.d_lav_sendt != null ? Math.round(s.d_lav_sendt).toLocaleString('nb-NO') : '–';
      const salg = s.salgspris != null ? Math.round(s.salgspris).toLocaleString('nb-NO') : '–';
      const kr = s.kr_diff != null ? (s.kr_diff >= 0 ? '+' : '') + Math.round(s.kr_diff).toLocaleString('nb-NO') : '–';
      return `<tr>
        <td style="padding:6px;border:1px solid #ddd;font-family:monospace">${s.regnr}</td>
        <td style="padding:6px;border:1px solid #ddd">${variant}</td>
        <td style="padding:6px;border:1px solid #ddd;text-align:right;font-family:monospace">${dlav}</td>
        <td style="padding:6px;border:1px solid #ddd;text-align:right;font-family:monospace;font-weight:600">${salg}</td>
        <td style="padding:6px;border:1px solid #ddd;text-align:right;font-family:monospace">${kr}</td>
        <td style="padding:6px;border:1px solid #ddd;text-align:right">${pctBadge(s.pct_over_dlav)}</td>
      </tr>`;
    }).join('');

  const acceptRate = m.estimering_sendt > 0 ? Math.round(m.akseptert.total / m.estimering_sendt * 100) : 0;
  const soldRate = m.mottatt > 0 ? Math.round(m.solgt / m.mottatt * 100) : 0;

  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"></head><body style="font-family:-apple-system,Helvetica,Arial,sans-serif;color:#1a1a1a;line-height:1.5;max-width:900px;margin:0 auto;padding:20px">
<h1 style="color:#004225;border-bottom:2px solid #004225;padding-bottom:8px;margin-bottom:4px">Peasy ukesanalyse</h1>
<p style="color:#666;margin-top:0">Uke: <strong>${fmtDate(weekStart)} – ${fmtDate(weekEnd)}</strong> · Generert: ${fmtDate(new Date())} kl ${pad(new Date().getHours())}:${pad(new Date().getMinutes())}</p>

<h2 style="color:#004225;border-bottom:1px solid #ddd;padding-bottom:4px">Sammendrag</h2>
<table style="border-collapse:collapse;width:100%;margin-bottom:20px">
<tr style="background:#f5f5f0"><td style="padding:8px;border:1px solid #ddd;font-weight:600">Leads mottatt</td><td style="padding:8px;border:1px solid #ddd"><strong>${m.leads.total}</strong> <span style="color:#666">(Peasy: ${m.leads.peasy} · Drive: ${m.leads.drive})</span></td></tr>
<tr><td style="padding:8px;border:1px solid #ddd;font-weight:600">Estimering sendt</td><td style="padding:8px;border:1px solid #ddd">${m.estimering_sendt}</td></tr>
<tr style="background:#f5f5f0"><td style="padding:8px;border:1px solid #ddd;font-weight:600">Akseptert</td><td style="padding:8px;border:1px solid #ddd"><strong style="color:#0F6E66">${m.akseptert.total}</strong> <span style="color:#666">(${acceptRate}% av est. sendt · Gire ${m.akseptert.gire} · Levere selv ${m.akseptert.levere_selv})</span></td></tr>
<tr><td style="padding:8px;border:1px solid #ddd;font-weight:600">Mottatt anlegg</td><td style="padding:8px;border:1px solid #ddd">${m.mottatt}</td></tr>
<tr style="background:#f5f5f0"><td style="padding:8px;border:1px solid #ddd;font-weight:600">Solgt auksjon</td><td style="padding:8px;border:1px solid #ddd"><strong>${m.solgt}</strong> <span style="color:#666">(${soldRate}% av mottatt)</span></td></tr>
<tr><td style="padding:8px;border:1px solid #ddd;font-weight:600">Returnert</td><td style="padding:8px;border:1px solid #ddd">${m.returnert}</td></tr>
${avgPct !== null ? `<tr style="background:#f5f5f0"><td style="padding:8px;border:1px solid #ddd;font-weight:600">Snitt salgspris vs D-lav</td><td style="padding:8px;border:1px solid #ddd"><b style="color:${avgPct >= 0 ? '#0F6E66' : '#A8221C'}">${avgPct >= 0 ? '+' : ''}${avgPct}%</b> <span style="color:#666">(snitt ${(avgKr >= 0 ? '+' : '')}${avgKr.toLocaleString('nb-NO')} kr per bil · ${withPct.length} biler)</span></td></tr>` : ''}
</table>

<h2 style="color:#004225;border-bottom:1px solid #ddd;padding-bottom:4px">Per-dag utvikling</h2>
<table style="border-collapse:collapse;width:100%;font-size:13px;margin-bottom:20px">
<tr style="background:#004225;color:#fff">
<th style="padding:6px;border:1px solid #ddd;text-align:left">Dato</th>
<th style="padding:6px;border:1px solid #ddd;text-align:right">Leads</th>
<th style="padding:6px;border:1px solid #ddd;text-align:right">Akseptert</th>
<th style="padding:6px;border:1px solid #ddd;text-align:right">Solgt</th>
<th style="padding:6px;border:1px solid #ddd;text-align:right">Returnert</th>
</tr>
${dayRows}
</table>

${m.solgt_analysis.length > 0 ? `<h2 style="color:#004225;border-bottom:1px solid #ddd;padding-bottom:4px">Solgte biler — salgspris vs D-lav sendt</h2>
<table style="border-collapse:collapse;width:100%;font-size:13px;margin-bottom:20px">
<tr style="background:#004225;color:#fff">
<th style="padding:6px;border:1px solid #ddd;text-align:left">Regnr</th>
<th style="padding:6px;border:1px solid #ddd;text-align:left">Bil</th>
<th style="padding:6px;border:1px solid #ddd;text-align:right">D-lav sendt</th>
<th style="padding:6px;border:1px solid #ddd;text-align:right">Salgspris</th>
<th style="padding:6px;border:1px solid #ddd;text-align:right">Δ kr</th>
<th style="padding:6px;border:1px solid #ddd;text-align:right">% over D-lav</th>
</tr>
${solgtRows}
</table>` : '<p style="color:#666;font-style:italic">Ingen solgte biler denne uken.</p>'}

<p style="margin-top:30px;color:#888;font-size:11px;font-style:italic">
Auto-generert ukentlig · Kilder: master XLSX + lokal measurements.jsonl (V3-eval). Salgspris fra kolonne E (Høyeste bud).
</p>
</body></html>`;
}

async function sendReport(subject, html, dryRun) {
  if (dryRun) {
    const p = '/tmp/weekly-report-preview.html';
    await fs.writeFile(p, html, 'utf8');
    console.log('DRY-RUN preview:', p);
    return { ok: true, dry: true };
  }
  const user = process.env.IMAP_USER || process.env.EMAIL_USER;
  const pass = process.env.IMAP_PASS;
  if (!user || !pass) throw new Error('IMAP_USER / IMAP_PASS mangler i .env');
  const t = nodemailer.createTransport({
    host: 'exchange.tornado.email', port: 587, secure: false,
    auth: { user, pass }, connectionTimeout: 10000, greetingTimeout: 10000
  });
  const info = await t.sendMail({
    from: 'Peasy Bot <' + user + '>', to: MAIL_TO, subject, html
  });
  console.log('mail sendt til', MAIL_TO, ':', info.response);
  return { ok: true, response: info.response };
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const dateArg = args.find(a => /^\d{4}-\d{2}-\d{2}$/.test(a));
  let sundayEnd;
  if (dateArg) {
    const [y, mo, d] = dateArg.split('-').map(Number);
    sundayEnd = new Date(y, mo - 1, d);
  } else {
    sundayEnd = new Date();
  }
  sundayEnd.setHours(23, 59, 59, 999);
  // Finn mandag den samme uken
  const dayOfWeek = sundayEnd.getDay(); // 0=søndag, 1=mandag, ..., 6=lørdag
  const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const mondayStart = new Date(sundayEnd);
  mondayStart.setDate(sundayEnd.getDate() - daysToMonday);
  mondayStart.setHours(0, 0, 0, 0);

  console.log('Peasy ukesanalyse for', fmtDate(mondayStart), '–', fmtDate(sundayEnd), dryRun ? '(DRY RUN)' : '');
  const rows = await fetchXlsx();
  console.log('Master rows:', rows.length - 1);
  const v3 = await loadMeasurements();
  console.log('V3 records:', Object.keys(v3).length);
  const metrics = computeMetrics(rows, mondayStart, sundayEnd, v3);
  console.log('Metrics:', {
    leads: metrics.leads.total, est: metrics.estimering_sendt,
    akseptert: metrics.akseptert.total, mottatt: metrics.mottatt,
    solgt: metrics.solgt, returnert: metrics.returnert
  });
  const html = renderHtml(mondayStart, sundayEnd, metrics);
  const subject = 'Peasy ukesanalyse ' + fmtDate(mondayStart) + '–' + fmtDate(sundayEnd) +
    ' (' + metrics.leads.total + ' leads, ' + metrics.akseptert.total + ' aksept, ' + metrics.solgt + ' solgt)';
  const r = await sendReport(subject, html, dryRun);
  console.log('Result:', r);
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });
