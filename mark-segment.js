/* Peasy Pulse — Marked: «Hvilke biler gir kampanjene?» (c503).
   Kobler kampanjer (UTM) til Treffkartet: andel leads i grønne ruter og solgt per 100 priset, med faktisk kost.
   Grønne ruter = samme regel som Treffkartet spørsmål 3: estimat × alder, minst 10 estimater og 8+ solgt per 100 (siste 180 dager).
   Leser window._lastRows (ERP-eksporten, kolonner etter navn) og ads-spend.json. Bare visning. */
(function () {
  var C = { id: 0, regnr: 1, est: 3, aar: 8, kilde: 11, status: 12, sd: 14, solgt: 18, utmSrc: 23, utmCamp: 24, estDato: 31 };
  var PB = [[0, 25e3, '0–25k'], [25e3, 50e3, '25–50k'], [50e3, 100e3, '50–100k'], [100e3, 150e3, '100–150k'], [150e3, 250e3, '150–250k'], [250e3, 400e3, '250–400k'], [400e3, 1e9, '400k+']];
  var AB = [[0, 3, '0–3 år'], [3, 6, '3–6 år'], [6, 10, '6–10 år'], [10, 15, '10–15 år'], [15, 99, 'over 15 år']];
  var MIN_N = 10, GRONN = 8;
  var ads = null, periode = 90;

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function kr(n) { return n == null || !isFinite(n) ? '–' : Math.round(n).toLocaleString('nb-NO') + ' kr'; }
  function iso(v) { var m = String(v == null ? '' : v).match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/); return m ? m[3] + '-' + m[2].padStart(2, '0') + '-' + m[1].padStart(2, '0') : null; }
  function bi(v, B) { if (v == null || !isFinite(v)) return -1; for (var i = 0; i < B.length; i++) if (v >= B[i][0] && v < B[i][1]) return i; return -1; }
  function midt(v) { var m = String(v || '').replace(/[\s ]/g, '').match(/(\d+)-(\d+)/); return m && +m[1] && +m[2] ? (+m[1] + +m[2]) / 2 : null; }
  function erSolgt(r) { return /^sold/i.test(String(r[C.status] || '')); }
  function venter(r) { return /trans\.?\s*best/i.test(String(r[C.status] || '')); }
  function celle(r) {
    var e = iso(r[C.estDato]); var m = midt(r[C.est]); var aar = Number(r[C.aar]);
    if (!e || !m || !aar) return null;
    var i = bi(m, PB), j = bi(Number(e.slice(0, 4)) - aar, AB);
    return i < 0 || j < 0 ? null : i + '|' + j;
  }
  function dagerSiden(n) { return new Date(Date.now() - n * 864e5).toISOString().slice(0, 10); }

  // Grønne ruter fra de siste 180 dagene (samme regel som Treffkartet, spørsmål 3).
  function gronneRuter(rows) {
    var fra = dagerSiden(180), st = {};
    rows.forEach(function (r) {
      var e = iso(r[C.estDato]); if (!e || e < fra || venter(r)) return;
      var k = celle(r); if (!k) return;
      var s = st[k] || (st[k] = { n: 0, s: 0 }); s.n++; if (erSolgt(r)) s.s++;
    });
    // Rate per rute (solgt per 100). Ruter med under MIN_N biler får snittet for alle.
    var N = 0, S = 0; Object.keys(st).forEach(function (k) { N += st[k].n; S += st[k].s; });
    var snitt = N ? S / N * 100 : 0, g = { _snitt: snitt };
    Object.keys(st).forEach(function (k) { g[k] = { n: st[k].n, s: st[k].s, rate: st[k].n >= MIN_N ? st[k].s / st[k].n * 100 : snitt }; });
    return g;
  }

  // Kampanje fra UTM: Meta bruker navn, Google bruker kampanje-id. Slås opp i ads-spend.json.
  function kampanjeAv(r) {
    var src = String(r[C.utmSrc] || '').toLowerCase(), camp = String(r[C.utmCamp] || '').trim();
    var kanal = /facebook|fb|meta|instagram|ig/.test(src) ? 'Meta' : /google/.test(src) ? 'Google' : (src ? 'Annet' : 'Uten UTM');
    var k = ads && ads.kampanjer ? Object.values(ads.kampanjer).find(function (x) { return camp && (String(x.id) === camp || x.navn === camp); }) : null;
    if (k) return { key: k.kilde + ':' + k.id, navn: k.navn, kanal: k.kilde === 'meta' ? 'Meta' : 'Google', kamp: k };
    return { key: 'x:' + kanal, navn: kanal === 'Uten UTM' ? 'Uten UTM (direkte/organisk)' : kanal + ' (ukjent kampanje)', kanal: kanal, kamp: null };
  }

  function kost(kamp, fra, til) {
    if (!kamp || !kamp.dager) return null;
    var s = 0; Object.keys(kamp.dager).forEach(function (d) { if (d >= fra && d <= til) s += Number(kamp.dager[d]) || 0; });
    return s;
  }

  function tegn() {
    var sec = document.getElementById('mark-section'); var rows = window._lastRows;
    if (!sec || !rows || !rows.length || !ads) return;
    rows = rows.filter(function (r) { return Array.isArray(r) && r[C.id] !== 'Internnr.'; });
    var g = gronneRuter(rows);
    var fra = dagerSiden(periode), til = dagerSiden(1);
    var grupper = {};
    rows.forEach(function (r) {
      if (String(r[C.kilde] || '').toLowerCase() !== 'peasy') return;
      var sd = iso(r[C.sd]); if (!sd || sd < fra || sd > til) return;
      var k = kampanjeAv(r);
      var x = grupper[k.key] || (grupper[k.key] = { navn: k.navn, kanal: k.kanal, kamp: k.kamp, leads: 0, priset: 0, forv: 0, solgt: 0 });
      x.leads++;
      var c = celle(r); if (c) { x.priset++; x.forv += g[c] ? g[c].rate : g._snitt; }
      if (erSolgt(r)) x.solgt++;
    });
    var liste = Object.values(grupper).sort(function (a, b) { return b.leads - a.leads; });
    var tot = { leads: 0, priset: 0, forv: 0, solgt: 0, kost: 0 };
    var h = '<h3 style="margin:0 0 4px">3 · Hvilke biler gir kampanjene?</h3>' +
      '<p style="color:#5E6B62;font-size:12.5px;margin:0 0 8px;max-width:90ch">Peasy-leads mottatt siste ' + periode + ' dager, per kampanje. <b>Bilmiks</b> = hvor mange solgt per 100 vi kan forvente ut fra hvilke biler kampanjen gir (estimat × alder), regnet fra Treffkartet siste 180 dager. Snittet for alle er ' + g._snitt.toFixed(1) + '. Høy bilmiks = kampanjen gir biler vi selger. ' +
      '<b>Solgt per 100 priset</b> = hvor mange av de prisede som er solgt så langt. Ferske leads har ikke rukket å bli solgt, så sammenlign kampanjene mot hverandre, ikke mot fasit.</p>' +
      '<div style="margin:0 0 8px;font-size:12.5px">Periode: ' + [30, 90, 180].map(function (p) { return '<button type="button" onclick="window.msPeriode(' + p + ')" style="margin-right:4px;padding:3px 9px;border-radius:6px;border:1px solid #004225;background:' + (p === periode ? '#004225;color:#fff' : 'transparent;color:#004225') + ';cursor:pointer">' + p + ' d</button>'; }).join('') + '</div>' +
      '<div style="overflow-x:auto"><table style="border-collapse:collapse;width:100%;font-size:13px;min-width:720px"><tr style="background:#F5F5F0">' +
      ['Kampanje', 'Kanal', 'Leads', 'Priset', 'Bilmiks (forventet solgt per 100)', 'Solgt', 'Solgt per 100 priset', 'Kost', 'Kost per solgt'].map(function (t, i) { return '<th style="padding:6px 8px;border:1px solid #ddd;text-align:' + (i > 1 ? 'right' : 'left') + ';font-size:11.5px">' + t + '</th>'; }).join('') + '</tr>';
    // Beste kampanje per kolonne: bare betalte kampanjer (har kost) med minst MIN_BEST prisede biler.
    var MIN_BEST = 30, best = { bm: null, sp: null, ks: null };
    liste.forEach(function (x) {
      x.k = kost(x.kamp, fra, til);
      x.bm = x.priset ? x.forv / x.priset : null;
      x.sp = x.priset ? x.solgt / x.priset * 100 : null;
      x.ks = x.k != null && x.solgt ? x.k / x.solgt : null;
      if (x.k == null || x.priset < MIN_BEST) return;
      if (x.bm != null && (!best.bm || x.bm > best.bm.bm)) best.bm = x;
      if (x.sp != null && (!best.sp || x.sp > best.sp.sp)) best.sp = x;
      if (x.ks != null && (!best.ks || x.ks < best.ks.ks)) best.ks = x;
    });
    var BEST = ';background:#DDF0E3;font-weight:700;color:#1F7A4D';
    liste.forEach(function (x) {
      var k = x.k; if (k != null) tot.kost += k;
      tot.leads += x.leads; tot.priset += x.priset; tot.forv += x.forv; tot.solgt += x.solgt;
      var bm = x.bm;
      var farge = bm == null ? '#5E6B62' : bm >= g._snitt * 1.15 ? '#1F7A4D' : bm >= g._snitt * 0.85 ? '#8A6D10' : '#B8452F';
      h += '<tr><td style="padding:6px 8px;border:1px solid #ddd">' + esc(x.navn) + '</td><td style="padding:6px 8px;border:1px solid #ddd">' + x.kanal + '</td>' +
        '<td style="padding:6px 8px;border:1px solid #ddd;text-align:right">' + x.leads + '</td><td style="padding:6px 8px;border:1px solid #ddd;text-align:right">' + x.priset + '</td>' +
        '<td style="padding:6px 8px;border:1px solid #ddd;text-align:right;font-weight:700;color:' + farge + (best.bm === x ? BEST : '') + '">' + (bm == null ? '–' : bm.toFixed(1)) + '</td>' +
        '<td style="padding:6px 8px;border:1px solid #ddd;text-align:right">' + x.solgt + '</td><td style="padding:6px 8px;border:1px solid #ddd;text-align:right' + (best.sp === x ? BEST : '') + '">' + (x.sp == null ? '–' : x.sp.toFixed(1)) + '</td>' +
        '<td style="padding:6px 8px;border:1px solid #ddd;text-align:right">' + (k == null ? '–' : kr(k)) + '</td><td style="padding:6px 8px;border:1px solid #ddd;text-align:right' + (best.ks === x ? BEST : '') + '">' + (x.ks == null ? '–' : kr(x.ks)) + '</td></tr>';
    });
    h += '<tr style="background:#F5F5F0;font-weight:700"><td style="padding:6px 8px;border:1px solid #ddd">Totalt</td><td style="padding:6px 8px;border:1px solid #ddd"></td><td style="padding:6px 8px;border:1px solid #ddd;text-align:right">' + tot.leads + '</td><td style="padding:6px 8px;border:1px solid #ddd;text-align:right">' + tot.priset + '</td><td style="padding:6px 8px;border:1px solid #ddd;text-align:right">' + (tot.priset ? (tot.forv / tot.priset).toFixed(1) : '–') + '</td><td style="padding:6px 8px;border:1px solid #ddd;text-align:right">' + tot.solgt + '</td><td style="padding:6px 8px;border:1px solid #ddd;text-align:right">' + (tot.priset ? (tot.solgt / tot.priset * 100).toFixed(1) : '–') + '</td><td style="padding:6px 8px;border:1px solid #ddd;text-align:right">' + kr(tot.kost) + '</td><td style="padding:6px 8px;border:1px solid #ddd;text-align:right">' + (tot.solgt ? kr(tot.kost / tot.solgt) : '–') + '</td></tr></table></div>';
    var gl = Object.keys(g).filter(function (k) { return k !== '_snitt' && g[k].n >= MIN_N; }).sort(function (a, b) { return g[b].rate - g[a].rate; }).slice(0, 3).map(function (k) { var p = k.split('|'); return PB[p[0]][2] + ', ' + AB[p[1]][2] + ' (' + g[k].rate.toFixed(1) + ')'; });
    h += '<p style="color:#5E6B62;font-size:12px;margin:6px 0 0">Beste ruter nå: ' + esc(gl.join(' · ')) + '. Bilmiks grønn = minst 15 % over snittet, rød = minst 15 % under. Grønn bakgrunn = beste betalte kampanje i kolonnen (minst ' + MIN_BEST + ' prisede).</p>';
    var el = document.getElementById('ms-section');
    if (!el) { el = document.createElement('div'); el.id = 'ms-section'; el.style.cssText = 'background:#fff;border:1px solid #DCD8CC;border-radius:10px;padding:14px 16px;margin:18px 0'; sec.appendChild(el); }
    el.innerHTML = h;
  }
  window.msPeriode = function (p) { periode = p; tegn(); };
  fetch('ads-spend.json?t=' + Date.now(), { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (d) { ads = d; }).catch(function () {});
  // Tegn når Marked-fanen er åpen og dataene finnes.
  setInterval(function () {
    var sec = document.getElementById('mark-section');
    if (sec && sec.style.display !== 'none' && !document.getElementById('ms-section')) tegn();
  }, 1000);
})();
