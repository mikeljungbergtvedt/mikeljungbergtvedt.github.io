#!/usr/bin/env python3
"""
Pulse v16.04.c04 -> v16.04.c05

Ny: UTM-seksjon under Peasy-tabellen, fra 1. april 2026
- 4 sammendragskort
- 5 niva-tabeller (source, medium, campaign, adset, content)
- Hver rad: leads, solgt, konv, snitt fee, sist sett, aktiv-flagg

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
src = src.replace('v16.04.c04', 'v16.04.c05')

# 2) Sett inn UTM HTML-blokk RETT FOR Skaleringsanbefalinger-divv
# Anchor: <div style="margin-top:20px"> ... <div style="font-size:14px;font-weight:700;color:#004225;margin-bottom:4px">Skaleringsanbefalinger (kun Peasy)</div>
skal_anchor = '<div style="margin-top:20px">\n      <div style="font-size:14px;font-weight:700;color:#004225;margin-bottom:4px">Skaleringsanbefalinger (kun Peasy)</div>'
if skal_anchor not in src:
    print('FEIL: fant ikke skaleringsanbefalinger-anchor')
    raise SystemExit(1)

utm_html = '''<!-- ========== UTM-DETALJER (under Peasy) ========== -->
    <div style="margin-top:24px;padding-top:20px;border-top:2px dashed rgba(0,66,37,0.10)">
      <div style="display:flex;align-items:baseline;justify-content:space-between;margin-bottom:6px;flex-wrap:wrap;gap:8px">
        <div style="font-size:14px;font-weight:700;color:#004225">UTM-detaljer (Peasy fra 1. april 2026)</div>
        <div style="font-size:11px;color:#999">Modning 4-6 uker for solgt-data </div>
      </div>
      <div style="font-size:12px;color:#667;margin-bottom:14px">UTM-tracking startet uke 18 (slutten av april). Solgt-tall fyller seg over tid etter hvert som leads konverterer.</div>

      <div id="mark-utm-summary" style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:18px"></div>

      <div style="font-size:13px;font-weight:700;color:#004225;margin:18px 0 6px">Per source (kanal)</div>
      <div style="overflow-x:auto"><table id="mark-utm-source" style="width:100%;border-collapse:collapse;font-size:13px"><thead><tr style="background:#F0F4F2"><th style="padding:7px 10px;text-align:left;font-size:10px;letter-spacing:0.5px;text-transform:uppercase;color:#667">Source</th><th style="padding:7px 10px;text-align:right;font-size:10px;letter-spacing:0.5px;text-transform:uppercase;color:#667">Leads</th><th style="padding:7px 10px;text-align:right;font-size:10px;letter-spacing:0.5px;text-transform:uppercase;color:#667">Solgt</th><th style="padding:7px 10px;text-align:right;font-size:10px;letter-spacing:0.5px;text-transform:uppercase;color:#667">Konv</th><th style="padding:7px 10px;text-align:right;font-size:10px;letter-spacing:0.5px;text-transform:uppercase;color:#667">Fee/solgt</th><th style="padding:7px 10px;text-align:right;font-size:10px;letter-spacing:0.5px;text-transform:uppercase;color:#667">Sist sett</th><th style="padding:7px 10px;text-align:center;font-size:10px;letter-spacing:0.5px;text-transform:uppercase;color:#667">Status</th></tr></thead><tbody id="mark-utm-source-tbody"></tbody></table></div>

      <div style="font-size:13px;font-weight:700;color:#004225;margin:18px 0 6px">Per medium</div>
      <div style="overflow-x:auto"><table id="mark-utm-medium" style="width:100%;border-collapse:collapse;font-size:13px"><thead><tr style="background:#F0F4F2"><th style="padding:7px 10px;text-align:left;font-size:10px;letter-spacing:0.5px;text-transform:uppercase;color:#667">Medium</th><th style="padding:7px 10px;text-align:right;font-size:10px;letter-spacing:0.5px;text-transform:uppercase;color:#667">Leads</th><th style="padding:7px 10px;text-align:right;font-size:10px;letter-spacing:0.5px;text-transform:uppercase;color:#667">Solgt</th><th style="padding:7px 10px;text-align:right;font-size:10px;letter-spacing:0.5px;text-transform:uppercase;color:#667">Konv</th><th style="padding:7px 10px;text-align:right;font-size:10px;letter-spacing:0.5px;text-transform:uppercase;color:#667">Fee/solgt</th><th style="padding:7px 10px;text-align:right;font-size:10px;letter-spacing:0.5px;text-transform:uppercase;color:#667">Sist sett</th><th style="padding:7px 10px;text-align:center;font-size:10px;letter-spacing:0.5px;text-transform:uppercase;color:#667">Status</th></tr></thead><tbody id="mark-utm-medium-tbody"></tbody></table></div>

      <div style="font-size:13px;font-weight:700;color:#004225;margin:18px 0 6px">Per kampanje</div>
      <div style="overflow-x:auto"><table id="mark-utm-campaign" style="width:100%;border-collapse:collapse;font-size:13px"><thead><tr style="background:#F0F4F2"><th style="padding:7px 10px;text-align:left;font-size:10px;letter-spacing:0.5px;text-transform:uppercase;color:#667">Source</th><th style="padding:7px 10px;text-align:left;font-size:10px;letter-spacing:0.5px;text-transform:uppercase;color:#667">Kampanje</th><th style="padding:7px 10px;text-align:right;font-size:10px;letter-spacing:0.5px;text-transform:uppercase;color:#667">Leads</th><th style="padding:7px 10px;text-align:right;font-size:10px;letter-spacing:0.5px;text-transform:uppercase;color:#667">Solgt</th><th style="padding:7px 10px;text-align:right;font-size:10px;letter-spacing:0.5px;text-transform:uppercase;color:#667">Konv</th><th style="padding:7px 10px;text-align:right;font-size:10px;letter-spacing:0.5px;text-transform:uppercase;color:#667">Fee/solgt</th><th style="padding:7px 10px;text-align:right;font-size:10px;letter-spacing:0.5px;text-transform:uppercase;color:#667">Sist sett</th><th style="padding:7px 10px;text-align:center;font-size:10px;letter-spacing:0.5px;text-transform:uppercase;color:#667">Status</th></tr></thead><tbody id="mark-utm-campaign-tbody"></tbody></table></div>

      <div style="font-size:13px;font-weight:700;color:#004225;margin:18px 0 6px">Per adset</div>
      <div style="overflow-x:auto"><table id="mark-utm-adset" style="width:100%;border-collapse:collapse;font-size:13px"><thead><tr style="background:#F0F4F2"><th style="padding:7px 10px;text-align:left;font-size:10px;letter-spacing:0.5px;text-transform:uppercase;color:#667">Kampanje</th><th style="padding:7px 10px;text-align:left;font-size:10px;letter-spacing:0.5px;text-transform:uppercase;color:#667">Adset</th><th style="padding:7px 10px;text-align:right;font-size:10px;letter-spacing:0.5px;text-transform:uppercase;color:#667">Leads</th><th style="padding:7px 10px;text-align:right;font-size:10px;letter-spacing:0.5px;text-transform:uppercase;color:#667">Solgt</th><th style="padding:7px 10px;text-align:right;font-size:10px;letter-spacing:0.5px;text-transform:uppercase;color:#667">Konv</th><th style="padding:7px 10px;text-align:right;font-size:10px;letter-spacing:0.5px;text-transform:uppercase;color:#667">Sist sett</th><th style="padding:7px 10px;text-align:center;font-size:10px;letter-spacing:0.5px;text-transform:uppercase;color:#667">Status</th></tr></thead><tbody id="mark-utm-adset-tbody"></tbody></table></div>

      <div style="font-size:13px;font-weight:700;color:#004225;margin:18px 0 6px">Per content / annonse</div>
      <div style="overflow-x:auto"><table id="mark-utm-content" style="width:100%;border-collapse:collapse;font-size:13px"><thead><tr style="background:#F0F4F2"><th style="padding:7px 10px;text-align:left;font-size:10px;letter-spacing:0.5px;text-transform:uppercase;color:#667">Kampanje</th><th style="padding:7px 10px;text-align:left;font-size:10px;letter-spacing:0.5px;text-transform:uppercase;color:#667">Content</th><th style="padding:7px 10px;text-align:left;font-size:10px;letter-spacing:0.5px;text-transform:uppercase;color:#667">Ad-id</th><th style="padding:7px 10px;text-align:right;font-size:10px;letter-spacing:0.5px;text-transform:uppercase;color:#667">Leads</th><th style="padding:7px 10px;text-align:right;font-size:10px;letter-spacing:0.5px;text-transform:uppercase;color:#667">Solgt</th><th style="padding:7px 10px;text-align:right;font-size:10px;letter-spacing:0.5px;text-transform:uppercase;color:#667">Sist sett</th><th style="padding:7px 10px;text-align:center;font-size:10px;letter-spacing:0.5px;text-transform:uppercase;color:#667">Status</th></tr></thead><tbody id="mark-utm-content-tbody"></tbody></table></div>
    </div>

    '''

src = src.replace(skal_anchor, utm_html + skal_anchor)
print('UTM HTML-blokk satt inn')

# 3) Legg til renderUtm i MARK_V16_04 og kall fra render()
# Erstatt render-funksjonen
old_render = '''  function render(){
    try { renderLeaderboard(); } catch(e){ console.error('renderLeaderboard',e); }
    try { renderPeasy(); } catch(e){ console.error('renderPeasy',e); }
    try { renderDrive(); } catch(e){ console.error('renderDrive',e); }
  }'''
new_render = '''  function render(){
    try { renderLeaderboard(); } catch(e){ console.error('renderLeaderboard',e); }
    try { renderPeasy(); } catch(e){ console.error('renderPeasy',e); }
    try { renderUtm(); } catch(e){ console.error('renderUtm',e); }
    try { renderDrive(); } catch(e){ console.error('renderDrive',e); }
  }

  // ----- Render UTM-detaljer -----
  function renderUtm(){
    var rows = getRows();
    var startUtm = new Date(2026, 3, 1); // 1. april 2026
    var now = new Date();
    var d7 = new Date(now.getTime() - 7*86400000);

    // Filter Peasy fra 1.april
    var peasyRows = rows.filter(function(r){
      if(rKilde(r) !== 'peasy') return false;
      var sd = parseSD(rSD(r));
      return sd && sd >= startUtm;
    });

    // UTM-fylte (kol 23 = utm_source)
    var utmRows = peasyRows.filter(function(r){ return r[23]; });

    // Sammendragskort
    var d7utm = peasyRows.filter(function(r){ var sd=parseSD(rSD(r)); return sd && sd >= d7; });
    var d7utm_filled = d7utm.filter(function(r){ return r[23]; });
    var d7_pct = d7utm.length ? Math.round(100*d7utm_filled.length/d7utm.length) : 0;

    var uniqueCamps = {};
    utmRows.forEach(function(r){ if(r[24]) uniqueCamps[r[24]] = true; });
    var nCamps = Object.keys(uniqueCamps).length;

    var solgtUtm = utmRows.filter(function(r){ return parseSold(rSolgt(r)); }).length;

    var sumEl = document.getElementById('mark-utm-summary');
    if(sumEl){
      sumEl.innerHTML =
        kpiCard('UTM-tagged leads', utmRows.length + ' / ' + peasyRows.length, 'Siden 1. april 2026 ('+(peasyRows.length?Math.round(100*utmRows.length/peasyRows.length):0)+'% fyllingsgrad)', '#1565C0') +
        kpiCard('Unike kampanjer', nCamps + '', 'Aktive utm_campaign-verdier', '#004225') +
        kpiCard('Fyllingsgrad siste 7d', d7_pct + ' %', d7utm_filled.length + ' av ' + d7utm.length + ' nye leads', '#2E7D32') +
        kpiCard('Solgt med UTM', solgtUtm + '', 'Modning 4-6 uker forventet', '#E65100');
    }

    // Aggregerings-helper
    function aggBy(rows, keyFn){
      var groups = {};
      rows.forEach(function(r){
        var k = keyFn(r);
        if(!k) return;
        if(!groups[k]) groups[k] = {leads:0, solgt:0, fee:0, last:null, key:k};
        var g = groups[k];
        g.leads++;
        var sold = parseSold(rSolgt(r));
        if(sold){
          g.solgt++;
          if(rArVerdi(r)) g.fee += rArVerdi(r);
        }
        var sd = parseSD(rSD(r));
        if(sd && (!g.last || sd > g.last)) g.last = sd;
      });
      return Object.keys(groups).map(function(k){ return groups[k]; }).sort(function(a,b){ return b.leads - a.leads; });
    }

    function fmtSistSett(d){
      if(!d) return '-';
      var n = Math.floor((now-d)/86400000);
      if(n===0) return 'I dag';
      if(n===1) return 'I gar';
      if(n<7) return n+'d siden';
      if(n<30) return Math.floor(n/7)+'u siden';
      return Math.floor(n/30)+'mnd siden';
    }
    function statusBadge(d){
      if(!d) return '<span style="font-size:10px;color:#999">-</span>';
      var n = Math.floor((now-d)/86400000);
      if(n <= 7) return '<span style="font-size:10px;letter-spacing:0.5px;text-transform:uppercase;background:#E8F5E9;color:#2E7D32;padding:2px 8px;border-radius:999px;font-weight:600">Aktiv</span>';
      if(n <= 30) return '<span style="font-size:10px;letter-spacing:0.5px;text-transform:uppercase;background:#FFF3E0;color:#E65100;padding:2px 8px;border-radius:999px;font-weight:600">Stille</span>';
      return '<span style="font-size:10px;letter-spacing:0.5px;text-transform:uppercase;background:#F5F5F5;color:#999;padding:2px 8px;border-radius:999px;font-weight:600">Arkiv</span>';
    }

    function row1(label, g){
      var konv = g.leads ? fmtPct(g.solgt/g.leads) : '-';
      var fee = g.solgt ? '+ '+fmtKr(g.fee/g.solgt) : '-';
      return '<tr style="border-bottom:1px solid rgba(0,66,37,0.06)"><td style="padding:7px 10px">'+label+'</td>'+
        '<td style="padding:7px 10px;text-align:right;font-variant-numeric:tabular-nums">'+g.leads+'</td>'+
        '<td style="padding:7px 10px;text-align:right;font-variant-numeric:tabular-nums">'+g.solgt+'</td>'+
        '<td style="padding:7px 10px;text-align:right;font-variant-numeric:tabular-nums">'+konv+'</td>'+
        '<td style="padding:7px 10px;text-align:right;font-variant-numeric:tabular-nums;color:#2E7D32">'+fee+'</td>'+
        '<td style="padding:7px 10px;text-align:right;font-size:11px;color:#667">'+fmtSistSett(g.last)+'</td>'+
        '<td style="padding:7px 10px;text-align:center">'+statusBadge(g.last)+'</td>'+
        '</tr>';
    }
    function row2(c1, c2, g){
      var konv = g.leads ? fmtPct(g.solgt/g.leads) : '-';
      var fee = g.solgt ? '+ '+fmtKr(g.fee/g.solgt) : '-';
      return '<tr style="border-bottom:1px solid rgba(0,66,37,0.06)"><td style="padding:7px 10px;font-size:11px;color:#667">'+c1+'</td>'+
        '<td style="padding:7px 10px">'+c2+'</td>'+
        '<td style="padding:7px 10px;text-align:right;font-variant-numeric:tabular-nums">'+g.leads+'</td>'+
        '<td style="padding:7px 10px;text-align:right;font-variant-numeric:tabular-nums">'+g.solgt+'</td>'+
        '<td style="padding:7px 10px;text-align:right;font-variant-numeric:tabular-nums">'+konv+'</td>'+
        '<td style="padding:7px 10px;text-align:right;font-variant-numeric:tabular-nums;color:#2E7D32">'+fee+'</td>'+
        '<td style="padding:7px 10px;text-align:right;font-size:11px;color:#667">'+fmtSistSett(g.last)+'</td>'+
        '<td style="padding:7px 10px;text-align:center">'+statusBadge(g.last)+'</td>'+
        '</tr>';
    }
    function rowContent(camp, content, adid, g){
      var konv = g.leads ? fmtPct(g.solgt/g.leads) : '-';
      return '<tr style="border-bottom:1px solid rgba(0,66,37,0.06)"><td style="padding:7px 10px;font-size:11px;color:#667">'+camp+'</td>'+
        '<td style="padding:7px 10px">'+content+'</td>'+
        '<td style="padding:7px 10px;font-size:11px;color:#667">'+adid+'</td>'+
        '<td style="padding:7px 10px;text-align:right;font-variant-numeric:tabular-nums">'+g.leads+'</td>'+
        '<td style="padding:7px 10px;text-align:right;font-variant-numeric:tabular-nums">'+g.solgt+'</td>'+
        '<td style="padding:7px 10px;text-align:right;font-size:11px;color:#667">'+fmtSistSett(g.last)+'</td>'+
        '<td style="padding:7px 10px;text-align:center">'+statusBadge(g.last)+'</td>'+
        '</tr>';
    }

    function emptyRow(cols, msg){
      return '<tr><td colspan="'+cols+'" style="padding:14px;text-align:center;color:#999;font-style:italic;font-size:12px">'+msg+'</td></tr>';
    }

    // SOURCE
    var bySource = aggBy(utmRows, function(r){ return (r[23]||'').toString().toLowerCase(); });
    var sourceTbody = document.getElementById('mark-utm-source-tbody');
    if(sourceTbody){
      sourceTbody.innerHTML = bySource.length ? bySource.map(function(g){ return row1(g.key, g); }).join('') : emptyRow(7, 'Ingen UTM-data enda');
    }

    // MEDIUM (kol 29)
    var byMedium = aggBy(utmRows, function(r){ return (r[29]||'').toString().toLowerCase(); });
    var mediumTbody = document.getElementById('mark-utm-medium-tbody');
    if(mediumTbody){
      mediumTbody.innerHTML = byMedium.length ? byMedium.map(function(g){ return row1(g.key||'(tom)', g); }).join('') : emptyRow(7, 'Ingen medium-data enda');
    }

    // CAMPAIGN (kol 24)
    var byCampaign = aggBy(utmRows, function(r){
      var src = (r[23]||'').toString().toLowerCase();
      var camp = r[24] || '(ingen)';
      return src + '||' + camp;
    });
    byCampaign.forEach(function(g){
      var p = g.key.split('||');
      g.source = p[0]; g.campaign = p[1];
    });
    var campTbody = document.getElementById('mark-utm-campaign-tbody');
    if(campTbody){
      campTbody.innerHTML = byCampaign.length ? byCampaign.map(function(g){ return row2(g.source, g.campaign, g); }).join('') : emptyRow(8, 'Ingen kampanje-data enda');
    }

    // ADSET (kol 26)
    var byAdset = aggBy(utmRows.filter(function(r){ return r[26]; }), function(r){
      return (r[24]||'(ingen)') + '||' + r[26];
    });
    byAdset.forEach(function(g){
      var p = g.key.split('||');
      g.campaign = p[0]; g.adset = p[1];
    });
    var adsetTbody = document.getElementById('mark-utm-adset-tbody');
    if(adsetTbody){
      adsetTbody.innerHTML = byAdset.length ? byAdset.map(function(g){
        var konv = g.leads ? fmtPct(g.solgt/g.leads) : '-';
        return '<tr style="border-bottom:1px solid rgba(0,66,37,0.06)"><td style="padding:7px 10px;font-size:11px;color:#667">'+g.campaign+'</td>'+
          '<td style="padding:7px 10px">'+g.adset+'</td>'+
          '<td style="padding:7px 10px;text-align:right;font-variant-numeric:tabular-nums">'+g.leads+'</td>'+
          '<td style="padding:7px 10px;text-align:right;font-variant-numeric:tabular-nums">'+g.solgt+'</td>'+
          '<td style="padding:7px 10px;text-align:right;font-variant-numeric:tabular-nums">'+konv+'</td>'+
          '<td style="padding:7px 10px;text-align:right;font-size:11px;color:#667">'+fmtSistSett(g.last)+'</td>'+
          '<td style="padding:7px 10px;text-align:center">'+statusBadge(g.last)+'</td>'+
          '</tr>';
      }).join('') : emptyRow(7, 'Ingen adset-data enda');
    }

    // CONTENT (kol 25 = utm_content, kol 28 = ad-id)
    var byContent = aggBy(utmRows.filter(function(r){ return r[25] || r[28]; }), function(r){
      return (r[24]||'(ingen)') + '||' + (r[25]||'(tom)') + '||' + (r[28]||'-');
    });
    byContent.forEach(function(g){
      var p = g.key.split('||');
      g.campaign = p[0]; g.content = p[1]; g.adid = p[2];
    });
    var contentTbody = document.getElementById('mark-utm-content-tbody');
    if(contentTbody){
      contentTbody.innerHTML = byContent.length ? byContent.map(function(g){ return rowContent(g.campaign, g.content, g.adid, g); }).join('') : emptyRow(7, 'Ingen content-data enda');
    }
  }'''
if old_render not in src:
    print('FEIL: fant ikke render-funksjon')
    raise SystemExit(1)
src = src.replace(old_render, new_render)
print('renderUtm lagt til + render() oppdatert')

with open(PULSE, 'w') as f:
    f.write(src)

print()
print('Versjon: v16.04.c05')
print('Deploy: git add -A && git commit -m "Pulse v16.04.c05 - UTM-seksjon under Peasy" && git pull --rebase && git push')
