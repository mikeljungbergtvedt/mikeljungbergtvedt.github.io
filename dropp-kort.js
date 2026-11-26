/* c744 (Mike 26.11): nøkkelkortet «Ankommet / leads» (mål 15 %) med dropp-off under.
   Ankommet = første RECEIVED etter at bilen var på liste 5 («på vei»), fra webhook-loggen på Minien (GET /erp-events → hentLev, v20.258).
   ERP-hendelsesloggen (bilfil-berik.json) er reserve på Minien. Leads = Peasy SD mottatt i perioden (samme som bestilt % i Marked (ny)).
   Bare Peasy: Ordna er tatt ut på Minien, AutoDB og Drive tas ut her (som Marketing-mailen).
   Dropp-off per bestillingsperiode med 7 dagers ventetid: bestilt (første dag på «på vei», én per regnr) som ikke kom til anlegget.
   Biler som fortsatt er på vei (også ny registrering av samme regnr) er utenfor nevneren. Dropp % = dropp / (ankommet + dropp). */
(function (root) {
  var MAL = 0.15, VENT = 7;
  function k(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function dag(d, n) { var x = new Date(d); x.setDate(x.getDate() + n); return x; }
  function nbDag(s) { var p = String(s || '').trim().slice(0, 10).split('.'); return p.length === 3 && p[2].length === 4 ? p[2] + '-' + p[1] + '-' + p[0] : null; }
  function inn(P, s) { return !!s && s >= P[0] && s <= P[1]; }
  function uke(d) { var t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())); var n = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - n); var y = new Date(Date.UTC(t.getUTCFullYear(), 0, 1)); return Math.ceil(((t - y) / 864e5 + 1) / 7); }
  function pst(a, b) { return b ? Math.round(1000 * a / b) / 10 : null; }
  function fd(s) { return s ? s.slice(8, 10) + '.' + s.slice(5, 7) : ''; }
  var ARSAK = { REJECTED_BY_CUSTOMER: 'avvist av kunde', REJECTED_BY_ADMIN: 'avvist av admin', REJECTED_BY_TIMEOUT: 'utløpt', REJECTED: 'avvist', ORDER_DELIVERY: 'avbestilt (bestille levering)' };

  /* o: { rows (Excel-rader, rad 0 = header), hentLev ({ biler }), iGaar (Date), srcKey (fn) } */
  function beregn(o) {
    var rows = o.rows || [], srcKey = o.srcKey, ig = new Date(o.iGaar); ig.setHours(0, 0, 0, 0);
    var peasy = {}, leadDag = [];
    for (var i = 1; i < rows.length; i++) {
      var r = rows[i]; if (!r || !String(r[1] || '').trim()) continue;
      if (srcKey(r) !== 'peasy') continue;
      peasy[String(r[0]).trim()] = 1;
      leadDag.push(nbDag(r[14]));
    }
    var biler = ((o.hentLev && o.hentLev.biler) || []).filter(function (x) { return peasy[String(x.id)]; });
    var P = { f14: [k(dag(ig, -13)), k(ig)], p14: [k(dag(ig, -27)), k(dag(ig, -14))] };
    var C = { f: [k(dag(ig, -13 - VENT)), k(dag(ig, -VENT))], p: [k(dag(ig, -27 - VENT)), k(dag(ig, -14 - VENT))] };
    function ank(Pp) {
      var leads = leadDag.filter(function (s) { return inn(Pp, s); }).length;
      var n = biler.filter(function (x) { return inn(Pp, x.mo); }).length;
      return { fra: Pp[0], til: Pp[1], leads: leads, ank: n, pct: pst(n, leads) };
    }
    function kohort(Pp) {
      var per = {};
      biler.forEach(function (x) { if (!inn(Pp, x.b)) return; var key = x.regnr || ('#' + x.id); if (!per[key] || x.b < per[key].b) per[key] = x; });
      var t = { fra: Pp[0], til: Pp[1], bestilt: 0, ank: 0, pv: 0, dropp: 0, arsak: {}, hent: { bestilt: 0, ank: 0, dropp: 0 }, lev: { bestilt: 0, ank: 0, dropp: 0 } };
      Object.keys(per).forEach(function (key) {
        var x = per[key], ty = t[x.type === 'lev' ? 'lev' : 'hent'];
        t.bestilt++; ty.bestilt++;
        if (x.m) { t.ank++; ty.ank++; return; }
        if (x.pv) { t.pv++; return; }
        t.dropp++; ty.dropp++;
        var a = ARSAK[x.s] || 'annet'; t.arsak[a] = (t.arsak[a] || 0) + 1;
      });
      t.pct = pst(t.dropp, t.ank + t.dropp); t.hent.pct = pst(t.hent.dropp, t.hent.ank + t.hent.dropp); t.lev.pct = pst(t.lev.dropp, t.lev.ank + t.lev.dropp);
      return t;
    }
    var sisteSon = dag(ig, -VENT); while (sisteSon.getDay() !== 0) sisteSon = dag(sisteSon, -1);
    var uker = [];
    for (var w = 3; w >= 0; w--) { var son = dag(sisteSon, -7 * w), man = dag(son, -6); var u = kohort([k(man), k(son)]); u.uke = uke(man); uker.push(u); }
    return { mal: MAL, vent: VENT, f14: ank(P.f14), p14: ank(P.p14), dropp: { f: kohort(C.f), p: kohort(C.p) }, uker: uker, n: biler.length };
  }

  function pTxt(v) { return v == null ? '–' : String(v).replace('.', ',') + ' %'; }
  function kort(R) {
    if (!R) return '<div class="dial-card neutral nk-30"><div class="dial-label">Ankommet / leads</div><div class="dial-value" style="color:#667A72">—</div><div class="dial-unit">Venter på Minien (v20.258, hentLev i /erp-events)</div><div class="dial-sub">Mål ' + (MAL * 100) + ' % · Peasy</div><div class="target-tag">14 d</div></div>';
    var a = R.f14, b = R.p14, d = R.dropp.f, dp = R.dropp.p;
    var col = a.pct == null ? '#667A72' : (a.pct >= MAL * 100 ? '#2E7D32' : '#C62828');
    var ars = Object.keys(d.arsak).sort(function (x, y) { return d.arsak[y] - d.arsak[x]; }).map(function (x) { return d.arsak[x] + ' ' + x; }).join(', ');
    var ukeTxt = R.uker.map(function (u) { return 'u' + u.uke + ' ' + pTxt(u.pct) + ' (' + u.dropp + '/' + (u.ank + u.dropp) + ')'; }).join(' · ');
    var tip = 'Ankommet = første mottak (RECEIVED) etter «på vei», webhook-loggen på Minien. Leads = Peasy SD mottatt. Bare Peasy (ikke Ordna, Drive eller AutoDB).\n'
      + 'Dropp-off: bestilt ' + fd(d.fra) + '–' + fd(d.til) + ' (' + R.vent + ' dagers ventetid), én per regnr. ' + d.bestilt + ' bestilt, ' + d.ank + ' ankommet, ' + d.dropp + ' dropp, ' + d.pv + ' fortsatt på vei (holdt utenfor).\n'
      + (ars ? 'Årsak (siste ERP-status): ' + ars + '.\n' : '') + 'Per bestillingsuke: ' + ukeTxt;
    return '<div class="dial-card neutral nk-30" title="' + tip.replace(/"/g, '&quot;') + '"><div class="dial-label">Ankommet / leads</div>'
      + '<div class="dial-value" style="color:' + col + '">' + (a.pct == null ? '—' : String(a.pct).replace('.', ',')) + '<span style="font-size:14px;font-weight:600">%</span></div>'
      + '<div class="dial-unit">' + a.ank + ' ankommet / ' + a.leads + ' Peasy-leads · forrige 14 d ' + pTxt(b.pct) + ' (' + b.ank + '/' + b.leads + ')</div>'
      + '<div class="dial-sub">Mål ' + (MAL * 100) + ' % · ' + fd(a.fra) + '–' + fd(a.til) + '</div>'
      + '<div class="dial-sub nk-dropp" style="margin-top:4px">Dropp-off <b>' + pTxt(d.pct) + '</b>: ' + (d.ank + d.dropp) + ' bestilt → ' + d.ank + ' ankommet'
      + ' · hent ' + pTxt(d.hent.pct) + ' · lev ' + pTxt(d.lev.pct) + ' · forrige ' + pTxt(dp.pct)
      + '<br><span style="font-size:10px;color:#8A948F">Bestilt ' + fd(d.fra) + '–' + fd(d.til) + ', 7 d ventetid' + (d.pv ? ', ' + d.pv + ' på vei utenfor' : '') + '</span></div>'
      + '<div class="target-tag">14 d</div></div>';
  }
  var api = { beregn: beregn, kort: kort, MAL: MAL, VENT: VENT };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.ANKDROPP = api;
})(typeof window !== 'undefined' ? window : null);
