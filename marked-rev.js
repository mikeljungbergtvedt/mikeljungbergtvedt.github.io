/* Peasy Pulse — Marked (ny), c598 (Mike 15.10.2026). Testes ved siden av den gamle Marked-fanen.
   Ett spørsmål: hva skjer med bestilte biler, og hvem bidrar? Bestilt = bilfilens «bestilt» (første dag på «på vei», én per internnr,
   avbestilte ute). Kanal: Peasy-leads etter UTM (Meta, Google, Direkte), ellers kilden (Drive, Ordna, AutoDB).
   Topp: siste 7 hele dager mot de 7 før. Kr per bestilt: 4 uker. Meta og Google kan åpnes til kampanjer.
   Graf: rullerende 7 dager, 12 uker bakover. */
(function () {
  var KAN = ['Google', 'Meta', 'Direkte', 'Drive', 'Ordna', 'AutoDB'];
  var FARGE = { Google: '#F2B705', Meta: '#1877F2', Direkte: '#667A72', Drive: '#2E7D32', Ordna: '#E65100', AutoDB: '#6A1B9A' };
  var apen = {};
  function d0(s) { if (!s) return null; var p = String(s).trim().slice(0, 10).split('.'); if (p.length !== 3) return null; var d = new Date(+p[2], +p[1] - 1, +p[0]); return isNaN(d) ? null : d; }
  function key(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function dag(d, n) { var x = new Date(d); x.setDate(x.getDate() + n); return x; }
  function i(a, b, x) { return x && x >= a && x <= b; }
  function kr(n) { return n == null || !isFinite(n) ? '–' : Math.round(n).toLocaleString('nb-NO'); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function kanal(r) {
    var s = (typeof srcKey === 'function') ? srcKey(r) : '';
    if (s === 'peasy') { var k = (typeof kanalAvRad === 'function') ? kanalAvRad(r) : 'direkte'; return k === 'meta' ? 'Meta' : k === 'google' ? 'Google' : 'Direkte'; }
    return s === 'drive' ? 'Drive' : s === 'ordna' ? 'Ordna' : s === 'autodb' ? 'AutoDB' : null;
  }

  function beregn() {
    var rows = window._lastRows || [], ads = window.adsSpend || null;
    var i0 = new Date(); i0.setHours(0, 0, 0, 0);
    var A = [dag(i0, -7), dag(i0, -1)], B = [dag(i0, -14), dag(i0, -8)], F = [dag(i0, -28), dag(i0, -1)];
    var K = (ads && ads.kampanjer) || {}, D = (ads && ads.days) || {};
    var mId = (typeof pulseMetaOppslag === 'function') ? pulseMetaOppslag() : function (c) { return c; };
    var kampNavn = {}, kampKost = {}, kampSist = {};
    Object.keys(K).forEach(function (k) {
      var c = K[k]; if (!c) return; var id = c.kilde + '|' + String(c.id); kampNavn[id] = c.navn || String(c.id);
      Object.keys(c.dager || {}).forEach(function (ds) {
        var v = Number(c.dager[ds]) || 0; if (!v) return; var dd = new Date(ds + 'T12:00:00');
        var o = kampKost[id] = kampKost[id] || { a: 0, b: 0, f: 0 };
        if (i(A[0], dag(A[1], 1), dd)) o.a += v; if (i(B[0], dag(B[1], 1), dd)) o.b += v; if (i(F[0], dag(F[1], 1), dd)) o.f += v;
        if (!kampSist[id] || ds > kampSist[id]) kampSist[id] = ds;
      });
    });
    function kostKan(kn, P) { var s = 0, f = kn === 'Meta' ? 'meta' : kn === 'Google' ? 'google' : null; if (!f) return null; for (var d = new Date(P[0]); d <= P[1]; d = dag(d, 1)) { var x = D[key(d)]; if (x) s += Number(x[f]) || 0; } return s; }
    var T = {}; KAN.forEach(function (k) { T[k] = { a: 0, b: 0, f: 0, la: 0, kamp: {} }; });
    var uker = []; for (var w = 11; w >= 0; w--) { var e = dag(i0, -1 - 7 * w); uker.push([dag(e, -6), e]); }
    var serie = {}; KAN.forEach(function (k) { serie[k] = uker.map(function () { return 0; }); });
    rows.slice(1).forEach(function (r) {
      if (!r || !String(r[1] || '').trim()) return; var kn = kanal(r); if (!kn || !T[kn]) return;
      var lead = d0(r[14]); if (i(A[0], A[1], lead)) T[kn].la++;
      var b = d0(r._bestilt); if (!b) return;
      var t = T[kn];
      var ia = i(A[0], A[1], b), ib = i(B[0], B[1], b), iff = i(F[0], F[1], b);
      if (ia) t.a++; if (ib) t.b++; if (iff) t.f++;
      uker.forEach(function (u, ix) { if (i(u[0], u[1], b)) serie[kn][ix]++; });
      if ((kn === 'Meta' || kn === 'Google') && (ia || ib || iff)) {
        var camp = String(r[24] || '').trim(); var id = kn === 'Meta' ? 'meta|' + (mId(camp, String(r[28] || '').trim(), lead) || camp) : 'google|' + camp;
        var o = t.kamp[id] = t.kamp[id] || { a: 0, b: 0, f: 0 }; if (ia) o.a++; if (ib) o.b++; if (iff) o.f++;
      }
    });
    KAN.forEach(function (k) { var t = T[k]; t.ka = kostKan(k, A); t.kb = kostKan(k, B); t.kf = kostKan(k, F); });
    // Kampanjer med kost eller bestillinger de siste 14 dagene (vinduet + forrige periode).
    ['Meta', 'Google'].forEach(function (kn) {
      var pre = kn === 'Meta' ? 'meta|' : 'google|', ids = {};
      Object.keys(kampKost).forEach(function (id) { if (id.indexOf(pre) === 0 && (kampKost[id].a || kampKost[id].b)) ids[id] = 1; });
      Object.keys(T[kn].kamp).forEach(function (id) { var o = T[kn].kamp[id]; if (o.a || o.b) ids[id] = 1; });
      T[kn].liste = Object.keys(ids).map(function (id) {
        var o = T[kn].kamp[id] || { a: 0, b: 0, f: 0 }, k = kampKost[id] || { a: 0, b: 0, f: 0 }, sist = kampSist[id] || null;
        var avsl = sist && sist < key(dag(i0, -2));
        var rå = kampNavn[id] || id.split('|')[1] || ''; if (!rå || /\{\{/.test(rå)) rå = '(kampanje ukjent – UTM ikke fylt ut i annonsen)';
        return { id: id, navn: rå.replace(/\s*\(Vekstloop\)\s*$/, ''), a: o.a, b: o.b, f: o.f, ka: k.a, kb: k.b, kf: k.f, avsluttet: avsl ? sist : null };
      }).sort(function (x, y) { return (y.ka + y.kb) - (x.ka + x.kb) || (y.a - x.a); });
    });
    return { T: T, A: A, B: B, uker: uker, serie: serie };
  }

  function pil(a, b) { if (a > b) return '<span style="color:#2E7D32;font-weight:800">▲ ' + (a - b) + '</span>'; if (a < b) return '<span style="color:#C62828;font-weight:800">▼ ' + (b - a) + '</span>'; return '<span style="color:#667A72">=</span>'; }
  function perBest(k, n) { return !k ? '–' : n ? kr(k / n) : 'ingen'; }

  function render() {
    var root = document.getElementById('markrev-root'); if (!root) return;
    if (!window._lastRows || !window._lastRows.length) { root.innerHTML = '<div style="padding:20px;color:#667A72">Laster …</div>'; setTimeout(render, 800); return; }
    var R = beregn(), T = R.T;
    var f = function (d) { return d.toLocaleDateString('nb-NO', { day: '2-digit', month: '2-digit' }); };
    var th = 'style="text-align:right;padding:6px 8px;font-size:11px;color:#667A72;font-weight:700;border-bottom:1px solid rgba(0,66,37,0.15)"';
    var td = 'text-align:right;padding:7px 8px;border-bottom:1px solid rgba(0,66,37,0.06);white-space:nowrap';
    var sum = { a: 0, b: 0, ka: 0, kb: 0 };
    var h = '<thead><tr><th ' + th.replace('right', 'left') + '>Hvem</th><th ' + th + '>Bestilt ' + f(R.A[0]) + '–' + f(R.A[1]) + '</th><th ' + th + '>Før ' + f(R.B[0]) + '–' + f(R.B[1]) + '</th><th ' + th + '></th><th ' + th + '>Leads</th><th ' + th + '>Kost</th><th ' + th + '>Kr per bestilt (4 uker)</th></tr></thead><tbody>';
    KAN.forEach(function (kn) {
      var t = T[kn]; sum.a += t.a; sum.b += t.b; sum.ka += t.ka || 0; sum.kb += t.kb || 0;
      var kan = !!t.liste && t.liste.length;
      h += '<tr' + (kan ? ' data-mr="' + kn + '" style="cursor:pointer"' : '') + '><td style="' + td.replace('right', 'left') + ';font-weight:700"><span style="display:inline-block;width:9px;height:9px;border-radius:2px;background:' + FARGE[kn] + ';margin-right:7px"></span>' + kn + (kan ? ' <span style="color:#667A72;font-weight:400">' + (apen[kn] ? '▾' : '▸') + '</span>' : '') + '</td>' +
        '<td style="' + td + ';font-size:15px;font-weight:800">' + t.a + '</td><td style="' + td + '">' + t.b + '</td><td style="' + td + '">' + pil(t.a, t.b) + '</td><td style="' + td + '">' + t.la + '</td><td style="' + td + '">' + kr(t.ka) + '</td><td style="' + td + ';font-weight:700">' + perBest(t.kf, t.f) + '</td></tr>';
      if (kan && apen[kn]) {
        var L = t.liste, vis = L.length > 8 && !apen[kn + '+'] ? L.slice(0, 5) : L;
        vis.forEach(function (c) {
          h += '<tr style="background:rgba(0,66,37,0.025);' + (c.avsluttet ? 'color:#9AA39E' : '') + '"><td style="' + td.replace('right', 'left') + ';padding-left:26px;font-size:12px">' + esc(c.navn) + (c.avsluttet ? ' <span style="font-size:10px;border:1px solid #C9CFCB;border-radius:8px;padding:0 6px">avsluttet ' + c.avsluttet.slice(8, 10) + '.' + c.avsluttet.slice(5, 7) + '</span>' : '') + '</td>' +
            '<td style="' + td + ';font-weight:700">' + c.a + '</td><td style="' + td + '">' + c.b + '</td><td style="' + td + '">' + pil(c.a, c.b) + '</td><td style="' + td + '"></td><td style="' + td + '">' + kr(c.ka) + '</td><td style="' + td + '">' + perBest(c.kf, c.f) + '</td></tr>';
        });
        if (vis.length < L.length) h += '<tr data-mr="' + kn + '+" style="cursor:pointer"><td colspan="7" style="padding:6px 26px;font-size:12px;color:#004225">+ ' + (L.length - vis.length) + ' andre kampanjer</td></tr>';
      }
    });
    h += '<tr style="font-weight:800"><td style="' + td.replace('right', 'left') + ';border-top:2px solid #004225">Totalt</td><td style="' + td + ';border-top:2px solid #004225;font-size:15px">' + sum.a + '</td><td style="' + td + ';border-top:2px solid #004225">' + sum.b + '</td><td style="' + td + ';border-top:2px solid #004225">' + pil(sum.a, sum.b) + '</td><td style="' + td + ';border-top:2px solid #004225"></td><td style="' + td + ';border-top:2px solid #004225">' + kr(sum.ka) + '</td><td style="' + td + ';border-top:2px solid #004225"></td></tr></tbody>';
    root.innerHTML =
      '<div class="section-label">Hva skjer? Bestilte hent/lev, siste 7 dager mot de 7 før</div>' +
      '<div class="table-card" style="margin-bottom:18px"><div style="padding:8px 12px;overflow-x:auto"><table id="markrev-tab" style="width:100%;border-collapse:collapse;font-size:13px">' + h + '</table></div>' +
      '<div style="padding:0 18px 12px;font-size:11px;color:#667A72;line-height:1.5">Bestilt = første dag bilen kom på «på vei», én per internnr, avbestilte telles ikke. Kanal = der leadet kom fra (Peasy etter UTM). Kost = faktisk Meta og Google. Kr per bestilt regnes over 4 uker, fordi én uke har for få biler. Trykk Meta eller Google for kampanjene.</div></div>' +
      '<div class="section-label">Trend: bestilt per kanal, rullerende 7 dager (12 uker)</div>' +
      '<div class="table-card"><div style="padding:8px 16px 16px;position:relative;height:280px"><canvas id="markrev-graf"></canvas></div></div>';
    root.querySelectorAll('[data-mr]').forEach(function (el) { el.onclick = function () { var k = el.getAttribute('data-mr'); apen[k] = !apen[k]; render(); }; });
    if (window.Chart) {
      var cv = document.getElementById('markrev-graf'); var ex = Chart.getChart(cv); if (ex) ex.destroy();
      new Chart(cv, { type: 'line', data: { labels: R.uker.map(function (u) { return f(u[1]); }), datasets: KAN.map(function (kn) { return { label: kn, data: R.serie[kn], borderColor: FARGE[kn], backgroundColor: FARGE[kn], tension: 0.25, pointRadius: 2 }; }) },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } } });
    }
  }
  window.MARKREV = { render: render, beregn: beregn };
})();
