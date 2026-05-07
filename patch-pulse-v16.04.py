#!/usr/bin/env python3
"""
Pulse v16.03.c138 -> v16.04.c01 patch.

Endring 1: Markedsforing-seksjon (id="mark-section") far Peasy + Drive splitt
Endring 2: Versjon bumpes til v16.04.c01
Endring 3: peasy-config.json far utvidet marketingPerioder med 3 perioder

Kjor pa Mini i ~/mikeljungbergtvedt.github.io/
"""
import re, json, sys, os, shutil, datetime as dt

REPO = os.path.expanduser('~/mikeljungbergtvedt.github.io')
PULSE = os.path.join(REPO, 'peasy-pulse.html')
CONFIG = os.path.join(REPO, 'peasy-config.json')
NEW_VERSION = 'v16.04.c01'

def main():
    # --- Backup ---
    ts = dt.datetime.now().strftime('%Y%m%d-%H%M%S')
    shutil.copy(PULSE, PULSE + f'.bak-{ts}')
    shutil.copy(CONFIG, CONFIG + f'.bak-{ts}')
    print(f'Backup: peasy-pulse.html.bak-{ts}, peasy-config.json.bak-{ts}')

    # --- Pulse HTML ---
    with open(PULSE) as f:
        src = f.read()
    orig_lines = src.count('\n') + 1

    # 1) Versjon-bump
    src = src.replace('v16.03.c138', NEW_VERSION)

    # 2) Erstatt Markedsforing-seksjon (id="mark-section")
    # Finn start og slutt
    start_marker = '<section class="mode-section" data-mode="mark" id="mark-section"'
    start = src.find(start_marker)
    if start < 0:
        print('FEIL: fant ikke mark-section')
        sys.exit(1)

    # Finn matchende </section> ved aa telle <section>...</section>
    pos = start
    depth = 0
    end = -1
    while pos < len(src):
        nxt_open = src.find('<section', pos)
        nxt_close = src.find('</section>', pos)
        if nxt_close < 0:
            break
        if nxt_open >= 0 and nxt_open < nxt_close:
            depth += 1
            pos = nxt_open + 8
        else:
            depth -= 1
            if depth == 0:
                end = nxt_close + len('</section>')
                break
            pos = nxt_close + 10

    if end < 0:
        print('FEIL: fant ikke slutt paa mark-section')
        sys.exit(1)

    # Ny seksjon
    new_section = build_new_mark_section()
    src = src[:start] + new_section + src[end:]

    with open(PULSE, 'w') as f:
        f.write(src)
    new_lines = src.count('\n') + 1
    print(f'peasy-pulse.html: {orig_lines} -> {new_lines} linjer')

    # --- Config-utvidelse ---
    with open(CONFIG) as f:
        cfg = json.load(f)

    # Erstatt marketingPerioder med tre perioder
    cfg['marketingPerioder'] = [
        {'fra': '2025-11-01', 'til': '2026-03-14', 'krPerDag': 1000},
        {'fra': '2026-03-15', 'til': '2026-03-29', 'krPerDag': 2000},
        {'fra': '2026-03-30', 'til': None, 'krPerDag': 1000},
    ]
    # Drive postnr-soner (in-zone)
    cfg['driveZoner'] = [
        [1,1295],[1300,1435],[1400,1422],[1404,1404],[1407,1407],[1429,1435],
        [1440,1455],[1450,1459],[1461,1488],[1500,1539],[1540,1556],[1596,1599],
        [1600,1679],[1706,1711],[1721,1727],[1807,1814],[1830,1832],[1850,1852],
        [1911,1912],[1914,1914],[1972,2029],[2040,2069],[3000,3048],[3060,3066],
        [4000,4099],[4300,4339],[5003,5097],[5098,5155],[5160,5163],[5164,5223],
        [5224,5228],[5229,5229],[5230,5237],[5238,5239],[5243,5244],[5251,5254],
        [5257,5306],[7003,7099],[7224,7550],[7560,7562],[7563,7563]
    ]
    cfg['driveKrPerLead'] = 105

    with open(CONFIG, 'w') as f:
        json.dump(cfg, f, indent=4, ensure_ascii=False)
    print(f'peasy-config.json: oppdatert med marketingPerioder (3), driveZoner ({len(cfg["driveZoner"])}), driveKrPerLead')

    print(f'\nFerdig. Versjon: {NEW_VERSION}')
    print(f'Test lokalt med: open peasy-pulse.html')
    print(f'Deploy: git add -A && git commit -m "Pulse {NEW_VERSION} - Markedsforing splitt Peasy/Drive" && git push')


def build_new_mark_section():
    """Build the new Markedsforing section as one big string."""
    return '''<section class="mode-section" data-mode="mark" id="mark-section" style="display:none">

  <div style="font-size:18px;font-weight:800;color:#004225;margin-bottom:6px">Markedsføring — Peasy &amp; Drive</div>
  <div style="font-size:13px;color:#667;margin-bottom:18px">Adskilt presentasjon. Peasy = Meta + Google + word-of-mouth (alt unntatt Drive). Drive = Gire-partner med postnr-sone for betalbare leads.</div>

  <!-- ========== PEASY-SEKSJON ========== -->
  <div style="background:rgba(255,255,255,0.97);border:1px solid rgba(0,66,37,0.08);border-radius:12px;padding:24px;margin-bottom:24px;box-shadow:0 1px 3px rgba(0,66,37,0.07);border-top:4px solid #2E7D32">
    <div style="display:flex;align-items:baseline;justify-content:space-between;margin-bottom:16px;flex-wrap:wrap;gap:8px">
      <div>
        <div style="font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:#667;margin-bottom:2px">Kilde 1</div>
        <div style="font-size:22px;font-weight:800;color:#2E7D32">Peasy</div>
        <div style="font-size:12px;color:#667">Meta + Google + word-of-mouth</div>
      </div>
      <div id="mark-peasy-spend-summary" style="font-size:12px;color:#667;text-align:right">
        <span id="mark-peasy-current-spend" style="font-weight:600">— kr/dag</span>
      </div>
    </div>

    <div id="mark-peasy-kpi" style="display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-bottom:16px"></div>

    <div style="overflow-x:auto">
      <table id="mark-peasy-table" style="width:100%;border-collapse:collapse;font-size:13px">
        <thead>
          <tr style="background:#F0F4F2">
            <th style="padding:8px 10px;text-align:left;font-size:11px;letter-spacing:0.5px;text-transform:uppercase;color:#667">Metrikk</th>
            <th style="padding:8px 10px;text-align:right;font-size:11px;letter-spacing:0.5px;text-transform:uppercase;color:#667">Siste 30d</th>
            <th style="padding:8px 10px;text-align:right;font-size:11px;letter-spacing:0.5px;text-transform:uppercase;color:#667">Siste 90d</th>
            <th style="padding:8px 10px;text-align:right;font-size:11px;letter-spacing:0.5px;text-transform:uppercase;color:#667">Siden 1.11.25</th>
          </tr>
        </thead>
        <tbody id="mark-peasy-tbody"></tbody>
      </table>
    </div>

    <div style="margin-top:20px">
      <div style="font-size:14px;font-weight:700;color:#004225;margin-bottom:4px">Skaleringsanbefalinger (kun Peasy)</div>
      <div style="font-size:12px;color:#667;margin-bottom:10px">Estimater for hva som skjer hvis du øker daglig spend. Antar konservativ CPL-elastisitet (50% økning per dobling).</div>
      <div style="overflow-x:auto">
        <table id="mark-peasy-skalering" style="width:100%;border-collapse:collapse;font-size:13px">
          <thead>
            <tr style="background:#F0F4F2">
              <th style="padding:8px 10px;text-align:left;font-size:11px;letter-spacing:0.5px;text-transform:uppercase;color:#667">Scenario</th>
              <th style="padding:8px 10px;text-align:right;font-size:11px;letter-spacing:0.5px;text-transform:uppercase;color:#667">Spend/dag</th>
              <th style="padding:8px 10px;text-align:right;font-size:11px;letter-spacing:0.5px;text-transform:uppercase;color:#667">Antatt CPL</th>
              <th style="padding:8px 10px;text-align:right;font-size:11px;letter-spacing:0.5px;text-transform:uppercase;color:#667">Leads/dag</th>
              <th style="padding:8px 10px;text-align:right;font-size:11px;letter-spacing:0.5px;text-transform:uppercase;color:#667">Solgte/mnd</th>
              <th style="padding:8px 10px;text-align:right;font-size:11px;letter-spacing:0.5px;text-transform:uppercase;color:#667">Netto/mnd</th>
              <th style="padding:8px 10px;text-align:right;font-size:11px;letter-spacing:0.5px;text-transform:uppercase;color:#667">ROI</th>
            </tr>
          </thead>
          <tbody id="mark-peasy-skalering-tbody"></tbody>
        </table>
      </div>
    </div>

  </div>

  <!-- ========== DRIVE-SEKSJON ========== -->
  <div style="background:rgba(255,255,255,0.97);border:1px solid rgba(0,66,37,0.08);border-radius:12px;padding:24px;box-shadow:0 1px 3px rgba(0,66,37,0.07);border-top:4px solid #1565C0">
    <div style="display:flex;align-items:baseline;justify-content:space-between;margin-bottom:16px;flex-wrap:wrap;gap:8px">
      <div>
        <div style="font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:#667;margin-bottom:2px">Kilde 2</div>
        <div style="font-size:22px;font-weight:800;color:#1565C0">Drive</div>
        <div style="font-size:12px;color:#667">Gire-partner · 105 kr per SD mottatt innenfor postnr-sone</div>
      </div>
      <div id="mark-drive-zone-summary" style="font-size:12px;color:#667;text-align:right"></div>
    </div>

    <div id="mark-drive-kpi" style="display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-bottom:16px"></div>

    <div style="overflow-x:auto">
      <table id="mark-drive-table" style="width:100%;border-collapse:collapse;font-size:13px">
        <thead>
          <tr style="background:#F0F4F2">
            <th style="padding:8px 10px;text-align:left;font-size:11px;letter-spacing:0.5px;text-transform:uppercase;color:#667">Metrikk</th>
            <th style="padding:8px 10px;text-align:right;font-size:11px;letter-spacing:0.5px;text-transform:uppercase;color:#667">Siste 30d</th>
            <th style="padding:8px 10px;text-align:right;font-size:11px;letter-spacing:0.5px;text-transform:uppercase;color:#667">Siste 90d</th>
            <th style="padding:8px 10px;text-align:right;font-size:11px;letter-spacing:0.5px;text-transform:uppercase;color:#667">Siden 1.11.25</th>
          </tr>
        </thead>
        <tbody id="mark-drive-tbody"></tbody>
      </table>
    </div>

    <div style="margin-top:14px;font-size:11px;color:#667;font-style:italic">Drive er ikke skalerbar — vi påvirker ikke leadvolum. Tabellen viser in-zone (betalbar) og out-of-zone (gratis) separat.</div>
  </div>

</section>

<script>
// ============================================================
// Markedsforing v16.04.c01 — Peasy/Drive splitt
// ============================================================
window.MARK_V16_04 = (function(){
  var START_DATE = new Date('2025-11-01');

  // ----- Konfig-helpers (gjenbruker eksisterende window.peasyConfig) -----
  function cfg(){ return window.peasyConfig || {}; }
  function getZoner(){ return (cfg().driveZoner) || []; }
  function getDriveKr(){ return (cfg().driveKrPerLead) || 105; }
  function getMarketingPerioder(){ return (cfg().marketingPerioder) || []; }

  function inZone(pn){
    if(pn===null||pn===undefined||pn==='') return false;
    var n = parseInt(String(pn).trim(),10);
    if(isNaN(n)) return false;
    var z = getZoner();
    for(var i=0;i<z.length;i++){ if(n>=z[i][0] && n<=z[i][1]) return true; }
    return false;
  }

  function parseSD(s){
    if(!s) return null;
    var m = String(s).match(/^(\\d{1,2})\\.(\\d{1,2})\\.(\\d{4})/);
    if(!m) return null;
    return new Date(parseInt(m[3],10), parseInt(m[2],10)-1, parseInt(m[1],10));
  }
  function parseSold(s){ return parseSD(s); }

  // ----- Spend-beregning gjennbruker eksisterende beregneSpend -----
  function spendForRange(fromDate, toDate){
    if(typeof window.beregneSpend === 'function'){
      return window.beregneSpend(fromDate, toDate);
    }
    // Fallback hvis beregneSpend ikke finnes
    var perioder = getMarketingPerioder();
    var total = 0;
    var msDay = 86400000;
    for(var i=0;i<perioder.length;i++){
      var p = perioder[i];
      var pf = new Date(p.fra);
      var pt = p.til ? new Date(p.til) : new Date('2100-01-01');
      var s = new Date(Math.max(fromDate.getTime(), pf.getTime()));
      var e = new Date(Math.min(toDate.getTime(), pt.getTime()));
      if(e >= s){
        var d = Math.floor((e-s)/msDay) + 1;
        total += d * (p.krPerDag||0);
      }
    }
    return total;
  }

  function dailySpendNow(){
    var perioder = getMarketingPerioder();
    var now = new Date();
    for(var i=perioder.length-1;i>=0;i--){
      var p = perioder[i];
      var pf = new Date(p.fra);
      var pt = p.til ? new Date(p.til) : new Date('2100-01-01');
      if(now >= pf && now <= pt) return p.krPerDag||0;
    }
    return 0;
  }

  // ----- Aggregering per kilde og periode -----
  function aggSource(rows, kilde, fromDate, toDate, zoneFilter){
    // zoneFilter: 'in', 'out', 'all'
    var leads=0, solgt=0, fee=0, prodKost=0, returnert=0;
    for(var i=0;i<rows.length;i++){
      var r = rows[i];
      if(rKilde(r) !== kilde) continue;
      var sd = parseSD(rSD(r));
      if(!sd) continue;
      if(sd < fromDate || sd > toDate) continue;
      if(kilde==='driveno' && zoneFilter && zoneFilter!=='all'){
        var inZ = inZone(rPostnr(r));
        if(zoneFilter==='in' && !inZ) continue;
        if(zoneFilter==='out' && inZ) continue;
      }
      leads++;
      if(parseSold(rSolgt(r))){
        solgt++;
        if(rArVerdi(r)) fee += rArVerdi(r);
      }
      if(rReturnert(r)){ returnert++; }
    }
    return {leads:leads, solgt:solgt, fee:fee, prodKost:prodKost, returnert:returnert};
  }

  // ----- Datakilde-mapper (window._lastRows = array av arrays, ikke objekter) -----
  // Kolonne-indeksering (0-basert):
  //  3=Endelig AR verdi, 9=Postnr, 11=Kilde, 14=SD mottatt, 18=Solgt pa, 21=Returnert pa
  function getRows(){
    if(!window._lastRows || !Array.isArray(window._lastRows)) return [];
    // Skip header (slice(1)), filter ut tomme
    return window._lastRows.slice(1).filter(function(r){ return r && r.length; });
  }
  function rKilde(r){ return String(r[11]||'').toLowerCase(); }
  function rPostnr(r){ return r[9]; }
  function rSD(r){ return r[14]; }
  function rSolgt(r){ return r[18]; }
  function rReturnert(r){ return r[21]; }
  function rArVerdi(r){ return Number(r[3])||0; }

  function fmtKr(n){ return Math.round(n).toLocaleString('nb-NO') + ' kr'; }
  function fmtPct(n){ return (n*100).toFixed(1).replace('.',',') + ' %'; }
  function fmtNum1(n){ return n.toFixed(1).replace('.',','); }

  // ----- Render Peasy-seksjon -----
  function renderPeasy(){
    var rows = getRows();
    var now = new Date();
    var d30 = new Date(now.getTime() - 30*86400000);
    var d90 = new Date(now.getTime() - 90*86400000);

    var p30 = aggSource(rows, 'peasy', d30, now);
    var p90 = aggSource(rows, 'peasy', d90, now);
    var pTot = aggSource(rows, 'peasy', START_DATE, now);

    var spend30 = spendForRange(d30, now);
    var spend90 = spendForRange(d90, now);
    var spendTot = spendForRange(START_DATE, now);

    // CPL nå (siste 30d) = spend / leads
    var cpl30 = p30.leads ? spend30 / p30.leads : 0;
    var cpl90 = p90.leads ? spend90 / p90.leads : 0;
    var cplTot = pTot.leads ? spendTot / pTot.leads : 0;

    // Cost per solgt = spend / solgt
    var cps30 = p30.solgt ? spend30 / p30.solgt : 0;

    // Konvertering
    var konv30 = p30.leads ? p30.solgt / p30.leads : 0;

    // Spend now
    var spendDay = dailySpendNow();
    document.getElementById('mark-peasy-current-spend').textContent =
      'Spend nå: ' + fmtKr(spendDay) + '/dag';

    // KPI cards
    var kpi = document.getElementById('mark-peasy-kpi');
    kpi.innerHTML = '' +
      kpiCard('CPL nå (siste 30d)', fmtKr(cpl30), p30.leads + ' leads · ' + fmtKr(spend30) + ' spend', '#2E7D32') +
      kpiCard('Cost per solgt (30d)', fmtKr(cps30), p30.solgt + ' solgt · konv ' + fmtPct(konv30), '#004225') +
      kpiCard('Marginal CPL (mars-test)', '~217 kr', '+50% leads ved doblet spend (15-29.mars)', '#1565C0');

    // Tabell
    function feeAvg(a){ return a.solgt ? a.fee / a.solgt : 0; }
    var tbody = document.getElementById('mark-peasy-tbody');
    tbody.innerHTML = '' +
      tblRow('Leads (SD mottatt)', p30.leads, p90.leads, pTot.leads) +
      tblRow('Solgt', p30.solgt, p90.solgt, pTot.solgt) +
      tblRowText('Konvertering Lead → Solgt',
        fmtPct(p30.leads ? p30.solgt/p30.leads : 0),
        fmtPct(p90.leads ? p90.solgt/p90.leads : 0),
        fmtPct(pTot.leads ? pTot.solgt/pTot.leads : 0)) +
      tblRowText('Fee snitt (per solgt)',
        '+ '+fmtKr(feeAvg(p30)),
        '+ '+fmtKr(feeAvg(p90)),
        '+ '+fmtKr(feeAvg(pTot)),
        '#2E7D32') +
      tblRowText('Spend (Meta + Google)',
        fmtKr(spend30), fmtKr(spend90), fmtKr(spendTot),
        '#C62828') +
      tblRowText('CPL (spend / leads)',
        fmtKr(cpl30),
        fmtKr(p90.leads ? spend90/p90.leads : 0),
        fmtKr(pTot.leads ? spendTot/pTot.leads : 0),
        '#C62828') +
      tblRowText('Cost per solgt lead',
        fmtKr(cps30),
        fmtKr(p90.solgt ? spend90/p90.solgt : 0),
        fmtKr(pTot.solgt ? spendTot/pTot.solgt : 0),
        '#C62828', true);

    // Skalering (basert pa cpl30 og konv30)
    var skBody = document.getElementById('mark-peasy-skalering-tbody');
    var leadsDay30 = p30.leads / 30;
    var spendDayCurrent = spendDay || 1000;
    var scenarios = [
      {label:'Nå (baseline)', mult:1.0, color:'#F0F8F0'},
      {label:'+50% spend', mult:1.5, color:'#FFF8E0'},
      {label:'Doblet spend', mult:2.0, color:'#FFE8D0'},
      {label:'3x spend', mult:3.0, color:'#FFE0E0'},
      {label:'4x spend', mult:4.0, color:'#FFD0D0'}
    ];
    skBody.innerHTML = scenarios.map(function(s){
      // CPL elasticitet: 50% okning per dobling
      var doublings = Math.log2(s.mult || 1);
      var cplScaled = cpl30 * Math.pow(1.5, doublings);
      var newSpend = spendDayCurrent * s.mult;
      var newLeads = cplScaled ? newSpend / cplScaled : 0;
      var solgteMnd = newLeads * 30 * konv30;
      var feeMnd = solgteMnd * feeAvg(p30);
      var spendMnd = newSpend * 30;
      var nettoMnd = feeMnd - spendMnd;
      var roi = spendMnd ? (feeMnd / spendMnd) : 0;
      var roiCol = roi >= 2 ? '#2E7D32' : (roi >= 1.5 ? '#E65100' : '#C62828');
      return '<tr style="background:'+s.color+'">' +
        '<td style="padding:8px 10px;font-weight:600">'+s.label+'</td>' +
        '<td style="padding:8px 10px;text-align:right">'+fmtKr(newSpend)+'</td>' +
        '<td style="padding:8px 10px;text-align:right">'+fmtKr(cplScaled)+'</td>' +
        '<td style="padding:8px 10px;text-align:right">'+fmtNum1(newLeads)+'</td>' +
        '<td style="padding:8px 10px;text-align:right">'+Math.round(solgteMnd)+'</td>' +
        '<td style="padding:8px 10px;text-align:right;font-weight:600">'+fmtKr(nettoMnd)+'</td>' +
        '<td style="padding:8px 10px;text-align:right;font-weight:600;color:'+roiCol+'">'+roi.toFixed(2)+'x</td>' +
        '</tr>';
    }).join('');
  }

  // ----- Render Drive-seksjon -----
  function renderDrive(){
    var rows = getRows();
    var now = new Date();
    var d30 = new Date(now.getTime() - 30*86400000);
    var d90 = new Date(now.getTime() - 90*86400000);

    function dAgg(from){
      return {
        in: aggSource(rows, 'driveno', from, now, 'in'),
        out: aggSource(rows, 'driveno', from, now, 'out')
      };
    }
    var d30A = dAgg(d30);
    var d90A = dAgg(d90);
    var dTotA = dAgg(START_DATE);

    var krLead = getDriveKr();

    // Sone-summary
    document.getElementById('mark-drive-zone-summary').innerHTML =
      '<strong style="color:#1565C0">' + dTotA.in.leads + '</strong> i sone (betalbar) · ' +
      '<strong>' + dTotA.out.leads + '</strong> utenfor sone (gratis) — siden 1.11.25';

    // KPI
    var costIn30 = d30A.in.leads * krLead;
    var cpsIn30 = d30A.in.solgt ? costIn30/d30A.in.solgt : 0;
    var konvIn30 = d30A.in.leads ? d30A.in.solgt/d30A.in.leads : 0;

    var kpi = document.getElementById('mark-drive-kpi');
    kpi.innerHTML = '' +
      kpiCard('CPL i sone', fmtKr(krLead), 'Fast pris per SD mottatt', '#1565C0') +
      kpiCard('Cost per solgt (in-zone, 30d)', fmtKr(cpsIn30),
        d30A.in.solgt + ' solgt av ' + d30A.in.leads + ' leads', '#1565C0') +
      kpiCard('Konvertering in-zone (30d)', fmtPct(konvIn30),
        'Out-of-zone konv: ' + fmtPct(d30A.out.leads ? d30A.out.solgt/d30A.out.leads : 0), '#004225');

    // Tabell — to rader (in-zone og out-of-zone) per metrikk
    var tbody = document.getElementById('mark-drive-tbody');
    function feeAvg(a){ return a.solgt ? a.fee/a.solgt : 0; }
    function konv(a){ return a.leads ? a.solgt/a.leads : 0; }

    tbody.innerHTML = '' +
      // Header rad — innenfor sone
      '<tr style="background:rgba(21,101,192,0.06)"><td colspan="4" style="padding:6px 10px;font-size:11px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;color:#1565C0">Innenfor sone (betalbar 105 kr/lead)</td></tr>' +
      tblRow('Leads', d30A.in.leads, d90A.in.leads, dTotA.in.leads) +
      tblRow('Solgt', d30A.in.solgt, d90A.in.solgt, dTotA.in.solgt) +
      tblRowText('Konvertering', fmtPct(konv(d30A.in)), fmtPct(konv(d90A.in)), fmtPct(konv(dTotA.in))) +
      tblRowText('Fee snitt', '+ '+fmtKr(feeAvg(d30A.in)), '+ '+fmtKr(feeAvg(d90A.in)), '+ '+fmtKr(feeAvg(dTotA.in)), '#2E7D32') +
      tblRowText('Lead-kost (105 kr × leads)',
        fmtKr(d30A.in.leads*krLead), fmtKr(d90A.in.leads*krLead), fmtKr(dTotA.in.leads*krLead), '#C62828') +
      tblRowText('Cost per solgt',
        fmtKr(d30A.in.solgt ? d30A.in.leads*krLead/d30A.in.solgt : 0),
        fmtKr(d90A.in.solgt ? d90A.in.leads*krLead/d90A.in.solgt : 0),
        fmtKr(dTotA.in.solgt ? dTotA.in.leads*krLead/dTotA.in.solgt : 0),
        '#C62828', true) +
      // Header — utenfor sone
      '<tr style="background:rgba(0,66,37,0.04)"><td colspan="4" style="padding:6px 10px;font-size:11px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;color:#667;border-top:8px solid transparent">Utenfor sone (gratis — eier leverer uten Gire)</td></tr>' +
      tblRow('Leads', d30A.out.leads, d90A.out.leads, dTotA.out.leads) +
      tblRow('Solgt', d30A.out.solgt, d90A.out.solgt, dTotA.out.solgt) +
      tblRowText('Konvertering', fmtPct(konv(d30A.out)), fmtPct(konv(d90A.out)), fmtPct(konv(dTotA.out))) +
      tblRowText('Fee snitt', '+ '+fmtKr(feeAvg(d30A.out)), '+ '+fmtKr(feeAvg(d90A.out)), '+ '+fmtKr(feeAvg(dTotA.out)), '#2E7D32') +
      tblRowText('Lead-kost', '0 kr', '0 kr', '0 kr', '#667');
  }

  // ----- HTML-helpers -----
  function kpiCard(label, val, sub, color){
    return '<div style="background:#fff;border:1px solid rgba(0,66,37,0.08);border-left:4px solid '+color+';border-radius:8px;padding:14px 16px">' +
      '<div style="font-size:10px;letter-spacing:1px;text-transform:uppercase;color:#667;margin-bottom:4px">'+label+'</div>' +
      '<div style="font-size:22px;font-weight:700;color:'+color+'">'+val+'</div>' +
      '<div style="font-size:11px;color:#667;margin-top:2px">'+sub+'</div>' +
      '</div>';
  }
  function tblRow(label, v30, v90, vTot, bold){
    var weight = bold ? 'font-weight:700' : '';
    return '<tr style="border-bottom:1px solid rgba(0,66,37,0.06);'+weight+'">' +
      '<td style="padding:8px 10px">'+label+'</td>' +
      '<td style="padding:8px 10px;text-align:right;font-variant-numeric:tabular-nums">'+v30+'</td>' +
      '<td style="padding:8px 10px;text-align:right;font-variant-numeric:tabular-nums">'+v90+'</td>' +
      '<td style="padding:8px 10px;text-align:right;font-variant-numeric:tabular-nums">'+vTot+'</td>' +
      '</tr>';
  }
  function tblRowText(label, v30, v90, vTot, color, bold){
    var c = color||'';
    var weight = bold ? 'font-weight:700' : '';
    var s = c ? 'color:'+c : '';
    return '<tr style="border-bottom:1px solid rgba(0,66,37,0.06);'+weight+'">' +
      '<td style="padding:8px 10px">'+label+'</td>' +
      '<td style="padding:8px 10px;text-align:right;font-variant-numeric:tabular-nums;'+s+'">'+v30+'</td>' +
      '<td style="padding:8px 10px;text-align:right;font-variant-numeric:tabular-nums;'+s+'">'+v90+'</td>' +
      '<td style="padding:8px 10px;text-align:right;font-variant-numeric:tabular-nums;'+s+'">'+vTot+'</td>' +
      '</tr>';
  }

  function render(){
    try { renderPeasy(); } catch(e){ console.error('renderPeasy',e); }
    try { renderDrive(); } catch(e){ console.error('renderDrive',e); }
  }

  // Auto-render naar mark-modus aktiveres
  var origSetMode = window.setMode;
  if(typeof origSetMode === 'function'){
    window.setMode = function(m){
      origSetMode.apply(this, arguments);
      if(m === 'mark') setTimeout(render, 100);
    };
  }
  // Forsok render ved oppstart hvis mark er aktiv
  setTimeout(function(){
    if(window.currentMode==='mark') render();
  }, 1500);

  return { render: render, renderPeasy: renderPeasy, renderDrive: renderDrive };
})();
</script>'''


if __name__ == '__main__':
    main()
