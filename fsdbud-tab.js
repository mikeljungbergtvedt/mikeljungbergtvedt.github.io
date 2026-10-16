/* Peasy Pulse — FSD/BM mot bud, c611 (Mike 16.10.2026). Erstatter Scoreboard, A/B og Auto (de viste Easy/V3G).
   Leser fsd-bm-bud.json (Mini: fsd-bm-bud.js hver time). Per bil FSD/BM har priset: FSD, BM, prisen som ble brukt,
   hvor bilen er i løpet, og forhandlerbudet mot forventet bud fra fossefallet (for prisen som ble brukt, FSD og BM). */
(function () {
  var STATUS = { final_estimate: 'QA send', order_delivery: 'Estimat sendt', on_the_way: 'På vei', car_received: 'Mottatt', waiting_for_preparation: 'Klargjøres',
    ready_for_auction: 'Klar for auksjon', on_auction: 'På auksjon', auction_finished: 'Auksjon ferdig', wait_for_bid_accept: 'Venter budsvar',
    wait_for_signing: 'Signering', contract_signed: 'Kontrakt', sold: 'Solgt', returned: 'Retur', rejected: 'Avvist' };
  function kr(n) { return n == null || !isFinite(n) ? '–' : Math.round(n).toLocaleString('nb-NO'); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function pst(a, b) { return a && b ? Math.round((a / b - 1) * 100) : null; }
  function fpst(p) { if (p == null) return '–'; var c = Math.abs(p) <= 10 ? '#2E7D32' : Math.abs(p) <= 20 ? '#8A6D10' : '#C62828'; return '<span style="color:' + c + ';font-weight:700">' + (p > 0 ? '+' : '') + p + ' %</span>'; }
  function median(a) { a = a.filter(function (x) { return x != null; }).sort(function (x, y) { return x - y; }); if (!a.length) return null; var m = a.length >> 1; return a.length % 2 ? a[m] : Math.round((a[m - 1] + a[m]) / 2); }
  function render() {
    var root = document.getElementById('fsdbud-root'); if (!root) return;
    root.innerHTML = '<div style="padding:20px;color:#667A72">Laster …</div>';
    fetch('fsd-bm-bud.json?t=' + Date.now(), { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (d) {
      if (!d) { root.innerHTML = '<div style="padding:20px;color:#A8221C">Fant ikke fsd-bm-bud.json.</div>'; return; }
      var R = d.rader || [], mb = R.filter(function (r) { return r.bud; });
      var tell = {}; R.forEach(function (r) { var k = STATUS[r.liste] || r.liste || '?'; tell[k] = (tell[k] || 0) + 1; });
      var td = 'padding:6px 8px;border-bottom:1px solid rgba(0,66,37,0.06);white-space:nowrap;text-align:right';
      var th = 'padding:6px 8px;font-size:11px;color:#667A72;font-weight:700;border-bottom:1px solid rgba(0,66,37,0.15);text-align:right;white-space:nowrap';
      var h = '<div class="section-label">FSD og BM mot faktisk bud</div>';
      h += '<div style="margin:0 0 14px;font-size:13px;color:#333;line-height:1.6"><b>' + R.length + '</b> biler priset av FSD/BM siden 13.10 · <b>' + mb.length + '</b> med bud fra forhandlerne. ' +
        Object.keys(tell).map(function (k) { return esc(k) + ' ' + tell[k]; }).join(' · ') + '</div>';
      if (mb.length) {
        var tre = [['Prisen som ble brukt', 'forv_brukt'], ['FSD', 'forv_fsd'], ['BM', 'forv_bm']].map(function (x) {
          var p = mb.map(function (r) { return pst(r.bud, r[x[1]]); }); var inn = p.filter(function (v) { return v != null && Math.abs(v) <= 10; }).length, n = p.filter(function (v) { return v != null; }).length;
          return '<tr><td style="' + td.replace('right', 'left') + ';font-weight:700">' + x[0] + '</td><td style="' + td + '">' + n + '</td><td style="' + td + '">' + fpst(median(p)) + '</td><td style="' + td + '">' + (n ? Math.round(inn / n * 100) + ' %' : '–') + '</td></tr>';
        }).join('');
        h += '<div class="table-card" style="margin-bottom:16px"><div style="padding:8px 12px"><table style="width:100%;border-collapse:collapse;font-size:13px"><thead><tr><th style="' + th.replace('right', 'left') + '">Bud mot forventet bud</th><th style="' + th + '">Biler</th><th style="' + th + '">Median avvik</th><th style="' + th + '">Innen ±10 %</th></tr></thead><tbody>' + tre + '</tbody></table></div>' +
          '<div style="padding:0 18px 12px;font-size:11px;color:#667A72">Avvik = (faktisk bud ÷ forventet bud fra fossefallet) − 1. Positivt = forhandlerne ga mer enn ventet.</div></div>';
        var prof = ['A', 'B', 'O'].map(function (p) { var x = R.filter(function (r) { return r.profil === p; }); var ja = x.filter(function (r) { return r.bud_akseptert; }).length, nei = x.filter(function (r) { return r.bud_avvist && !r.bud_akseptert; }).length;
          return '<tr><td style="' + td.replace('right', 'left') + ';font-weight:700">' + (p === 'O' ? 'Ordna' : p) + '</td><td style="' + td + '">' + x.length + '</td><td style="' + td + '">' + ja + '</td><td style="' + td + '">' + nei + '</td><td style="' + td + '">' + (ja + nei ? Math.round(ja / (ja + nei) * 100) + ' %' : '–') + '</td></tr>'; }).join('');
        h += '<div class="table-card" style="margin-bottom:16px"><div style="padding:8px 12px"><table style="width:100%;border-collapse:collapse;font-size:13px"><thead><tr><th style="' + th.replace('right', 'left') + '">Profil</th><th style="' + th + '">Biler</th><th style="' + th + '">Bud akseptert</th><th style="' + th + '">Bud avvist</th><th style="' + th + '">Bud-aksept</th></tr></thead><tbody>' + prof + '</tbody></table></div></div>';
      } else {
        h += '<div class="table-card" style="margin-bottom:16px;padding:14px 18px;font-size:13px;color:#667A72">Ingen bud ennå. Sammenligningen fylles automatisk når de første bilene har vært på auksjon.</div>';
      }
      var rows = R.map(function (r) {
        var stopp = r.stopp && !r.pris_brukt;
        return '<tr' + (stopp ? ' style="color:#8A948F"' : '') + '><td style="' + td.replace('right', 'left') + ';font-family:monospace;font-weight:700">' + esc(r.regnr) + '</td><td style="' + td.replace('right', 'left') + '">' + esc(r.bil) + '</td><td style="' + td + '">' + kr(r.km) + '</td><td style="' + td + '">' + esc(r.profil === 'O' ? 'Ordna' : r.profil) + '</td>' +
          '<td style="' + td + '">' + kr(r.fsd) + '</td><td style="' + td + '">' + kr(r.bm) + '</td><td style="' + td + ';font-weight:700">' + (stopp ? 'stoppet' : kr(r.pris_brukt) + (r.pris_kilde && r.pris_kilde !== 'fsd/bm' ? ' <span style="font-size:10px;color:#667A72">' + esc(r.pris_kilde) + '</span>' : '')) + '</td>' +
          '<td style="' + td + '">' + (r.lav ? kr(r.lav) + '–' + kr(r.hoy) : '–') + '</td><td style="' + td.replace('right', 'left') + '">' + esc(STATUS[r.liste] || r.liste || '') + '</td>' +
          '<td style="' + td + ';font-weight:700">' + kr(r.bud) + '</td><td style="' + td + '">' + kr(r.forv_brukt) + '</td><td style="' + td + '">' + fpst(pst(r.bud, r.forv_brukt)) + '</td></tr>';
      }).join('');
      h += '<div class="table-card"><div style="padding:8px 12px;overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:12px"><thead><tr>' +
        ['Regnr', 'Bil', 'Km', 'Profil', 'FSD', 'BM', 'Brukt pris', 'ERP lav–høy', 'Status', 'Bud', 'Forventet bud', 'Avvik'].map(function (t, i) { return '<th style="' + (i < 2 || i === 8 ? th.replace('right', 'left') : th) + '">' + t + '</th>'; }).join('') +
        '</tr></thead><tbody>' + rows + '</tbody></table></div><div style="padding:0 18px 12px;font-size:11px;color:#667A72">Brukt pris = Mid fra FSD og BM, eller manuell pris / antatt bud i QA. Grå = stoppet uten manuell pris. Oppdatert ' + esc(String(d.bygget).slice(0, 16).replace('T', ' ')) + ' UTC.</div></div>';
      root.innerHTML = h;
    }).catch(function (e) { root.innerHTML = '<div style="padding:20px;color:#A8221C">Feil: ' + esc(e.message) + '</div>'; });
  }
  window.FSDBUD = { render: render };
})();
