/* Peasy Pulse — Auto-fane (skygge). Leser auto-score.json (Mini: auto-score.js). Sender ingenting. */
(function () {
  if (!document.getElementById('au-fold-css')) {
    var st = document.createElement('style'); st.id = 'au-fold-css';
    st.textContent = '#auto-section .au-fold{cursor:pointer;user-select:none}' +
      '#auto-section .au-pl{display:inline-block;width:22px;height:22px;line-height:20px;text-align:center;border:1px solid #004225;border-radius:6px;color:#004225;font-weight:700;margin-right:6px}';
    document.head.appendChild(st);
  }
  function nb(n) { return n == null ? '–' : Math.round(n).toLocaleString('nb-NO'); }
  function k(n) { return n == null ? '–' : Math.round(n / 1000) + 'k'; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function tid(iso) { if (!iso) return ''; var d = new Date(iso); return d.toLocaleString('nb-NO', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }); }
  function badge(b) {
    return b.ville_sendt
      ? '<span class="au-b au-ok">AUTO</span>'
      : '<span class="au-b au-qa">QA</span>';
  }
  function hvorfor(b) {
    var s = (b.stopp || []).map(function (x) { return '<b>' + esc(x) + '</b>'; });
    return s.concat((b.grunner || []).map(esc)).join(' · ') || '—';
  }
  function rad(b, medTid) {
    return '<tr>' + (medTid ? '<td class="au-m">' + tid(b.tid) + (b.etterpaa ? '<br>etterpå' : '') + '</td>' : '') +
      '<td>' + badge(b) + '</td>' +
      '<td class="au-r au-s' + (b.score >= 80 ? ' hi' : b.score < 50 ? ' lo' : '') + '">' + b.score + '</td>' +
      '<td><b>' + esc(b.regnr) + '</b><div class="au-m">' + esc(b.bil || '') + '</div></td>' +
      '<td>' + esc(b.arm) + '</td>' +
      '<td class="au-r">' + k(b.erp_lav) + '–' + k(b.erp_hoy) + '</td>' +
      (medTid ? '' : '<td class="au-m">finn ' + b.deler.finn + '/40 · celle ' + b.deler.celle + '/30 · data ' + b.deler.data + '/20 · erp ' + b.deler.erp + '/10</td>') +
      '<td class="au-w">' + hvorfor(b) + '</td></tr>';
  }
  // ── Fordeling til QA send ──────────────────────────────────────────
  // QA send viser en bil bare når boten har rutet den til «qa». «vurderes», «auto» og «sendt» skjules.
  // Er auto-score.json eldre enn 15 min (boten står), vises alt som før.
  var AU_STALE_MS = 15 * 60000;
  window._autoRute = null;
  function auRuteFersk() {
    var d = window._autoRute;
    return !!(d && d.ruter && d.bygget && (Date.now() - Date.parse(d.bygget)) < AU_STALE_MS);
  }
  window.qaAutoSkjul = function (b) {
    if (!auRuteFersk() || !b) return false;
    var id = b.id != null ? String(b.id) : '';
    if (!id) return false;
    var r = window._autoRute.ruter[id];
    if (r === 'qa') return false;
    return true; // vurderes / auto / sendt, eller ny bil boten ikke har rutet ennå

  };
  window.qaAutoTelling = function (biler) {
    var t = { vurderes: 0, auto: 0 };
    if (!auRuteFersk()) return t;
    (biler || []).forEach(function (b) { var r = window._autoRute.ruter[String(b.id)]; if (r === 'vurderes' || r == null) t.vurderes++; else if (r === 'auto' || r === 'sendt') t.auto++; });
    return t;
  };
  // Last QA på nytt bare når QA-fanen er åpen og ingen skriver i et felt der (ikke forstyrr QA-arbeid).
  function auKanLasteQA() {
    var sec = document.getElementById('qa-section');
    if (!sec || sec.style.display === 'none') return false;
    var a = document.activeElement;
    return !(a && sec.contains(a) && /INPUT|TEXTAREA|SELECT/.test(a.tagName));
  }
  function auHentRuter(forste) {
    fetch('auto-score.json?t=' + Date.now(), { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        if (!d) return;
        var endret = !window._autoRute || JSON.stringify(window._autoRute.ruter) !== JSON.stringify(d.ruter);
        window._autoRute = d;
        if (endret || forste) { try { if (typeof window.refreshListe3 === 'function') window.refreshListe3(); } catch (e) {} if (auKanLasteQA()) { try { if (typeof window.loadQA === 'function') window.loadQA(true); } catch (e) {} } }
      }).catch(function () {});
  }
  auHentRuter(true);
  setInterval(auHentRuter, 30000);

  window.auToggle = function (id) {
    var el = document.getElementById(id), pl = document.getElementById(id + '-pl');
    if (!el) return;
    var open = el.style.display === 'none';
    el.style.display = open ? 'block' : 'none';
    if (pl) pl.textContent = open ? '−' : '+';
  };
  window.loadAuto = function () {
    var body = document.getElementById('auto-body');
    if (!body) return;
    body.innerHTML = '<div class="au-m">Laster …</div>';
    fetch('auto-score.json?t=' + Date.now()).then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function (d) {
        var hist = d.historikk || [];
        var hAuto = hist.filter(function (b) { return b.ville_sendt; }).length;
        var h = '';
        h += '<div class="au-kpis">' +
          '<div class="au-kpi"><div class="au-kl">På liste 3 nå</div><div class="au-kv">' + d.antall + '</div></div>' +
          '<div class="au-kpi"><div class="au-kl">Ville auto-sendt nå</div><div class="au-kv g">' + d.ville_sendt + '</div></div>' +
          '<div class="au-kpi"><div class="au-kl">Logget totalt</div><div class="au-kv">' + hist.length + '</div></div>' +
          '<div class="au-kpi"><div class="au-kl">Ville auto-sendt, logget</div><div class="au-kv g">' + hAuto + '</div><div class="au-m">' + (hist.length ? Math.round(hAuto / hist.length * 100) : 0) + ' %</div></div>' +
          '</div>';
        h += '<div class="au-card"><div class="au-ct">Liste 3 nå</div><div class="au-m">Oppdatert ' + tid(d.bygget) + ' · grense ' + d.grense + ' poeng og ingen stopp</div>' +
          (d.biler.length ? '<table class="au-tbl"><tr><th></th><th class="au-r">Poeng</th><th>Bil</th><th>Arm</th><th class="au-r">ERP</th><th>Deler</th><th>Hvorfor</th></tr>' +
            d.biler.map(function (b) { return rad(b, false); }).join('') + '</table>' : '<div class="au-m">Ingen biler på liste 3.</div>') + '</div>';
        var HODE = '<tr><th>Tid</th><th></th><th class="au-r">Poeng</th><th>Bil</th><th>Arm</th><th class="au-r">ERP</th><th>Hvorfor</th></tr>';
        function fold(id, tittel, liste, tom) {
          return '<div class="au-card"><div class="au-ct au-fold" onclick="auToggle(\'' + id + '\')"><span class="au-pl" id="' + id + '-pl">+</span> ' + tittel + '</div>' +
            '<div id="' + id + '" style="display:none">' +
            (liste.length ? '<table class="au-tbl">' + HODE + liste.map(function (b) { return rad(b, true); }).join('') + '</table>' : '<div class="au-m">' + tom + '</div>') +
            '</div></div>';
        }
        var sendt = (d.auto_sendt || []);
        var ok = sendt.filter(function (x) { return x.ok; });
        h = '<div class="au-card" style="border-left:4px solid ' + (d.auto_send_paa ? '#004225' : '#C9A227') + '"><b>' +
          (d.auto_send_paa ? 'AUTO-SEND ER PÅ' : 'SKYGGE — auto-send er av') + '</b> <span class="au-m">· ' + ok.length + ' sendt automatisk totalt · maks 10 per dag</span></div>' + h;
        h += '<div class="au-card"><div class="au-ct au-fold" onclick="auToggle(\'au-sendt\')"><span class="au-pl" id="au-sendt-pl">+</span> Auto-sendt (' + ok.length + ')</div>' +
          '<div id="au-sendt" style="display:none">' + (sendt.length ? '<table class="au-tbl"><tr><th>Tid</th><th></th><th class="au-r">Poeng</th><th>Bil</th><th>Arm</th><th class="au-r">ERP</th><th>Status</th></tr>' +
            sendt.map(function (x) {
              return '<tr><td class="au-m">' + tid(x.tid) + '</td><td>' + (x.ok ? '<span class="au-b au-ok">SENDT</span>' : '<span class="au-b au-qa">FEIL</span>') + '</td>' +
                '<td class="au-r au-s hi">' + x.score + '</td><td><b>' + esc(x.regnr) + '</b><div class="au-m">' + esc(x.bil || '') + '</div></td><td>' + esc(x.arm) + '</td>' +
                '<td class="au-r">' + k(x.erp_lav) + '–' + k(x.erp_hoy) + '</td><td class="au-w">' + (x.ok ? 'Sendt til kunde' : esc(x.feil || '')) + '</td></tr>';
            }).join('') + '</table>' : '<div class="au-m">Ingen ennå.</div>') + '</div></div>';
        h += fold('au-auto', 'Ville auto-sendt (' + hAuto + ')', hist.filter(function (b) { return b.ville_sendt; }), 'Ingen ennå.');
        h += fold('au-alle', 'Alle logget (' + hist.length + ') — første poengsum per bil, sammenlignes med budet', hist, 'Tom ennå.');
        body.innerHTML = h;
      })
      .catch(function (e) { body.innerHTML = '<div class="au-m">Fikk ikke lest auto-score.json (' + esc(e.message) + ').</div>'; });
  };
})();
