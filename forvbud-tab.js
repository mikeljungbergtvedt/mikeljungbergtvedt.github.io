/* Peasy Pulse — «Forventet bud», c750 (Mike 27.11.2026: «forventet faktisk bud skal være rett»).
   Leser forventet-bud.json (Mini: forventet-bud.js, bygges hver time sammen med bud-fossefall).
   Viser hvor forhandlerbudene lander mot det fossefallet sier i dag, per gruppe, og et eget tall: forventet bud.
   Bare visning. Rører ikke satser, prising, Send eller ERP. */
(function () {
  var MND = ['jan', 'feb', 'mar', 'apr', 'mai', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'des'];
  var GR = '#2E7D32', GU = '#8A6D10', RO = '#C62828', DEMPET = '#5E6B62';
  function kr(n) { return n == null || !isFinite(n) ? '–' : Math.round(n).toLocaleString('nb-NO'); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function pst(x) { return x == null || !isFinite(x) ? '–' : Math.round(x * 100) + ' %'; }
  function farge(f) { return f == null ? DEMPET : f >= 0.9 ? GR : f >= 0.75 ? GU : RO; }
  /* Peasy-avgiften etter størrelsen på forhandlerbudet. Samme trinn som fossefallet. */
  function avgift(b) { return b <= 35000 ? 5900 : b <= 75000 ? 8900 : b <= 150000 ? 9900 : 11900; }
  function budFraKunde(k) { k = Number(k); if (!(k > 0)) return null; var t = [5900, 8900, 9900, 11900]; for (var i = 0; i < t.length; i++) if (avgift(k + t[i]) === t[i]) return k + t[i]; return k + avgift(k); }
  function kundeFraBud(b) { b = Number(b); return b > 0 ? Math.max(0, b - avgift(b)) : null; }
  function tusen(x) { return x == null ? null : Math.round(x / 1000) * 1000; }
  /* Forventet bud til kunden for en bil med dette lav-estimatet, i gruppen g. Gir { midt, fra, til } i kroner, eller null. */
  function forLav(lav, g) {
    var fb = budFraKunde(lav); if (!fb || !g || g.faktor == null) return null;
    return { midt: tusen(kundeFraBud(fb * g.faktor)), fra: g.p25 == null ? null : tusen(kundeFraBud(fb * g.p25)), til: g.p75 == null ? null : tusen(kundeFraBud(fb * g.p75)) };
  }
  window.forvBudForLav = forLav; /* for testing og senere bruk på kortene */

  var _data = null, _alle = false;

  function flis(tall, tekst, under, col) {
    return '<div style="flex:1 1 200px;min-width:0;background:#fff;border:1px solid #E1E6E1;border-radius:10px;padding:12px 14px">'
      + '<div style="font-size:26px;font-weight:800;color:' + (col || '#14211a') + ';font-variant-numeric:tabular-nums">' + tall + '</div>'
      + '<div style="font-size:13px;font-weight:600;color:#14211a;margin-top:2px">' + tekst + '</div>'
      + (under ? '<div style="font-size:12px;color:' + DEMPET + ';margin-top:2px">' + under + '</div>' : '') + '</div>';
  }
  function trendTekst(tr) {
    var t = (tr || []).slice(-4); if (!t.length) return '–';
    var ut = t.map(function (x) { return MND[Number(x.mnd.slice(5)) - 1] + ' ' + (x.faktor == null ? '–' : Math.round(x.faktor * 100)) + (x.n < 4 ? '*' : ''); }).join(' · ');
    var a = t[0].faktor, b = t[t.length - 1].faktor, pil = '';
    if (t.length >= 2 && a != null && b != null) pil = b - a <= -0.1 ? ' <span style="color:' + RO + ';font-weight:700" title="Faller">↓</span>' : b - a >= 0.1 ? ' <span style="color:' + GR + ';font-weight:700" title="Stiger">↑</span>' : ' <span style="color:' + DEMPET + '" title="Flatt">→</span>';
    return ut + pil;
  }

  function render() {
    var root = document.getElementById('forvbud-root'); if (!root) return;
    if (!_data) { root.innerHTML = '<div style="padding:20px;color:' + DEMPET + '">Laster forventet bud …</div>'; hent(); return; }
    var d = _data, th = 'text-align:left;padding:7px 10px;border-bottom:2px solid #D5DBD5;font-size:12px;color:' + DEMPET + ';white-space:nowrap', td = 'padding:8px 10px;border-bottom:1px solid #ECEFEC;font-size:13px;vertical-align:top';
    var ja = 0, nei = 0; (d.grupper || []).forEach(function (g) { ja += (g.budaksept && g.budaksept.ja) || 0; nei += (g.budaksept && g.budaksept.nei) || 0; });
    var tr = (d.totalt && d.totalt.treff) || {}, tf = (d.totalt && d.totalt.treff_fossefall) || {};
    var h = '<div style="max-width:1100px">';
    h += '<h2 style="margin:0 0 4px;font-size:20px">Forventet bud</h2>';
    h += '<p style="margin:0 0 14px;font-size:13px;color:' + DEMPET + ';max-width:78ch">Hvor forhandlerbudene faktisk lander mot det fossefallet sier i dag (dagens satser og flagg). 100 % betyr at fossefallet treffer. Forventet bud er fossefallets bud ganget med tallet for gruppen. Oppdatert ' + esc(String(d.bygget || '').slice(0, 16).replace('T', ' kl. ')) + ' UTC.</p>';
    h += '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:16px">';
    h += flis(pst(d.totalt && d.totalt.faktor), 'Budene lander her mot fossefallet', 'Median, ' + ((d.totalt && d.totalt.n) || 0) + ' auksjoner siste ' + (d.vindu_dager || 45) + ' dager', farge(d.totalt && d.totalt.faktor));
    h += flis(tr.innen20 == null ? '–' : tr.innen20 + ' %', 'av bilene får bud innen ±20 % av forventet bud', 'Fossefallet alene: ' + (tf.innen20 == null ? '–' : tf.innen20 + ' %') + '. ' + (tr.n || 0) + ' auksjoner siste ' + (d.treff_dager || 90) + ' dager');
    h += flis(ja + nei ? Math.round(ja / (ja + nei) * 100) + ' %' : '–', 'Budaksept', ja + ' av ' + (ja + nei) + ' svar siste ' + (d.treff_dager || 90) + ' dager. Målet er 65 %', ja + nei ? (ja / (ja + nei) >= 0.65 ? GR : RO) : null);
    h += '</div>';

    h += '<div style="overflow-x:auto;background:#fff;border:1px solid #E1E6E1;border-radius:10px"><table id="forvbud-grupper" style="border-collapse:collapse;width:100%;font-variant-numeric:tabular-nums">';
    h += '<tr><th style="' + th + '">Gruppe</th><th style="' + th + '">Bud mot fossefallet</th><th style="' + th + '">Vanlig spenn</th><th style="' + th + '">Lav over forventet bud</th><th style="' + th + '">Budaksept</th><th style="' + th + '">Trend per måned</th><th style="' + th + '">Treff ±20 %</th><th style="' + th + '">Auksjoner</th></tr>';
    (d.grupper || []).forEach(function (g) {
      var ba = g.budaksept || {}, n = (ba.ja || 0) + (ba.nei || 0);
      h += '<tr data-gruppe="' + esc(g.id) + '"><td style="' + td + ';font-weight:700;white-space:nowrap">' + esc(g.navn) + '</td>'
        + '<td style="' + td + ';font-weight:800;font-size:16px;color:' + farge(g.faktor) + '">' + pst(g.faktor) + '</td>'
        + '<td style="' + td + ';white-space:nowrap">' + (g.p25 == null ? '–' : Math.round(g.p25 * 100) + '–' + Math.round(g.p75 * 100) + ' %') + '</td>'
        + '<td style="' + td + ';white-space:nowrap">' + (g.lav_over_forventet_kr == null ? '–' : kr(g.lav_over_forventet_kr) + ' kr') + '</td>'
        + '<td style="' + td + ';white-space:nowrap;color:' + (n ? (ba.pst >= 65 ? GR : RO) : DEMPET) + ';font-weight:700">' + (n ? ba.pst + ' % <span style="font-weight:400;color:' + DEMPET + '">(' + ba.ja + ' av ' + n + ')</span>' : '–') + '</td>'
        + '<td style="' + td + ';white-space:nowrap">' + trendTekst(g.trend) + '</td>'
        + '<td style="' + td + '">' + (g.treff && g.treff.innen20 != null ? g.treff.innen20 + ' %' : '–') + '</td>'
        + '<td style="' + td + ';white-space:nowrap;color:' + DEMPET + '">' + (g.n || 0) + (g.vindu_dager ? ' · ' + g.vindu_dager + ' d' : '') + (g.kilde === 'alle' ? ' · <span style="color:' + GU + '">alle grupper</span>' : '') + '</td></tr>';
    });
    h += '</table></div>';
    h += '<p style="font-size:12px;color:' + DEMPET + ';margin:6px 0 18px;max-width:90ch">Grønn fra 90 %, gul fra 75 %, rød under. Vanlig spenn: der halvparten av budene lander. Lav over forventet bud: hvor mange kroner lav typisk ligger over det kunden kan vente å få. Trend: stjerne betyr færre enn 4 auksjoner den måneden. Treff: andel biler der budet kom innen ±20 % av forventet bud, regnet med tallet slik det var den dagen. «Alle grupper»: gruppen har for få auksjoner, så tallet er lånt fra alle.</p>';

    /* Kalkulator: forventet bud for én bil */
    h += '<div style="background:#fff;border:1px solid #E1E6E1;border-radius:10px;padding:12px 14px;margin-bottom:18px">';
    h += '<div style="font-size:14px;font-weight:700;margin-bottom:8px">Forventet bud for én bil</div>';
    h += '<div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;font-size:13px"><label>Lav på estimatet <input id="forvbud-lav" type="number" inputmode="numeric" min="0" step="1000" placeholder="f.eks. 76000" style="width:130px;min-height:36px;padding:4px 8px;border:1px solid #C9D1C9;border-radius:6px;font-size:14px"> kr</label>';
    h += '<label>Gruppe <select id="forvbud-gruppe" style="min-height:36px;padding:4px 8px;border:1px solid #C9D1C9;border-radius:6px;font-size:14px">' + (d.grupper || []).map(function (g) { return '<option value="' + esc(g.id) + '">' + esc(g.navn) + '</option>'; }).join('') + '</select></label></div>';
    h += '<div id="forvbud-svar" style="margin-top:10px;font-size:14px;min-height:22px;color:' + DEMPET + '">Skriv inn lav, så vises forventet bud til kunden.</div></div>';

    /* Auksjonene */
    var biler = d.biler || [], vis = _alle ? biler : biler.slice(0, 25);
    h += '<div style="font-size:14px;font-weight:700;margin-bottom:6px">Auksjoner siste ' + (d.treff_dager || 90) + ' dager (' + biler.length + ')</div>';
    h += '<div style="overflow-x:auto;background:#fff;border:1px solid #E1E6E1;border-radius:10px"><table id="forvbud-biler" style="border-collapse:collapse;width:100%;font-variant-numeric:tabular-nums">';
    h += '<tr><th style="' + th + '">Avgjort</th><th style="' + th + '">Internnr</th><th style="' + th + '">Gruppe</th><th style="' + th + ';text-align:right">Lav i dag</th><th style="' + th + ';text-align:right">Forventet bud</th><th style="' + th + ';text-align:right">Faktisk bud</th><th style="' + th + ';text-align:right">Avvik</th><th style="' + th + '">Svar</th></tr>';
    var navn = {}; (d.grupper || []).forEach(function (g) { navn[g.id] = g.navn; });
    vis.forEach(function (b) {
      var av = b.avvik, c = av == null ? DEMPET : Math.abs(av) <= 0.2 ? GR : Math.abs(av) <= 0.4 ? GU : RO;
      h += '<tr><td style="' + td + ';white-space:nowrap">' + esc(String(b.dato || '').slice(8, 10) + '.' + String(b.dato || '').slice(5, 7)) + '</td><td style="' + td + '">' + esc(b.id) + '</td><td style="' + td + ';white-space:nowrap">' + esc(navn[b.gruppe] || b.gruppe) + '</td>'
        + '<td style="' + td + ';text-align:right">' + kr(b.lav_idag) + '</td><td style="' + td + ';text-align:right">' + kr(b.forventet_kunde) + '</td><td style="' + td + ';text-align:right;font-weight:700">' + kr(b.kundebud) + '</td>'
        + '<td style="' + td + ';text-align:right;color:' + c + ';font-weight:700">' + (av == null ? '–' : (av > 0 ? '+' : '') + Math.round(av * 100) + ' %') + '</td>'
        + '<td style="' + td + ';white-space:nowrap;color:' + (b.reaksjon === 'aksept' ? GR : b.reaksjon === 'avslag' ? RO : DEMPET) + '">' + (b.reaksjon === 'aksept' ? 'Budaksept' : b.reaksjon === 'avslag' ? 'Budavslag' : '–') + '</td></tr>';
    });
    h += '</table></div>';
    if (biler.length > 25) h += '<button type="button" id="forvbud-alle" style="margin-top:8px;min-height:36px;padding:6px 14px;border:1px solid #C9D1C9;border-radius:6px;background:#fff;font-size:13px;cursor:pointer">' + (_alle ? 'Vis bare de 25 siste' : 'Vis alle ' + biler.length) + '</button>';
    h += '<p style="font-size:12px;color:' + DEMPET + ';margin:8px 0 0;max-width:90ch">Beløpene er det kunden får (etter Peasy-avgiften). Lav i dag er det fossefallet ville satt nå, ikke det kunden fikk den gang. Avvik er forhandlerbudet mot forventet bud. Biler uten Finn-utpris er ikke med' + ((d.totalt && d.totalt.utelatt && d.totalt.utelatt.uten_drivstoff) ? ', og ' + d.totalt.utelatt.uten_drivstoff + ' venter på drivstoff fra ERP' : '') + '.</p>';
    h += '</div>';
    root.innerHTML = h;

    var lavEl = document.getElementById('forvbud-lav'), grEl = document.getElementById('forvbud-gruppe'), svar = document.getElementById('forvbud-svar');
    function regn() {
      var lav = Number(lavEl.value), g = (d.grupper || []).filter(function (x) { return x.id === grEl.value; })[0];
      if (!(lav > 0)) { svar.style.color = DEMPET; svar.textContent = 'Skriv inn lav, så vises forventet bud til kunden.'; return; }
      var r = forLav(lav, g);
      if (!r) { svar.style.color = DEMPET; svar.textContent = 'Gruppen har ikke nok auksjoner til et tall ennå.'; return; }
      svar.style.color = '#14211a';
      svar.innerHTML = 'Forventet bud til kunden: <b style="font-size:17px">' + kr(r.midt) + ' kr</b>' + (r.fra != null ? '. Halvparten av budene lander mellom <b>' + kr(r.fra) + '</b> og <b>' + kr(r.til) + ' kr</b>' : '') + '. Lav er ' + kr(lav) + ' kr, altså ' + kr(Math.max(0, lav - r.midt)) + ' kr over.';
    }
    if (lavEl) { lavEl.oninput = regn; grEl.onchange = regn; }
    var knapp = document.getElementById('forvbud-alle'); if (knapp) knapp.onclick = function () { _alle = !_alle; render(); };
  }

  function hent() {
    fetch('forventet-bud.json?t=' + Date.now(), { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (d) {
      var root = document.getElementById('forvbud-root');
      if (!d || !Array.isArray(d.grupper)) { if (root) root.innerHTML = '<div style="padding:20px;color:#A8221C">Fant ikke forventet-bud.json. Minien lager den hver time når v20.262 er lagt ut.</div>'; return; }
      _data = d; render();
    }).catch(function () { var root = document.getElementById('forvbud-root'); if (root) root.innerHTML = '<div style="padding:20px;color:#A8221C">Kunne ikke lese forventet-bud.json.</div>'; });
  }

  window.FORVBUD = { render: function () { _data = null; render(); } };
})();
