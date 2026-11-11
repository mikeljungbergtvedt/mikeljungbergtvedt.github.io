/* c702 (Mike 10.11): Vekstloop dag-for-dag: klikk kampanjerad for bestilte reg.nr.; klikk reg.nr. for målgruppe-popup (samme tall som tellingen).
/* c701 (Mike 10.11): Vekstloop dag-for-dag: eiertid_år (SD mottatt, eller i dag om SD mangler, minus «Eier siden», én desimal) i målgruppe (3–15 år, AR mid 70–400k, eiertid ≥ 2). Ukjent eiertid telles ikke med. Samme definisjon som vekstloop-uke.js.
/* c700 (Mike 10.11): Marked (ny) nederst: «Vekstloop denne uka, dag for dag» (samme tall som vekstloop-uke.js, man–søn, uke-hittil t.o.m. i går; i dag og senere tomme).
/* c708 (Mike 11.11): Bestilt = siste booking (siste statusbytte til «på vei» / siste Gire eller Levere etter avbestilling+ny booking), aldri to ganger, samme regel som morgenmailen. Datoene kommer fra pulseBilfil (BESTILT_BOOKING='latest').
/* c691 (Mike 05.11): Marked (ny) = morgenmailen (kampanje-uke v3). Kr/bestilt = Google+Meta-kost / Peasy bestilt (Google+Meta+uten UTM), partner (Drive/Ordna/AutoDB) ute. Uten UTM = lag, ikke egen CAC-kanal. 14d mot forrige 14d. Bestilt = Gire bestilt på | Levere selv (bilfil-dato der den finnes). */
/* Peasy Pulse — Marked (ny), c601 (bestilt, leads og kost: inneværende uke mot samme dager forrige uke, med pil. Ingen kr per bestilt). c600 (tabellen: bare inneværende uke mot samme dager forrige uke; ukene står i grafen). c599 (Mike 15.10.2026). Testes ved siden av den gamle Marked-fanen.
   Ett spørsmål: hva skjer med bestilte biler, og hvem bidrar? Bestilt = siste booking (c708), én per internnr, avbestilte ute.
   Kanal: Peasy-leads etter UTM (Meta, Google, Direkte), ellers kilden (Drive, Ordna, AutoDB).
   Kalenderuker med ukenummer. Inneværende uke t.o.m. i går mot samme ukedager forrige uke, så de tre hele ukene før.
   Mandag: forrige hele uke mot uka før. Kr per bestilt: de 4 siste hele ukene. Graf: 12 uker, siste uke «hittil». */
(function () {
  var KAN = ['Google', 'Meta', 'Direkte', 'Drive', 'Ordna', 'AutoDB'];
  var PEASY = ['Google', 'Meta', 'Direkte'], PARTNER = ['Drive', 'Ordna', 'AutoDB'];
  var NAVN = { Direkte: 'Uten UTM (lag)' };
  function nv(k) { return NAVN[k] || k; }
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
    P.f14 = [dag(naaTil, -13), naaTil]; P.p14 = [dag(naaTil, -27), dag(naaTil, -14)];   // c691: 14d t.o.m. i går mot forrige 14d (som mailen)
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
    var T = {}; KAN.forEach(function (k) { T[k] = { n: tom(), l: tom(), kamp: {} }; });
    var serie = {}; KAN.forEach(function (k) { serie[k] = Q.uker.map(function () { return 0; }); });
    rows.slice(1).forEach(function (r) {
      if (!r || !String(r[1] || '').trim()) return; var kn = kanal(r); if (!kn || !T[kn]) return;
      var lead = d0(r[14]), t = T[kn];
      var camp = String(r[24] || '').trim(), cid = (kn === 'Meta' || kn === 'Google') ? (kn === 'Meta' ? 'meta|' + (mId(camp, String(r[28] || '').trim(), lead) || camp) : 'google|' + camp) : null;
      ['naa', 'sammen'].forEach(function (p) { if (inn(P[p], lead)) { t.l[p]++; if (cid) { var oc = t.kamp[cid] = t.kamp[cid] || { n: tom(), l: tom() }; oc.l[p]++; } } });
      var b = d0(r._bilfil ? r._bestilt : (r[15] || r[16])); if (!b) return;   // c708/c691: siste booking (pulseBilfil _bestilt / kol 15–16)
      var treff = false;
      ids.forEach(function (p) { if (inn(P[p], b)) { t.n[p]++; treff = true; } });
      Q.uker.forEach(function (u, ix) { if (inn(u.p, b)) serie[kn][ix]++; });
      if (cid && treff) { var o = t.kamp[cid] = t.kamp[cid] || { n: tom(), l: tom() }; ids.forEach(function (p) { if (inn(P[p], b)) o.n[p]++; }); }
    });
    KAN.forEach(function (k) { var t = T[k]; t.kost = {}; ids.forEach(function (p) { t.kost[p] = kostKan(k, P[p]); }); });
    ['Meta', 'Google'].forEach(function (kn) {
      var pre = kn === 'Meta' ? 'meta|' : 'google|', vis = {};
      Object.keys(kampKost).forEach(function (id) { if (id.indexOf(pre) === 0 && (kampKost[id].naa || kampKost[id].sammen)) vis[id] = 1; });
      Object.keys(T[kn].kamp).forEach(function (id) { var o = T[kn].kamp[id]; if (o.n.naa || o.n.sammen || o.l.naa || o.l.sammen) vis[id] = 1; });
      T[kn].liste = Object.keys(vis).map(function (id) {
        var raa = kampNavn[id] || id.split('|')[1] || ''; if (!raa || /\{\{/.test(raa)) raa = '(kampanje ukjent – UTM ikke fylt ut i annonsen)';
        var sist = kampSist[id] || null;
        var o = T[kn].kamp[id] || { n: tom(), l: tom() };
        return { navn: raa.replace(/\s*\(Vekstloop\)\s*$/, ''), n: o.n, l: o.l, kost: kampKost[id] || tom(), avsluttet: sist && sist < key(dag(P.naa[1], -1)) ? sist : null };
      }).sort(function (x, y) { return (y.kost.naa + y.kost.sammen) - (x.kost.naa + x.kost.sammen) || (y.n.naa - x.n.naa); });
    });
    // c641 (Mike 22.10): annonsekost per uke (ads-spend.json, samme dager som trenden) til kost per bestilt hent/lev.
    var kostU = { Google: Q.uker.map(function (u) { return kostKan('Google', u.p); }), Meta: Q.uker.map(function (u) { return kostKan('Meta', u.p); }) };
    return { T: T, Q: Q, serie: serie, kostU: kostU };
  }

  function pil(a, b, fmt) { fmt = fmt || String; if (a > b) return '<span style="color:#2E7D32;font-weight:800">▲ ' + fmt(a - b) + '</span>'; if (a < b) return '<span style="color:#C62828;font-weight:800">▼ ' + fmt(b - a) + '</span>'; return '<span style="color:#667A72">=</span>'; }
  /* c691: headline som morgenmailen — Peasy kost → bestilt (kr/best) nå vs samme dager forrige uke, og 14d vs forrige 14d. */
  function peasySum(T, p) { var n = 0, l = 0; PEASY.forEach(function (k) { n += T[k].n[p]; l += T[k].l[p]; }); var kost = (T.Google.kost[p] || 0) + (T.Meta.kost[p] || 0); return { n: n, l: l, kost: kost, per: n ? kost / n : null }; }
  function fd(d) { return String(d.getDate()).padStart(2, '0') + '.' + String(d.getMonth() + 1).padStart(2, '0'); }
  function headline(R) {
    var T = R.T, P = R.Q.P, a = peasySum(T, 'naa'), b = peasySum(T, 'sammen'), c = peasySum(T, 'f14'), d = peasySum(T, 'p14');
    var pct = function (x) { return x.l ? Math.round(100 * x.n / x.l) + ' %' : '–'; };
    var MAAL = 2000, ok = a.per != null && a.per < MAAL;
    window._markrevHeadline = { naa: a, sammen: b, f14: c, p14: d };
    return '<div class="table-card" style="margin-bottom:18px;padding:14px 18px;border-left:4px solid ' + (ok ? '#004225' : '#B71C1C') + '">' +
      '<div style="font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#667A72">Peasy kost → bestilt (som morgenmailen) · mål under ' + kr(MAAL) + ' kr/best</div>' +
      '<div style="font-size:17px;font-weight:800;margin-top:6px">' + fd(P.naa[0]) + '–' + fd(P.naa[1]) + ': ' + kr(a.kost) + ' kr → ' + a.n + ' bestilt (' + kr(a.per) + ' kr/best)' +
      ' <span style="font-weight:500;color:#667A72">— forrige ' + kr(b.kost) + ' → ' + b.n + ' (' + kr(b.per) + ')</span></div>' +
      '<div style="font-size:13px;margin-top:4px">Leads → bestilt: ' + a.l + ' → ' + a.n + ' (' + pct(a) + ') mot ' + b.l + ' → ' + b.n + ' (' + pct(b) + ')</div>' +
      '<div style="font-size:14px;margin-top:6px"><b>14d</b> ' + fd(P.f14[0]) + '–' + fd(P.f14[1]) + ': ' + kr(c.kost) + ' kr → <b>' + c.n + ' bestilt</b> (' + kr(c.per) + ')' +
      ' — forrige 14d ' + fd(P.p14[0]) + '–' + fd(P.p14[1]) + ': ' + kr(d.kost) + ' → ' + d.n + ' (' + kr(d.per) + ')</div>' +
      '<div style="font-size:11px;color:#667A72;margin-top:6px">Peasy = Google + Meta + uten UTM (lag). Partner (Drive, Ordna, AutoDB) er ute av kr/bestilt.</div></div>';
  }
  function perBest(k, n) { return !k ? '–' : n ? kr(k / n) : 'ingen'; }

  function render() {
    var root = document.getElementById('markrev-root'); if (!root) return;
    if (!window._lastRows || !window._lastRows.length) { root.innerHTML = '<div style="padding:20px;color:#667A72">Laster …</div>'; setTimeout(render, 800); return; }
    var R = beregn(), T = R.T, Q = R.Q, U = Q.ukeNr;
    var th = 'style="text-align:right;padding:6px 8px;font-size:11px;color:#667A72;font-weight:700;border-bottom:1px solid rgba(0,66,37,0.15);white-space:nowrap"';
    var td = 'text-align:right;padding:7px 8px;border-bottom:1px solid rgba(0,66,37,0.06);white-space:nowrap';
    var lys = ';color:#8A948F';
    var sammen = Q.hel ? 'Uke ' + U.u1 : 'uke ' + U.u1 + ' samme dager';
    var gr = function (t) { return '<th colspan="3" style="text-align:center;padding:6px 8px;font-size:11px;color:#004225;font-weight:800;border-bottom:1px solid rgba(0,66,37,0.15)">' + t + '</th>'; };
    var sub = '<th ' + th + '>' + Q.navnNaa + '</th><th ' + th + '>' + sammen + '</th><th ' + th + '></th>';
    var h = '<thead><tr><th></th>' + gr('Bestilt hent/lev') + gr('Leads') + gr('Annonsekost') + '</tr><tr><th ' + th.replace('right', 'left') + '>Hvem</th>' + sub + sub + sub + '</tr></thead><tbody>';
    var cols = 10, sum = { n: { naa: 0, sammen: 0 }, l: { naa: 0, sammen: 0 }, k: { naa: 0, sammen: 0 } };
    var skille = ';border-left:1px solid rgba(0,66,37,0.08)';
    function tre(a, b, fmt, stor, venstre) { return '<td style="' + td + (venstre ? skille : '') + (stor ? ';font-size:15px;font-weight:800' : ';font-weight:700') + '">' + fmt(a) + '</td><td style="' + td + '">' + fmt(b) + '</td><td style="' + td + '">' + (a == null || b == null ? '' : pil(a, b, fmt)) + '</td>'; }
    var heltall = function (n) { return n == null ? '–' : String(n); };
    var partnerStart = false;
    KAN.forEach(function (kn) {
      var t = T[kn];
      if (PARTNER.indexOf(kn) >= 0 && !partnerStart) { partnerStart = true; h += peasyRad(); h += '<tr><td colspan="' + cols + '" style="padding:10px 8px 4px;font-size:11px;color:#667A72;font-weight:700">Partner (ikke i kr/bestilt)</td></tr>'; }
      if (PARTNER.indexOf(kn) < 0) { sum.n.naa += t.n.naa; sum.n.sammen += t.n.sammen; sum.l.naa += t.l.naa; sum.l.sammen += t.l.sammen; sum.k.naa += t.kost.naa || 0; sum.k.sammen += t.kost.sammen || 0; }
      var kan = !!t.liste && t.liste.length;
      h += '<tr' + (kan ? ' data-mr="' + kn + '" style="cursor:pointer"' : '') + '><td style="' + td.replace('right', 'left') + ';font-weight:700"><span style="display:inline-block;width:9px;height:9px;border-radius:2px;background:' + FARGE[kn] + ';margin-right:7px"></span>' + nv(kn) + (kan ? ' <span style="color:#667A72;font-weight:400">' + (apen[kn] ? '▾' : '▸') + '</span>' : '') + '</td>' +
        tre(t.n.naa, t.n.sammen, heltall, true) + tre(t.l.naa, t.l.sammen, heltall, false, true) + tre(t.kost.naa, t.kost.sammen, kr, false, true) + '</tr>';
      if (kan && apen[kn]) {
        var L = t.liste, vis = L.length > 8 && !apen[kn + '+'] ? L.slice(0, 5) : L;
        vis.forEach(function (c) {
          h += '<tr style="background:rgba(0,66,37,0.025);font-size:12px' + (c.avsluttet ? ';color:#9AA39E' : '') + '"><td style="' + td.replace('right', 'left') + ';padding-left:26px">' + esc(c.navn) + (c.avsluttet ? ' <span style="font-size:10px;border:1px solid #C9CFCB;border-radius:8px;padding:0 6px">avsluttet ' + c.avsluttet.slice(8, 10) + '.' + c.avsluttet.slice(5, 7) + '</span>' : '') + '</td>' +
            tre(c.n.naa, c.n.sammen, heltall, false) + tre(c.l.naa, c.l.sammen, heltall, false, true) + tre(c.kost.naa, c.kost.sammen, kr, false, true) + '</tr>';
        });
        if (vis.length < L.length) h += '<tr data-mr="' + kn + '+" style="cursor:pointer"><td colspan="' + cols + '" style="padding:6px 26px;font-size:12px;color:#004225">+ ' + (L.length - vis.length) + ' andre kampanjer</td></tr>';
      }
    });
    h += '</tbody>';
    function peasyRad() { var bt = ';border-top:2px solid #004225'; return '<tr style="font-weight:800"><td style="' + td.replace('right', 'left') + bt + '">Peasy totalt</td>' + [[sum.n, heltall], [sum.l, heltall], [sum.k, kr]].map(function (x, ix) { return '<td style="' + td + bt + (ix ? skille : '') + (ix ? '' : ';font-size:15px') + '">' + x[1](x[0].naa) + '</td><td style="' + td + bt + '">' + x[1](x[0].sammen) + '</td><td style="' + td + bt + '">' + pil(x[0].naa, x[0].sammen, x[1]) + '</td>'; }).join('') + '</tr>'; }
    root.innerHTML = headline(R) +
      '<div class="section-label">Hva skjer? Bestilte hent/lev per uke</div>' +
      '<div class="table-card" style="margin-bottom:18px"><div style="padding:8px 12px;overflow-x:auto"><table id="markrev-tab" style="width:100%;border-collapse:collapse;font-size:13px">' + h + '</table></div>' +
      '<div style="padding:0 18px 12px;font-size:11px;color:#667A72;line-height:1.5">Bestilt = siste booking (siste dag på «på vei» / siste Gire eller Levere etter avbestilling og ny booking; avbestilte telles ikke), som morgenmailen. Kanal = der leadet kom fra (Peasy etter UTM). Uten UTM er lag (ofte forsinket betalt), ikke egen kanal i kr/bestilt. ' + (Q.hel ? '' : 'Inneværende uke er t.o.m. i går og sammenlignes med de samme dagene forrige uke. ') + 'Leads er nye henvendelser i samme dager, ikke de samme bilene som er bestilt. Pilen viser retningen mot samme dager forrige uke. Trykk Meta eller Google for kampanjene.</div></div>' +
      '<div class="section-label">Trend: bestilt per kanal, uke for uke (12 uker)</div>' +
      '<div class="table-card"><div style="padding:8px 16px 16px;position:relative;height:280px"><canvas id="markrev-graf"></canvas></div></div>' +
      kostHtml(R) + vlHtml();
    root.querySelectorAll('[data-mr]').forEach(function (el) { el.onclick = function () { var k = el.getAttribute('data-mr'); apen[k] = !apen[k]; render(); }; });
    vlBind(root);
    kostGraf(R);
    if (window.Chart) {
      var cv = document.getElementById('markrev-graf'); var ex = Chart.getChart(cv); if (ex) ex.destroy();
      new Chart(cv, { type: 'line', data: { labels: Q.uker.map(function (u) { return 'Uke ' + u.navn; }), datasets: KAN.map(function (kn) { return { label: kn, data: R.serie[kn], borderColor: FARGE[kn], backgroundColor: FARGE[kn], tension: 0.25, pointRadius: 2, segment: { borderDash: function (c) { return !Q.hel && c.p1DataIndex === Q.uker.length - 1 ? [5, 4] : undefined; } } }; }) },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } } });
    }
  }
  /* c641 (Mike 22.10): kost per bestilt hent/lev uke for uke (12 uker). Google = Google-kost / Google-bestilt, Meta tilsvarende,
     Totalt = (Google + Meta) / alle bestilte. Mangler bestilte en uke, blir det et hull. Samme uker og bestilt-logikk som trenden. */
  function kostSerier(R) {
    var Q = R.Q, alle = Q.uker.map(function (_, ix) { return PEASY.reduce(function (s, k) { return s + (R.serie[k] ? R.serie[k][ix] : 0); }, 0); });
    var del = function (k, n) { return n && k != null ? Math.round(k / n) : null; };
    return {
      Google: Q.uker.map(function (_, ix) { return { v: del(R.kostU.Google[ix], R.serie.Google[ix]), kost: R.kostU.Google[ix], n: R.serie.Google[ix] }; }),
      Meta: Q.uker.map(function (_, ix) { return { v: del(R.kostU.Meta[ix], R.serie.Meta[ix]), kost: R.kostU.Meta[ix], n: R.serie.Meta[ix] }; }),
      Totalt: Q.uker.map(function (_, ix) { var k = (R.kostU.Google[ix] || 0) + (R.kostU.Meta[ix] || 0); return { v: del(k, alle[ix]), kost: k, n: alle[ix] }; })
    };
  }
  var KOST_FARGE = { Google: '#F2B705', Meta: '#1877F2', Totalt: '#004225' };
  function kostHtml(R) {
    var S = kostSerier(R), Q = R.Q, td = 'padding:4px 6px;text-align:right;border-top:1px solid #E7EBE4;font-variant-numeric:tabular-nums;white-space:nowrap';
    var t = '<table id="markrev-kost-tab" style="width:100%;border-collapse:collapse;font-size:12px"><thead><tr><th style="text-align:left;padding:4px 6px;color:#667A72">Kr per bestilt</th>' +
      Q.uker.map(function (u) { return '<th style="' + td.replace('border-top:1px solid #E7EBE4;', '') + ';color:#667A72;font-weight:600">' + esc(u.navn) + '</th>'; }).join('') + '</tr></thead><tbody>' +
      ['Google', 'Meta', 'Totalt'].map(function (k) { return '<tr' + (k === 'Totalt' ? ' style="font-weight:800"' : '') + '><td style="text-align:left;padding:4px 6px;border-top:1px solid #E7EBE4;color:' + KOST_FARGE[k] + ';font-weight:700">' + k + '</td>' +
        S[k].map(function (x) { return '<td style="' + td + '" title="Kost ' + kr(x.kost) + ' kr, ' + x.n + ' bestilt">' + (x.v == null ? '–' : kr(x.v)) + '</td>'; }).join('') + '</tr>'; }).join('') +
      /* c642: kost per kontrakt (simulert) = kost per bestilt / (budaksept × når bud), regnes live av kalkulatoren */
      ['Google', 'Meta', 'Totalt'].map(function (k, i) { return '<tr class="mr-kk"' + (k === 'Totalt' ? ' style="font-weight:800"' : '') + '><td style="text-align:left;padding:4px 6px;border-top:' + (i ? '1px solid #E7EBE4' : '2px solid #C9D3CC') + ';color:' + KOST_FARGE[k] + ';font-weight:700;white-space:nowrap">' + k + ' per kontrakt (sim.)</td>' +
        S[k].map(function (x) { return '<td class="mr-kk-c" data-v="' + (x.v == null ? '' : x.v) + '" style="' + td + (i ? '' : ';border-top:2px solid #C9D3CC') + '">–</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table>';
    var kalk = '<div id="markrev-kalk" style="display:flex;flex-wrap:wrap;gap:8px 16px;align-items:center;padding:6px 12px 8px;font-size:12.5px;color:#16201B">' +
      '<label style="display:flex;align-items:center;gap:6px"><b>Budaksept</b> <input id="mr-ba" type="number" min="10" max="100" step="5" style="width:56px;padding:3px 4px;border:1px solid #C9D3CC;border-radius:5px"> % <input id="mr-ba-r" type="range" min="10" max="100" step="5" style="width:120px"></label>' +
      '<label style="display:flex;align-items:center;gap:6px">Når bud (av bestilte) <input id="mr-nb" type="number" min="10" max="100" step="5" style="width:56px;padding:3px 4px;border:1px solid #C9D3CC;border-radius:5px"> %</label>' +
      '<span id="mr-kalk-sum" style="font-weight:700"></span>' +
      '<span style="color:#8A6D10;font-size:11.5px">Simulering, ikke faktiske kontrakter</span></div>';
    return '<div class="section-label" style="margin-top:18px">Kost per bestilt hent/lev, uke for uke (12 uker)</div>' +
      '<div class="table-card"><div style="padding:8px 16px 8px;position:relative;height:260px"><canvas id="markrev-kost"></canvas></div>' +
      kalk + '<div style="padding:0 12px 6px;overflow-x:auto">' + t + '</div>' +
      '<div style="padding:4px 18px 12px;font-size:11px;color:#667A72;line-height:1.5">Bestilt = siste booking (siste dag på «på vei»). Leads uten UTM teller som Direkte, så Google og Meta kan være undertalt. Totalt = annonsekost Google + Meta delt på Peasy bestilt (Google + Meta + uten UTM). Partner (Drive, Ordna, AutoDB) er ute. Kost fra ads-spend.json.' + (Q.hel ? '' : ' Siste uke er «hittil» (t.o.m. i går), stiplet.') + '</div></div>';
  }
  /* c642 (Mike 22.10): kalkulator for kost per kontrakt. Valget lagres i localStorage, ikke på serveren. Mål 2 000 kr. */
  var KALK_MAAL = 2000;
  function kalkBind(R) {
    var ba = document.getElementById('mr-ba'), bar = document.getElementById('mr-ba-r'), nb = document.getElementById('mr-nb'), sum = document.getElementById('mr-kalk-sum');
    if (!ba || !bar || !nb) return;
    var les = function (k, d) { try { var v = Number(localStorage.getItem(k)); return v >= 10 && v <= 100 ? v : d; } catch (e) { return d; } };
    var klem = function (v) { v = Math.round(Number(v) / 5) * 5; return Math.max(10, Math.min(100, v || 0)); };
    ba.value = bar.value = les('markrevBudaksept', 60); nb.value = les('markrevNaarBud', 100);
    var S = kostSerier(R), Q = R.Q;
    var farge = function (v) { return v == null ? '' : v < KALK_MAAL ? '#2E7D32' : '#C62828'; };
    var regn = function () {
      var f = (klem(ba.value) / 100) * (klem(nb.value) / 100);
      [].forEach.call(document.querySelectorAll('#markrev-kost-tab .mr-kk-c'), function (td) {
        var v = td.getAttribute('data-v'); var k = v === '' ? null : Math.round(Number(v) / f);
        td.textContent = k == null ? '–' : kr(k); td.style.color = farge(k);
      });
      var n = Q.uker.length, a = S.Totalt[n - 1].v, b = S.Totalt[n - 2].v;
      var tall = function (v) { var k = v == null ? null : Math.round(v / f); return '<span style="color:' + farge(k) + '">' + (k == null ? '–' : 'ca. ' + kr(k) + ' kr') + '</span>'; };
      sum.innerHTML = 'Uke ' + esc(Q.uker[n - 1].navn) + ': ' + tall(a) + ' per kontrakt · uke ' + esc(Q.uker[n - 2].navn) + ': ' + tall(b) + ' · mål ' + kr(KALK_MAAL) + ' kr';
      try { localStorage.setItem('markrevBudaksept', klem(ba.value)); localStorage.setItem('markrevNaarBud', klem(nb.value)); } catch (e) {}
    };
    ba.oninput = function () { bar.value = klem(ba.value); regn(); };
    ba.onchange = function () { ba.value = bar.value = klem(ba.value); regn(); };
    bar.oninput = function () { ba.value = bar.value; regn(); };
    nb.oninput = regn; nb.onchange = function () { nb.value = klem(nb.value); regn(); };
    regn();
  }
  function kostGraf(R) {
    kalkBind(R);
    if (!window.Chart) return;
    var cv = document.getElementById('markrev-kost'); if (!cv) return; var ex = Chart.getChart(cv); if (ex) ex.destroy();
    var S = kostSerier(R), Q = R.Q;
    new Chart(cv, { type: 'line', data: { labels: Q.uker.map(function (u) { return 'Uke ' + u.navn; }), datasets: ['Google', 'Meta', 'Totalt'].map(function (k) { return {
      label: k, data: S[k].map(function (x) { return x.v; }), borderColor: KOST_FARGE[k], backgroundColor: KOST_FARGE[k], borderWidth: k === 'Totalt' ? 3 : 2, tension: 0.25, pointRadius: 3, spanGaps: false,
      segment: { borderDash: function (c) { return !Q.hel && c.p1DataIndex === Q.uker.length - 1 ? [5, 4] : undefined; } } }; }) },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' }, tooltip: { callbacks: { label: function (c) { var x = S[c.dataset.label][c.dataIndex]; return c.dataset.label + ': ' + kr(x.v) + ' kr per bestilt (kost ' + kr(x.kost) + ' kr, ' + x.n + ' bestilt)'; } } } },
        scales: { y: { beginAtZero: true, ticks: { callback: function (v) { return kr(v) + ' kr'; } } } } } });
  }

  /* c700: Vekstloop denne uka, dag for dag. Samme definisjoner som v2/vekstloop-uke.js. */
  var VL_MAL = { bestilling: 0.20, salg: 0.70, kostPerBestilt: 1000, bestiltMin: 0.10 };
  var VL_DG = ['man', 'tir', 'ons', 'tor', 'fre', 'lør', 'søn'];

  function vlParse(s) {
    if (!s) return null;
    var m = String(s).trim().match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})(?:\s+(\d{1,2}):(\d{2}))?/);
    if (!m) return null;
    return new Date(+m[3], +m[2] - 1, +m[1], +(m[4] || 0), +(m[5] || 0));
  }
  function vlPst(a, b) { return !b ? '–' : (Math.round(a / b * 1000) / 10).toLocaleString('nb-NO') + ' %'; }
  function vlKr(n) { return n == null || !isFinite(n) ? '–' : Math.round(n).toLocaleString('nb-NO') + ' kr'; }
  function vlKanal(utm) {
    var u = String(utm || '').trim().toLowerCase();
    if (u === 'facebook' || u === 'fb' || u === 'instagram' || u === 'ig' || u === 'meta') return 'meta';
    if (u === 'google') return 'google';
    return 'direkte';
  }
  function vlKortVisning(g) {
    if (g.kanal === 'direkte') return 'Direkte / ukjent';
    var n = String(g.navn || g.camp || '').replace(/\s*\(Vekstloop\)\s*$/, '');
    n = n.replace(/^Konvertering:\s*/i, '').replace(/^Search:\s*/i, '');
    n = n.replace(/\s*\[[^\]]*\]\s*/g, ' ').replace(/[«»]/g, '').replace(/;/g, ' ');
    n = n.replace(/\s+/g, ' ').trim();
    if (g.kanal === 'meta') {
      if (/retarget/i.test(n)) return 'Meta Retargeting';
      if (/^broad\b|nytt publikum/i.test(n)) return 'Meta Broad';
      if (/^narrow\b|engasjement/i.test(n)) return 'Meta Narrow';
      n = n.replace(/^(Broad|Narrow|Target):\s*/i, '').trim();
      return ('Meta ' + n).replace(/\s+/g, ' ').trim();
    }
    if (g.kanal === 'google') {
      if (/^brand\b/i.test(n)) return 'Google Brand';
      if (/salg av bil/i.test(n)) return 'Google Salg av bil';
      if (/bilsalg/i.test(n) && /bergen/i.test(n)) return 'Google Bilsalg Bergen';
      return ('Google ' + n).replace(/\s+/g, ' ').trim();
    }
    return n || '–';
  }
  function vlKampanjeOk(g) {
    if (g.kanal === 'direkte' || !(g.kost > 0)) return '–';
    if (!g.a) return 'Under target';
    var bp = g.l ? g.a / g.l : 0, kpb = g.kost / g.a;
    return (bp >= VL_MAL.bestiltMin && kpb <= VL_MAL.kostPerBestilt) ? 'OK' : 'Under target';
  }
  function vlEiertid(eierSiden, ref) {
    var d = vlParse(eierSiden); if (!d || !ref) return null;
    var ref0 = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate());
    return Math.round(((ref0 - d) / (365.25 * 864e5)) * 10) / 10;
  }
  /* Ett resultat brukes både i tellingen og i popupen, så de ikke kan divergere. */
  function vlMalgruppeData(r, aks, eierIx, sd) {
    var arv = String((r[3] == null ? '' : r[3])).replace(/[\s\u00a0]/g, '');
    var m = arv.match(/(\d+)-(\d+)/);
    var val = m ? (+m[1] + +m[2]) / 2 : null;
    var aar = Number(r[8]);
    var alder = (aar && aks) ? (aks.getFullYear() - aar) : null;
    var alderOk = alder == null ? null : (alder >= 3 && alder <= 15);
    var arOk = val == null ? null : (val >= 70000 && val <= 400000);
    var eier = null;
    if (eierIx != null) eier = vlEiertid(r[eierIx], sd || new Date());
    var eierOk = eier == null ? null : (eier >= 2);
    var ok = null;
    if (val == null || !aar || !aks) ok = null;
    else if (eierIx == null || eier == null) ok = null;
    else ok = alderOk && arOk && eierOk;
    return {
      reg: String(r[1] == null ? '' : r[1]).trim(),
      alder: alder, alderOk: alderOk,
      arMid: val, arOk: arOk,
      eiertid: eier, eierOk: eierOk,
      ok: ok
    };
  }
  function vlIMalgruppe(r, aks, eierIx, sd) {
    return vlMalgruppeData(r, aks, eierIx, sd).ok;
  }
  function vlEierIx(rows) {
    var h = (rows && rows[0]) || [];
    for (var i = 0; i < h.length; i++) {
      if (String(h[i] || '').trim().toLowerCase() === 'eier siden') return i;
    }
    return null;
  }
  var _vlEier = { status: 'idle', map: null };
  function vlMedEier(rows) {
    rows = rows || [];
    if (!rows.length) return rows;
    if (vlEierIx(rows) != null) return rows;
    if (!_vlEier.map) return rows;
    var h = (rows[0] || []).slice();
    h.push('Eier siden');
    var out = [h];
    for (var i = 1; i < rows.length; i++) {
      var r = (rows[i] || []).slice();
      var id = String(r[0] == null ? '' : r[0]).trim();
      r.push(_vlEier.map[id] || '');
      out.push(r);
    }
    return out;
  }
  function vlHentEier() {
    if (_vlEier.status === 'loading' || _vlEier.status === 'ready' || _vlEier.status === 'fail') return;
    if (typeof XLSX === 'undefined') return;
    _vlEier.status = 'loading';
    var base = (window.PA_PROXY_ERP || ((typeof PA_MINI_BASE !== 'undefined' ? PA_MINI_BASE : '') + '/list/'));
    var mini = String(base).replace(/\/list\/?$/, '') + '/xlsx?t=' + Date.now();
    fetch(mini, { signal: AbortSignal.timeout(8000) }).then(function (r) {
      if (!r || !r.ok) throw new Error('xlsx');
      return r.arrayBuffer();
    }).then(function (buf) {
      var wb = XLSX.read(buf, { type: 'array' });
      var raw = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 });
      var hd = raw[0] || [];
      var iId = -1, iEier = -1;
      for (var i = 0; i < hd.length; i++) {
        var n = String(hd[i] || '').trim().toLowerCase();
        if (n === 'internnr.') iId = i;
        if (n === 'eier siden') iEier = i;
      }
      var map = {};
      if (iId >= 0 && iEier >= 0) {
        for (var j = 1; j < raw.length; j++) {
          var rr = raw[j] || [];
          var id = String(rr[iId] == null ? '' : rr[iId]).trim();
          var v = rr[iEier];
          if (!id || v == null || v === '') continue;
          map[id] = String(v).trim();
        }
      }
      _vlEier.map = map;
      _vlEier.status = 'ready';
      render();
    }).catch(function () {
      _vlEier.status = 'fail';
      render();
    });
  }
  function vlDenneUka() {
    var i0 = new Date(); i0.setHours(0, 0, 0, 0);
    var man = dag(i0, -((i0.getDay() + 6) % 7));
    man.setHours(0, 0, 0, 0);
    var dager = [];
    for (var i = 0; i < 7; i++) {
      var d = dag(man, i); d.setHours(0, 0, 0, 0);
      var til = new Date(d); til.setHours(23, 59, 59, 999);
      dager.push({ d: d, til: til, key: key(d), ferdig: d.getTime() < i0.getTime(), navn: VL_DG[i], etikett: VL_DG[i] + ' ' + fd(d) });
    }
    var iGar = dag(i0, -1); iGar.setHours(23, 59, 59, 999);
    var hittilOk = iGar.getTime() >= man.getTime();
    return { man: man, i0: i0, iGar: iGar, ukeNr: uke(man), dager: dager, hittilOk: hittilOk };
  }
  /* Samme aggregering som beregnUke i vekstloop-uke.js for vinduet w = { fra, til }. */
  function vlBeregn(rows, ads, w) {
    rows = vlMedEier(rows || []);
    var eierIx = vlEierIx(rows);
    var inn = function (d) { return d && d >= w.fra && d <= w.til; };
    var mId = (typeof pulseMetaOppslag === 'function') ? pulseMetaOppslag() : function () { return null; };
    var kostKamp = {}, navnKamp = {};
    var kostMeta = 0, kostGoogle = 0;
    var days = (ads && ads.days) || {};
    Object.keys(days).forEach(function (ds) {
      var d = new Date(ds + 'T12:00:00'); if (!inn(d)) return;
      var a = days[ds] || {};
      kostMeta += Number(a.meta) || 0; kostGoogle += Number(a.google) || 0;
    });
    Object.keys((ads && ads.kampanjer) || {}).forEach(function (k) {
      var c = ads.kampanjer[k]; if (!c) return;
      var s = 0;
      Object.keys(c.dager || {}).forEach(function (ds) {
        var d = new Date(ds + 'T12:00:00'); if (inn(d)) s += Number(c.dager[ds]) || 0;
      });
      if (!s) return;
      var keyK = c.kilde === 'google' ? 'google|' + String(c.id) : 'meta|' + String(c.id);
      kostKamp[keyK] = (kostKamp[keyK] || 0) + s;
      navnKamp[keyK] = c.navn;
    });
    var tom = function () { return { l: 0, a: 0, s: 0, seg: 0, segUnk: 0 }; };
    var tot = tom(), kamp = {};
    rows.slice(1).forEach(function (r) {
      if (!r || !r[1]) return;
      var kilde = String(r[11] || '').trim().toLowerCase();
      var utm = String(r[23] || '').trim().toLowerCase();
      if (kilde !== 'peasy' || utm === 'autodb') return;
      var k = vlKanal(utm);
      var campRaw = String(r[24] || '').trim();
      var sd = vlParse(r[14]);
      var m = k === 'meta' ? mId(campRaw, String(r[28] || '').trim(), sd) : null;
      var kkey = k === 'google' ? 'google|' + campRaw : (k === 'meta' ? 'meta|' + (m || campRaw.toLowerCase()) : 'direkte|');
      var aks = vlParse(r[15]) || vlParse(r[16]);
      var sol = vlParse(r[18]);
      var g = kamp[kkey] = kamp[kkey] || Object.assign(tom(), { kanal: k, camp: k === 'meta' && m ? m : campRaw, key: kkey });
      if (inn(sd)) { tot.l++; g.l++; }
      if (inn(aks)) {
        tot.a++; g.a++;
        if (!g.biler) g.biler = [];
        var det = vlMalgruppeData(r, aks, eierIx, sd);
        g.biler.push(det);
        if (det.ok === true) { tot.seg++; g.seg++; }
        else if (det.ok === null) { tot.segUnk++; g.segUnk++; }
      }
      if (inn(sol)) { tot.s++; g.s++; }
    });
    tot.kost = kostMeta + kostGoogle;
    tot.eierIx = eierIx;
    var rader = [];
    Object.keys(kamp).forEach(function (kkey) {
      var g = kamp[kkey];
      g.kost = kostKamp[kkey] || 0;
      g.navn = navnKamp[kkey] || (g.kanal === 'google' ? 'Google-kampanje ' + g.camp
        : (g.kanal === 'meta' ? (g.camp || '(uten kampanje)') : 'Direkte / ukjent'));
      if (g.kost > 0 || g.l > 0 || g.a > 0 || g.s > 0) rader.push(g);
    });
    Object.keys(kostKamp).forEach(function (kkey) {
      if (!kamp[kkey]) rader.push({
        kanal: kkey.split('|')[0], camp: kkey.split('|').slice(1).join('|'), key: kkey,
        l: 0, a: 0, s: 0, seg: 0, segUnk: 0, kost: kostKamp[kkey], navn: navnKamp[kkey], biler: []
      });
    });
    rader.sort(function (a, b) { return (b.kost || 0) - (a.kost || 0) || (b.l - a.l); });
    return { tot: tot, rader: rader, kostMeta: kostMeta, kostGoogle: kostGoogle };
  }
  function vlSegTxt(g) {
    if (!g.a) return '–';
    return g.seg + ' av ' + g.a;
  }
  var _vlStore = {}, vlApen = {}, _vlPopOut = null;
  function vlLukkPopup() {
    var el = document.getElementById('vl-mg-pop');
    if (el && el.parentNode) el.parentNode.removeChild(el);
    document.removeEventListener('keydown', vlPopEsc, true);
    if (_vlPopOut) { document.removeEventListener('mousedown', _vlPopOut, true); _vlPopOut = null; }
  }
  function vlPopEsc(e) { if (e.key === 'Escape') vlLukkPopup(); }
  function vlMerke(ok) {
    if (ok === true) return '<span style="color:#1B5E20;font-weight:700">✓</span>';
    if (ok === false) return '<span style="color:#B71C1C;font-weight:700">✗</span>';
    return '<span style="color:#757575">–</span>';
  }
  function vlPopupHtml(d) {
    var tal = function (n, des) {
      if (n == null || !isFinite(n)) return 'ukjent';
      return n.toLocaleString('nb-NO', { minimumFractionDigits: des || 0, maximumFractionDigits: des || 0 });
    };
    var rad = function (label, verdi, vs, ok) {
      return '<div style="display:flex;gap:8px;align-items:baseline;padding:3px 0;font-size:13px">'
        + '<span style="min-width:58px;color:#667A72">' + label + '</span>'
        + '<span style="flex:1">' + verdi + ' <span style="color:#667A72;font-size:11px">' + vs + '</span></span>'
        + vlMerke(ok) + '</div>';
    };
    var verd = d.ok === true ? 'ja' : (d.ok === false ? 'nei' : 'ukjent');
    var vf = d.ok === true ? '#1B5E20' : (d.ok === false ? '#B71C1C' : '#757575');
    return '<div style="font-family:Arial,sans-serif;min-width:220px;max-width:280px">'
      + '<div style="font-weight:800;font-size:15px;margin-bottom:8px">' + esc(d.reg) + '</div>'
      + rad('Alder', d.alder == null ? 'ukjent' : (d.alder + ' år'), 'vs 3–15', d.alderOk)
      + rad('AR mid', d.arMid == null ? 'ukjent' : (tal(Math.round(d.arMid)) + ' kr'), 'vs 70–400k', d.arOk)
      + rad('Eiertid', d.eiertid == null ? 'ukjent' : (tal(d.eiertid, 1) + ' år'), 'vs ≥ 2', d.eierOk)
      + '<div style="margin-top:8px;padding-top:8px;border-top:1px solid #e5e5e5;font-weight:700;color:' + vf + '">I målgruppe: ' + verd + '</div>'
      + '</div>';
  }
  function vlVisPopup(d, anchor) {
    vlLukkPopup();
    if (!d || typeof document === 'undefined' || !document.body) return;
    var pop = document.createElement('div');
    pop.id = 'vl-mg-pop';
    pop.setAttribute('role', 'dialog');
    pop.style.cssText = 'position:fixed;z-index:99999;background:#fff;border:1px solid #C9D3CC;border-radius:8px;box-shadow:0 8px 24px rgba(0,0,0,.12);padding:12px 14px;';
    pop.innerHTML = vlPopupHtml(d);
    document.body.appendChild(pop);
    var r = anchor && anchor.getBoundingClientRect ? anchor.getBoundingClientRect() : { top: 80, bottom: 80, left: 80 };
    var top = r.bottom + 6, left = r.left;
    if (top + pop.offsetHeight > (window.innerHeight || 800) - 8) top = Math.max(8, r.top - pop.offsetHeight - 6);
    if (left + pop.offsetWidth > (window.innerWidth || 800) - 8) left = Math.max(8, (window.innerWidth || 800) - pop.offsetWidth - 8);
    pop.style.top = top + 'px';
    pop.style.left = left + 'px';
    document.addEventListener('keydown', vlPopEsc, true);
    _vlPopOut = function (e) { if (pop && !pop.contains(e.target)) vlLukkPopup(); };
    setTimeout(function () { if (_vlPopOut) document.addEventListener('mousedown', _vlPopOut, true); }, 0);
  }
  function vlBind(root) {
    if (!root || root._vlBound) return;
    root._vlBound = true;
    root.addEventListener('click', function (e) {
      var t = e.target;
      var bil = t && t.closest ? t.closest('[data-vl-bil]') : null;
      if (bil) {
        e.preventDefault();
        e.stopPropagation();
        var det = _vlStore[bil.getAttribute('data-vl-bil')];
        if (det) vlVisPopup(det, bil);
        return;
      }
      var kamp = t && t.closest ? t.closest('[data-vl-kamp]') : null;
      if (!kamp) return;
      var id = kamp.getAttribute('data-vl-kamp');
      vlApen[id] = !vlApen[id];
      var neste = kamp.nextElementSibling;
      if (neste && neste.getAttribute('data-vl-exp') === id) neste.style.display = vlApen[id] ? '' : 'none';
      var care = kamp.querySelector('.vl-care');
      if (care) care.textContent = vlApen[id] ? '▾' : '▸';
    });
  }
  function vlTabell(D, tabId) {
    var td = 'padding:4px 6px;border-bottom:1px solid #e5e5e5;text-align:right;white-space:nowrap';
    var tdl = 'padding:4px 6px;border-bottom:1px solid #e5e5e5;text-align:left;white-space:nowrap';
    var th = 'padding:4px 6px;text-align:right;background:#F0F4F2;font-size:11px;white-space:nowrap;color:#667A72;font-weight:700';
    var thl = th.replace('right', 'left');
    var okFarge = function (v) { return v === 'OK' ? '#1B5E20' : (v === 'Under target' ? '#B71C1C' : '#757575'); };
    var h = '<table class="vl-dag-tab" style="border-collapse:collapse;width:auto;font-size:12px"><thead><tr>';
    h += '<th style="' + thl + '">Kampanje</th><th style="' + th + '">Kost</th><th style="' + th + '">Leads</th><th style="' + th + '">Bestilt</th><th style="' + th + '">Bestilt %</th><th style="' + th + '">Solgt</th><th style="' + th + '">Kost/bestilt</th><th style="' + th + '">I målgruppe</th><th style="' + thl + '">OK</th></tr></thead><tbody>';
    var sumKost = 0, sumL = 0, sumA = 0, sumS = 0, sumSeg = 0;
    (D.rader || []).forEach(function (g) {
      var ok = vlKampanjeOk(g);
      sumKost += g.kost || 0; sumL += g.l; sumA += g.a; sumS += g.s; sumSeg += g.seg;
      var kid = (tabId || '') + '|' + String(g.key || '');
      var har = g.biler && g.biler.length;
      var care = har ? (' <span class="vl-care" style="color:#667A72;font-weight:400">' + (vlApen[kid] ? '▾' : '▸') + '</span>') : '';
      var trAttr = har ? ' data-vl-kamp="' + esc(kid) + '" style="cursor:pointer"' : '';
      h += '<tr' + trAttr + '><td style="' + tdl + '">' + esc(vlKortVisning(g)) + care + '</td><td style="' + td + '">' + vlKr(g.kost) + '</td><td style="' + td + '">' + g.l + '</td><td style="' + td + '">' + g.a + '</td><td style="' + td + '">' + vlPst(g.a, g.l) + '</td><td style="' + td + '">' + g.s + '</td><td style="' + td + '">' + ((g.a && g.kost > 0) ? vlKr(g.kost / g.a) : '–') + '</td><td style="' + td + '">' + vlSegTxt(g) + '</td><td style="' + tdl + ';font-weight:700;color:' + okFarge(ok) + '">' + ok + '</td></tr>';
      if (har) {
        var regs = g.biler.map(function (b, j) {
          var bid = kid + '|' + j;
          _vlStore[bid] = b;
          return '<span data-vl-bil="' + esc(bid) + '" style="color:#004225;text-decoration:underline;cursor:pointer;margin-right:10px;white-space:nowrap">' + esc(b.reg) + '</span>';
        }).join('');
        h += '<tr data-vl-exp="' + esc(kid) + '" style="display:' + (vlApen[kid] ? '' : 'none') + '"><td colspan="9" style="padding:2px 6px 8px 18px;font-size:12px;line-height:1.7">' + regs + '</td></tr>';
      }
    });
    h += '<tr style="font-weight:800"><td style="' + tdl + '">Peasy totalt</td><td style="' + td + '">' + vlKr(sumKost) + '</td><td style="' + td + '">' + sumL + '</td><td style="' + td + '">' + sumA + '</td><td style="' + td + '">' + vlPst(sumA, sumL) + '</td><td style="' + td + '">' + sumS + '</td><td style="' + td + '">' + ((sumA && sumKost > 0) ? vlKr(sumKost / sumA) : '–') + '</td><td style="' + td + '">' + (sumA ? (sumSeg + ' av ' + sumA) : '–') + '</td><td style="' + tdl + '"></td></tr>';
    h += '</tbody></table>';
    return h;
  }
  function vlKortTom(tittel) {
    return '<div class="table-card" style="margin-bottom:12px;background:#F4F6F5;opacity:.85"><div style="padding:10px 16px;font-size:13px;font-weight:700;color:#667A72">' + esc(tittel) + ' <span style="font-weight:600;font-size:11px;letter-spacing:.4px;text-transform:uppercase;border:1px solid #C9D3CC;border-radius:8px;padding:1px 7px;margin-left:8px">ikke ferdig</span></div></div>';
  }
  function vlKortTab(tittel, D, tabId) {
    var unk = (D && D.tot && D.tot.segUnk) || 0;
    var note = '<div style="padding:0 16px 10px;font-size:11px;color:#667A72">ukjent eiertid: ' + unk + '</div>';
    return '<div class="table-card" style="margin-bottom:12px"><div style="padding:10px 16px 4px;font-size:13px;font-weight:700;color:#004225">' + esc(tittel) + '</div><div style="padding:4px 12px 12px;overflow-x:auto">' + vlTabell(D, tabId) + '</div>' + note + '</div>';
  }
  function vlHtml() {
    vlHentEier();
    vlLukkPopup();
    _vlStore = {};
    var rows = window._lastRows || [], ads = window.adsSpend || null, U = vlDenneUka();
    var html = '<div class="section-label" style="margin-top:22px">Vekstloop denne uka, dag for dag</div>';
    U.dager.forEach(function (dagO) {
      if (!dagO.ferdig) { html += vlKortTom(dagO.etikett); return; }
      html += vlKortTab(dagO.etikett, vlBeregn(rows, ads, { fra: dagO.d, til: dagO.til }), dagO.key);
    });
    if (!U.hittilOk) html += vlKortTom('Uke ' + U.ukeNr + ' hittil');
    else {
      var hittilTittel = 'Uke ' + U.ukeNr + ' hittil (man–' + VL_DG[U.iGar.getDay() === 0 ? 6 : U.iGar.getDay() - 1] + ' ' + fd(U.iGar) + ')';
      html += vlKortTab(hittilTittel, vlBeregn(rows, ads, { fra: U.man, til: U.iGar }), 'hittil');
    }
    html += '<div style="padding:0 18px 16px;font-size:11px;color:#667A72;line-height:1.5">Målgruppe: biler 3–15 år, verdi 70–400k, eiertid minst 2 år (eiertid = år mellom «Eier siden» og SD mottatt, eller i dag om SD mangler, én desimal). Mangler «Eier siden» telles ikke i målgruppe (ukjent eiertid vises under hver dag). Mål: 20 % bestilt og 70 % solgt. OK = bestilt % ≥ 10 % og kost/bestilt ≤ 1 000 kr. I dag og senere dager er tomme til dagen er ferdig. Peasy-leads only, kost fra ads-spend.json.</div>';
    return html;
  }

  window.MARKREV = { headline: headline, peasySum: peasySum, render: render, beregn: beregn, perioder: perioder, kostSerier: kostSerier, vlBeregn: vlBeregn, vlDenneUka: vlDenneUka, vlHtml: vlHtml, vlKortVisning: vlKortVisning, vlKampanjeOk: vlKampanjeOk, vlMedEier: vlMedEier, vlMalgruppeData: vlMalgruppeData, vlPopupHtml: vlPopupHtml, _vlEier: _vlEier, _vlStore: function () { return _vlStore; } };
})();
