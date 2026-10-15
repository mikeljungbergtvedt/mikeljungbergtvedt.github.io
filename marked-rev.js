/* Peasy Pulse — Marked (ny), c600 (tabellen: bare inneværende uke mot samme dager forrige uke; ukene står i grafen). c599 (Mike 15.10.2026). Testes ved siden av den gamle Marked-fanen.
   Ett spørsmål: hva skjer med bestilte biler, og hvem bidrar? Bestilt = bilfilens «bestilt» (første dag på «på vei», én per internnr,
   avbestilte ute). Kanal: Peasy-leads etter UTM (Meta, Google, Direkte), ellers kilden (Drive, Ordna, AutoDB).
   Kalenderuker med ukenummer. Inneværende uke t.o.m. i går mot samme ukedager forrige uke, så de tre hele ukene før.
   Mandag: forrige hele uke mot uka før. Kr per bestilt: de 4 siste hele ukene. Graf: 12 uker, siste uke «hittil». */
(function () {
  var KAN = ['Google', 'Meta', 'Direkte', 'Drive', 'Ordna', 'AutoDB'];
  var FARGE = { Google: '#F2B705', Meta: '#1877F2', Direkte: '#667A72', Drive: '#2E7D32', Ordna: '#E65100', AutoDB: '#6A1B9A' };
  var DG = ['søn', 'man', 'tir', 'ons', 'tor', 'fre', 'lør'];
  var apen = {};
  function d0(s) { if (!s) return null; var p = String(s).trim().slice(0, 10).split('.'); if (p.length !== 3) return null; var d = new Date(+p[2], +p[1] - 1, +p[0]); return isNaN(d) ? null : d; }
  function key(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function dag(d, n) { var x = new Date(d); x.setDate(x.getDate() + n); return x; }
  function inn(P, x) { return x && x >= P[0] && x <= P[1]; }
  function uke(d) { var t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())); var n = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - n); var y = new Date(Date.UTC(t.getUTCFullYear(), 0, 1)); return Math.ceil(((t - y) / 864e5 + 1) / 7); }
  function kr(n) { return n == null || !isFinite(n) ? '–' : Math.round(n).toLocaleString('nb-NO'); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function kanal(r) {
    var s = (typeof srcKey === 'function') ? srcKey(r) : '';
    if (s === 'peasy') { var k = (typeof kanalAvRad === 'function') ? kanalAvRad(r) : 'direkte'; return k === 'meta' ? 'Meta' : k === 'google' ? 'Google' : 'Direkte'; }
    return s === 'drive' ? 'Drive' : s === 'ordna' ? 'Ordna' : s === 'autodb' ? 'AutoDB' : null;
  }

  function perioder() {
    var i0 = new Date(); i0.setHours(0, 0, 0, 0);
    var man = dag(i0, -((i0.getDay() + 6) % 7)), mandag = i0.getTime() === man.getTime();
    var naaMan = mandag ? dag(man, -7) : man, naaTil = dag(i0, -1);          // inneværende uke t.o.m. i går (mandag: forrige hele uke)
    var n = Math.round((naaTil - naaMan) / 864e5);                            // antall dager etter mandag
    var P = { naa: [naaMan, naaTil], sammen: [dag(naaMan, -7), dag(naaTil, -7)] };
    P.u1 = [dag(naaMan, -7), dag(naaMan, -1)]; P.u2 = [dag(naaMan, -14), dag(naaMan, -8)]; P.u3 = [dag(naaMan, -21), dag(naaMan, -15)];
    P.f4 = [dag(naaMan, -28), dag(naaMan, -1)];
    var hel = mandag;                                                          // mandag: «naa» er en hel uke
    var navnNaa = 'Uke ' + uke(naaMan) + (hel ? '' : ' (' + DG[naaMan.getDay()] + (n ? '–' + DG[naaTil.getDay()] : '') + ')');
    var uker = []; for (var w = 11; w >= 0; w--) { var f = dag(naaMan, -7 * w); uker.push({ p: [f, w === 0 ? naaTil : dag(f, 6)], navn: String(uke(f)) + (w === 0 && !hel ? ' (hittil)' : '') }); }
    return { P: P, navnNaa: navnNaa, hel: hel, uker: uker, ukeNr: { u1: uke(P.u1[0]), u2: uke(P.u2[0]), u3: uke(P.u3[0]), f4a: uke(P.f4[0]), f4b: uke(P.u1[0]) } };
  }

  function beregn() {
    var rows = window._lastRows || [], ads = window.adsSpend || null, Q = perioder(), P = Q.P, ids = Object.keys(P);
    var K = (ads && ads.kampanjer) || {}, D = (ads && ads.days) || {};
    var mId = (typeof pulseMetaOppslag === 'function') ? pulseMetaOppslag() : function (c) { return c; };
    var tom = function () { var o = {}; ids.forEach(function (k) { o[k] = 0; }); return o; };
    var kampNavn = {}, kampKost = {}, kampSist = {};
    Object.keys(K).forEach(function (k) {
      var c = K[k]; if (!c) return; var id = c.kilde + '|' + String(c.id); kampNavn[id] = c.navn || String(c.id);
      Object.keys(c.dager || {}).forEach(function (ds) {
        var v = Number(c.dager[ds]) || 0; if (!v) return; var dd = new Date(ds + 'T00:00:00'); var o = kampKost[id] = kampKost[id] || tom();
        ids.forEach(function (p) { if (inn(P[p], dd)) o[p] += v; });
        if (!kampSist[id] || ds > kampSist[id]) kampSist[id] = ds;
      });
    });
    function kostKan(kn, Pp) { var s = 0, f = kn === 'Meta' ? 'meta' : kn === 'Google' ? 'google' : null; if (!f) return null; for (var d = new Date(Pp[0]); d <= Pp[1]; d = dag(d, 1)) { var x = D[key(d)]; if (x) s += Number(x[f]) || 0; } return s; }
    var T = {}; KAN.forEach(function (k) { T[k] = { n: tom(), leads: 0, kamp: {} }; });
    var serie = {}; KAN.forEach(function (k) { serie[k] = Q.uker.map(function () { return 0; }); });
    rows.slice(1).forEach(function (r) {
      if (!r || !String(r[1] || '').trim()) return; var kn = kanal(r); if (!kn || !T[kn]) return;
      var lead = d0(r[14]); if (inn(P.naa, lead)) T[kn].leads++;
      var b = d0(r._bestilt); if (!b) return;
      var t = T[kn], treff = false;
      ids.forEach(function (p) { if (inn(P[p], b)) { t.n[p]++; treff = true; } });
      Q.uker.forEach(function (u, ix) { if (inn(u.p, b)) serie[kn][ix]++; });
      if ((kn === 'Meta' || kn === 'Google') && treff) {
        var camp = String(r[24] || '').trim(); var id = kn === 'Meta' ? 'meta|' + (mId(camp, String(r[28] || '').trim(), lead) || camp) : 'google|' + camp;
        var o = t.kamp[id] = t.kamp[id] || tom(); ids.forEach(function (p) { if (inn(P[p], b)) o[p]++; });
      }
    });
    KAN.forEach(function (k) { var t = T[k]; t.kost = {}; ids.forEach(function (p) { t.kost[p] = kostKan(k, P[p]); }); });
    ['Meta', 'Google'].forEach(function (kn) {
      var pre = kn === 'Meta' ? 'meta|' : 'google|', vis = {};
      Object.keys(kampKost).forEach(function (id) { if (id.indexOf(pre) === 0 && (kampKost[id].naa || kampKost[id].u1)) vis[id] = 1; });
      Object.keys(T[kn].kamp).forEach(function (id) { var o = T[kn].kamp[id]; if (o.naa || o.u1) vis[id] = 1; });
      T[kn].liste = Object.keys(vis).map(function (id) {
        var raa = kampNavn[id] || id.split('|')[1] || ''; if (!raa || /\{\{/.test(raa)) raa = '(kampanje ukjent – UTM ikke fylt ut i annonsen)';
        var sist = kampSist[id] || null;
        return { navn: raa.replace(/\s*\(Vekstloop\)\s*$/, ''), n: T[kn].kamp[id] || tom(), kost: kampKost[id] || tom(), avsluttet: sist && sist < key(dag(P.naa[1], -1)) ? sist : null };
      }).sort(function (x, y) { return (y.kost.naa + y.kost.u1) - (x.kost.naa + x.kost.u1) || (y.n.naa - x.n.naa); });
    });
    return { T: T, Q: Q, serie: serie };
  }

  function pil(a, b) { if (a > b) return '<span style="color:#2E7D32;font-weight:800">▲ ' + (a - b) + '</span>'; if (a < b) return '<span style="color:#C62828;font-weight:800">▼ ' + (b - a) + '</span>'; return '<span style="color:#667A72">=</span>'; }
  function perBest(k, n) { return !k ? '–' : n ? kr(k / n) : 'ingen'; }

  function render() {
    var root = document.getElementById('markrev-root'); if (!root) return;
    if (!window._lastRows || !window._lastRows.length) { root.innerHTML = '<div style="padding:20px;color:#667A72">Laster …</div>'; setTimeout(render, 800); return; }
    var R = beregn(), T = R.T, Q = R.Q, U = Q.ukeNr;
    var th = 'style="text-align:right;padding:6px 8px;font-size:11px;color:#667A72;font-weight:700;border-bottom:1px solid rgba(0,66,37,0.15);white-space:nowrap"';
    var td = 'text-align:right;padding:7px 8px;border-bottom:1px solid rgba(0,66,37,0.06);white-space:nowrap';
    var lys = ';color:#8A948F';
    var sammen = Q.hel ? 'Uke ' + U.u1 : 'Uke ' + U.u1 + ' samme dager';
    var h = '<thead><tr><th ' + th.replace('right', 'left') + '>Hvem</th><th ' + th + '>' + Q.navnNaa + '</th><th ' + th + '>' + sammen + '</th><th ' + th + '></th>' +
      '<th ' + th + '>Leads</th><th ' + th + '>Kost</th><th ' + th + '>Kr per bestilt (uke ' + U.f4a + '–' + U.f4b + ')</th></tr></thead><tbody>';
    var cols = 7, sum = { naa: 0, sammen: 0, u1: 0, u2: 0, u3: 0, k: 0 };
    function celler(n, kost, f4n, f4k, leads, bold) {
      return '<td style="' + td + (bold ? ';font-size:15px;font-weight:800' : ';font-weight:700') + '">' + n.naa + '</td><td style="' + td + '">' + n.sammen + '</td><td style="' + td + '">' + pil(n.naa, n.sammen) + '</td>' +
        '<td style="' + td + '">' + (leads == null ? '' : leads) + '</td><td style="' + td + '">' + kr(kost) + '</td><td style="' + td + ';font-weight:700">' + perBest(f4k, f4n) + '</td>';
    }
    KAN.forEach(function (kn) {
      var t = T[kn]; ['naa', 'sammen', 'u1', 'u2', 'u3'].forEach(function (p) { sum[p] += t.n[p]; }); sum.k += t.kost.naa || 0;
      var kan = !!t.liste && t.liste.length;
      h += '<tr' + (kan ? ' data-mr="' + kn + '" style="cursor:pointer"' : '') + '><td style="' + td.replace('right', 'left') + ';font-weight:700"><span style="display:inline-block;width:9px;height:9px;border-radius:2px;background:' + FARGE[kn] + ';margin-right:7px"></span>' + kn + (kan ? ' <span style="color:#667A72;font-weight:400">' + (apen[kn] ? '▾' : '▸') + '</span>' : '') + '</td>' +
        celler(t.n, t.kost.naa, t.n.f4, t.kost.f4, t.leads, true) + '</tr>';
      if (kan && apen[kn]) {
        var L = t.liste, vis = L.length > 8 && !apen[kn + '+'] ? L.slice(0, 5) : L;
        vis.forEach(function (c) {
          h += '<tr style="background:rgba(0,66,37,0.025);font-size:12px' + (c.avsluttet ? ';color:#9AA39E' : '') + '"><td style="' + td.replace('right', 'left') + ';padding-left:26px">' + esc(c.navn) + (c.avsluttet ? ' <span style="font-size:10px;border:1px solid #C9CFCB;border-radius:8px;padding:0 6px">avsluttet ' + c.avsluttet.slice(8, 10) + '.' + c.avsluttet.slice(5, 7) + '</span>' : '') + '</td>' +
            celler(c.n, c.kost.naa, c.n.f4, c.kost.f4, null, false) + '</tr>';
        });
        if (vis.length < L.length) h += '<tr data-mr="' + kn + '+" style="cursor:pointer"><td colspan="' + cols + '" style="padding:6px 26px;font-size:12px;color:#004225">+ ' + (L.length - vis.length) + ' andre kampanjer</td></tr>';
      }
    });
    var bt = ';border-top:2px solid #004225';
    h += '<tr style="font-weight:800"><td style="' + td.replace('right', 'left') + bt + '">Totalt</td><td style="' + td + bt + ';font-size:15px">' + sum.naa + '</td><td style="' + td + bt + '">' + sum.sammen + '</td><td style="' + td + bt + '">' + pil(sum.naa, sum.sammen) + '</td><td style="' + td + bt + '"></td><td style="' + td + bt + '">' + kr(sum.k) + '</td><td style="' + td + bt + '"></td></tr></tbody>';
    root.innerHTML =
      '<div class="section-label">Hva skjer? Bestilte hent/lev per uke</div>' +
      '<div class="table-card" style="margin-bottom:18px"><div style="padding:8px 12px;overflow-x:auto"><table id="markrev-tab" style="width:100%;border-collapse:collapse;font-size:13px">' + h + '</table></div>' +
      '<div style="padding:0 18px 12px;font-size:11px;color:#667A72;line-height:1.5">Bestilt = første dag bilen kom på «på vei», én per internnr, avbestilte telles ikke. Kanal = der leadet kom fra (Peasy etter UTM). ' + (Q.hel ? '' : 'Inneværende uke er t.o.m. i går og sammenlignes med de samme dagene forrige uke. ') + 'Leads og kost gjelder ' + Q.navnNaa.toLowerCase() + '. Kr per bestilt regnes over de 4 siste hele ukene. Trykk Meta eller Google for kampanjene.</div></div>' +
      '<div class="section-label">Trend: bestilt per kanal, uke for uke (12 uker)</div>' +
      '<div class="table-card"><div style="padding:8px 16px 16px;position:relative;height:280px"><canvas id="markrev-graf"></canvas></div></div>';
    root.querySelectorAll('[data-mr]').forEach(function (el) { el.onclick = function () { var k = el.getAttribute('data-mr'); apen[k] = !apen[k]; render(); }; });
    if (window.Chart) {
      var cv = document.getElementById('markrev-graf'); var ex = Chart.getChart(cv); if (ex) ex.destroy();
      new Chart(cv, { type: 'line', data: { labels: Q.uker.map(function (u) { return 'Uke ' + u.navn; }), datasets: KAN.map(function (kn) { return { label: kn, data: R.serie[kn], borderColor: FARGE[kn], backgroundColor: FARGE[kn], tension: 0.25, pointRadius: 2, segment: { borderDash: function (c) { return !Q.hel && c.p1DataIndex === Q.uker.length - 1 ? [5, 4] : undefined; } } }; }) },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } } });
    }
  }
  window.MARKREV = { render: render, beregn: beregn, perioder: perioder };
})();
