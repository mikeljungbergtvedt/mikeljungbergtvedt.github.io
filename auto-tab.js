/* Peasy Pulse — Auto-fane (skygge). Leser auto-score.json (Mini: auto-score.js). Sender ingenting. */
(function () {
  // c572: skjul gamle auto-tellere («populert», «Kokker») og bytt IDENT/COMPS med tvillingene FSD og Benchmark brukte (Mike 13.10).
  (function () {
    if (document.getElementById('qa572-css')) return;
    var s = document.createElement('style'); s.id = 'qa572-css';
    s.textContent = '.au-hode-l{display:flex;align-items:baseline;gap:10px;white-space:nowrap;overflow:hidden}.au-hode-l .au-eier{margin-left:auto;color:#6B756F;font-size:13px}#qa-counters,.qa-finn-legends{display:none!important}table.au-tv2{table-layout:auto!important;width:auto!important;min-width:100%!important}table.au-tv2 th,table.au-tv2 td{padding:5px 6px 5px 0!important;letter-spacing:normal!important;text-transform:none!important;font-size:12.5px!important;background:none}table.au-tv2 th{font-size:11px!important;color:#5E6B62!important}table.au-tv{table-layout:fixed!important;min-width:0!important;width:100%!important}table.au-tv th,table.au-tv td{padding:4px 4px 4px 0!important;letter-spacing:normal!important;text-transform:none!important;font-size:12px!important}table.au-tv th{font-size:11px!important;color:#5E6B62!important;background:none!important}';
    (document.head || document.documentElement).appendChild(s);
  })();
  // c578: Send er låst til FSD har priset bilen (ikke stoppet) og pris er skrevet til ERP (Mike 13.10).
  function auSendLaas(c, b) {
    var ag = b.agent;
    var manuell = !!(ag && ag.pris_kilde && ag.pris_kilde.kilde === 'manuell' && b.erp_lav);
    // Manuell Finn-pris (skrevet til ERP) låser alltid opp, også når FSD har stoppet bilen.
    var grunn = manuell ? '' : !ag ? 'Venter på FSD og Benchmark' : (ag.fsd && ag.fsd.stopp) ? 'FSD har stoppet bilen. Sett Finn-pris manuelt.' : !(ag.erp && ag.erp.skrevet) ? 'Pris er ikke skrevet til ERP ennå' : '';
    [].forEach.call(c.querySelectorAll('.qa-send-btn, .au-send-topp'), function (k) {
      if (grunn) { if (!k.disabled || k.getAttribute('data-laast') !== '1') { k.disabled = true; k.setAttribute('data-laast', '1'); k.style.opacity = '.4'; k.style.cursor = 'not-allowed'; k.title = grunn; } }
      else if (k.getAttribute('data-laast') === '1') { k.removeAttribute('data-laast'); k.disabled = false; k.style.opacity = ''; k.style.cursor = ''; k.title = ''; }
    });
  }
  function auFsdBokser(c, b) {
    auSendLaas(c, b);
    auAarTopp(c, b, b.agent);
    auKmTopp(c, b, b.agent);
    // c579: knapperaden nederst, på linje mellom kortene i samme rad.
    var kn = c.querySelector('.qa-detail-btn') || c.querySelector('.qa-clear-btn');
    if (kn && kn.parentElement && !kn.parentElement.classList.contains('qa-actions')) kn.parentElement.classList.add('qa-actions');
    var ag = b.agent;
    if (!ag) {
      auOriginCv(c, b, null);
      // Venter på FSD: skjul gamle auto-deler (Claude/Grok-graf, IDENT/COMPS).
      var gml0 = c.querySelector('.qa-finn-terrain'); if (gml0) gml0.style.display = 'none';
      var l0 = [].filter.call(c.querySelectorAll('div'), function (d) { return d.children.length === 0 && d.textContent === 'IDENT'; })[0];
      if (l0 && l0.parentElement && l0.parentElement.parentElement) l0.parentElement.parentElement.style.display = 'none';
      return;
    }
    auFsdGraf(c, b, ag);
    auPrisTag(c, ag);
    auMidPris(c, b, ag);
    auOriginCv(c, b, ag);
    auEierPlass(c);
    if (c.querySelector('table.au-tv2')) auStickyLefts(c);
    var lbl = [].filter.call(c.querySelectorAll('div'), function (d) { return d.children.length === 0 && d.textContent === 'IDENT'; })[0];
    var grid = lbl && lbl.parentElement && lbl.parentElement.parentElement;
    if (!grid || grid.getAttribute('data-fsd') === '2') return;
    // c573: tvillingtabell med alle felt som skiller ekte fra falske tvillinger. Avvik fra bilen i rødt. Ingen gjetting: mangler = «–».
    var tv = Array.isArray(ag.tvillinger) ? ag.tvillinger : [];
    var me = ag.bilen || {};
    var tekst = function (x) { return [x.modell, x.motor, x.tittel].filter(Boolean).join(' '); };
    var drv = function (x) { var d = String(x.drivlinje || ''); if (/4|awd|firehjul/i.test(d)) return '4WD'; if (/2|fwd|rwd|forhjul|bakhjul/i.test(d)) return '2WD'; return /xdrive|quattro|4motion|4matic|awd|4x4|4wd|allrad|e-four|all4/i.test(tekst(x)) ? '4WD' : null; };
    var gir = function (x) { var g = String(x.gir || ''); return /aut/i.test(g) ? 'Aut' : /man/i.test(g) ? 'Man' : null; };
    var hkAv = function (x) { return x.hk || Number((String(x.tittel || '').match(/(\d{2,3})\s*hk/i) || [])[1]) || null; };
    var kwh = function (x) { if (x.batteri_kwh) return String(x.batteri_kwh).replace(',', '.') + ' kWh'; var m = tekst(x).match(/(\d{2,3}(?:[.,]\d)?)\s*kwh/i); return m ? m[1].replace(',', '.') + ' kWh' : null; };
    var rekk = function (x) { return x.rekkevidde_km ? auKr(x.rekkevidde_km) + ' km' : null; };
    var kar = function (x) { var k = String(x.karosseri || '').trim(); if (!k) return null; k = k.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(); return k.length <= 3 ? k.toUpperCase() : k.charAt(0).toUpperCase() + k.slice(1); };
    var mdl = function (x) {
      var t = x.modell ? [x.modell, x.motor].filter(Boolean).join(' ') : String(x.tittel || '').split(' - ')[0];
      return t.replace(/\(?\d{2,3}(?:[.,]\d)?\s*kwh\)?/ig, '').replace(/\(\d{2,3}\s*kw\)/ig, '').replace(/\b(elektrisk|elbil|bensin|diesel|hybrid)\b/ig, '').replace(/\b(manuell|automat(isk)?|stasjonsvogn|sedan|kombi|suv|coupe|coupé|cabriolet|flerbruksbil)\b/ig, '').replace(/\b(19|20)\d{2}\b/g, '').replace(/\d{2,3}\s*hk/ig, '').replace(/[,·]+/g, ' ').replace(/\s{2,}/g, ' ').trim();
    };
    var aarAv = function (x) { return x.aar || x.modellaar || null; };
    var ev = !!kwh(me) || /elektrisk|electric|\bev\b|kwh/i.test(tekst(me)) || tv.some(function (t) { return !!kwh(t); });
    // Mike 14.10: årsmodell alltid fra car.info (agent.bil.modellaar). Avvik mot ERP vises som «ERP 2025»; mangler car.info: ERP-år merket «(ERP)».
    var aarCi = (ag.bil && ag.bil.kilde !== 'vegvesen' && ag.bil.modellaar) || null;
    var refAar = aarCi || ag.erp_aar || null;
    var aarMerke = !aarCi && ag.erp_aar ? ' <small style="color:#8C978F">(ERP)</small>' : (aarCi && ag.erp_aar && Number(ag.erp_aar) !== Number(aarCi) ? ' <small style="color:#8C978F">ERP ' + esc(String(ag.erp_aar)) + '</small>' : '');
    var felt = [
      ['År', function (x, egen) { return egen ? refAar : aarAv(x); }, refAar],
      ['Hk', hkAv, hkAv(me)],
    ];
    if (ev) felt.push(['Batteri', kwh, kwh(me)], ['Rekkev.', rekk, me.rekkevidde_kilde === 'vegvesen' ? null : rekk(me), function (a, b) { var x = parseInt(String(a).replace(/\D/g, ''), 10), y = parseInt(String(b).replace(/\D/g, ''), 10); return !x || !y || Math.abs(x - y) / y <= 0.05; }]);
    felt.push(['Gir', gir, gir(me)], ['Drift', drv, drv(me)], ['Karosseri', kar, kar(me)]);
    var utst = function (x) { return x.utstyr || null; };
    var td = 'padding:5px 10px 5px 0;border-top:1px solid #E7EBE4;vertical-align:top;white-space:nowrap';
    var cel = function (v, ref, egen, lik) { var avvik = !egen && ref != null && (lik ? !lik(v, ref) : String(v) !== String(ref)); return v == null || v === '' ? '<span style="color:#9AA39C">–</span>' : (avvik ? '<b style="color:' + AU_AVVIK_RED + '">' + esc(v) + '</b>' : esc(v)); };
    var st = function (i, ekstra) { return ';position:sticky;left:0;background:inherit;z-index:2' + (ekstra || '') + '" data-s="' + i; };
    var rad = function (x, egen, id, km, pris, status) {
      return '<tr style="background:' + (egen ? '#F3F6F4' : '#fff') + '"><td style="' + td + st(0) + '">' + id + '</td><td style="' + td + st(1, ';text-align:right') + '">' + km + '</td><td style="' + td + st(2, ';text-align:right') + '">' + pris + '</td><td style="' + td + st(3, ';border-right:1px solid #E7EBE4') + '">' + status + '</td>' +
        '<td style="' + td + ';max-width:190px;overflow:hidden;text-overflow:ellipsis;padding-left:8px" title="' + esc(mdl(x)) + '">' + esc(mdl(x) || '–') + '</td>' +
        felt.map(function (f) { return '<td style="' + td + '">' + cel(f[1](x, egen), f[2], egen, f[3]) + (egen && f[0] === 'År' ? aarMerke : '') + '</td>'; }).join('') + '</tr>';
    };
    var html = '<div style="font-size:11px;font-weight:800;letter-spacing:.4px;color:#004225;margin-bottom:4px">TVILLINGER ' + tv.length + '</div>';
    if (utst(me)) html += '<div style="font-size:13px;line-height:1.45;margin:0 0 8px;padding:6px 10px;background:#F3F6F4;border-radius:6px"><b>Bilens utstyr:</b> ' + esc(utst(me)) + '</div>';
    if (tv.length) {
      html += '<div style="overflow-x:auto;-webkit-overflow-scrolling:touch"><table class="au-tv2" style="border-collapse:collapse;font-size:12.5px;font-variant-numeric:tabular-nums;min-width:100%"><tr style="text-align:left;color:#5E6B62;font-size:11px;background:#fff"><th style="width:70px;min-width:70px' + st(0) + '">Finn</th><th style="width:56px;min-width:56px;text-align:right' + st(1) + '">Km</th><th style="width:60px;min-width:60px;text-align:right' + st(2) + '">Pris</th><th style="width:46px;min-width:46px' + st(3, ';border-right:1px solid #E7EBE4') + '">Status</th><th style="padding-left:8px">Modell / variant</th>' +
        felt.map(function (f) { return '<th>' + f[0] + '</th>'; }).join('') + '</tr>' +
        rad(me, true, '<b>Bilen</b>', auKm(ag, b) != null ? auKr(auKm(ag, b)) : '–', '', '') +
        tv.map(function (t) {
          var url = t.lenke || (t.finnkode ? 'https://www.finn.no/mobility/item/' + t.finnkode : null);
          var kode = (String(url || '').match(/(\d{6,})/) || [])[1] || '–';
          return rad(t, false, url ? '<a href="' + esc(url) + '" target="_blank" rel="noopener" style="color:#004225">' + esc(kode) + '</a>' : esc(kode), t.km ? auKr(t.km) : '–', t.pris ? auKr(t.pris) : '–', t.status === 'solgt' ? 'Solgt' : t.status === 'fjernet' ? 'Fjernet' : 'Aktiv');
        }).join('') + '</table></div>';
      var medU = tv.filter(function (t) { return utst(t); });
      if (medU.length) html += '<div style="margin-top:10px;font-size:11px;font-weight:800;letter-spacing:.4px;color:#004225">UTSTYR PER TVILLING</div>' + medU.map(function (t) {
        var kode = (String(t.lenke || t.finnkode || '').match(/(\d{6,})/) || [])[1] || '–';
        return '<div style="font-size:12.5px;line-height:1.45;padding:4px 0;border-top:1px solid #E7EBE4"><b>' + esc(kode) + '</b> · ' + (t.pris ? auKr(t.pris) + ' · ' : '') + esc(utst(t)) + '</div>';
      }).join('');
    } else html += '<div style="font-size:12.5px;color:#5E6B62">FSD og Benchmark har ingen tvillinger for bilen.</div>';
    grid.setAttribute('data-fsd', '2');
    setTimeout(function () { auStickyLefts(grid); }, 0);
    grid.style.cssText = 'margin-bottom:8px;padding:10px 12px;border:1px solid #DCE1D9;border-radius:8px;background:#fff;min-width:0';
    grid.innerHTML = html;
  }
  // c573: FSD/Benchmark-graf i stedet for Claude/Grok-sliden. Midtverdien er Finn-prisen som går inn i fossefallet.
  function auFsdGraf(c, b, ag) {
    var gml = c.querySelector('.qa-finn-terrain');
    if (!gml) return;
    var fP = ag.fsd && ag.fsd.pris, bP = ag.benchmark && ag.benchmark.pris;
    var av = auAvvik(ag, b);
    var mid = av.mid;
    var sig = [fP, bP, mid, av.varsel].join('|');
    var ny = c.querySelector('.au-fsdgraf');
    if (ny && ny.getAttribute('data-sig') === sig) { gml.style.display = 'none'; return; }
    gml.style.display = 'none';
    if ((ag.fsd && ag.fsd.stopp) || !mid) { if (ny) ny.remove(); return; }
    var vals = [fP, bP, mid].filter(function (v) { return v > 0; });
    var html = '';
    if (vals.length) {
      var lo = Math.min.apply(null, vals), hi = Math.max.apply(null, vals);
      var pad = Math.max((hi - lo) * 0.35, hi * 0.04);
      lo -= pad; hi += pad;
      var pos = function (v) { return ((v - lo) / (hi - lo) * 100).toFixed(1) + '%'; };
      var k = function (n) { return Math.round(n / 1000) + 'k'; };
      var mark = function (v, farge, lab, opp) { return '<div style="position:absolute;left:' + pos(v) + ';top:' + (opp ? '0' : '34px') + ';transform:translateX(-50%);font-size:12px;color:' + farge + ';white-space:nowrap;font-weight:600">' + lab + '</div><div style="position:absolute;left:' + pos(v) + ';top:20px;width:2px;height:14px;margin-left:-1px;background:' + farge + '"></div>'; };
      html = '<div style="position:relative;height:56px;margin:6px 8px 2px">' +
        '<div style="position:absolute;left:0;right:0;top:26px;height:2px;background:#DCE1D9;border-radius:1px"></div>' +
        (fP && bP ? '<div style="position:absolute;left:' + pos(Math.min(fP, bP)) + ';width:calc(' + pos(Math.max(fP, bP)) + ' - ' + pos(Math.min(fP, bP)) + ');top:25px;height:4px;border-radius:2px;background:' + (av.varsel ? AU_DEMPET.y.kant : '#B9C7BE') + '"></div>' : '') +
        (fP ? mark(fP, '#1D4ED8', 'FSD ' + k(fP), true) : '') +
        (bP ? mark(bP, '#5E6B62', 'Bench ' + k(bP), !fP || Math.abs(fP - bP) / Math.max(fP, bP) > 0.06) : '') +
        (mid ? '<div style="position:absolute;left:' + pos(mid) + ';top:19px;width:16px;height:16px;margin-left:-8px;border-radius:50%;background:#004225;border:3px solid #fff;box-shadow:0 0 0 1.5px #004225"></div>' : '') +
        '</div>' +
        '<div style="display:flex;justify-content:space-between;gap:10px;align-items:baseline;font-variant-numeric:tabular-nums;margin:0 2px">' +
          '<span style="font-size:15px;color:#004225"><b>Mid ' + (mid ? auKr(mid) : '–') + '</b> → fossefall</span>' +
          (fP && bP ? '<span style="font-size:12.5px;color:' + (av.varsel ? AU_DEMPET.y.tekst : '#5E6B62') + '">FSD vs Bench ' + (fP >= bP ? '+' : '') + Math.round((fP - bP) / bP * 100) + ' %' + (av.varsel ? ' · over terskel ' + auKr(Math.round(av.terskel)) : '') + '</span>' : '') +
        '</div>';
    }
    if (!ny) { ny = document.createElement('div'); ny.className = 'au-fsdgraf'; ny.style.cssText = 'margin:4px 0 10px'; gml.parentNode.insertBefore(ny, gml.nextSibling); }
    ny.setAttribute('data-sig', sig);
    ny.innerHTML = html;
  }

  // c575: dempede statusfarger og avviksvarsel (Mike 13.10). Terskel = clamp(5 % av Mid, 5 000, 50 000). Ikke en blokkering.
  var AU_DEMPET = {
    g: { bak: '#EEF5F0', kant: '#8DB89D', tekst: '#2F5E43' },
    y: { bak: '#F7F1DC', kant: '#D3C07E', tekst: '#6B5A1F' },
    r: { bak: '#F8ECEC', kant: '#D19A9A', tekst: '#8A3B3B' }
  };
  var AU_AVVIK_RED = '#A65B52';
  function auTerskel(mid) { return Math.min(50000, Math.max(5000, 0.05 * mid)); }
  function auAvvik(ag, b) {
    var f = ag.fsd && ag.fsd.pris, bm = ag.benchmark && ag.benchmark.pris;
    // Mike 14.10: Mid = (FSD + Bench) / 2 (eller den som finnes). Manuell pris og origin95-kapp er regnet inn i ag.mid_pris (auto-score).
    var mid = ag.mid_pris != null ? ag.mid_pris : (ag.fsd && ag.fsd.stopp) ? null : (f && bm ? Math.round((f + bm) / 2) : f || bm) || null;
    var diff = f && bm ? Math.abs(f - bm) : null;
    var terskel = mid ? auTerskel(mid) : null;
    return { mid: mid, diff: diff, terskel: terskel, varsel: !!(diff != null && terskel && diff > terskel) };
  }
  // c576: faste kolonner (Finn, Km, Pris, Status) får left = faktisk posisjon, så de aldri dekker modellteksten.
  function auStickyLefts(root) {
    var t = root.querySelector('table.au-tv2'); if (!t) return;
    var box = t.parentElement, sl = box.scrollLeft; box.scrollLeft = 0;
    var alle = t.querySelectorAll('[data-s]');
    [].forEach.call(alle, function (c) { c.style.left = 'auto'; });
    var t0 = t.getBoundingClientRect().left;
    var lefts = [].map.call(t.querySelectorAll('tr:first-child [data-s]'), function (th) { return Math.round(th.getBoundingClientRect().left - t0); });
    box.scrollLeft = sl;
    [].forEach.call(alle, function (c) { c.style.left = (lefts[Number(c.getAttribute('data-s'))] || 0) + 'px'; });
  }
  function auEierPlass(c) {
    var l = c.querySelector('.au-hode-l'), e = l && l.querySelector('.au-eier');
    if (!e) return; e.style.display = ''; if (l.scrollWidth > l.clientWidth + 1) e.style.display = 'none';
  }
  // c576: «Manuell · X» bare når Finn-prisen er satt for hånd. Ellers «Merged · X» (Mid av FSD og Benchmark).
  function auPrisTag(c, ag) {
    // Mike 14.10: tre piller: FSD · x, Bench · y, Merged · Mid. Manuell vinner. Ingen Claude/Grok/Merge fra den gamle prisingen.
    var box = c.querySelector('.qa-chef-pills');
    var k = function (n) { return n ? auKr(n) : '–'; };
    var f = ag.fsd && ag.fsd.pris, bm = ag.benchmark && ag.benchmark.pris;
    var html = ag.mid_kilde === 'manuell'
      ? '<span class="qa-chef-pill qa-chef-pill--merge" title="Finn-pris satt for hånd">Manuell · ' + k(ag.mid_pris) + '</span>'
      : '<span class="qa-chef-pill" title="FSD (Grok)">FSD · ' + k(f) + '</span><span class="qa-chef-pill" title="Benchmark (Claude)">Bench · ' + k(bm) + '</span>' +
        '<span class="qa-chef-pill qa-chef-pill--merge" title="' + (ag.mid_kilde === 'merged+origin95' ? 'Mid kappet til 0,95 × kundens egen Finn-annonse' : 'Mid = (FSD + Bench) / 2') + '">Merged · ' + k(ag.mid_pris) + (ag.mid_kilde === 'merged+origin95' ? ' (origin95)' : '') + '</span>';
    if (!box) { var cv = c.querySelector('.qa-origin-cv'); if (!cv) return; box = document.createElement('div'); box.className = 'qa-chef-pills'; cv.parentNode.insertBefore(box, cv.nextSibling); }
    if (box.getAttribute('data-sig') !== html) { box.innerHTML = html; box.setAttribute('data-sig', html); }
  }
  // Mike 14.10: prisdelen på kortet (A/B, «Kunde ser», sendelinjen, fossefallet) regnes fra Mid, ikke fra den gamle prisingens måling.
  function auMidPris(c, b, ag) {
    var mid = ag.mid_pris, ff = ag.mid_ff;
    if (!mid || !ff || ff.feil) return;
    var arm = String(b.arm || 'A').toUpperCase();
    var fak = { A: 1, B: 0.9, ORDNA: 0.75 };
    var r1 = function (n) { return n == null ? null : Math.round(n / 1000) * 1000; };
    var band = function (x) { var f0 = fak[x]; return { midt: r1(ff.a * f0), lav: r1(ff.lav * f0), hoy: r1(ff.hoy * f0) }; };
    var A = band('A'), B = band('B'), O = band('ORDNA');
    var aktiv = arm === 'B' ? B : arm === 'ORDNA' ? O : A;
    if (b.erp_lav && b.erp_hoy) { aktiv.lav = b.erp_lav; aktiv.hoy = b.erp_hoy; }
    var pct = function (n) { return n ? Math.round(n / mid * 100) + ' %' : ''; };
    var k = function (n) { return n ? auKr(n) : '–'; };
    var sig = JSON.stringify([mid, A, B, O, arm, b.erp_lav, b.erp_hoy]);
    var grid = [].filter.call(c.querySelectorAll('div'), function (d) { return /grid-template-columns:\s*44px/.test(d.getAttribute('style') || ''); })[0];
    if (grid && grid.getAttribute('data-mid') !== sig) {
      grid.setAttribute('data-mid', sig);
      var rad = function (navn, x) { return '<div style="color:var(--muted);">' + navn + '</div><div style="text-align:right;font-weight:700;">' + k(x.lav) + ' <span style="font-size:10px;color:#2F5E43">' + pct(x.lav) + '</span></div><div style="text-align:right;font-weight:600;">' + k(mid) + '</div><div style="text-align:right;">' + k(x.hoy) + ' <span style="font-size:10px;color:#2F5E43">' + pct(x.hoy) + '</span></div><div></div>'; };
      grid.innerHTML = '<div></div><div style="color:var(--muted);font-size:10px;text-align:right;">Lav</div><div style="color:var(--muted);font-size:10px;text-align:right;">Finn-pris (Mid)</div><div style="color:var(--muted);font-size:10px;text-align:right;">Høy</div><div></div>' + rad('A', A) + rad('B', B) + rad('Ordna', O);
    }
    [].forEach.call(c.querySelectorAll('div'), function (d) {
      if (d.children.length > 3) return;
      var t = (d.textContent || '').trim();
      if (/^Kunde ser \d+/.test(t)) d.innerHTML = '<b>Kunde ser ' + pct(aktiv.lav).replace(' %', '') + '–' + pct(aktiv.hoy) + ' av Finn</b> · ' + k(aktiv.lav) + '–' + k(aktiv.hoy) + ' kr';
      else if (/^Finn-pris [\d\s]+$/.test(t)) d.textContent = 'Finn-pris (Mid) ' + k(mid);
      else if (/Lav [\d\s]+ sendes til kunden/.test(t)) d.innerHTML = '<b>' + (arm === 'ORDNA' ? 'Ordna' : arm) + '</b> Lav <b>' + k(aktiv.lav) + '</b> sendes til kunden (fossefall fra Mid).';
    });
    var tabell = [].filter.call(c.querySelectorAll('table'), function (t) { return /^\s*Lag/.test((t.querySelector('tr') || {}).textContent || '') && /Finn-utpris/.test(t.textContent); })[0];
    if (tabell && tabell.getAttribute('data-mid') !== sig) {
      tabell.setAttribute('data-mid', sig);
      var td = 'padding:3px 6px;border-top:1px solid #E7EBE4;text-align:right;font-variant-numeric:tabular-nums';
      var rows = ff.trinn.map(function (l) { var sum = l[2] === 'sum'; return '<tr' + (sum ? ' style="font-weight:700"' : '') + '><td style="padding:3px 6px;border-top:1px solid #E7EBE4">' + (l[2] === 'start' ? 'Finn-utpris (Mid)' : (sum ? '= ' : '− ') + esc(l[0] === 'Midt' ? 'Peasy-bud midt' : l[0])) + '</td><td style="' + td + '">' + (l[1] == null ? '–' : (l[1] < 0 ? '−' : '') + auKr(Math.abs(l[1]))) + '</td><td style="' + td + '">' + (l[0] === 'Midt' ? k(B.midt) : '') + '</td><td style="' + td + '">' + (l[0] === 'Midt' ? k(O.midt) : '') + '</td></tr>'; }).join('');
      tabell.innerHTML = '<tr style="font-weight:700"><td style="padding:3px 6px">Lag</td><td style="' + td + '">A</td><td style="' + td + '">B</td><td style="' + td + '">Ordna</td></tr>' + rows +
        '<tr style="font-weight:700"><td style="padding:3px 6px;border-top:2px solid #2F5E43">Lav – høy</td><td style="' + td + ';border-top:2px solid #2F5E43">' + k(A.lav) + ' – ' + k(A.hoy) + '</td><td style="' + td + ';border-top:2px solid #2F5E43">' + k(B.lav) + ' – ' + k(B.hoy) + '</td><td style="' + td + ';border-top:2px solid #2F5E43">' + k(O.lav) + ' – ' + k(O.hoy) + '</td></tr>';
    }
  }

  // c581: ORIGIN-CV bare fra car.info for denne bilen (dette internnr), ikke fra en eldre registrering av samme regnr.
  // Hk og drivstoff fra car.info (systemeffekt og «Plug-in hybrid»), ikke Vegvesens bensinmotor. «+» viser hele car.info-svaret.
  function auOriginCv(c, b, ag) {
    var box = c.querySelector('.qa-origin-cv'); if (!box) return;
    var ci = ag && ag.bilen && ag.bilen.carinfo;
    var rad = function (t) { return '<div class="qa-origin-cv-row">' + t + '</div>'; };
    var html;
    if (!ci) {
      html = '<div class="qa-origin-cv-h">ORIGIN-CV</div>' + rad(esc(String(b.id)) + ' · ' + esc(b.regnr)) + rad('car.info mangler for ' + esc(String(b.id)));
    } else {
      var hk = ci.hk || ag.bilen.hk;
      var navn = ci.navn || '';
      var ekstra = (ci.tekniske || []).map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('');
      var pk = ci.pakker ? [].concat(ci.pakker.trim || [], ci.pakker.equip || []).filter(Boolean).join(', ') : '';
      var id = 'au-cvx-' + b.id;
      html = '<div class="qa-origin-cv-h">ORIGIN-CV<button type="button" class="au-cv-pluss" data-t="' + id + '" title="Åpne hele car.info-returen" style="border:1px solid #DCE1D9;background:#fff;border-radius:5px;width:22px;height:20px;cursor:pointer;font-weight:700;color:#0F6E66">+</button></div>' +
        rad(esc(String(b.id)) + ' · ' + esc(b.regnr)) +
        rad('ERP ' + (auKm(ag, b) != null ? auKr(auKm(ag, b)) + ' km' : 'km –') + auKmMerke(ag, b)) +
        rad(esc(navn)) +
        rad([hk ? hk + ' hk' : null, ci.drivstoff ? esc(ci.drivstoff) : null, ci.karosseri ? esc(ci.karosseri) : null].filter(Boolean).join(' · ')) +
        '<div id="' + id + '" hidden style="margin-top:6px;font-size:11.5px;line-height:1.45;max-height:320px;overflow:auto">' +
          (pk ? '<div><b>Pakker:</b> ' + esc(pk) + '</div>' : '') +
          '<div><b>Varsler:</b> ' + esc(ci.varsler && ((ci.varsler.warnings || []).length + (ci.varsler.notifications || []).length) ? JSON.stringify(ci.varsler) : 'ingen') + '</div>' +
          '<ul style="margin:4px 0 0;padding-left:16px">' + ekstra + '</ul></div>';
    }
    if (box.getAttribute('data-sig') === html) return;
    box.innerHTML = html; box.setAttribute('data-sig', html);
    var kn = box.querySelector('.au-cv-pluss');
    if (kn) kn.addEventListener('click', function (e) { e.preventDefault(); var x = document.getElementById(kn.getAttribute('data-t')); if (x) { x.hidden = !x.hidden; kn.textContent = x.hidden ? '+' : '−'; } });
  }
  // c583: årstall i kortets topplinje fra car.info, med ERP-avvik i liten skrift.
  function auAarTopp(c, b, ag) {
    var el = c.querySelector('.qa-aar'); if (!el) return;
    var ci = ag && ag.bil && ag.bil.kilde !== 'vegvesen' && ag.bil.modellaar, erp = (ag && ag.erp_aar) || null;
    var html = ci ? esc(String(ci)) + (erp && Number(erp) !== Number(ci) ? ' <small style="color:#8C978F">ERP ' + esc(String(erp)) + '</small>' : '') : null;
    if (!html) { var t = (el.getAttribute('data-erp') || el.textContent || '').trim(); if (!el.getAttribute('data-erp')) el.setAttribute('data-erp', t); html = esc(t) + (t ? ' <small style="color:#8C978F">(ERP)</small>' : ''); }
    if (el.innerHTML !== html) el.innerHTML = html;
  }
  // c584: km på kortet fra én kilde: km for aktivt internnr (agent.km, samme som ORIGIN-CV). Avvik mot ERP-lista i liten skrift.
  function auKm(ag, b) { return (ag && ag.km) || b.km || null; }
  function auKmMerke(ag, b) { var a = ag && ag.km; return a && b.km && Number(a) !== Number(b.km) ? ' <small style="color:#8C978F">ERP-liste ' + auKr(b.km) + ' km</small>' : ''; }
  function auKmTopp(c, b, ag) {
    var el = c.querySelector('.qa-kmtopp'); var km = auKm(ag, b); if (!el || !km) return;
    var html = Math.round(km / 1000) + 'k km' + auKmMerke(ag, b);
    if (el.innerHTML !== html) el.innerHTML = html;
  }
  // c585: ikoner i headeren for «priset før» og «vært på vår auksjon» (tidligere internnr, bare historikk). Detaljer i tooltip.
  function auHistIkoner(ag) {
    var h = (ag && ag.historikk) || [];
    var k = function (n) { return n ? Math.round(n / 1000) + 'k' : '–'; };
    var priset = h.filter(function (x) { return x.lav || x.hoy; });
    var auk = h.filter(function (x) { return x.hoyeste_bud || x.bud_avvist; });
    var svg = function (d) { return '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + '</svg>'; };
    var ik = function (tittel, d) { return '<span title="' + esc(tittel) + '" style="display:inline-flex;align-items:center;color:#5E4A1F;cursor:help">' + svg(d) + '</span>'; };
    var ut = '';
    if (priset.length) ut += ik('Priset før: ' + priset.map(function (x) { return (x.dato || '?') + ' ' + k(x.lav) + '–' + k(x.hoy) + ' (internnr ' + x.id + (x.status ? ', ' + x.status : '') + ')'; }).join(' · '), '<path d="M20.6 13.4l-7.2 7.2a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z"/><circle cx="7.5" cy="7.5" r="1.3"/>');
    if (auk.length) ut += ik('Vært på vår auksjon: ' + auk.map(function (x) { return (x.dato || '?') + (x.hoyeste_bud ? ' høyeste bud ' + k(x.hoyeste_bud) : '') + (x.bud_avvist ? ', bud avvist ' + x.bud_avvist : '') + ' (internnr ' + x.id + ')'; }).join(' · '), '<path d="M14 6l4 4M9 11l4 4M12.5 4.5l7 7-3 3-7-7z"/><path d="M10.5 12.5L4 19"/><path d="M3 21h8"/>');
    return ut ? '<span style="display:inline-flex;gap:6px;align-items:center;align-self:center">' + ut + '</span>' : '';
  }
  // c571: plass til 3 QA-kort i bredden, fast bredde uansett om det er 1, 2 eller 3 (Mike 13.10). Én kolonne på smal skjerm.
  (function () {
    if (document.getElementById('qa3-css')) return;
    var s = document.createElement('style'); s.id = 'qa3-css';
    s.textContent = '#qa-cards{grid-template-columns:repeat(2,minmax(0,1fr))!important;align-items:stretch!important}#qa-cards>.qa-card{display:flex!important;flex-direction:column}#qa-cards>.qa-card>*{flex-shrink:0}#qa-cards .qa-actions{margin-top:auto!important}#qa-cards>.qa-card{max-width:none!important;min-width:0}@media (max-width:900px){#qa-cards{grid-template-columns:minmax(0,1fr)!important}}';
    (document.head || document.documentElement).appendChild(s);
  })();
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
    fetch('auto-score.json?t=' + Date.now(), { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : null; })
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
      if (topp && ekte) { topp.disabled = ekte.disabled; var et = (ekte.innerText || '').trim(); if (et && topp.textContent !== et) topp.textContent = et; var ecs = getComputedStyle(ekte); if (topp.style.backgroundColor !== ecs.backgroundColor) topp.style.backgroundColor = ecs.backgroundColor; if (topp.style.color !== ecs.color) topp.style.color = ecs.color; topp.style.cursor = ekte.disabled ? 'not-allowed' : 'pointer'; }

      // c506: små ikoner for det som står lenger ned på kortet (selgerkommentar, tidligere priset). Klikk = gå dit.
      var merker = auMerker(c);
      var nokkel = merker.map(function (m) { return m.t; }).join(',') + '|' + JSON.stringify(b.grok || null) + '|' + JSON.stringify(b.cc || null) + '|' + JSON.stringify(b.slutt || null) + '|' + JSON.stringify(b.enighet || null) + '|' + JSON.stringify(b.agent ? [b.agent.fsd, b.agent.benchmark, b.agent.avvik_pst, b.agent.historikk] : null) + '|' + JSON.stringify(b.bilde || null) + '|' + (b.eiertid_aar != null ? b.eiertid_aar : '') + '|' + b.score + '|' + (b.stopp || []).join(';') + '|' + (b.grunner || []).join(';') + '|' + infoAlle.join(';') + '|' + kost;
      auFsdBokser(c, b);
      if (gammel && gammel.getAttribute('data-k') === nokkel) continue;
      var nivaa = b.score >= 80 ? 'g' : b.score < 50 ? 'r' : 'y';
      // c572: med FSD/Benchmark styrer de fargen og teksten i statusboksen. Ingen auto-poeng, skygge, CC eller auto-detaljer (Mike 13.10).
      var agF = b.agent || null;
      var avv0 = agF ? auAvvik(agF, b) : null;
      if (agF) { nivaa = (agF.fsd && agF.fsd.stopp) || !avv0.mid ? 'r' : avv0.varsel ? 'y' : 'g'; }
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
        // c570: vanlig galleri. Alle bildene som miniatyrer på rad, klikk åpner stort bilde med piler (Mike 13.10).
        bildeHtml = '<div style="display:grid;gap:4px"><div style="display:flex;gap:6px;overflow-x:auto;padding-bottom:2px">' + bildeListe.map(function (u, i) { return '<a href="#" class="au-lb" data-ix="' + i + '" data-bilder="' + esc(JSON.stringify(bildeListe)) + '" aria-label="Bilde ' + (i + 1) + '" style="flex:0 0 auto"><img src="' + esc(u) + '" alt="" loading="lazy" style="height:110px;width:auto;max-width:180px;object-fit:cover;border-radius:6px;display:block;background:#E7E4DA' + (lign ? ';opacity:.85' : '') + '"></a>'; }).join('') + '</div>' +
          '<div style="font-size:11.5px;color:' + (lign ? '#8A6D10' : '#5E6B62') + '">' + esc(bildeTekst) + (bildeListe.length > 1 ? ' · ' + bildeListe.length + ' bilder' : '') + '</div></div>';
      }
      // c535: auto, skygge og CC på én linje øverst, farget etter spennet: grønn ≤5 %, gul ≤10 %, rød over (Mike 13.10).
      var enHtml = '';
      // c569: layout fra 08:00 (c536), men linjen øverst viser FSD og Benchmark, farget etter avvik: grønn ≤5 %, gul ≤10 %, rød over (Mike 13.10).
      var ag0 = b.agent || null;
      if (ag0) {
        var fP = ag0.fsd && ag0.fsd.pris, bP = ag0.benchmark && ag0.benchmark.pris;
        var to = [['FSD', fP], ['Benchmark', bP]].map(function (p) { return '<span>' + p[0] + ' <strong style="font-variant-numeric:tabular-nums">' + (p[1] ? Math.round(p[1] / 1000) + 'k' : '–') + '</strong></span>'; });
        var sp = ag0.avvik_pst;
        var stopp = ag0.fsd && ag0.fsd.stopp;
        var eF = stopp ? '#B8452F' : sp == null ? '#5E6B62' : sp <= 5 ? '#004225' : sp <= 10 ? '#8A6D10' : '#B8452F';
        var eB = stopp ? '#F8E6E1' : sp == null ? '#EEF0EC' : sp <= 5 ? '#E3EFE7' : sp <= 10 ? '#FBF3D8' : '#F8E6E1';
        var eT = stopp ? 'FSD stoppet' : sp == null ? 'mangler pris' : (sp <= 5 ? 'enige ' : 'uenige ') + sp + ' %';
        enHtml = '<div class="au-enighet" style="display:flex;flex-wrap:wrap;gap:6px 14px;align-items:center;background:' + eB + ';border-left:4px solid ' + eF + ';border-radius:8px;padding:8px 12px;font-size:15px;color:#16201B">' +
          to.join('<span style="color:#9AA39C">·</span>') + '<strong style="color:' + eF + ';margin-left:auto">' + eT + '</strong></div>';
      }
      if (agF) {
        var fP1 = agF.fsd && agF.fsd.pris, bP1 = agF.benchmark && agF.benchmark.pris;
        rute = agF.fsd && agF.fsd.stopp ? 'FSD STOPPET' : fP1 ? 'FSD PRISET' : 'FSD VENTER';
        ha = { t: agF.fsd && agF.fsd.stopp ? (agF.fsd.stopp_grunn || 'FSD stoppet bilen') : 'FSD ' + (fP1 ? auKr(fP1) : '–') + ' · Benchmark ' + (bP1 ? auKr(bP1) : '–') + (agF.avvik_pst != null ? ' · avvik ' + agF.avvik_pst + ' %' : ''), u: '' };
        fu = ''; grok = ''; ccHtml = ''; kildeHtml = '';
      }
      // c573: én header i stedet for stripe + grønn boks (Mike 13.10): «FSD PRISET · FSD 219k · Benchmark 215k · avvik 2 % · Eiertid 6,7 år».
      var nyHtml = '';
      // c577: ingen auto/skygge-boks. Før FSD har priset: bare «FSD VENTER» + bilder (Mike 13.10).
      if (!agF) {
        nyHtml = '<div class="au-hode" style="background:#EEF0EC;border-radius:8px;padding:4px 12px;font-size:14.5px;color:#16201B"><div class="au-hode-l"><strong style="color:#5E6B62">FSD VENTER</strong><span>FSD og Benchmark priser bilen</span>' + auHistIkoner(b.agent) +
          (b.eiertid_aar != null ? '<span class="au-eier">Eiertid ' + String(b.eiertid_aar).replace('.', ',') + ' år</span>' : '') + '</div></div>' + bildeHtml;
      } else {
        var kk = function (n) { return n ? Math.round(n / 1000) + 'k' : '–'; };
        var hF = AU_DEMPET[nivaa].tekst, hB = AU_DEMPET[nivaa].bak, hK = AU_DEMPET[nivaa].kant;
        if (avv0.varsel && !(agF.fsd && agF.fsd.stopp)) rute = '⚠ AVVIK';
        var fP0 = agF.fsd && agF.fsd.pris, bP0 = agF.benchmark && agF.benchmark.pris;
        var midt0 = ['FSD ' + kk(fP0), 'Bench ' + kk(bP0)];
        if (fP0 && bP0) midt0.push(avv0.varsel ? (fP0 >= bP0 ? '+' : '−') + kk(Math.abs(fP0 - bP0)) + ' / ' + Math.abs(Math.round((fP0 - bP0) / bP0 * 100)) + ' %' : (fP0 >= bP0 ? '+' : '−') + Math.abs(Math.round((fP0 - bP0) / bP0 * 100)) + ' %');
        nyHtml = '<div class="au-hode" style="background:' + hB + ';border-radius:8px;padding:4px 12px;font-size:14.5px;color:#16201B;font-variant-numeric:tabular-nums">' +
          '<div class="au-hode-l"><strong style="color:' + hF + '">' + esc(rute) + '</strong><span>' + midt0.map(esc).join(' · ') + '</span>' + auHistIkoner(agF) +
          (b.eiertid_aar != null ? '<span class="au-eier">Eiertid ' + String(b.eiertid_aar).replace('.', ',') + ' år</span>' : '') + '</div>' +
          (agF.fsd && agF.fsd.stopp ? '<div style="font-size:13.5px;margin:2px 0 2px">' + esc(agF.fsd.stopp_grunn || 'FSD stoppet bilen') + '</div>' : '') + '</div>' +
          bildeHtml +
          (merker.length ? '<span style="display:flex;flex-wrap:wrap;gap:6px">' + merker.map(function (m, ix) {
            return '<button type="button" class="au-merke" data-ix="' + ix + '" title="' + esc(m.tittel) + '" style="font-size:12px;border:1px solid #DCD8CC;background:#fff;border-radius:999px;padding:2px 9px;cursor:pointer;color:#16201B">' + m.t + '</button>';
          }).join('') + '</span>' : '') +
          (infoAlle.length ? '<div style="display:flex;flex-wrap:wrap;gap:4px 14px;font-size:12.5px;color:#5E6B62">' + infoAlle.map(function (x) { return '<span>' + x + '</span>'; }).join('') + '</div>' : '');
      }
      el2.innerHTML = nyHtml || (enHtml + bildeHtml +
        '<div style="display:grid;grid-template-columns:auto 1fr;gap:12px;align-items:start;background:' + bakgrunn + ';border-radius:10px;padding:10px 12px">' +
          (agF ? '<div></div>' : '<div style="display:grid;place-items:center;width:50px;height:50px;border-radius:50%;border:3px solid ' + farge + ';color:' + farge + ';font-weight:800;font-size:18px;font-variant-numeric:tabular-nums">' + b.score + '</div>') +
          '<div style="display:grid;gap:2px;color:#16201B;font-size:13.5px;line-height:1.4">' +
            '<span style="font-weight:700;font-size:11.5px;letter-spacing:.06em;color:' + farge + '">' + rute + '</span>' +
            (agF && agF.fsd && agF.fsd.stopp ? '<span style="font-size:13.5px">' + esc(ha.t) + '</span>' : '<b style="font-size:15px">' + esc(ha.t) + '</b>') +
            (ha.u || fu ? '<span>' + [esc(ha.u), fu].filter(Boolean).join(' ') + '</span>' : '') +
            grok +
            ccHtml +
            kildeHtml +
            eier +
            (merker.length ? '<span style="display:flex;flex-wrap:wrap;gap:6px;margin-top:2px">' + merker.map(function (m, ix) {
              return '<button type="button" class="au-merke" data-ix="' + ix + '" title="' + esc(m.tittel) + '" style="font-size:12px;border:1px solid #DCD8CC;background:#fff;border-radius:999px;padding:2px 9px;cursor:pointer;color:#16201B">' + m.t + '</button>';
            }).join('') + '</span>' : '') +
            (agF ? '' : '<details style="font-size:12.5px;color:#5E6B62;margin-top:2px"><summary style="cursor:pointer;color:#004225;font-weight:600;width:max-content">+ detaljer</summary>') +
              (agF ? '' : '<div style="display:flex;flex-wrap:wrap;gap:6px;margin:6px 0">' +
                [['Finn', b.deler.finn, 40], ['Celle', b.deler.celle, 30], ['Data', b.deler.data, 20], ['ERP = QA', b.deler.erp, 10]].map(function (x) {
                  return '<span style="background:#fff;border:1px solid #DCD8CC;border-radius:6px;padding:3px 8px"><span style="font-size:10.5px;text-transform:uppercase;letter-spacing:.06em">' + x[0] + '</span> <strong style="color:#16201B">' + x[1] + '/' + x[2] + '</strong></span>';
                }).join('') + '</div>' +
              '') +
              (agF ? '' : detaljer.length ? '<ul style="margin:0;padding-left:18px">' + detaljer.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>' : '') +
            (agF ? '' : '</details>') +
          '</div>' +
        '</div>' +
        (infoAlle.length ? '<div style="display:flex;flex-wrap:wrap;gap:4px 14px;font-size:12.5px;color:#5E6B62">' + infoAlle.map(function (x) { return '<span>' + x + '</span>'; }).join('') + '</div>' : ''));
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
