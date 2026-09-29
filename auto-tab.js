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

  // ── Poengsum øverst på hvert QA-kort ───────────────────────────────
  function auKortId(card) {
    var id = card.getAttribute('data-erpid') || '';
    if (!id) { var el = card.querySelector('[data-erpid]'); if (el) id = el.getAttribute('data-erpid') || ''; }
    return id;
  }
  // Nytt QA-kort: én statusboks (poeng, rute, hovedårsak), detaljer bak +, støy samlet.
  // Dagens bokser skjules (display:none), ingenting slettes. SEND øverst trykker den ekte SEND-knappen nederst.
  function auHovedarsak(b) {
    var st = (b.stopp || []).join(' | '), gr = (b.grunner || []).join(' | ');
    if (b.ville_sendt) return { t: 'Klar for auto-send', u: '' };
    if (/0 eksterne comps|kun kundens/.test(st)) return { t: 'Ingen sammenlignbare biler på Finn', u: 'Finn-utpris er kundens egen annonse × 0,95.' };
    if (/km-feil/.test(st)) return { t: 'Kilometerstanden stemmer ikke', u: (st.match(/km-feil[^|]*/) || [''])[0] };
    if (/PRIS MANUELT/.test(st)) return { t: 'Må prises manuelt', u: '' };
    if (/vrak/.test(st)) return { t: 'Vrak eller ikke kjørbar', u: '' };
    if (/AI svært uenige/.test(st)) return { t: 'Claude og Grok er svært uenige om Finn-utprisen', u: (st.match(/AI svært uenige[^|]*/) || [''])[0] };
    if (/always_qa|lav sikkerhet/.test(st)) return { t: 'Lav sikkerhet i Finn-utprisen', u: '' };
    var d = b.deler || {};
    var svakest = [['finn', d.finn / 40], ['celle', d.celle / 30], ['data', d.data / 20], ['erp', d.erp / 10]].sort(function (x, y) { return x[1] - y[1]; })[0][0];
    if (svakest === 'celle') { var c = gr.match(/celle ([^:]+): (\d+) bud/); return { t: 'Lite erfaring i denne prisklassen', u: c ? (c[2] + ' bud i cellen ' + c[1] + '.') : '' }; }
    if (svakest === 'finn') { var f = (b.grunner || []).filter(function (x) { return /AI uenige|solgte|utenfor|sammenligne/.test(x); }); return { t: 'Usikker Finn-utpris', u: f.join('. ') + (f.length ? '.' : '') }; }
    if (svakest === 'erp') return { t: 'ERP og QA-kortet har ulike tall', u: '' };
    return { t: 'Mangler data fra selger', u: (b.grunner || []).filter(function (x) { return /kommentar|km/.test(x); }).join('. ') };
  }
  function auKr(n) { return n == null ? '–' : Math.round(n).toLocaleString('nb-NO'); }
  var AU_STOY = [/^HEFT\b/, /^ORIGIN PÅ FINN/, /^⚠?\s*Finn-utpris kun fra kundens annonse/, /^0 SØSTRE/, /^B 0 COMPS/];
  function auRyddKort(c, info) {
    var barn = c.children;
    for (var i = 0; i < barn.length; i++) {
      var el = barn[i];
      if (el.classList.contains('au-qa-poeng') || el.getAttribute('data-au-skjult')) continue;
      var tx = (el.innerText || '').trim();
      for (var j = 0; j < AU_STOY.length; j++) {
        if (!AU_STOY[j].test(tx)) continue;
        if (j === 0) info.push('Pant registrert');
        if (j === 1) { var a = el.querySelector('a'); var pris = (tx.match(/([\d\s ]{5,}) kr/) || [])[1]; info.push('Origin på Finn' + (pris ? ' ' + pris.trim() + ' kr' : '') + (a ? ' · <a href="' + a.href + '" target="_blank" rel="noopener" style="color:#004225">Åpne</a>' : '')); }
        el.style.display = 'none'; el.setAttribute('data-au-skjult', '1');
        break;
      }
    }
  }
  function auHode(c, regnr) {
    var barn = c.children;
    for (var i = 0; i < barn.length; i++) {
      if (barn[i].classList.contains('au-qa-poeng')) continue;
      if ((barn[i].innerText || '').trim().indexOf(regnr) === 0) return barn[i];
    }
    return null;
  }
  function auMerkQaKort() {
    var d = window._autoRute;
    if (!d || !Array.isArray(d.biler)) return;
    var byId = {};
    d.biler.forEach(function (b) { byId[String(b.id)] = b; });
    var kort = document.querySelectorAll('#qa-cards .qa-card');
    for (var i = 0; i < kort.length; i++) {
      var c = kort[i], b = byId[auKortId(c)];
      var gammel = c.querySelector(':scope > .au-qa-poeng');
      if (!b) { if (gammel) gammel.remove(); continue; }
      var info = [];
      auRyddKort(c, info);
      if (info.length) c.setAttribute('data-au-info', JSON.stringify(info));
      var infoAlle = JSON.parse(c.getAttribute('data-au-info') || '[]');
      // Kostnadslinjen ved regnr ($ · kall · car.info) flyttes inn under detaljer
      var kost = c.getAttribute('data-au-kost') || '';
      if (!kost) {
        var hk = auHode(c, b.regnr);
        var spans = hk ? hk.querySelectorAll('*') : [];
        for (var k = 0; k < spans.length; k++) {
          var t = (spans[k].innerText || '').trim();
          if (/^\$[\d.]+ · \d+ kall/.test(t) && spans[k].children.length === 0) { kost = t; spans[k].style.display = 'none'; c.setAttribute('data-au-kost', kost); break; }
        }
      }
      // SEND øverst: gjør ekte knapp av merket, samme farge som SEND nederst
      var ekte = c.querySelector('.qa-send-btn');
      if (ekte && !c.querySelector('.au-send-topp')) {
        var hode = auHode(c, b.regnr);
        var merke = null;
        if (hode) { var alle = hode.querySelectorAll('*'); for (var m = 0; m < alle.length; m++) { var mt = (alle[m].innerText || '').trim(); if (/SEND$/.test(mt) && mt.length <= 10 && alle[m].tagName !== 'BUTTON' && !alle[m].querySelector('button')) { merke = alle[m]; break; } } }
        var kn = document.createElement('button');
        kn.type = 'button'; kn.className = 'au-send-topp';
        kn.textContent = (ekte.innerText || 'SEND').trim();
        var cs = getComputedStyle(ekte);
        kn.style.cssText = 'background:' + cs.backgroundColor + ';color:' + cs.color + ';border:0;border-radius:8px;padding:8px 16px;font-weight:700;font-size:14px;cursor:pointer;white-space:nowrap';
        kn.disabled = ekte.disabled;
        kn.addEventListener('click', function (e) { e.preventDefault(); var eb = this.closest('.qa-card').querySelector('.qa-send-btn'); if (eb && !eb.disabled) eb.click(); });
        if (merke) { merke.style.display = 'none'; merke.parentNode.insertBefore(kn, merke.nextSibling); }
        else if (hode) hode.appendChild(kn);
      }
      var topp = c.querySelector('.au-send-topp');
      if (topp && ekte) { topp.disabled = ekte.disabled; var et = (ekte.innerText || '').trim(); if (et && topp.textContent !== et) topp.textContent = et; }

      var nokkel = b.score + '|' + (b.stopp || []).join(';') + '|' + (b.grunner || []).join(';') + '|' + infoAlle.join(';') + '|' + kost;
      if (gammel && gammel.getAttribute('data-k') === nokkel) continue;
      var nivaa = b.score >= 80 ? 'g' : b.score < 50 ? 'r' : 'y';
      var farge = { g: '#004225', r: '#B8452F', y: '#8A6D10' }[nivaa];
      var bakgrunn = { g: '#E3EFE7', r: '#F8E6E1', y: '#FBF3D8' }[nivaa];
      var ha = auHovedarsak(b);
      var rute = b.ville_sendt ? 'AUTO' : ('QA · ' + Math.max(0, (d.grense || 80) - b.score) + ' POENG FRA AUTO');
      var fu = b.finn_utpris != null ? 'Finn-utpris <strong style="font-variant-numeric:tabular-nums">' + auKr(b.finn_utpris) + '</strong>' : '';
      var detaljer = (b.stopp || []).map(function (x) { return 'Stopp: ' + x; }).concat(b.grunner || []);
      if (kost) detaljer.push('Kostnad: ' + kost);
      var el2 = document.createElement('div');
      el2.className = 'au-qa-poeng';
      el2.setAttribute('data-k', nokkel);
      el2.style.cssText = 'margin:0 0 10px;display:grid;gap:8px';
      el2.innerHTML =
        '<div style="display:grid;grid-template-columns:auto 1fr;gap:12px;align-items:start;background:' + bakgrunn + ';border-radius:10px;padding:10px 12px">' +
          '<div style="display:grid;place-items:center;width:50px;height:50px;border-radius:50%;border:3px solid ' + farge + ';color:' + farge + ';font-weight:800;font-size:18px;font-variant-numeric:tabular-nums">' + b.score + '</div>' +
          '<div style="display:grid;gap:2px;color:#16201B;font-size:13.5px;line-height:1.4">' +
            '<span style="font-weight:700;font-size:11.5px;letter-spacing:.06em;color:' + farge + '">' + rute + '</span>' +
            '<b style="font-size:15px">' + esc(ha.t) + '</b>' +
            (ha.u || fu ? '<span>' + [esc(ha.u), fu].filter(Boolean).join(' ') + '</span>' : '') +
            '<details style="font-size:12.5px;color:#5E6B62;margin-top:2px"><summary style="cursor:pointer;color:#004225;font-weight:600;width:max-content">+ detaljer</summary>' +
              '<div style="display:flex;flex-wrap:wrap;gap:6px;margin:6px 0">' +
                [['Finn', b.deler.finn, 40], ['Celle', b.deler.celle, 30], ['Data', b.deler.data, 20], ['ERP = QA', b.deler.erp, 10]].map(function (x) {
                  return '<span style="background:#fff;border:1px solid #DCD8CC;border-radius:6px;padding:3px 8px"><span style="font-size:10.5px;text-transform:uppercase;letter-spacing:.06em">' + x[0] + '</span> <strong style="color:#16201B">' + x[1] + '/' + x[2] + '</strong></span>';
                }).join('') + '</div>' +
              (detaljer.length ? '<ul style="margin:0;padding-left:18px">' + detaljer.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>' : '') +
            '</details>' +
          '</div>' +
        '</div>' +
        (infoAlle.length ? '<div style="display:flex;flex-wrap:wrap;gap:4px 14px;font-size:12.5px;color:#5E6B62">' + infoAlle.map(function (x) { return '<span>' + x + '</span>'; }).join('') + '</div>' : '');
      if (gammel) gammel.replaceWith(el2); else c.insertBefore(el2, c.firstChild);
    }
  }
  setInterval(auMerkQaKort, 1500);

  // Hva kunden gjorde: status fra ERP og grunn (valg + egne ord). Oppdateres hvert 10. min på Mini.
  function auUtfall(x) {
    if (!x.ok) return '<span class="au-b au-qa">FEIL</span> ' + esc(x.feil || '');
    var u = x.utfall;
    if (!u) return '<span style="color:#5E6B62">Sendt · status hentes</span>';
    var avv = /avvist|utløpt/i.test(u.tekst), ok = /akseptert/i.test(u.tekst);
    var chip = '<span class="au-b" style="background:' + (avv ? '#F8E6E1;color:#B8452F' : ok ? '#004225;color:#fff' : '#F1E7C8;color:#6b5510') + '">' + esc(u.tekst) + '</span>';
    var grunn = u.ord ? '<div style="margin-top:3px">«' + esc(u.ord) + '»</div>' : '';
    if (u.valgt) grunn = '<div style="margin-top:3px;color:#5E6B62">' + esc(u.valgt) + '</div>' + grunn;
    return chip + grunn;
  }
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
          '<div id="au-sendt" style="display:none">' + (sendt.length ? '<table class="au-tbl"><tr><th>Tid</th><th></th><th class="au-r">Poeng</th><th>Bil</th><th>Arm</th><th class="au-r">ERP</th><th>Kunden</th></tr>' +
            sendt.map(function (x) {
              return '<tr><td class="au-m">' + tid(x.tid) + '</td><td>' + (x.ok ? '<span class="au-b au-ok">SENDT</span>' : '<span class="au-b au-qa">FEIL</span>') + '</td>' +
                '<td class="au-r au-s hi">' + x.score + '</td><td><b>' + esc(x.regnr) + '</b><div class="au-m">' + esc(x.bil || '') + '</div></td><td>' + esc(x.arm) + '</td>' +
                '<td class="au-r">' + k(x.erp_lav) + '–' + k(x.erp_hoy) + '</td><td class="au-w">' + auUtfall(x) + '</td></tr>';
            }).join('') + '</table>' : '<div class="au-m">Ingen ennå.</div>') + '</div></div>';
        h += fold('au-auto', 'Ville auto-sendt (' + hAuto + ')', hist.filter(function (b) { return b.ville_sendt; }), 'Ingen ennå.');
        h += fold('au-alle', 'Alle logget (' + hist.length + ') — første poengsum per bil, sammenlignes med budet', hist, 'Tom ennå.');
        body.innerHTML = h;
      })
      .catch(function (e) { body.innerHTML = '<div class="au-m">Fikk ikke lest auto-score.json (' + esc(e.message) + ').</div>'; });
  };
})();
