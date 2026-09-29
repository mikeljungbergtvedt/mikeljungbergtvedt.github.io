/* Peasy Pulse — «Bud mot fossefall» i Scoreboard. Leser bud-fossefall.json (Mini: bud-fossefall.js). Bare visning. */
(function () {
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function kr(n) { return n == null ? '–' : Math.round(n).toLocaleString('nb-NO'); }
  function pst(x) { return x == null ? '–' : (x > 0 ? '+' : '') + Math.round(x * 100) + ' %'; }
  function farge(x) { if (x == null) return '#5E6B62'; var a = Math.abs(x); return a <= 0.1 ? '#004225' : a <= 0.25 ? '#8A6D10' : '#B8452F'; }
  var GRUPPE = { sterk: 'Sterk Finn-utpris', middels: 'Middels', svak: 'Svak Finn-utpris', ukjent: 'Ukjent (eldre biler)' };
  var visAlle = false, data = null;

  if (!document.getElementById('bf-css')) {
    var st = document.createElement('style'); st.id = 'bf-css';
    st.textContent = '#bf-section{margin-top:22px}#bf-section h2{font-size:18px;color:#004225;margin:0 0 4px}' +
      '#bf-section .bf-sub{color:#5E6B62;font-size:12.5px;margin:0 0 12px;max-width:80ch}' +
      '#bf-section .bf-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:10px;margin-bottom:12px}' +
      '#bf-section .bf-kpi{background:#fff;border:1px solid #DCD8CC;border-radius:10px;padding:12px 14px}' +
      '#bf-section .bf-kl{font-size:10.5px;letter-spacing:.08em;text-transform:uppercase;color:#5E6B62;font-weight:600}' +
      '#bf-section .bf-kv{font-size:26px;font-weight:700;font-variant-numeric:tabular-nums}' +
      '#bf-section .bf-kd{font-size:12px;color:#5E6B62}' +
      '#bf-section .bf-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px}@media(max-width:820px){#bf-section .bf-grid{grid-template-columns:1fr}}' +
      '#bf-section .bf-card{background:#fff;border:1px solid #DCD8CC;border-radius:10px;padding:12px 14px;overflow-x:auto}' +
      '#bf-section .bf-ct{font-weight:700;font-size:14px}#bf-section .bf-cn{color:#5E6B62;font-size:12px;margin:2px 0 6px}' +
      '#bf-section table{border-collapse:collapse;width:100%;font-size:12.5px}' +
      '#bf-section th{text-align:left;font-size:10.5px;letter-spacing:.06em;text-transform:uppercase;color:#5E6B62;padding:6px 8px;border-bottom:1px solid #DCD8CC;white-space:nowrap}' +
      '#bf-section td{padding:6px 8px;border-bottom:1px solid #EEE9DD;vertical-align:top}' +
      '#bf-section .r{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}' +
      '#bf-section .chip{display:inline-block;font-size:10.5px;font-weight:700;padding:2px 7px;border-radius:99px;background:#F1EFE7;color:#5E6B62}' +
      '#bf-section .chip.live{background:#004225;color:#fff}' +
      '#bf-section .mer{margin-top:8px;background:none;border:1px solid #004225;color:#004225;border-radius:6px;padding:5px 10px;font-weight:600;cursor:pointer}';
    document.head.appendChild(st);
  }

  function tegn() {
    var sec = document.getElementById('score-section'); if (!sec || !data) return;
    var el = document.getElementById('bf-section');
    if (!el) { el = document.createElement('div'); el.id = 'bf-section'; sec.appendChild(el); }
    var t = data.totalt || {}, g = data.grupper || {};
    var h = '<h2>Bud mot fossefall</h2>' +
      '<div class="bf-sub">Kjeden Finn-utpris → fossefall → estimert AR-bud → faktisk AR-bud. Avvik = faktisk AR-bud mot estimert AR-bud. ' +
      '<b>Live</b> = priset av fossefallet. <b>Tilbakeregnet</b> = eldre bil, Finn-utprisen den hadde kjørt gjennom dagens tabeller. ' +
      'Oppdatert ' + esc(new Date(data.bygget).toLocaleString('nb-NO', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })) + '.</div>';
    h += '<div class="bf-kpis">' +
      '<div class="bf-kpi"><div class="bf-kl">Biler med AR-bud</div><div class="bf-kv">' + (t.n || 0) + '</div><div class="bf-kd">' + (t.live || 0) + ' live · ' + (t.tilbakeregnet || 0) + ' tilbakeregnet</div></div>' +
      '<div class="bf-kpi"><div class="bf-kl">Median avvik AR-bud</div><div class="bf-kv" style="color:' + farge(t.median_avvik) + '">' + pst(t.median_avvik) + '</div><div class="bf-kd">halvparten mellom ' + pst(t.p25) + ' og ' + pst(t.p75) + '</div></div>' +
      '<div class="bf-kpi"><div class="bf-kl">Peasy-bud over lav</div><div class="bf-kv">' + (t.n_estimat ? Math.round(t.over_lav / t.n_estimat * 100) + ' %' : '–') + '</div><div class="bf-kd">' + (t.over_lav || 0) + ' av ' + (t.n_estimat || 0) + ' med estimat</div></div>' +
      '<div class="bf-kpi"><div class="bf-kl">Sterk Finn-utpris</div><div class="bf-kv" style="color:' + farge(g.sterk && g.sterk.median_avvik) + '">' + pst(g.sterk && g.sterk.median_avvik) + '</div><div class="bf-kd">median avvik · ' + ((g.sterk && g.sterk.n) || 0) + ' biler</div></div>' +
      '</div>';
    h += '<div class="bf-grid">';
    h += '<div class="bf-card"><div class="bf-ct">Etter Finn-utprisens kvalitet</div><div class="bf-cn">Større avvik eller spredning i «svak» enn i «sterk» betyr at feilen kommer fra Finn-utprisen.</div><table><tr><th>Finn-utpris</th><th class="r">Biler</th><th class="r">Median</th><th class="r">Halvparten mellom</th></tr>' +
      ['sterk', 'middels', 'svak', 'ukjent'].map(function (k) { var o = g[k] || {}; return o.n ? '<tr><td>' + GRUPPE[k] + '</td><td class="r">' + o.n + '</td><td class="r" style="color:' + farge(o.median_avvik) + ';font-weight:700">' + pst(o.median_avvik) + '</td><td class="r">' + pst(o.p25) + ' – ' + pst(o.p75) + '</td></tr>' : ''; }).join('') + '</table></div>';
    h += '<div class="bf-card"><div class="bf-ct">Etter tabellcelle</div><div class="bf-cn">Bommer alle bilene i én celle i samme retning, er det tabellen (margin/takst) som bør justeres.</div><table><tr><th>Celle</th><th class="r">Biler</th><th class="r">Median</th><th class="r">Halvparten mellom</th></tr>' +
      (data.celler || []).map(function (c) { return '<tr><td>' + esc(c.celle) + '</td><td class="r">' + c.n + '</td><td class="r" style="color:' + farge(c.median_avvik) + ';font-weight:700">' + pst(c.median_avvik) + '</td><td class="r">' + pst(c.p25) + ' – ' + pst(c.p75) + '</td></tr>'; }).join('') + '</table></div>';
    h += '</div>';
    var biler = data.biler || [], vis = visAlle ? biler : biler.slice(0, 40);
    h += '<div class="bf-card"><div class="bf-ct">Bil for bil</div><div class="bf-cn">Nyeste først. GB = GB-fanens Finn-trente anslag, når GB har regnet på bilen.</div>' +
      '<table><tr><th>Bil</th><th></th><th class="r">Finn-utpris</th><th class="r">Estimert AR-bud</th><th class="r">Faktisk AR-bud</th><th class="r">Avvik</th><th class="r">Estimat → Peasy-bud</th><th>Finn-kilde</th><th class="r">GB</th></tr>' +
      vis.map(function (b) {
        return '<tr><td><b>' + esc(b.regnr) + '</b> <span style="color:#5E6B62">' + esc(b.id) + '</span><div style="color:#5E6B62;font-size:11.5px">' + esc(b.bil || '') + (b.km ? ' · ' + kr(b.km) + ' km' : '') + ' · ' + esc(b.celle || '') + '</div></td>' +
          '<td><span class="chip ' + (b.modus === 'live' ? 'live' : '') + '">' + (b.modus === 'live' ? 'LIVE' : 'TILBAKE') + '</span></td>' +
          '<td class="r">' + kr(b.finn_utpris) + (b.finn_felt && b.finn_felt.status === 200 ? ' <span title="Lagret i ERP-feltet" style="color:#004225">✓</span>' : '') + '</td>' +
          '<td class="r">' + kr(b.ar_bud_est) + '</td><td class="r"><b>' + kr(b.ar_bud) + '</b></td>' +
          '<td class="r" style="color:' + farge(b.avvik) + ';font-weight:700">' + pst(b.avvik) + '</td>' +
          '<td class="r">' + (b.estimat_lav ? kr(b.estimat_lav) + '–' + kr(b.estimat_hoy) : '–') + ' → ' + kr(b.peasy_bud) + (b.over_lav === true ? ' <span style="color:#004225">✓</span>' : b.over_lav === false ? ' <span style="color:#B8452F">✗</span>' : '') + '</td>' +
          '<td>' + esc(GRUPPE[b.finn_gruppe] || b.finn_gruppe) + '<div style="color:#5E6B62;font-size:11.5px">' + esc(b.finn_grunn || '') + '</div></td>' +
          '<td class="r">' + (b.gb ? kr(b.gb) + '<div style="color:#5E6B62;font-size:11.5px">' + pst(b.gb_avvik) + ' mot Finn</div>' : '–') + '</td></tr>';
      }).join('') + '</table>' +
      (biler.length > 40 ? '<button type="button" class="mer" onclick="window.bfVisAlle()">' + (visAlle ? '− Vis 40' : '+ Vis alle ' + biler.length) + '</button>' : '') + '</div>';
    el.innerHTML = h;
  }
  window.bfVisAlle = function () { visAlle = !visAlle; tegn(); };
  function hent() {
    fetch('bud-fossefall.json?t=' + Date.now(), { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) { if (d) { data = d; tegn(); } }).catch(function () {});
  }
  // Tegn når Scoreboard er åpen; hent på nytt hvert 10. minutt.
  setInterval(function () {
    var sec = document.getElementById('score-section');
    if (sec && sec.style.display !== 'none' && !document.getElementById('bf-section')) { if (data) tegn(); else hent(); }
  }, 1000);
  hent(); setInterval(hent, 600000);
})();
