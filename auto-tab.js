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
  function auQaUtAvTakt(ruter) {
    var vist = {};
    document.querySelectorAll('#qa-cards .qa-card').forEach(function (c) { var id = auKortId(c); if (id) vist[id] = 1; });
    for (var id in vist) if (ruter[id] && ruter[id] !== 'qa') return true;
    var iListe3 = (window._qaList3Raw || []).map(function (b) { return String(b.id || b.erpId || ''); });
    for (var k in ruter) if (ruter[k] === 'qa' && !vist[k] && iListe3.indexOf(k) >= 0) return true;
    return false;
  }
  function auHentRuter(forste) {
    var miniUrl = window.PA_PROXY_ERP && window.PA_TOKEN_ERP ? window.PA_PROXY_ERP.replace(/\/list\/$/, '/auto-score') + '?t=' + encodeURIComponent(window.PA_TOKEN_ERP) + '&x=' + Date.now() : null;
    var hent = function (u) { return fetch(u, { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : null; }); };
    (miniUrl ? hent(miniUrl).catch(function () { return null; }).then(function (d) { return d || hent('auto-score.json?t=' + Date.now()); }) : hent('auto-score.json?t=' + Date.now()))
      .then(function (d) {
        if (!d) return;
        var endret = !window._autoRute || JSON.stringify(window._autoRute.ruter) !== JSON.stringify(d.ruter);
        window._autoRute = d;
        if (endret || forste) {
          try { if (typeof window.refreshListe3 === 'function') window.refreshListe3(); } catch (e) {}
          // c507: last QA på nytt bare når kortene som vises ikke lenger stemmer med rutene (ny QA-bil, eller en vist bil er
          // ikke QA lenger). En bil som nettopp er sendt, er allerede borte fra skjermen, så da blinker ingenting.
          if (auKanLasteQA() && (forste || auQaUtAvTakt(d.ruter))) { try { if (typeof window.loadQA === 'function') window.loadQA(true); } catch (e) {} }
          else { try { auMerkQaKort(); } catch (e) {} }
        }
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
  // Finner selgerkommentar og ERP-historikk på kortet (boksene lages av QA-kortet i peasy-pulse.html).
  function auMerker(c) {
    var ut = [], fant = {};
    var alle = c.querySelectorAll('div');
    for (var i = 0; i < alle.length; i++) {
      var el = alle[i];
      if (el.closest('.au-qa-poeng')) continue;
      var tx = (el.innerText || '').trim();
      if (!fant.k && /^Selgerkommentar/.test(tx) && el.children.length <= 3) {
        fant.k = 1; ut.push({ t: '💬 Selgerkommentar', tittel: tx.replace(/^Selgerkommentar[^:]*:?\s*/, '').slice(0, 300), el: el });
      }
      var m = !fant.h && tx.match(/^ERP-historikk \((\d+) tidligere\)/);
      if (m) { fant.h = 1; ut.push({ t: '↺ Priset før (' + m[1] + ')', tittel: 'Bilen har vært hos oss før. Klikk for historikken.', el: el }); }
    }
    return ut;
  }
  // c537: nytt QA-kort i Unbox-stil (Mike 13.10). Bare det som trengs for å bestemme: bilen, bildene, hva kunden skriver,
  // estimatet, auto/skygge/CC og de nærmeste like bilene fra car.info. Det gamle kortet ligger bak «Vis alt», så alle knapper virker som før.
  function auNyCss() {
    if (document.getElementById('au-ny-css')) return;
    var l = document.createElement('link'); l.rel = 'stylesheet'; l.href = 'https://fonts.googleapis.com/css2?family=Inter+Tight:wght@400;500;600;700;800&display=swap'; document.head.appendChild(l);
    var s = document.createElement('style'); s.id = 'au-ny-css';
    s.textContent =
      '.qa-card.au-ny-modus:not(.au-vis-alt)>:not(.au-ny){display:none!important}.qa-card.au-ny-modus:not(.au-vis-alt) .qa-send-btn{display:none!important}' +
      '.au-ny{font-family:"Inter Tight",-apple-system,Helvetica,Arial,sans-serif;color:#16201B;display:grid;gap:14px;margin-bottom:12px}' +
      '.au-ny-hode{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}' +
      '.au-ny-navn{font-weight:700;font-size:18px;line-height:1.25}.au-ny-meta{color:#5E6B62;font-size:13.5px;margin-top:3px;font-variant-numeric:tabular-nums}' +
      '.au-ny-arm{display:inline-block;font-size:11px;font-weight:700;letter-spacing:.06em;border:1px solid #DCE1D9;border-radius:5px;padding:0 6px;color:#5E6B62}' +
      '.au-ny-galleri{display:flex;gap:8px;overflow-x:auto;scroll-snap-type:x mandatory;padding-bottom:4px}' +
      '.au-ny-galleri a{flex:0 0 auto;scroll-snap-align:start}.au-ny-galleri img{height:150px;width:auto;max-width:240px;object-fit:cover;border-radius:10px;display:block;background:#E7EBE4}' +
      '.au-ny-liten{font-size:12px;color:#8A6D10}' +
      '.au-ny-kunde{background:#F7F4EE;border-radius:12px;padding:12px 14px}.au-ny-kunde p{margin:4px 0 0;font-size:16px;line-height:1.45;font-weight:500}' +
      '.au-ny-etikett{font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#5E6B62}.au-ny-dempet{color:#8C978F;font-weight:400}' +
      '.au-ny-estimat{font-size:clamp(22px,7vw,30px);font-weight:800;color:#004225;letter-spacing:-.01em;font-variant-numeric:tabular-nums;white-space:nowrap}' +
      '.au-ny-under{color:#5E6B62;font-size:13px}' +
      '.au-ny-kilder{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}' +
      '.au-ny-kilde{border:1px solid #DCE1D9;border-radius:10px;padding:8px 10px;display:grid;gap:2px}.au-ny-kilde span{font-size:12px;color:#5E6B62}.au-ny-kilde b{font-size:18px;font-variant-numeric:tabular-nums}' +
      '.au-ny-kilde.valgt{border-color:#004225;background:#E6F0EA}' +
      '.au-ny-bruk{justify-self:start;margin-top:2px;font:600 12px inherit;font-family:inherit;color:#004225;background:none;border:1px solid #004225;border-radius:6px;padding:1px 8px;cursor:pointer}' +
      '.au-ny-enig{font-size:13px;color:#5E6B62}.au-ny-enig.uenig{color:#8A4B12}' +
      '.au-ny-tv table{width:100%;border-collapse:collapse;font-size:14px;font-variant-numeric:tabular-nums;margin-top:4px}.au-ny-tv td{padding:6px 0;border-top:1px solid #E7EBE4}.au-ny-tv td.h{text-align:right}.au-ny-tv a{color:#004225}' +
      '.au-ny-solgt{font-size:11px;font-weight:700;color:#004225;background:#E6F0EA;border-radius:4px;padding:1px 6px}.au-ny-ask{font-size:11px;color:#5E6B62;border:1px solid #DCE1D9;border-radius:4px;padding:0 6px}' +
      '.au-ny-knapper{display:grid;grid-template-columns:1fr auto auto;gap:8px}' +
      '.au-ny-send{background:#F6C744;color:#16201B;border:0;border-radius:10px;padding:13px 14px;font:700 15px inherit;font-family:inherit;cursor:pointer}.au-ny-send:disabled{opacity:.45;cursor:not-allowed}' +
      '.au-ny-sek{background:#fff;border:1px solid #DCE1D9;color:#16201B;border-radius:10px;padding:0 14px;font:600 14px inherit;font-family:inherit;cursor:pointer}';
    document.head.appendChild(s);
  }
  // c540: QA-kort for FSD (Grok) + Benchmark (Claude), etter Mikes oppsett 13.10: identitet, to priser, flagg, tvillinger med lenker,
  // forkastet, begrunnelse. Bare data fra modellenes JSON (auto-score.json b.agent). Det gamle kortet ligger bak «Vis alt».
  // c545: bildevisning i siden (ikke ny fane). Piler, Esc og klikk utenfor lukker.
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a.au-lb');
    if (!a) return;
    e.preventDefault();
    var liste = []; try { liste = JSON.parse(a.getAttribute('data-bilder') || '[]'); } catch (_) {}
    var ix = Number(a.getAttribute('data-ix')) || 0;
    var o = document.createElement('div');
    o.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.88);z-index:99999;display:flex;align-items:center;justify-content:center';
    var img = document.createElement('img'); img.style.cssText = 'max-width:92vw;max-height:86vh;object-fit:contain';
    var nr = document.createElement('div'); nr.style.cssText = 'position:absolute;top:14px;left:0;right:0;text-align:center;color:#fff;font:14px -apple-system,Helvetica,Arial,sans-serif';
    var knapp = function (t, css) { var k = document.createElement('button'); k.type = 'button'; k.textContent = t; k.style.cssText = 'position:absolute;background:rgba(255,255,255,.15);color:#fff;border:0;border-radius:4px;font-size:28px;width:48px;height:48px;cursor:pointer;' + css; return k; };
    var forr = knapp('‹', 'left:12px;top:50%;transform:translateY(-50%)'), nest = knapp('›', 'right:12px;top:50%;transform:translateY(-50%)'), lukk = knapp('×', 'right:12px;top:12px');
    var vis = function (d) { ix = (ix + d + liste.length) % liste.length; img.src = liste[ix]; nr.textContent = (ix + 1) + ' / ' + liste.length; };
    var steng = function () { document.removeEventListener('keydown', tast); o.remove(); };
    var tast = function (ev) { if (ev.key === 'Escape') steng(); else if (ev.key === 'ArrowLeft') vis(-1); else if (ev.key === 'ArrowRight') vis(1); };
    forr.onclick = function (ev) { ev.stopPropagation(); vis(-1); }; nest.onclick = function (ev) { ev.stopPropagation(); vis(1); }; lukk.onclick = steng;
    o.onclick = function (ev) { if (ev.target === o) steng(); };
    o.append(img, nr, lukk); if (liste.length > 1) o.append(forr, nest);
    var x0 = null;
    o.addEventListener('touchstart', function (ev) { x0 = ev.touches[0].clientX; }, { passive: true });
    o.addEventListener('touchend', function (ev) { if (x0 == null) return; var dx = ev.changedTouches[0].clientX - x0; x0 = null; if (Math.abs(dx) > 40) vis(dx < 0 ? 1 : -1); }, { passive: true });
    document.body.style.overflow = 'hidden';
    var stengGml = steng; steng = function () { document.body.style.overflow = ''; stengGml(); };
    lukk.onclick = steng; o.onclick = function (ev) { if (ev.target === o) steng(); };
    document.body.appendChild(o); document.addEventListener('keydown', tast); vis(0);
  });
  // c551: QA-kortet etter Mikes designmanual 13.10 (mobil først, 5 nummererte seksjoner, sticky topp/bunn, kvittering av røde varsler).
  function qkCss() {
    if (document.getElementById('qk-css')) return;
    var s = document.createElement('style'); s.id = 'qk-css';
    s.textContent = [
      '#qa-cards{grid-template-columns:minmax(0,720px)!important;justify-content:center!important}',
      '.qa-card.au-ny-modus{padding:0!important;max-width:720px;width:100%;box-sizing:border-box}',
      '.qa-card.au-ny-modus>:not(.au-ny){display:none!important}',
      '.qk{font-family:-apple-system,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.45;color:#16201B;font-variant-numeric:tabular-nums;border-radius:12px;background:#fff;overflow:clip}',
      '.qk *{box-sizing:border-box}',
      '.qk-topp{position:sticky;top:0;z-index:5;background:#fff;border-bottom:1px solid #e3e7e4;padding:10px 16px;display:flex;gap:10px;align-items:center;justify-content:space-between}',
      '.qk-topp b{font-size:15px}.qk-topp .qk-meta{font-size:12px;color:#6b756f}.qk-spor{flex:0 0 auto;font-size:12px;color:#004225;border:1px solid #004225;border-radius:12px;padding:2px 10px;white-space:nowrap}',
      '.qk-innhold{padding:12px 16px;display:grid;grid-template-columns:minmax(0,1fr);gap:12px}',
      '.qk-sek h3{margin:0;font-size:15px;font-weight:700}.qk-hjelp{margin:0 0 8px;font-size:12px;color:#6b756f}',
      '.qk-bilder{display:flex;gap:6px;overflow-x:auto;-webkit-overflow-scrolling:touch}.qk-bilder a{flex:0 0 auto;display:block;min-width:44px;min-height:44px}.qk-bilder img{height:80px;width:auto;border-radius:6px;display:block}',
      '.qk-kommentar{background:#f2f4f2;border-radius:8px;padding:10px 12px;margin-top:8px}.qk-tom{color:#5a635d}',
      '.qk-varsel{display:flex;gap:10px;align-items:center;min-height:44px;padding:6px 0;border-bottom:1px solid #eef0ee;font-size:14px}',
      '.qk-varsel .qk-tekst{flex:1;min-width:0;overflow-wrap:anywhere}.qk-varsel.rod .qk-tekst{color:#c62828;font-weight:600}',
      '.qk-varsel label{flex:0 0 auto;display:flex;align-items:center;gap:6px;min-height:44px;min-width:44px;font-size:12px;color:#6b756f;cursor:pointer}.qk-varsel input{width:22px;height:22px;accent-color:#004225}',
      '.qk-priser{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}',
      '.qk-pris{border:1px solid #d5dad6;border-radius:12px;padding:10px 12px}.qk-pris.fsd{border:2px solid #004225}.qk-pris span{display:block;font-size:12px;color:#6b756f}.qk-pris b{display:block;font-size:26px;font-weight:700;white-space:nowrap}.qk-pris.fsd b{color:#004225}',
      '.qk-avvik{font-size:14px;margin-top:6px}.qk-avvik.rod{color:#c62828;font-weight:600}',
      '.qk-tab{width:100%;border-collapse:collapse;font-size:13px}.qk-tab th{text-align:left;font-size:12px;color:#6b756f;font-weight:600;padding:4px 6px 4px 0;border-bottom:1px solid #e3e7e4}',
      '.qk-tabwrap{overflow-x:auto}.qk-tab td{padding:0 6px 0 0;height:44px;border-bottom:1px solid #eef0ee}.qk-tab td.h,.qk-tab td:first-child{white-space:nowrap}.qk-tab .ik{font-size:11px;color:#6b756f;white-space:normal}.qk-tab .h{text-align:right}.qk-tab tr.en td{background:#fff8dc}.qk-tab a{color:#004225;display:inline-block;min-height:44px;line-height:44px}',
      '@media (max-width:400px){.qk-tab .aar{display:none}}',
      '.qk-fork summary{cursor:pointer;min-height:44px;line-height:44px;color:#004225;font-size:14px}.qk-fork ul{margin:0;padding-left:18px;font-size:13px;color:#6b756f}.qk-fork a{color:#6b756f}',
      '.qk-ff{width:100%;border-collapse:collapse;font-size:14px}.qk-ff td{padding:5px 0}.qk-ff td.h{text-align:right;white-space:nowrap}.qk-ff tr.sum td{font-weight:700;border-top:1px solid #16201B}',
      '.qk-kunde{display:flex;justify-content:space-between;align-items:baseline;gap:8px;margin-top:8px;padding-top:8px;border-top:2px solid #004225}.qk-kunde span{font-size:14px}.qk-kunde b{font-size:24px;color:#004225;white-space:nowrap}',
      '.qk-spor3{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-top:10px}.qk-spor3 div{border:1px solid #d5dad6;border-radius:12px;padding:8px}.qk-spor3 div.aktiv{border:2px solid #004225}',
      '.qk-spor3 b{display:block;font-size:17px;white-space:nowrap}.qk-spor3 span{display:block;font-size:12px;color:#6b756f}',
      '.qk-bunn{position:sticky;bottom:0;z-index:5;background:#fff;border-top:1px solid #e3e7e4;padding:10px 16px;display:grid;grid-template-columns:1fr 1.4fr;gap:10px}',
      '.qk-bunn button{min-height:48px;border-radius:12px;font:600 15px -apple-system,Helvetica,Arial,sans-serif;cursor:pointer}',
      '.qk-ny{background:#fff;color:#004225;border:2px solid #004225}.qk-send{background:#004225;color:#fff;border:2px solid #004225}.qk-send:disabled{background:#c9ceca;border-color:#c9ceca;color:#fff;cursor:not-allowed}',
      '.qk-grunn{font-size:12px;color:#6b756f;grid-column:1/-1;margin:0}'
    ].join('');
    document.head.appendChild(s);
  }
  function qkKort(c, b) {
    qkCss();
    var ag = b.agent || {};
    var nokkel = JSON.stringify([b.regnr, b.km, b.arm, b.erp_lav, b.erp_hoy, b.kunde_kommentar, b.bilde, ag]);
    var ny = c.querySelector(':scope > .au-ny');
    var kr = function (n) { return n == null || n === '' ? 'ikke sjekket' : auKr(n); };
    var arm = String(b.arm || 'A').toUpperCase();
    var armNavn = arm === 'ORDNA' ? 'Ordna' : arm;
    if (!ny || ny.getAttribute('data-k') !== nokkel) {
      var bil = ag.bil || {};
      var navn = String(bil.navn || b.bil || '').split(',')[0];
      var aar = bil.modellaar || ag.erp_aar || null;
      // 1 Bilen
      var bilder = (b.bilde && b.bilde.kilde === 'kunde' && Array.isArray(b.bilde.bilder) ? b.bilde.bilder : []).map(function (x) {
        if (x.url) return x.url;
        if (x.lokal != null && window.PA_PROXY_ERP && window.PA_TOKEN_ERP) return window.PA_PROXY_ERP.replace(/\/list\/$/, '/bilde/') + encodeURIComponent(b.id + '-' + x.lokal) + '?t=' + encodeURIComponent(window.PA_TOKEN_ERP);
        return null;
      }).filter(Boolean);
      var s1 = '<section class="qk-sek"><h3>1 Bilen</h3><p class="qk-hjelp">Er dette riktig bil og riktig tilstand?</p>' +
        (bilder.length ? '<div class="qk-bilder">' + bilder.map(function (u, i) { return '<a href="#" class="au-lb" data-ix="' + i + '" data-bilder="' + esc(JSON.stringify(bilder)) + '" aria-label="Bilde ' + (i + 1) + ' av ' + bilder.length + '"><img src="' + esc(u) + '" loading="lazy" alt="Kundens bilde ' + (i + 1) + '"></a>'; }).join('') + '</div>' : '<p class="qk-tom" style="margin:0">Ingen bilder fra kunden</p>') +
        '<div class="qk-kommentar">' + (b.kunde_kommentar ? esc(b.kunde_kommentar) : '<span class="qk-tom">Ingen kommentar</span>') + '</div></section>';
      // 2 Varsler
      var rader = [];
      var rod = function (id, t) { rader.push('<div class="qk-varsel rod"><div class="qk-tekst">' + t + '</div><label><input type="checkbox" class="qk-kvitt" data-id="' + id + '">Sjekket</label></div>'); };
      var gra = function (t) { rader.push('<div class="qk-varsel"><div class="qk-tekst">' + t + '</div></div>'); };
      var hist = Array.isArray(ag.historikk) ? ag.historikk : null;
      (hist || []).filter(function (h) { return h.bud_avvist; }).forEach(function (h) { rod('bud-' + h.id, 'Bud avvist på vår auksjon ' + esc(h.bud_avvist) + ', høyeste bud ' + kr(h.hoyeste_bud)); });
      var pf = (hist || []).filter(function (h) { return h.lav; })[0];
      gra('Priset før: ' + (hist == null ? 'ikke sjekket' : pf ? esc(pf.dato || '') + ', ' + auKr(pf.lav) + ' – ' + auKr(pf.hoy) : 'Nei'));
      var ea = ag.egen_annonse;
      gra('Bilens egen Finn-annonse: ' + (ea == null ? 'ikke sjekket' : ea.aktiv ? (ea.lenke ? '<a href="' + esc(ea.lenke) + '" target="_blank" rel="noopener">' + kr(ea.pris) + '</a>' : kr(ea.pris)) + ', ' + (ea.dager != null ? ea.dager + ' dager ute' : 'ikke sjekket') : 'Ingen'));
      if (ag.eu_km && b.km != null && ag.eu_km.km > b.km) rod('km', 'Km-avvik: EU-kontroll ' + esc(ag.eu_km.dato || '') + ' viste ' + auKr(ag.eu_km.km) + ' km, ERP sier ' + auKr(b.km) + ' km');
      else gra('EU-kontroll: ' + (ag.eu_km ? auKr(ag.eu_km.km) + ' km (' + esc(ag.eu_km.dato || '') + ')' : 'ikke sjekket'));
      if (bil.kilde === 'vegvesen' || ag.reserve) rod('carinfo', 'Mangler data: car.info kjenner ikke bilen. Like biler er funnet via andre biler.');
      if (ag.fsd && ag.fsd.stopp) rod('stopp', 'FSD vil ikke prise bilen automatisk: ' + esc(ag.fsd.stopp_grunn || ''));
      if (!ag.fsd || !ag.fsd.pris) rod('ingenpris', 'FSD har ingen Finn-utpris for bilen.');
      var s2 = '<section class="qk-sek"><h3>2 Varsler</h3><p class="qk-hjelp">Rødt må sjekkes før du sender.</p>' + rader.join('') + '</section>';
      // 3 Finn-utpris
      var fp = ag.fsd && ag.fsd.pris, bp = ag.benchmark && ag.benchmark.pris;
      var s3 = '<section class="qk-sek"><h3>3 Finn-utpris</h3><p class="qk-hjelp">Hva bilen ville stått til på Finn i dag.</p><div class="qk-priser">' +
        '<div class="qk-pris fsd"><span>FSD – brukes</span><b>' + (fp ? auKr(fp) : 'ikke satt') + '</b></div>' +
        '<div class="qk-pris"><span>Benchmark – kontroll</span><b>' + (bp ? auKr(bp) : 'ikke sjekket') + '</b></div></div>' +
        (ag.avvik_pst != null ? '<div class="qk-avvik' + (ag.avvik_pst > 10 ? ' rod' : '') + '">Avvik ' + ag.avvik_pst + ' %</div>' : '') + '</section>';
      // 4 Tvillinger
      var tv = Array.isArray(ag.tvillinger) ? ag.tvillinger : [];
      var st = function (x) { return x === 'solgt' ? 'Solgt' : x === 'fjernet' ? 'Fjernet' : x ? 'Aktiv' : '<span class="ik">ikke sjekket</span>'; };
      var krT = function (n) { return n == null || n === '' ? '<span class="ik">ikke sjekket</span>' : auKr(n); };
      var s4 = '<section class="qk-sek"><h3>4 Tvillinger</h3><p class="qk-hjelp">Like biler AI-ene brukte. Trykk finnkode for å sjekke.</p>' +
        (tv.length ? '<div class="qk-tabwrap"><table class="qk-tab"><tr><th>Finnkode</th><th class="h">Pris</th><th class="h">Km</th><th class="aar">År</th><th>Status</th><th>Brukt av</th></tr>' + tv.map(function (t) {
          var url = t.lenke || (t.finnkode ? 'https://www.finn.no/mobility/item/' + t.finnkode : null);
          return '<tr class="' + (t.fsd && t.bench ? '' : 'en') + '"><td>' + (url ? '<a href="' + esc(url) + '" target="_blank" rel="noopener">' + esc(t.finnkode || 'annonse') + '</a>' : esc(t.finnkode || '–')) + '</td><td class="h">' + krT(t.pris) + '</td><td class="h">' + krT(t.km) + '</td><td class="aar">' + (t.aar || '<span class="ik">ikke sjekket</span>') + '</td><td>' + st(t.status) + '</td><td>' + (t.fsd && t.bench ? 'Begge' : t.fsd ? 'FSD' : 'Benchmark') + '</td></tr>';
        }).join('') + '</table></div>' : '<p class="qk-tom" style="margin:0">Ingen tvillinger</p>') +
        ((ag.forkastet || []).length ? '<details class="qk-fork"><summary>Forkastet: ' + ag.forkastet.length + ' biler (vis)</summary><ul>' + ag.forkastet.map(function (f) { return '<li><a href="https://www.finn.no/mobility/item/' + encodeURIComponent(f.finnkode) + '" target="_blank" rel="noopener">' + esc(f.finnkode) + '</a> ' + esc(f.aarsak) + '</li>'; }).join('') + '</ul></details>' : '') + '</section>';
      // 5 Fra Finn-pris til kunden
      var ff = ag.fsd && ag.fsd.fossefall;
      var s5 = '<section class="qk-sek"><h3>5 Fra Finn-pris til kunden</h3><p class="qk-hjelp">Trekkene som gir tilbudet.</p>';
      if (ff && ff.trinn) {
        s5 += '<table class="qk-ff">' + ff.trinn.map(function (l) {
          var sum = l[2] === 'sum', start = l[2] === 'start';
          var v = l[1] == null ? 'ikke sjekket' : (start || sum || l[1] === 0 ? '' : l[1] > 0 ? '+ ' : '− ') + auKr(Math.abs(l[1]));
          return '<tr' + (sum ? ' class="sum"' : '') + '><td>' + (sum ? '= ' : start ? '' : '− ') + esc(l[0]) + '</td><td class="h">' + v + '</td></tr>';
        }).join('') + '<tr><td>± spenn</td><td class="h">− ' + auKr(ff.spenn.lav) + ' / + ' + auKr(ff.spenn.hoy) + '</td></tr></table>' +
          '<div class="qk-kunde"><span>Til kunden (' + armNavn + ')</span><b>' + (b.erp_lav ? auKr(b.erp_lav) + ' – ' + auKr(b.erp_hoy) : 'ikke satt') + '</b></div>' +
          '<div class="qk-spor3">' + [['A', ff.a, 'A = midt'], ['B', ff.b, 'B = A × 0,90'], ['ORDNA', ff.ordna, 'Ordna = A × 0,75']].map(function (y) {
            return '<div class="' + (arm === y[0] ? 'aktiv' : '') + '"><span>' + (y[0] === 'ORDNA' ? 'Ordna' : y[0]) + '</span><b>' + kr(y[1]) + '</b><span>' + y[2] + '</span></div>';
          }).join('') + '</div>';
      } else {
        s5 += '<p class="qk-tom" style="margin:0">Ikke regnet ut: FSD har ingen Finn-utpris.</p>' + (b.erp_lav ? '<div class="qk-kunde"><span>Til kunden nå (' + armNavn + ')</span><b>' + auKr(b.erp_lav) + ' – ' + auKr(b.erp_hoy) + '</b></div>' : '');
      }
      s5 += '</section>';
      var el = document.createElement('div');
      el.className = 'au-ny qk';
      el.setAttribute('data-k', nokkel);
      el.innerHTML = '<div class="qk-topp"><div><b>' + esc(b.regnr) + ' · ' + esc(navn) + '</b><div class="qk-meta">' + (aar ? aar : 'år ikke sjekket') + ' · ' + (b.km != null ? auKr(b.km) + ' km' : 'km ikke sjekket') + '</div></div><span class="qk-spor">Spor: ' + armNavn + '</span></div>' +
        '<div class="qk-innhold">' + s1 + s2 + s3 + s4 + s5 + '</div>' +
        '<div class="qk-bunn"><button type="button" class="qk-ny">Ny vurdering</button><button type="button" class="qk-send">Send til kunde</button><p class="qk-grunn" hidden></p></div>';
      var kvittert = {};
      try { kvittert = JSON.parse(sessionStorage.getItem('qk-kvitt-' + b.id) || '{}'); } catch (_) {}
      el.querySelectorAll('.qk-kvitt').forEach(function (cb) { cb.checked = !!kvittert[cb.getAttribute('data-id')]; cb.addEventListener('change', function () { kvittert[cb.getAttribute('data-id')] = cb.checked; try { sessionStorage.setItem('qk-kvitt-' + b.id, JSON.stringify(kvittert)); } catch (_) {} qkKnapper(c, el); }); });
      el.querySelector('.qk-send').addEventListener('click', function (e) { e.preventDefault(); var eb = c.querySelector('.qa-send-btn'); if (!this.disabled && eb && !eb.disabled) eb.click(); });
      el.querySelector('.qk-ny').addEventListener('click', function (e) { e.preventDefault(); var cb = c.querySelector('.qa-clear-btn'); if (cb && !cb.disabled) cb.click(); });
      if (ny) ny.replaceWith(el); else c.insertBefore(el, c.firstChild);
      ny = el;
      c.classList.add('au-ny-modus');
    }
    qkKnapper(c, ny);
  }
  function qkKnapper(c, el) {
    var ekte = c.querySelector('.qa-send-btn');
    var send = el.querySelector('.qk-send'), grunn = el.querySelector('.qk-grunn');
    var mangler = [].slice.call(el.querySelectorAll('.qk-kvitt')).filter(function (x) { return !x.checked; }).length;
    var av = !ekte || ekte.disabled || mangler > 0;
    send.disabled = av;
    grunn.hidden = !av;
    grunn.textContent = mangler > 0 ? 'Kvitter ' + mangler + ' rødt varsel før du sender.' : !ekte ? 'Send er ikke tilgjengelig for bilen.' : ekte.disabled ? 'Send er sperret i ERP-flyten.' : '';
    var cb = c.querySelector('.qa-clear-btn'); el.querySelector('.qk-ny').disabled = !cb || cb.disabled;
  }
  function auAgentCss() {
    if (document.getElementById('au-ag-css')) return;
    var s = document.createElement('style'); s.id = 'au-ag-css';
    s.textContent =
      '#qa-cards{grid-template-columns:repeat(auto-fill,minmax(min(100%,380px),440px))!important;justify-content:start!important}' +
      '#qa-counters,.qa-finn-legends{display:none!important}' +
      '.au-ny .au-send-topp{display:none!important}' +
      '.au-ny{font-family:-apple-system,Helvetica,Arial,sans-serif;gap:10px;font-size:14px;color:#1B1F1D}' +
      '.au-ag-topp{display:flex;flex-wrap:wrap;justify-content:space-between;gap:8px;align-items:center;border-bottom:1px solid #E2E5E0;padding-bottom:8px}' +
      '.au-ag-id{font-weight:600;font-size:15px}.au-ag-id small{font-weight:400;color:#6B726D;margin-left:6px;font-variant-numeric:tabular-nums}' +
      '.au-ag-kn{display:flex;gap:6px}.au-ag-kn button{font:600 13px -apple-system,Helvetica,Arial,sans-serif;border-radius:4px;padding:7px 12px;cursor:pointer}' +
      '.au-ag-kn .au-ny-send{background:#1F5132;color:#fff;border:1px solid #1F5132}.au-ag-kn .au-ny-send:disabled{opacity:.4}.au-ag-kn .au-ny-sek{background:#fff;color:#1B1F1D;border:1px solid #C9CEC8}' +
      '.au-ag-tall{display:flex;flex-wrap:wrap;gap:4px 22px;font-variant-numeric:tabular-nums;align-items:baseline}.au-ag-tall span{color:#6B726D;font-size:12px;margin-right:4px}.au-ag-tall b{font-size:17px;font-weight:600}' +
      '.au-ag-tall .rod{color:#A33A23}.au-ag-tall .valgt{text-decoration:underline;text-underline-offset:3px}' +
      '.au-ag-flagg{display:grid;gap:2px}.au-ag-flagg details{font-size:13px;color:#A33A23}.au-ag-flagg summary{cursor:pointer;list-style:none;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.au-ag-flagg details div{color:#1B1F1D;margin:2px 0 4px 12px}' +
      '.au-ag-bilder{display:flex;gap:4px;overflow-x:auto}.au-ag-bilder img{height:64px;width:auto;display:block;border-radius:2px}.au-ag-bilder a{flex:0 0 auto}' +
      '.au-ag-tab{overflow-x:auto}.au-ag-tab table{width:100%;border-collapse:collapse;font-size:13px;font-variant-numeric:tabular-nums;}' +
      '.au-ag-tab th{text-align:left;font-size:11px;color:#6B726D;font-weight:600;padding:2px 8px 2px 0;border-bottom:1px solid #E2E5E0}.au-ag-tab td{padding:3px 8px 3px 0;border-bottom:1px solid #F0F2EF}' +
      '.au-ag-tab td.h,.au-ag-tab th.h{text-align:right}.au-ag-tab tr.en td{color:#8A6D10}.au-ag-tab a{color:#1F5132}' +
      '.au-ag-plus summary{cursor:pointer;list-style:none;font-size:13px;color:#1F5132}.au-ag-plus>div,.au-ag-plus>dl{margin-top:6px}' +
      '.au-ag-beg{font-size:13px;line-height:1.45}.au-ag-ff{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.au-ag-ff table{width:100%;border-collapse:collapse;font-size:12.5px;font-variant-numeric:tabular-nums}' +
      '.au-ag-ff td{padding:2px 0}.au-ag-ff td.h{text-align:right}.au-ag-ff tr.sum td{font-weight:600;border-top:1px solid #E2E5E0}.au-ag-arm{display:none}' +
      '.au-ag-alt{display:grid;gap:8px;font-size:13px}.au-ag-alt h4{margin:0;font-size:11px;color:#6B726D;font-weight:600}.au-ag-alt dl{display:grid;grid-template-columns:max-content 1fr;gap:2px 12px;margin:0}.au-ag-alt dt{color:#6B726D}.au-ag-alt dd{margin:0;overflow-wrap:anywhere}' +
      '.au-ag-sett{display:flex;gap:6px}.au-ag-sett input{flex:1;min-width:0;border:1px solid #C9CEC8;border-radius:4px;padding:6px 8px;font:inherit}.au-ag-sett button{border:1px solid #C9CEC8;background:#fff;border-radius:4px;padding:0 10px;cursor:pointer}' +
      '.au-ag-fork{font-size:12.5px;color:#6B726D}.au-ag-fork ul{margin:4px 0 0;padding-left:16px}.au-ag-fork a{color:#6B726D}' +
      '.au-ny-liten{font-size:12px;color:#6B726D}' +
      '.au-ag-fft{width:100%;border-collapse:collapse;font-size:13px;font-variant-numeric:tabular-nums;table-layout:fixed}.au-ag-fft td,.au-ag-fft th{padding:3px 0;border-bottom:1px solid #F0F2EF;color:#1B1F1D;text-align:left}' +
      '.au-ag-fft .tall{text-align:right;width:28%;white-space:nowrap}.au-ag-fft th{font-size:11px;color:#6B726D;font-weight:600}.au-ag-fft tr.sum td{font-weight:600;border-top:1px solid #C9CEC8}';
    document.head.appendChild(s);
  }
  function auAgentKort(c, b) {
    auNyCss(); auAgentCss();
    var ag = b.agent;
    var nokkel = JSON.stringify([b.regnr, b.km, b.erp_lav, b.erp_hoy, ag]);
    var ny = c.querySelector(':scope > .au-ny');
    if (!ny || ny.getAttribute('data-k') !== nokkel) {
      var kr = function (n) { return n ? auKr(n) : '–'; };
      var pris = function (navn, x, cls) {
        var tall = x && x.pris ? auKr(x.pris) : (x && x.feil ? 'feil' : x ? '–' : 'venter');
        return '<div class="au-ag-pris ' + cls + '"><span>' + navn + '</span><b>' + tall + '</b>' + (cls === 'fsd' && x && x.stopp ? '<em>STOPPET – prises manuelt</em>' : '') + '</div>';
      };
      var bilder = (b.bilde && Array.isArray(b.bilde.bilder) ? b.bilde.bilder : []).map(function (x) {
        if (x.url) return x.url;
        if (x.lokal != null && window.PA_PROXY_ERP && window.PA_TOKEN_ERP) return window.PA_PROXY_ERP.replace(/\/list\/$/, '/bilde/') + encodeURIComponent(b.id + '-' + x.lokal) + '?t=' + encodeURIComponent(window.PA_TOKEN_ERP);
        return null;
      }).filter(Boolean);
      var lign = b.bilde && b.bilde.kilde === 'lignende';
      var galleri = bilder.length ? '<div><div class="au-ag-bilder">' + bilder.map(function (u, i) { return '<a href="#" class="au-lb" data-ix="' + i + '" data-bilder="' + esc(JSON.stringify(bilder)) + '"><img src="' + esc(u) + '" loading="lazy" alt="Bilde ' + (i + 1) + '"></a>'; }).join('') + '</div><div class="au-ny-liten" style="color:' + (lign ? '#8A6D10' : '#5E6B62') + '">' + (lign ? 'Lignende bil fra Finn, ikke kundens bil' : bilder.length + ' bilder fra kunden · sveip for flere') + '</div></div>' : '<div class="au-ny-liten" style="color:#5E6B62">Ingen bilder fra kunden</div>';
      var bil = ag.bil || {};
      var id = '<div class="au-ag-id">' + esc(b.regnr) + ' · ' + esc(bil.navn || b.bil || '') + '<small>' + (bil.modellaar && String(bil.navn || '').indexOf(String(bil.modellaar)) < 0 ? bil.modellaar + ' · ' : '') + (b.km != null ? auKr(b.km) + ' km' : '') + ' · ' + esc(b.arm || '') + '</small></div>';
      var tv = (ag.tvillinger || []).map(function (t) {
        var url = t.lenke || (t.finnkode ? 'https://www.finn.no/mobility/item/' + t.finnkode : null);
        var navn = t.finnkode || 'annonse';
        var av = t.fsd && t.bench ? 'Begge' : t.fsd ? 'FSD' : 'Bench';
        return '<tr class="' + (t.fsd && t.bench ? '' : 'en') + '"><td>' + (url ? '<a href="' + esc(url) + '" target="_blank" rel="noopener">' + esc(navn) + '</a>' : esc(navn)) + '</td><td class="h">' + kr(t.pris) + '</td><td class="h">' + kr(t.km) + '</td><td>' + (t.aar || '–') + '</td><td>' + esc(t.trim || '–') + '</td><td><span class="au-ag-st ' + esc(t.status || 'aktiv') + '">' + esc(t.status ? t.status.charAt(0).toUpperCase() + t.status.slice(1) : '–') + '</span></td><td>' + av + '</td></tr>';
      }).join('');
      var fork = (ag.forkastet || []).map(function (f) { return '<li><a href="https://www.finn.no/mobility/item/' + encodeURIComponent(f.finnkode) + '" target="_blank" rel="noopener">' + esc(f.finnkode) + '</a> ' + esc(f.aarsak) + '</li>'; }).join('');
      var beg = [['FSD', ag.fsd], ['Benchmark', ag.benchmark]].filter(function (x) { return x[1] && x[1].begrunnelse; }).map(function (x) { return '<p style="margin:0 0 6px"><b>' + x[0] + ':</b> ' + esc(x[1].begrunnelse) + '</p>'; }).join('');
      // 7–8: fossefall Finn-utpris → A for begge modellene side om side, så A / B (A×0,90) / Ordna (A×0,75). Valgt arm markert.
      var armValgt = String(b.arm || '').toUpperCase();
      // «Vis alt» (Mike 13.10): strukturert data, enkelt, ikke det gamle kortet.
      var rad = function (k2, v) { return v == null || v === '' ? '' : '<dt>' + esc(k2) + '</dt><dd>' + v + '</dd>'; };
      var dl = function (tittel, rader) { rader = rader.join(''); return rader ? '<div><h4>' + tittel + '</h4><dl>' + rader + '</dl></div>' : ''; };
      var erpA = c.querySelector('a[href*="biladministrasjon"]');
      var modellRader = function (x) {
        if (!x) return ['<dt>Status</dt><dd>venter</dd>'];
        return [rad('Modell', esc(x.modell || '')), rad('Finn-utpris', x.pris ? auKr(x.pris) : (x.feil ? esc(x.feil) : '–')), rad('Stopp', x.stopp ? esc(x.stopp_grunn || 'ja') : null),
          rad('Tvillinger', x.antall_tvillinger != null ? String(x.antall_tvillinger) : null), rad('Forkastet', x.antall_forkastet != null ? String(x.antall_forkastet) : null),
          rad('Tid', x.sek ? x.sek + ' s' : null), rad('Egne flagg', (x.egne_flagg || []).length ? x.egne_flagg.map(esc).join('<br>') : null)];
      };
      var altHtml = '<div class="au-ag-alt" hidden>' +
        dl('Bil', [rad('Regnr', esc(b.regnr)), rad('Internnr', erpA ? '<a href="' + esc(erpA.href) + '" target="_blank" rel="noopener">' + esc(String(b.id)) + '</a>' : esc(String(b.id))),
          rad('Kilde', esc(b.kilde || '')), rad('Arm', esc(b.arm || '')), rad('Km (ERP)', b.km != null ? auKr(b.km) : null),
          rad('Siste EU-kontroll', ag.eu_km ? auKr(ag.eu_km.km) + ' km (' + esc(ag.eu_km.dato || '') + ')' : null),
          rad('Årsmodell car.info', bil.modellaar ? String(bil.modellaar) : null), rad('Årsmodell ERP', ag.erp_aar ? String(ag.erp_aar) : null),
          rad('car.info', esc(bil.navn || '')), rad('Eiertid', b.eiertid_aar != null ? String(b.eiertid_aar).replace('.', ',') + ' år' : null),
          rad('Bilder fra kunden', b.bilde && b.bilde.kilde === 'kunde' && b.bilde.bilder ? String(b.bilde.bilder.length) : '0')]) +
        dl('Kunde', [rad('Kommentar', b.kunde_kommentar ? esc(b.kunde_kommentar) : 'ingen')]) +
        dl('Pris', [rad('Finn-utpris i ERP', b.finn_utpris ? auKr(b.finn_utpris) : null), rad('Estimat til kunden', b.erp_lav ? auKr(b.erp_lav) + ' – ' + auKr(b.erp_hoy) : null),
          rad('Skrevet til ERP', ag.erp ? (ag.erp.skrevet ? 'ja, fra FSD' : 'nei' + (ag.erp.grunn ? ': ' + esc(ag.erp.grunn) : '')) : null), rad('Priset', ag.laget ? esc(new Date(ag.laget).toLocaleString('nb-NO')) : null),
          rad('Avvik FSD/Benchmark', ag.avvik_pst != null ? ag.avvik_pst + ' %' : null)]) +
        dl('FSD', modellRader(ag.fsd)) + dl('Benchmark', modellRader(ag.benchmark)) +
        (ag.reserve && ag.reserve.tvillingbiler && ag.reserve.tvillingbiler.length ? dl('Reserve (car.info mangler bilen)', ag.reserve.tvillingbiler.map(function (t) { return rad('Via ' + t.regnr, esc(t.car_info_navn || '')); })) : '') +
        (c.querySelector('.qa-anker-input') ? '<div><h4>Sett Finn-utpris selv</h4><div class="au-ag-sett"><input type="text" inputmode="numeric" class="au-ag-inp" placeholder="f.eks. 159000"><button type="button" class="au-ny-sek au-ag-settkn">Sett</button></div></div>' : '') +
        '</div>';
      // Fossefall én gang, for FSD-prisen (det er samme regnestykke). Benchmark: bare pris og hva kunden ville fått (Mike 13.10).
      var fF = ag.fsd && ag.fsd.fossefall && ag.fsd.fossefall.linjer ? ag.fsd.fossefall : null;
      var fB = ag.benchmark && ag.benchmark.fossefall ? ag.benchmark.fossefall : null;
      var armTall = function (f) { return !f ? null : armValgt === 'B' ? f.b : armValgt === 'ORDNA' ? f.ordna : f.a; };
      var armNavn = armValgt === 'ORDNA' ? 'Ordna' : (armValgt || 'A');
      var ffHtml = '';
      if (fF) {
        var rader = fF.linjer.map(function (l) { return '<tr' + (/^=/.test(l[0]) ? ' class="sum"' : '') + '><td>' + esc(l[0]) + '</td><td class="tall">' + auKr(l[1]) + '</td></tr>'; });
        rader.push('<tr class="sum"><td>= A (forventet bud)</td><td class="tall">' + auKr(fF.a) + '</td></tr>');
        if (armValgt === 'B') rader.push('<tr class="sum"><td>= B (A × 0,90)</td><td class="tall">' + auKr(fF.b) + '</td></tr>');
        if (armValgt === 'ORDNA') rader.push('<tr class="sum"><td>= Ordna (A × 0,75)</td><td class="tall">' + auKr(fF.ordna) + '</td></tr>');
        ffHtml = '<table class="au-ag-fft">' + rader.join('') + '</table>';
      }
      if (fB && armTall(fB)) ffHtml += '<div class="au-ny-liten" style="margin-top:6px">Med Benchmark (' + auKr(ag.benchmark.pris) + ') ville ' + armNavn + ' blitt ' + auKr(armTall(fB)) + '.</div>';
      var nyEl = document.createElement('div');
      nyEl.className = 'au-ny';
      nyEl.setAttribute('data-k', nokkel);
      nyEl.innerHTML =
        '<div class="au-ag-topp">' + id + '<div class="au-ag-kn"><button type="button" class="au-ny-send">Send</button><button type="button" class="au-ny-sek au-ag-ny">Ny vurdering</button></div></div>' +
        galleri +
        '<div class="au-ag-tall">' +
          '<div><span>FSD</span><b>' + (ag.fsd && ag.fsd.pris ? auKr(ag.fsd.pris) : (ag.fsd && ag.fsd.stopp ? 'stopp' : '–')) + '</b></div>' +
          '<div><span>Benchmark</span><b>' + (ag.benchmark && ag.benchmark.pris ? auKr(ag.benchmark.pris) : '–') + '</b></div>' +
          (ag.avvik_pst != null ? '<div><span>Avvik</span><b class="' + (ag.avvik_pst > 5 ? 'rod' : '') + '">' + ag.avvik_pst + ' %</b></div>' : '') +
          (ag.fsd && ag.fsd.fossefall && ag.fsd.fossefall.a ? [['A', ag.fsd.fossefall.a], ['B', ag.fsd.fossefall.b], ['ORDNA', ag.fsd.fossefall.ordna]].map(function (y) { return '<div><span>' + (y[0] === 'ORDNA' ? 'Ordna' : y[0]) + '</span><b class="' + (String(b.arm || '').toUpperCase() === y[0] ? 'valgt' : '') + '">' + auKr(y[1]) + '</b></div>'; }).join('') : '') +
        '</div>' +
        ((ag.flagg || []).length ? '<div class="au-ag-flagg">' + ag.flagg.map(function (f) { var kort = f.split(':')[0]; return '<details><summary>⚑ ' + esc(kort.length > 70 ? kort.slice(0, 67) + '…' : kort) + '</summary><div>' + esc(f) + '</div></details>'; }).join('') + '</div>' : '') +
        (tv ? '<div class="au-ag-tab"><table><tr><th>Finnkode</th><th class="h">Pris</th><th class="h">Km</th><th>År</th><th>Trim</th><th>Status</th><th>Brukt av</th></tr>' + tv + '</table></div>' : '') +
        (fork ? '<details class="au-ag-fork"><summary>Forkastet (' + ag.forkastet.length + ')</summary><ul>' + fork + '</ul></details>' : '') +
        (beg ? '<details class="au-ag-plus"><summary>+ Begrunnelse</summary><div class="au-ag-beg">' + beg + '</div></details>' : '') +
        (ffHtml ? '<details class="au-ag-plus"><summary>+ Fossefall</summary>' + ffHtml + '</details>' : '') +
        '<details class="au-ag-plus"><summary>+ Alt</summary>' + altHtml.replace(' hidden>', '>') + '</details>';
      nyEl.querySelector('.au-ny-send').addEventListener('click', function (e) { e.preventDefault(); var eb = c.querySelector('.qa-send-btn'); if (eb && !eb.disabled) eb.click(); });
      nyEl.querySelector('.au-ag-ny').addEventListener('click', function (e) { e.preventDefault(); var cb = c.querySelector('.qa-clear-btn'); if (cb && !cb.disabled) cb.click(); });
      var settKn = nyEl.querySelector('.au-ag-settkn');
      if (settKn) settKn.addEventListener('click', function (e) {
        e.preventDefault();
        var v = String(nyEl.querySelector('.au-ag-inp').value || '').replace(/\D/g, '');
        var inp = c.querySelector('.qa-anker-input'), sett = c.querySelector('.qa-anker-btn');
        if (!v || !inp || !sett) return;
        inp.value = v; inp.dataset.kilde = 'manuell'; inp.dataset.fra = String(b.finn_utpris || ''); sett.click();
      });
      if (ny) ny.replaceWith(nyEl); else c.insertBefore(nyEl, c.firstChild);
      ny = nyEl;
      c.classList.add('au-ny-modus');
    }
    var ekte = c.querySelector('.qa-send-btn'), send = ny.querySelector('.au-ny-send');
    if (send) {
      var tekst = ekte ? (ekte.innerText || '').replace(/[^\wæøåÆØÅ ]/g, '').trim() : '';
      send.textContent = (tekst || 'Send') + (b.erp_lav ? ' · ' + auKr(b.erp_lav) + ' – ' + auKr(b.erp_hoy) : '');
      send.disabled = !ekte || ekte.disabled;
    }
    if (ekte) ekte.style.display = 'none';
    var cb = c.querySelector('.qa-clear-btn'), nyKn = ny.querySelector('.au-ag-ny');
    if (nyKn) nyKn.disabled = !cb || cb.disabled;
  }
  // Før FSD har levert: bare bilen og «FSD priser», ikke auto/skygge/CC (skygge og CC er slått av 13.10).
  function auVenterKort(c, b) {
    auNyCss();
    var nokkel = 'venter|' + b.regnr + '|' + b.km;
    var ny = c.querySelector(':scope > .au-ny');
    if (ny && ny.getAttribute('data-k') === nokkel) return;
    var el = document.createElement('div'); el.className = 'au-ny'; el.setAttribute('data-k', nokkel);
    el.innerHTML = '<div class="au-ny-navn">' + esc(b.regnr) + ' · ' + esc(b.bil || '') + '</div><div class="au-ny-meta">' + (b.km != null ? auKr(b.km) + ' km' : '') + '</div><div class="au-ny-under">FSD priser bilen nå. Kortet kommer om 1–2 minutter.</div>';
    if (ny) ny.replaceWith(el); else c.insertBefore(el, c.firstChild);
    c.classList.add('au-ny-modus');
  }
  function auNyttKort(c, b) {
    auNyCss();
    var pr = (b.enighet && b.enighet.priser) || {};
    var nokkel = JSON.stringify([b.regnr, b.km, b.erp_lav, b.erp_hoy, pr, b.kunde_kommentar, b.naermeste, b.agent, b.bilde, !!c.querySelector('.qa-anker-input')]);
    var ny = c.querySelector(':scope > .au-ny');
    if (!ny || ny.getAttribute('data-k') !== nokkel) {
      var k = function (n) { return n ? Math.round(n / 1000) + 'k' : '–'; };
      var sp = b.enighet ? b.enighet.spenn_pst : null;
      var mangler = ['auto', 'skygge', 'cc'].filter(function (x) { return !pr[x]; }).map(function (x) { return x === 'cc' ? 'CC' : x; });
      var enTekst = sp == null ? 'Mangler pris fra ' + mangler.join(' og ') : (sp <= 5 ? 'Enige: ' : 'Uenige: ') + sp + ' % mellom laveste og høyeste';
      var bilder = (b.bilde && Array.isArray(b.bilde.bilder) ? b.bilde.bilder : []).map(function (x) {
        if (x.url) return x.url;
        if (x.lokal != null && window.PA_PROXY_ERP && window.PA_TOKEN_ERP) return window.PA_PROXY_ERP.replace(/\/list\/$/, '/bilde/') + encodeURIComponent(b.id + '-' + x.lokal) + '?t=' + encodeURIComponent(window.PA_TOKEN_ERP);
        return null;
      }).filter(Boolean);
      var lign = b.bilde && b.bilde.kilde === 'lignende';
      var galleri = bilder.length ? '<div class="au-ny-galleri">' + bilder.map(function (u, i) { return '<a href="#" class="au-lb" data-ix="' + i + '" data-bilder="' + esc(JSON.stringify(bilder)) + '"><img src="' + esc(u) + '" loading="lazy" alt="Bilde ' + (i + 1) + '"></a>'; }).join('') + '</div>' + (lign ? '<div class="au-ny-liten">Lignende bil fra Finn, ikke kundens bil</div>' : '') : '';
      var kanBruke = !!c.querySelector('.qa-anker-input');
      // c539: FSD (Grok) og Benchmark (Claude) side om side når prising-agenten har levert (Mike 13.10).
      var ag = b.agent || null;
      var agKilde = function (navn, x, kildeKode, valgt) {
        var v = x && x.pris;
        var bruk = !valgt && v && kanBruke ? '<button type="button" class="au-ny-bruk" data-kilde="' + kildeKode + '" data-fu="' + Math.round(v / 1000) * 1000 + '" data-fra="' + (b.finn_utpris || '') + '">Bruk</button>' : '';
        var tekst = x ? (x.stopp ? 'stopp' : x.feil ? 'feil' : k(v)) : 'venter';
        return '<div class="au-ny-kilde' + (valgt ? ' valgt' : '') + '"><span>' + navn + '</span><b>' + tekst + '</b>' + bruk + '</div>';
      };
      var agDiff = ag && ag.fsd && ag.benchmark && ag.fsd.pris && ag.benchmark.pris ? Math.round(Math.abs(ag.fsd.pris - ag.benchmark.pris) / Math.min(ag.fsd.pris, ag.benchmark.pris) * 100) : null;
      var tvRad = function (t) {
        var st = t.status === 'solgt' ? '<span class="au-ny-solgt">solgt</span>' : '<span class="au-ny-ask">' + esc(t.status || 'aktiv') + '</span>';
        var km = t.km ? auKr(t.km) + ' km' : '–';
        var url = t.lenke || (t.finnkode ? 'https://www.finn.no/mobility/item/' + t.finnkode : null);
        return '<tr><td>' + (url ? '<a href="' + esc(url) + '" target="_blank" rel="noopener">' + km + '</a>' : km) + '</td><td>' + st + '</td><td class="h">' + auKr(t.pris) + '</td></tr>';
      };
      var agHtml = '';
      if (ag) {
        var f = ag.fsd || {}, bm = ag.benchmark || {};
        agHtml = '<div><div class="au-ny-kilder" style="grid-template-columns:repeat(2,minmax(0,1fr))">' + agKilde('FSD (Grok)', ag.fsd, 'fsd', true) + agKilde('Benchmark (Claude)', ag.benchmark, 'benchmark', false) + '</div>' +
          '<div class="au-ny-enig' + (agDiff != null && agDiff <= 5 ? '' : ' uenig') + '" style="margin-top:6px">' + (agDiff != null ? (agDiff <= 5 ? 'Enige: ' : 'Uenige: ') + agDiff + ' %' : '') + (b.finn_utpris ? (agDiff != null ? ' · ' : '') + 'auto ' + k(b.finn_utpris) : '') + '</div></div>' +
          (f.stopp ? '<div class="au-ny-kunde" style="background:#FBF1E3"><div class="au-ny-etikett" style="color:#8A4B12">FSD stoppet bilen</div><p style="font-size:14.5px">' + esc(f.stopp_grunn || '') + '</p></div>' : '') +
          (f.begrunnelse ? '<div class="au-ny-under" style="line-height:1.45">' + esc(f.begrunnelse) + '</div>' : '') +
          ((f.tvillinger || []).length ? '<div class="au-ny-tv"><div class="au-ny-etikett">FSD sine tvillinger</div><table>' + f.tvillinger.map(tvRad).join('') + '</table></div>' : '') +
          ((bm.tvillinger || []).length ? '<details class="au-ny-tv"><summary class="au-ny-etikett" style="cursor:pointer">Benchmark sine tvillinger' + (bm.pris ? ' · ' + auKr(bm.pris) : '') + '</summary>' + (bm.begrunnelse ? '<div class="au-ny-under" style="margin:6px 0">' + esc(bm.begrunnelse) + '</div>' : '') + '<table>' + bm.tvillinger.map(tvRad).join('') + '</table></details>' : '');
      }
      var kilder = [['auto', 'Auto'], ['skygge', 'Skygge'], ['cc', 'CC']].map(function (x) {
        var v = pr[x[0]];
        var bruk = x[0] !== 'auto' && v && kanBruke ? '<button type="button" class="au-ny-bruk" data-kilde="' + (x[0] === 'cc' ? 'cc' : 'grok') + '" data-fu="' + Math.round(v / 1000) * 1000 + '" data-fra="' + (b.finn_utpris || '') + '">Bruk</button>' : '';
        return '<div class="au-ny-kilde' + (x[0] === 'auto' ? ' valgt' : '') + '"><span>' + x[1] + '</span><b>' + k(v) + '</b>' + bruk + '</div>';
      }).join('');
      var tv = (b.naermeste || []).map(function (t) {
        var type = t.solgt ? '<span class="au-ny-solgt">solgt</span>' : '<span class="au-ny-ask">' + (t.fjernet ? 'fjernet' : 'ute') + '</span>';
        var km = auKr(t.km) + ' km';
        return '<tr><td>' + (t.url ? '<a href="' + esc(t.url) + '" target="_blank" rel="noopener">' + km + '</a>' : km) + '</td><td>' + type + '</td><td class="h">' + auKr(t.pris) + '</td></tr>';
      }).join('');
      var nyEl = document.createElement('div');
      nyEl.className = 'au-ny';
      nyEl.setAttribute('data-k', nokkel);
      nyEl.innerHTML =
        '<div class="au-ny-hode"><div><div class="au-ny-navn">' + esc(b.bil || b.regnr) + '</div>' +
          '<div class="au-ny-meta">' + (b.km != null ? auKr(b.km) + ' km · ' : '') + esc(b.regnr) + ' <span class="au-ny-arm">' + esc(b.arm || '') + '</span>' + (b.eiertid_aar != null ? ' · eid ' + String(b.eiertid_aar).replace('.', ',') + ' år' : '') + '</div></div></div>' +
        galleri +
        '<div class="au-ny-kunde"><div class="au-ny-etikett">Kunden skriver</div><p>' + (b.kunde_kommentar ? '«' + esc(b.kunde_kommentar) + '»' : '<span class="au-ny-dempet">Ingen kommentar</span>') + '</p></div>' +
        '<div><div class="au-ny-etikett">Estimat til kunden</div><div class="au-ny-estimat">' + (b.erp_lav ? auKr(b.erp_lav) + ' – ' + auKr(b.erp_hoy) + ' kr' : 'Ikke priset') + '</div>' +
          '<div class="au-ny-under">' + (b.finn_utpris ? 'Bygget på Finn-utpris ' + auKr(b.finn_utpris) + (ag && ag.erp && ag.erp.skrevet ? ' (FSD)' : ' (auto)') : 'Ingen Finn-utpris') + '</div></div>' +
        (ag ? agHtml : '<div><div class="au-ny-kilder">' + kilder + '</div><div class="au-ny-enig' + (sp != null && sp <= 5 ? '' : ' uenig') + '" style="margin-top:6px">' + esc(enTekst) + '</div></div>' +
        (tv ? '<div class="au-ny-tv"><div class="au-ny-etikett">Nærmeste like biler (car.info)</div><table>' + tv + '</table></div>' : '')) +
        '<div class="au-ny-knapper"><button type="button" class="au-ny-send">Send</button><button type="button" class="au-ny-sek au-ny-endre">Endre pris</button><button type="button" class="au-ny-sek au-ny-alt">Vis alt</button></div>';
      nyEl.querySelector('.au-ny-send').addEventListener('click', function (e) { e.preventDefault(); var eb = c.querySelector('.qa-send-btn'); if (eb && !eb.disabled) eb.click(); });
      nyEl.querySelector('.au-ny-alt').addEventListener('click', function (e) { e.preventDefault(); c.classList.toggle('au-vis-alt'); this.textContent = c.classList.contains('au-vis-alt') ? 'Skjul' : 'Vis alt'; });
      nyEl.querySelector('.au-ny-endre').addEventListener('click', function (e) {
        e.preventDefault(); c.classList.add('au-vis-alt'); nyEl.querySelector('.au-ny-alt').textContent = 'Skjul';
        var inp = c.querySelector('.qa-anker-input'); if (inp) { inp.scrollIntoView({ behavior: 'smooth', block: 'center' }); inp.focus(); }
      });
      nyEl.querySelectorAll('.au-ny-bruk').forEach(function (kn) {
        kn.addEventListener('click', function (e) {
          e.preventDefault();
          var inp = c.querySelector('.qa-anker-input'), sett = c.querySelector('.qa-anker-btn');
          if (!inp || !sett) return;
          inp.value = this.getAttribute('data-fu'); inp.dataset.kilde = this.getAttribute('data-kilde'); inp.dataset.fra = this.getAttribute('data-fra') || '';
          sett.click();
        });
      });
      if (ny) ny.replaceWith(nyEl); else c.insertBefore(nyEl, c.firstChild);
      ny = nyEl;
      c.classList.add('au-ny-modus');
    }
    // Send-knappen følger den ekte knappen (tekst og om den er aktiv)
    var ekte = c.querySelector('.qa-send-btn'), send = ny.querySelector('.au-ny-send');
    if (send) {
      var tekst = ekte ? (ekte.innerText || '').replace(/[^\wæøåÆØÅ ]/g, '').trim() : '';
      send.textContent = (tekst || 'Send') + (b.erp_lav ? ' · ' + auKr(b.erp_lav) + ' – ' + auKr(b.erp_hoy) : '');
      send.disabled = !ekte || ekte.disabled;
    }
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
      try { if (b.agent) qkKort(c, b); else auVenterKort(c, b); } catch (e) { if (window.console) console.warn('au-ny', e); try { var fk = c.querySelector(':scope > .au-ny'); if (!fk) { fk = document.createElement('div'); fk.className = 'au-ny'; c.insertBefore(fk, c.firstChild); } fk.setAttribute('data-k', 'feil'); fk.innerHTML = '<div style="color:#A33A23;font-size:13px">Kortet kunne ikke tegnes (' + esc(e && e.message || e) + '). Gi beskjed til Claude.</div>'; } catch (_) {} }
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
      if (topp && ekte) { topp.disabled = ekte.disabled; var et = (ekte.innerText || '').trim(); if (et && topp.textContent !== et) topp.textContent = et; var ecs = getComputedStyle(ekte); if (topp.style.backgroundColor !== ecs.backgroundColor) topp.style.backgroundColor = ecs.backgroundColor; if (topp.style.color !== ecs.color) topp.style.color = ecs.color; topp.style.cursor = ekte.disabled ? 'not-allowed' : 'pointer'; }

      // c506: små ikoner for det som står lenger ned på kortet (selgerkommentar, tidligere priset). Klikk = gå dit.
      var merker = auMerker(c);
      var nokkel = merker.map(function (m) { return m.t; }).join(',') + '|' + JSON.stringify(b.grok || null) + '|' + JSON.stringify(b.cc || null) + '|' + JSON.stringify(b.slutt || null) + '|' + JSON.stringify(b.enighet || null) + '|' + JSON.stringify(b.bilde || null) + '|' + (b.eiertid_aar != null ? b.eiertid_aar : '') + '|' + b.score + '|' + (b.stopp || []).join(';') + '|' + (b.grunner || []).join(';') + '|' + infoAlle.join(';') + '|' + kost;
      if (gammel && gammel.getAttribute('data-k') === nokkel) continue;
      var nivaa = b.score >= 80 ? 'g' : b.score < 50 ? 'r' : 'y';
      var farge = { g: '#004225', r: '#B8452F', y: '#8A6D10' }[nivaa];
      var bakgrunn = { g: '#E3EFE7', r: '#F8E6E1', y: '#FBF3D8' }[nivaa];
      var ha = auHovedarsak(b);
      var rute = b.ville_sendt ? 'AUTO' : ('QA · ' + Math.max(0, (d.grense || 80) - b.score) + ' POENG FRA AUTO');
      var fu = b.finn_utpris != null ? 'Finn-utpris <strong style="font-variant-numeric:tabular-nums">' + auKr(b.finn_utpris) + '</strong>' : '';
      // c501: eiertid som egen linje i statusboksen, ikke koblet til Finn-utpris
      // c521: Grok-skyggeboten som kontroll (auto-score v3). Vises ved siden av vår Finn-utpris.
      var g = b.grok || null;
      var grok = '';
      if (g && g.status === 'priset' && g.finn_utpris) {
        var gAv = g.avvik_pst != null ? Math.abs(g.avvik_pst) : null;
        var gFarge = gAv == null ? '#16201B' : gAv > 20 ? '#B8452F' : gAv > 10 ? '#8A6D10' : '#004225';
        grok = '<span>Skygge <strong style="font-variant-numeric:tabular-nums">' + auKr(g.finn_utpris) + '</strong>' + (g.n != null ? ' · ' + g.n + ' tvillinger' : '') + (gAv != null ? ' · <strong style="color:' + gFarge + '">avvik ' + (g.avvik_pst > 0 ? '+' : '') + g.avvik_pst + ' %</strong>' : '') + (g.p25 && g.p75 ? ' · spenn ' + auKr(g.p25) + '–' + auKr(g.p75) : '') + '</span>';
        if (c.querySelector('.qa-anker-input')) {
          grok += ' <button type="button" class="au-bruk-grok" data-fu="' + Math.round(g.finn_utpris / 1000) * 1000 + '" data-fra="' + (b.finn_utpris || '') + '" title="Sett skyggens Finn-utpris i Finn-pris-feltet og skriv Lav/Høy til ERP. Logges som kilde Grok." style="font-size:12px;font-weight:700;border:1px solid #004225;background:#fff;color:#004225;border-radius:6px;padding:2px 9px;cursor:pointer;margin-left:4px">Bruk skygge</button>';
        }
        if ((g.tvillinger && g.tvillinger.length) || g.begrunnelse) {
          grok += '<details style="font-size:12.5px;color:#5E6B62"><summary style="cursor:pointer;color:#004225;font-weight:600;width:max-content">+ Skyggens tvillinger</summary>' +
            (g.begrunnelse ? '<div style="margin:6px 0">' + esc(g.begrunnelse) + '</div>' : '') +
            (g.tvillinger && g.tvillinger.length ? '<table style="border-collapse:collapse;font-variant-numeric:tabular-nums;margin-top:4px"><tr style="text-align:left"><th style="padding:2px 8px 2px 0">Finn</th><th style="padding:2px 8px">År</th><th style="padding:2px 8px;text-align:right">Km</th><th style="padding:2px 8px">Gir</th><th style="padding:2px 8px;text-align:right">Pris</th><th style="padding:2px 8px;text-align:right">Justert</th><th style="padding:2px 8px">Type</th></tr>' +
              g.tvillinger.map(function (t) {
                var lenke = t.finnkode ? '<a href="https://www.finn.no/mobility/item/' + encodeURIComponent(t.finnkode) + '" target="_blank" rel="noopener" style="color:#004225">' + esc(t.finnkode) + '</a>' : '–';
                return '<tr title="' + esc(t.grunn || '') + '"><td style="padding:2px 8px 2px 0">' + lenke + '</td><td style="padding:2px 8px">' + (t.aar || '–') + '</td><td style="padding:2px 8px;text-align:right">' + (t.km != null ? auKr(t.km) : '–') + '</td><td style="padding:2px 8px">' + esc(t.gir || '') + '</td><td style="padding:2px 8px;text-align:right">' + (t.pris ? auKr(t.pris) : '–') + '</td><td style="padding:2px 8px;text-align:right">' + (t.justert ? auKr(t.justert) : '–') + '</td><td style="padding:2px 8px">' + esc(t.klasse || '') + '</td></tr>';
              }).join('') + '</table>' : '') +
          '</details>';
        }
      } else if (g && g.status === 'venter') {
        grok = '<span style="color:#5E6B62">Skygge: venter på pris</span>';
      } else if (g) {
        grok = '<span style="color:#B8452F">Skygge: ' + (g.status === 'timeout' ? 'timeout' : 'ingen pris') + (g.grunn ? ' (' + esc(String(g.grunn).replace(/_/g, ' ')) + ')' : '') + '</span>';
      }
      // c532: CC = Claude Code priser som en forhandler (leser annonsene). Finn-utpris = km-justert median av tvillingene den valgte.
      var cc = b.cc || null;
      var ccHtml = '';
      if (cc && cc.status === 'priset' && cc.finn_utpris) {
        var cAv = cc.avvik_pst != null ? Math.abs(cc.avvik_pst) : null;
        var cFarge = cAv == null ? '#16201B' : cAv > 20 ? '#B8452F' : cAv > 10 ? '#8A6D10' : '#004225';
        ccHtml = '<span>CC <strong style="font-variant-numeric:tabular-nums">' + auKr(cc.finn_utpris) + '</strong> · ' + cc.n + ' tvillinger · ' + (cc.n_forkastet || 0) + ' forkastet' + (cAv != null ? ' · <strong style="color:' + cFarge + '">avvik ' + (cc.avvik_pst > 0 ? '+' : '') + cc.avvik_pst + ' %</strong>' : '') + '</span>';
        if (c.querySelector('.qa-anker-input')) {
          ccHtml += ' <button type="button" class="au-bruk-grok" data-kilde="cc" data-fu="' + Math.round(cc.finn_utpris / 1000) * 1000 + '" data-fra="' + (b.finn_utpris || '') + '" title="Sett CC sin Finn-utpris i Finn-pris-feltet og skriv Lav/Høy til ERP. Logges som kilde CC." style="font-size:12px;font-weight:700;border:1px solid #004225;background:#fff;color:#004225;border-radius:6px;padding:2px 9px;cursor:pointer;margin-left:4px">Bruk CC</button>';
        }
        ccHtml += '<details style="font-size:12.5px;color:#5E6B62"><summary style="cursor:pointer;color:#004225;font-weight:600;width:max-content">+ CC sine tvillinger</summary>' +
          (cc.begrunnelse ? '<div style="margin:6px 0">' + esc(cc.begrunnelse) + '</div>' : '') +
          '<table style="border-collapse:collapse;font-variant-numeric:tabular-nums;margin-top:4px"><tr style="text-align:left"><th style="padding:2px 8px 2px 0">Finn</th><th style="padding:2px 8px">År</th><th style="padding:2px 8px;text-align:right">Km</th><th style="padding:2px 8px;text-align:right">Pris</th><th style="padding:2px 8px;text-align:right">Justert</th><th style="padding:2px 8px">Utstyr</th></tr>' +
          (cc.tvillinger || []).map(function (t) {
            var lenke = t.finnkode ? '<a href="https://www.finn.no/mobility/item/' + encodeURIComponent(t.finnkode) + '" target="_blank" rel="noopener" style="color:#004225">' + esc(t.finnkode) + '</a>' : '–';
            return '<tr title="' + esc(t.hvorfor || '') + '"><td style="padding:2px 8px 2px 0">' + lenke + '</td><td style="padding:2px 8px">' + (t.aar || '–') + '</td><td style="padding:2px 8px;text-align:right">' + (t.km != null ? auKr(t.km) : '–') + '</td><td style="padding:2px 8px;text-align:right">' + (t.pris ? auKr(t.pris) : '–') + '</td><td style="padding:2px 8px;text-align:right">' + (t.justert ? auKr(t.justert) : '–') + '</td><td style="padding:2px 8px">' + esc(t.utstyr || '') + '</td></tr>';
          }).join('') + '</table>' +
          ((cc.forkastet || []).length ? '<div style="margin-top:6px"><b>Forkastet:</b> ' + cc.forkastet.map(function (f) { return '<a href="https://www.finn.no/mobility/item/' + encodeURIComponent(f.finnkode) + '" target="_blank" rel="noopener" style="color:#5E6B62">' + esc(f.finnkode) + '</a> ' + esc(f.grunn); }).join(' · ') + '</div>' : '') +
          '<div style="margin-top:4px">' + (cc.sek ? Math.round(cc.sek / 60) + ' min' : '') + (cc.usd != null ? ' · $' + cc.usd + ' (API-verdi, går på abonnement)' : '') + (cc.modell ? ' · ' + esc(cc.modell) : '') + '</div>' +
          '</details>';
      } else if (cc && cc.status === 'feilet') {
        ccHtml = '<span style="color:#B8452F">CC: ingen pris' + (cc.grunn ? ' (' + esc(cc.grunn) + ')' : '') + '</span>';
      }
      // c533: egen score per kilde + sluttscore for prisen vi ville brukt (visning; endrer ikke auto-send).
      var kildeHtml = '';
      if (b.slutt && b.kilder) {
        var navnK = { cc: 'CC', auto: 'Auto', grok: 'Skygge' };
        var fargeS = function (n) { return n >= 80 ? '#004225' : n < 50 ? '#B8452F' : '#8A6D10'; };
        var deler = ['cc', 'auto', 'grok'].filter(function (k) { return b.kilder[k]; }).map(function (k) { return navnK[k] + ' <strong style="color:' + fargeS(b.kilder[k].score) + '">' + b.kilder[k].score + '</strong>'; });
        var bak = (b.slutt.enige || []).map(function (x) { return 'enig ' + x.replace(/^(\w+)/, function (m) { return navnK[m] || m; }); }).concat((b.slutt.uenige || []).map(function (x) { return 'uenig ' + x.replace(/^(\w+)/, function (m) { return navnK[m] || m; }); }));
        kildeHtml = '<span>Score per kilde: ' + deler.join(' · ') + ' → <strong style="color:' + fargeS(b.slutt.score) + '">slutt ' + b.slutt.score + '</strong> (' + (navnK[b.slutt.kilde] || b.slutt.kilde) + (bak.length ? ', ' + esc(bak.join(', ')) : '') + ')</span>';
      }
      var eier = b.eiertid_aar != null ? '<span>Eiertid <strong style="font-variant-numeric:tabular-nums">' + String(b.eiertid_aar).replace('.', ',') + ' år</strong></span>' : '';
      var detaljer = (b.stopp || []).map(function (x) { return 'Stopp: ' + x; }).concat(b.grunner || []);
      if (kost) detaljer.push('Kostnad: ' + kost);
      var el2 = document.createElement('div');
      el2.className = 'au-qa-poeng';
      el2.setAttribute('data-k', nokkel);
      el2.style.cssText = 'margin:0 0 10px;display:grid;gap:8px';
      // c524: bilde øverst. Kundens bilde (ERP) eller forsidebildet til Groks første tvilling på Finn, merket «lignende bil».
      var bildeHtml = '';
      var bildeListe = [];
      if (b.bilde && Array.isArray(b.bilde.bilder)) {
        bildeListe = b.bilde.bilder.map(function (x) {
          if (x.url) return x.url;
          if (x.lokal != null && window.PA_PROXY_ERP && window.PA_TOKEN_ERP) return window.PA_PROXY_ERP.replace(/\/list\/$/, '/bilde/') + encodeURIComponent(b.id + '-' + x.lokal) + '?t=' + encodeURIComponent(window.PA_TOKEN_ERP);
          return null;
        }).filter(Boolean);
      }
      if (bildeListe.length) {
        var lign = b.bilde.kilde === 'lignende';
        var bildeTekst = lign ? 'Lignende bil fra Finn' + (b.bilde.finnkode ? ' (' + b.bilde.finnkode + ')' : '') + ', ikke kundens bil' : 'Kundens bilde';
        var pilStil = 'border:1px solid #DCD8CC;background:#fff;color:#16201B;border-radius:6px;width:28px;height:28px;font-size:16px;line-height:1;cursor:pointer';
        bildeHtml = '<figure class="au-bilder" data-bilder="' + esc(JSON.stringify(bildeListe)) + '" data-ix="0" style="margin:0;display:grid;gap:4px;justify-items:start">' +
          '<img src="' + esc(bildeListe[0]) + '" alt="' + esc(bildeTekst) + '" loading="lazy" style="width:auto;max-width:30%;max-height:180px;min-width:120px;object-fit:contain;border-radius:8px;background:#E7E4DA' + (lign ? ';opacity:.85' : '') + '">' +
          '<figcaption style="display:flex;gap:8px;align-items:center;font-size:11.5px;color:' + (lign ? '#8A6D10' : '#5E6B62') + '">' +
            (bildeListe.length > 1 ? '<button type="button" class="au-bilde-forrige" aria-label="Forrige bilde" style="' + pilStil + '">‹</button><span class="au-bilde-nr" style="font-variant-numeric:tabular-nums">1 / ' + bildeListe.length + '</span><button type="button" class="au-bilde-neste" aria-label="Neste bilde" style="' + pilStil + '">›</button>' : '') +
            '<span>' + esc(bildeTekst) + '</span></figcaption></figure>';
      }
      // c535: auto, skygge og CC på én linje øverst, farget etter spennet: grønn ≤5 %, gul ≤10 %, rød over (Mike 13.10).
      var enHtml = '';
      var en = b.enighet || null;
      if (en && en.priser) {
        var tre = [['Auto', en.priser.auto], ['Skygge', en.priser.skygge], ['CC', en.priser.cc]].map(function (p) { return '<span>' + p[0] + ' <strong style="font-variant-numeric:tabular-nums">' + (p[1] ? Math.round(p[1] / 1000) + 'k' : '–') + '</strong></span>'; });
        var sp = en.spenn_pst;
        var eF = sp == null ? '#5E6B62' : sp <= 5 ? '#004225' : sp <= 10 ? '#8A6D10' : '#B8452F';
        var eB = sp == null ? '#EEF0EC' : sp <= 5 ? '#E3EFE7' : sp <= 10 ? '#FBF3D8' : '#F8E6E1';
        var eT = sp == null ? 'mangler pris' : (sp <= 5 ? 'enige ' : 'uenige ') + sp + ' %';
        enHtml = '<div class="au-enighet" style="display:flex;flex-wrap:wrap;gap:6px 14px;align-items:center;background:' + eB + ';border-left:4px solid ' + eF + ';border-radius:8px;padding:8px 12px;font-size:15px;color:#16201B">' +
          tre.join('<span style="color:#9AA39C">·</span>') + '<strong style="color:' + eF + ';margin-left:auto">' + eT + '</strong></div>';
      }
      el2.innerHTML = enHtml + bildeHtml +
        '<div style="display:grid;grid-template-columns:auto 1fr;gap:12px;align-items:start;background:' + bakgrunn + ';border-radius:10px;padding:10px 12px">' +
          '<div style="display:grid;place-items:center;width:50px;height:50px;border-radius:50%;border:3px solid ' + farge + ';color:' + farge + ';font-weight:800;font-size:18px;font-variant-numeric:tabular-nums">' + b.score + '</div>' +
          '<div style="display:grid;gap:2px;color:#16201B;font-size:13.5px;line-height:1.4">' +
            '<span style="font-weight:700;font-size:11.5px;letter-spacing:.06em;color:' + farge + '">' + rute + '</span>' +
            '<b style="font-size:15px">' + esc(ha.t) + '</b>' +
            (ha.u || fu ? '<span>' + [esc(ha.u), fu].filter(Boolean).join(' ') + '</span>' : '') +
            grok +
            ccHtml +
            kildeHtml +
            eier +
            (merker.length ? '<span style="display:flex;flex-wrap:wrap;gap:6px;margin-top:2px">' + merker.map(function (m, ix) {
              return '<button type="button" class="au-merke" data-ix="' + ix + '" title="' + esc(m.tittel) + '" style="font-size:12px;border:1px solid #DCD8CC;background:#fff;border-radius:999px;padding:2px 9px;cursor:pointer;color:#16201B">' + m.t + '</button>';
            }).join('') + '</span>' : '') +
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
      el2.querySelectorAll('.au-bilder').forEach(function (fig) {
        var liste = []; try { liste = JSON.parse(fig.getAttribute('data-bilder') || '[]'); } catch (e) {}
        function vis(d) {
          if (!liste.length) return;
          var ix = (Number(fig.getAttribute('data-ix')) + d + liste.length) % liste.length;
          fig.setAttribute('data-ix', ix);
          fig.querySelector('img').src = liste[ix];
          var nr = fig.querySelector('.au-bilde-nr'); if (nr) nr.textContent = (ix + 1) + ' / ' + liste.length;
        }
        var f = fig.querySelector('.au-bilde-forrige'), n = fig.querySelector('.au-bilde-neste');
        if (f) f.addEventListener('click', function (e) { e.preventDefault(); vis(-1); });
        if (n) n.addEventListener('click', function (e) { e.preventDefault(); vis(1); });
      });
      el2.querySelectorAll('.au-bruk-grok').forEach(function (kn) {
        kn.addEventListener('click', function (e) {
          e.preventDefault();
          var kort = this.closest('.qa-card');
          var inp = kort && kort.querySelector('.qa-anker-input');
          var sett = kort && kort.querySelector('.qa-anker-btn');
          if (!inp || !sett) return;
          inp.value = this.getAttribute('data-fu');
          inp.dataset.kilde = this.getAttribute('data-kilde') || 'grok';
          inp.dataset.fra = this.getAttribute('data-fra') || '';
          sett.click();
        });
      });
      el2.querySelectorAll('.au-merke').forEach(function (kn) {
        kn.addEventListener('click', function (e) {
          e.preventDefault();
          var m = merker[Number(this.getAttribute('data-ix'))];
          if (!m || !m.el) return;
          var d = m.el.closest('details'); if (d) d.open = true;
          m.el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          var f = m.el.style.outline; m.el.style.outline = '2px solid #004225'; setTimeout(function () { m.el.style.outline = f; }, 1800);
        });
      });
      if (gammel) gammel.replaceWith(el2); else c.insertBefore(el2, c.firstChild);
      var nyF = c.querySelector(':scope > .au-ny'); if (nyF && c.firstChild !== nyF) c.insertBefore(nyF, c.firstChild);
    }
  }
  window.__qkKort = qkKort;
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
