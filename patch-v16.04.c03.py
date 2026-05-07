#!/usr/bin/env python3
"""
Pulse v16.04.c02 -> v16.04.c03

Endringer:
1. Fee-kolonne bug: bruk r[20] (Avgift) ikke r[3] (D lav-hoy)
2. Ledertavle-banner ovrest i Markedsforing-fanen
3. Placeholder-kort for SB1NN og AutoDB

Kjor pa Mini i ~/mikeljungbergtvedt.github.io/
"""
import re, shutil, datetime as dt, os

REPO = os.path.expanduser('~/mikeljungbergtvedt.github.io')
PULSE = os.path.join(REPO, 'peasy-pulse.html')

ts = dt.datetime.now().strftime('%Y%m%d-%H%M%S')
shutil.copy(PULSE, PULSE + f'.bak-{ts}')
print(f'Backup: peasy-pulse.html.bak-{ts}')

with open(PULSE) as f:
    src = f.read()

# 1) Versjon-bump
src = src.replace('v16.04.c02', 'v16.04.c03')

# 2) Fee-bug fix: r[3] -> r[20] for Avgift (kolonne U)
old_fee = 'function rArVerdi(r){ return Number(r[3])||0; }'
new_fee = 'function rArVerdi(r){ var v=r[20]; if(v===null||v===undefined||v==="") return 0; var n=Number(String(v).replace(/[^\\d.-]/g,"")); return isNaN(n)?0:n; }'
if old_fee not in src:
    print('FEIL: fant ikke gammel rArVerdi')
    raise SystemExit(1)
src = src.replace(old_fee, new_fee)
print('Fee-funksjon fikset (r[3] -> r[20] med strengeparsing)')

# 3) Legg til ledertavle-banner OG placeholder-seksjoner
# Finn der "Markedsforing - Peasy & Drive" overskriften er, og legg banner FORAN den
banner_anchor = '<div style="font-size:18px;font-weight:800;color:#004225;margin-bottom:6px">Markedsf'
banner_pos = src.find(banner_anchor)
if banner_pos < 0:
    print('FEIL: fant ikke banner-anchor')
    raise SystemExit(1)

banner_html = '''  <!-- ========== LEDERTAVLE-BANNER ========== -->
  <div id="mark-leaderboard" style="background:linear-gradient(135deg,#F8FAF9 0%,#FFF 100%);border:1px solid rgba(0,66,37,0.12);border-radius:14px;padding:20px 24px;margin-bottom:24px;box-shadow:0 2px 6px rgba(0,66,37,0.08)">
    <div style="display:flex;align-items:baseline;justify-content:space-between;margin-bottom:14px">
      <div style="font-size:14px;font-weight:800;color:#004225;letter-spacing:0.3px">KILDE-LEDERTAVLE</div>
      <div style="font-size:11px;color:#667;letter-spacing:0.5px;text-transform:uppercase">Siste 30 dager &middot; sortert pa netto per solgt</div>
    </div>
    <div id="mark-leaderboard-cards" style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px"></div>
  </div>

  '''

src = src[:banner_pos] + banner_html + src[banner_pos:]
print('Ledertavle-banner lagt til')

# 4) Legg til placeholder-seksjoner ETTER Drive-seksjonen
# Drive-seksjonen ender med "Drive er ikke skalerbar..."-italic-div og </div></section>
placeholder_anchor = '<div style="margin-top:14px;font-size:11px;color:#667;font-style:italic">Drive er ikke skalerbar'
placeholder_pos = src.find(placeholder_anchor)
if placeholder_pos < 0:
    print('FEIL: fant ikke placeholder-anchor (drive er ikke skalerbar)')
    raise SystemExit(1)

# Finn slutten av Drive-seksjonens </div> som lukker boksen
# Strukturen er: <div italic>...</div></div></section>
# Vi vil sette inn placeholders rett etter </div></section>
end_of_drive_box = src.find('</div>\n\n</section>', placeholder_pos)
if end_of_drive_box < 0:
    end_of_drive_box = src.find('</section>', placeholder_pos)

# Insert FOR </section>
insert_pos = end_of_drive_box

placeholder_html = '''
  <!-- ========== PLACEHOLDER: SB1 NORD-NORGE ========== -->
  <div style="background:rgba(248,249,250,0.97);border:1px dashed rgba(0,66,37,0.18);border-radius:12px;padding:24px;margin-top:24px;border-top:4px solid #C5CCD0">
    <div style="display:flex;align-items:baseline;justify-content:space-between;margin-bottom:8px">
      <div>
        <div style="font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:#999;margin-bottom:2px">Kilde 3 (kommer)</div>
        <div style="font-size:22px;font-weight:800;color:#999">SpareBank 1 Nord-Norge</div>
        <div style="font-size:12px;color:#999">Kostnadsmodell: TBD &middot; Forventet Q3 2026</div>
      </div>
      <div style="font-size:10px;letter-spacing:1.5px;text-transform:uppercase;color:#A56500;background:#FFF3E0;padding:6px 12px;border-radius:999px">Kommer snart</div>
    </div>
    <div style="font-size:13px;color:#999;font-style:italic;margin-top:12px">Vi forbereder integrasjon. Kostnadsmodell og volum-estimat kommer.</div>
  </div>

  <!-- ========== PLACEHOLDER: AUTODB ========== -->
  <div style="background:rgba(248,249,250,0.97);border:1px dashed rgba(0,66,37,0.18);border-radius:12px;padding:24px;margin-top:16px;border-top:4px solid #C5CCD0">
    <div style="display:flex;align-items:baseline;justify-content:space-between;margin-bottom:8px">
      <div>
        <div style="font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:#999;margin-bottom:2px">Kilde 4 (kommer)</div>
        <div style="font-size:22px;font-weight:800;color:#999">AutoDB</div>
        <div style="font-size:12px;color:#999">Kostnadsmodell: 300 kr per solgt lead &middot; Forventet Q3 2026</div>
      </div>
      <div style="font-size:10px;letter-spacing:1.5px;text-transform:uppercase;color:#A56500;background:#FFF3E0;padding:6px 12px;border-radius:999px">Kommer snart</div>
    </div>
    <div style="font-size:13px;color:#999;font-style:italic;margin-top:12px">Betaling kun ved konvertering. Lavere risiko enn per-lead-modeller, men krever solid konverteringsrate for at det skal lonne seg for dem.</div>
  </div>

'''

src = src[:insert_pos] + placeholder_html + src[insert_pos:]
print('Placeholders SB1NN + AutoDB lagt til')

# 5) Oppdater MARK_V16_04 med renderLeaderboard + fix fee inn i renderPeasy
# Finn "function render(){" i MARK-modulen
render_marker = '  function render(){\n    try { renderPeasy(); } catch(e){ console.error(\'renderPeasy\',e); }\n    try { renderDrive(); } catch(e){ console.error(\'renderDrive\',e); }\n  }'
new_render = '''  function render(){
    try { renderLeaderboard(); } catch(e){ console.error('renderLeaderboard',e); }
    try { renderPeasy(); } catch(e){ console.error('renderPeasy',e); }
    try { renderDrive(); } catch(e){ console.error('renderDrive',e); }
  }

  // ----- Render Ledertavle-banner -----
  function renderLeaderboard(){
    var rows = getRows();
    var now = new Date();
    var d30 = new Date(now.getTime() - 30*86400000);
    var krLead = getDriveKr();
    var spend30 = spendForRange(d30, now);

    // Peasy 30d
    var p = aggSource(rows, 'peasy', d30, now);
    var pCost = spend30;
    var pCostPerSolgt = p.solgt ? pCost/p.solgt : 0;
    var pFeePerSolgt = p.solgt ? p.fee/p.solgt : 0;
    var pNettoPerSolgt = pFeePerSolgt - pCostPerSolgt;

    // Drive 30d (in-zone)
    var d = aggSource(rows, 'driveno', d30, now, 'in');
    var dCost = d.leads * krLead;
    var dCostPerSolgt = d.solgt ? dCost/d.solgt : 0;
    var dFeePerSolgt = d.solgt ? d.fee/d.solgt : 0;
    var dNettoPerSolgt = dFeePerSolgt - dCostPerSolgt;

    var sources = [
      {key:'peasy', label:'Peasy', sub:'Meta + Google', color:'#2E7D32', leads:p.leads, solgt:p.solgt, cost:pCost, fee:p.fee, costPerSolgt:pCostPerSolgt, feePerSolgt:pFeePerSolgt, nettoPerSolgt:pNettoPerSolgt, konv:p.leads?p.solgt/p.leads:0, active:true},
      {key:'driveno', label:'Drive', sub:'Gire (i sone)', color:'#1565C0', leads:d.leads, solgt:d.solgt, cost:dCost, fee:d.fee, costPerSolgt:dCostPerSolgt, feePerSolgt:dFeePerSolgt, nettoPerSolgt:dNettoPerSolgt, konv:d.leads?d.solgt/d.leads:0, active:true},
      {key:'sb1nn', label:'SB1 Nord-Norge', sub:'Kommer Q3 2026', color:'#999', active:false},
      {key:'autodb', label:'AutoDB', sub:'Kommer Q3 2026', color:'#999', active:false}
    ];

    // Sorter aktive paa nettoPerSolgt synkende
    var active = sources.filter(function(s){return s.active;});
    active.sort(function(a,b){return b.nettoPerSolgt - a.nettoPerSolgt;});
    var medals = ['🥇','🥈','🥉'];
    active.forEach(function(s,i){ s.medal = medals[i] || ''; s.rank = i+1; });

    // Bygg kort i opprinnelig rekkefoelge (Peasy, Drive, SB1NN, AutoDB)
    var html = sources.map(function(s){
      if(!s.active){
        return '<div style="background:rgba(248,249,250,0.95);border:1px dashed rgba(0,66,37,0.15);border-radius:10px;padding:14px 16px;border-top:3px solid #C5CCD0">' +
          '<div style="font-size:10px;letter-spacing:1px;text-transform:uppercase;color:#999;margin-bottom:4px">'+s.label+'</div>' +
          '<div style="font-size:18px;font-weight:700;color:#999;margin-bottom:6px">Kommer snart</div>' +
          '<div style="font-size:11px;color:#999">'+s.sub+'</div>' +
          '</div>';
      }
      var nettoCol = s.nettoPerSolgt >= 0 ? '#2E7D32' : '#C62828';
      var nettoSign = s.nettoPerSolgt >= 0 ? '+' : '';
      var medalHtml = s.medal ? '<span style="font-size:18px;margin-right:6px">'+s.medal+'</span>' : '';
      return '<div style="background:#fff;border:1px solid rgba(0,66,37,0.10);border-radius:10px;padding:14px 16px;border-top:3px solid '+s.color+'">' +
        '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">' +
          '<div style="font-size:10px;letter-spacing:1px;text-transform:uppercase;color:#667">'+s.label+'</div>' +
          '<div>'+medalHtml+'</div>' +
        '</div>' +
        '<div style="font-size:11px;color:#667;margin-bottom:8px">Netto per solgt</div>' +
        '<div style="font-size:22px;font-weight:800;color:'+nettoCol+';margin-bottom:8px;font-variant-numeric:tabular-nums">'+nettoSign+fmtKr(s.nettoPerSolgt)+'</div>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;font-size:11px;color:#667;border-top:1px solid rgba(0,66,37,0.06);padding-top:8px">' +
          '<div>Fee/solgt</div><div style="text-align:right;font-variant-numeric:tabular-nums;color:#2E7D32">+ '+fmtKr(s.feePerSolgt)+'</div>' +
          '<div>Cost/solgt</div><div style="text-align:right;font-variant-numeric:tabular-nums;color:#C62828">- '+fmtKr(s.costPerSolgt)+'</div>' +
          '<div>Konvertering</div><div style="text-align:right;font-variant-numeric:tabular-nums">'+fmtPct(s.konv)+'</div>' +
          '<div>Solgt</div><div style="text-align:right;font-variant-numeric:tabular-nums">'+s.solgt+' av '+s.leads+'</div>' +
        '</div>' +
        '</div>';
    }).join('');

    var el = document.getElementById('mark-leaderboard-cards');
    if(el) el.innerHTML = html;
  }'''
if render_marker not in src:
    print('FEIL: fant ikke render-marker')
    raise SystemExit(1)
src = src.replace(render_marker, new_render)
print('renderLeaderboard lagt til + render() oppdatert')

with open(PULSE, 'w') as f:
    f.write(src)

print()
print('Versjon: v16.04.c03')
print('Deploy: git add -A && git commit -m "Pulse v16.04.c03 - leaderboard, fee fix, placeholders" && git pull --rebase && git push')
