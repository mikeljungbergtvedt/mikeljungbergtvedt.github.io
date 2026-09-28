/* gb-ml-tab.js — GB-fanen: Finn-trent prismodell (GB-ML). Kun visning. Skriver ikke ERP, sender ikke.
 * Henter GET /gb-ml?regnr= fra Mini (gb-ml-route.js). Første kall starter henting på Mini; fanen poller til resultatet er klart.
 * Gammel GB-utpris (/gb-utpris) vises uendret under «Gammel GB-utpris». */
(function () {
  var WEBHOOK_URL = 'https://mike-sin-mac-mini.tail3fb404.ts.net:8443/trigger-eval';
  var TOKEN = 'da9df6e858f0cdc5c0baa090a0f2c7c76f12cd3967488257';
  var POLL_MS = 8000, MAX_POLLS = 110; // ~15 min
  var seq = 0;

  function fmt(n) { if (n == null || n === '' || !isFinite(Number(n))) return '–'; return Math.round(Number(n)).toLocaleString('nb-NO'); }
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function root() { return document.getElementById('gb-ml-root'); }

  function css() {
    if (document.getElementById('gb-ml-css')) return;
    var s = document.createElement('style'); s.id = 'gb-ml-css';
    s.textContent = [
      '#gb-ml-root .gm-card{background:#fff;border:1px solid var(--border);border-radius:12px;padding:16px 18px;margin:0 0 14px;}',
      '#gb-ml-root h3{font-size:11px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;color:#0F6E66;margin:0 0 10px;}',
      '#gb-ml-root .gm-id{font-size:17px;font-weight:700;margin:0 0 14px;} #gb-ml-root .gm-id small{display:block;font-size:12.5px;font-weight:400;color:var(--muted);}',
      '#gb-ml-root .gm-grid{display:grid;grid-template-columns:2fr 1fr;gap:14px;} @media(max-width:800px){#gb-ml-root .gm-grid{grid-template-columns:1fr;}}',
      '#gb-ml-root .gm-big{font-size:40px;font-weight:800;letter-spacing:-.02em;line-height:1.1;} #gb-ml-root .gm-cmp .gm-big{font-size:30px;color:#B26A00;}',
      '#gb-ml-root .gm-iv{font-size:15px;margin-top:6px;} #gb-ml-root .gm-meta{font-size:12px;color:var(--muted);margin-top:8px;}',
      '#gb-ml-root .gm-bar{position:relative;height:8px;background:#E3EEF0;border-radius:4px;margin:14px 0 4px;} #gb-ml-root .gm-bar b,#gb-ml-root .gm-bar u{position:absolute;top:-4px;width:3px;height:16px;border-radius:2px;}',
      '#gb-ml-root .gm-bar b{background:#004225;} #gb-ml-root .gm-bar u{background:#E69100;}',
      '#gb-ml-root .gm-warn{background:#FFF3E0;border:1px solid #F5C77E;color:#7A4B00;border-radius:8px;padding:10px 14px;margin:0 0 12px;font-size:13.5px;}',
      '#gb-ml-root .gm-flag{background:#FDECEA;border:1px solid #F3B2AC;color:#8E1B12;border-radius:8px;padding:8px 12px;margin:0 0 12px;font-size:13px;}',
      '#gb-ml-root .gm-ghost{color:#8A9199;margin:0 0 12px;font-size:13px;} #gb-ml-root .gm-ghost s{font-size:18px;font-weight:700;} #gb-ml-root .gm-tag{border:1px solid #C5CBD1;border-radius:4px;padding:1px 6px;font-size:10.5px;margin-left:6px;text-transform:uppercase;}',
      '#gb-ml-root .gm-legend{display:flex;gap:14px;flex-wrap:wrap;font-size:12px;color:var(--muted);margin:0 0 8px;}',
      '#gb-ml-root .gm-chips{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 10px;} #gb-ml-root .gm-chip{display:inline-flex;gap:6px;align-items:center;border-radius:999px;padding:3px 10px;font-size:12.5px;}',
      '#gb-ml-root .gm-pak{background:#004225;border:1px solid #004225;color:#fff;font-weight:700;font-size:13px;padding:5px 12px;} #gb-ml-root .gm-pak small{color:#CFE3D8;opacity:1;} #gb-ml-root .gm-pak .gm-p{color:#9BE7B4;} #gb-ml-root .gm-pak .gm-n{color:#FFB4AE;} #gb-ml-root .gm-pak .gm-z{color:#CFE3D8;}',
      '#gb-ml-root .gm-sub{font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.04em;margin:4px 0 6px;}',
      '#gb-ml-root .gm-har{background:#E8F5E9;border:1px solid #A5D6A7;color:#1B5E20;} #gb-ml-root .gm-ukj{background:#FFF8E1;border:1px dashed #D4A017;color:#6D4C00;}',
      '#gb-ml-root .gm-chip small{font-size:11px;opacity:.75;} #gb-ml-root .gm-v{font-size:11.5px;font-variant-numeric:tabular-nums;} #gb-ml-root .gm-p{color:#1B7F3B;} #gb-ml-root .gm-n{color:#C62828;} #gb-ml-root .gm-z{color:#8A9199;}',
      '#gb-ml-root table{width:100%;border-collapse:collapse;font-size:13px;} #gb-ml-root th{text-align:left;color:var(--muted);font-weight:600;border-bottom:1px solid var(--border);padding:6px 8px;}',
      '#gb-ml-root td{padding:7px 8px;border-bottom:1px solid #EEF3F4;vertical-align:top;} #gb-ml-root .r{text-align:right;font-variant-numeric:tabular-nums;} #gb-ml-root td small{color:#8A9199;} #gb-ml-root td.gm-spec{color:#667;font-size:12px;}',
      '#gb-ml-root .gm-foot{font-size:11.5px;color:var(--muted);}'
    ].join('\n');
    document.head.appendChild(s);
  }

  function val(kr) {
    if (kr == null) return '';
    if (Math.abs(kr) < 500) return '<span class="gm-v gm-z">≈0</span>';
    return '<span class="gm-v ' + (kr > 0 ? 'gm-p' : 'gm-n') + '">' + (kr > 0 ? '+' : '−') + fmt(Math.abs(kr)) + '</span>';
  }

  function render(r) {
    var el = root(); if (!el) return;
    var id = r.ident || {};
    var iv = r.interval_80_base || [];
    var ut = Number(r.finn_utpris) > 0 ? Number(r.finn_utpris) : null;
    var pos = function (v) { return (iv.length === 2 && iv[1] > iv[0]) ? Math.max(0, Math.min(100, (v - iv[0]) / (iv[1] - iv[0]) * 100)) : 50; };
    var fm = r.finn_model || {};
    var pak = (r.equip || []).filter(function (e) { return e.status === 'pakke'; });
    var har = (r.equip || []).filter(function (e) { return e.status === 'har'; });
    var ukj = (r.equip || []).filter(function (e) { return e.status === 'ukjent'; });
    var h = '';
    h += '<div class="gm-id">' + esc([id.brand, id.model].filter(Boolean).join(' ')) + ' ' + esc(id.year || '') + (id.km != null ? ', ' + fmt(id.km) + ' km' : '')
      + '<small>' + esc(id.car_name || '') + (id.packages && id.packages.length ? ' · ' + esc(id.packages.join(' + ')) : '') + ' · priset som forhandlerannonse</small></div>';
    if (r.fallback || r.thin_data) {
      h += '<div class="gm-flag">⚠ ' + (r.thin_data ? 'Tynt datagrunnlag: bare ' + fmt(r.n_ads) + ' annonser med utstyr. ' : '')
        + (r.fallback ? 'Bredere søk brukt: ' + esc(fm.level) + ' «' + esc(fm.name) + '» (for få annonser på smalere nivå).' : '') + '</div>';
    }
    h += '<div class="gm-grid"><div class="gm-card"><h3>Modellpris (år / km / variant)</h3>'
      + '<div class="gm-big">' + fmt(r.pred_base) + ' kr</div>'
      + '<div class="gm-iv">80 %-intervall: <b>' + fmt(iv[0]) + ' – ' + fmt(iv[1]) + ' kr</b></div>'
      + '<div class="gm-bar"><b style="left:' + pos(r.pred_base).toFixed(1) + '%"></b>' + (ut ? '<u style="left:' + pos(ut).toFixed(1) + '%"></u>' : '') + '</div>'
      + '<div class="gm-meta">Typisk feil ~' + (r.cv_mape_base != null ? Number(r.cv_mape_base).toLocaleString('nb-NO', { maximumFractionDigits: 1 }) : '–') + ' % (CV MAE, ' + esc(r.model_base || '') + ')'
      + ' · n = ' + fmt(r.n_ads) + ' Finn-annonser ' + esc(fm.name || '') + ' · mørk = modell' + (ut ? ', oransje = Finn-utpris' : '') + '</div></div>';
    h += '<div class="gm-card gm-cmp"><h3>Dagens Finn-utpris</h3>'
      + (ut ? '<div class="gm-big">' + fmt(ut) + ' kr</div><div class="gm-iv">Modell − utpris: <b>' + (r.pred_base >= ut ? '+' : '−') + fmt(Math.abs(r.pred_base - ut)) + ' kr</b></div>'
        + '<div class="gm-meta">Fra dossier' + (r.finn_utpris_kilde ? ' (kilde: ' + esc(r.finn_utpris_kilde) + ')' : '') + '</div>'
        : '<div class="gm-meta">Ingen Finn-utpris i dossier.</div>') + '</div></div>';
    h += '<div class="gm-card"><h3>Utstyr</h3>'
      + '<div class="gm-warn">⚠ <b>Utstyrsjustering er ikke brukt i hovedprisen.</b> ' + esc(r.equip_note || '') + '</div>'
      + '<div class="gm-ghost">Med utstyr: <s>' + fmt(r.pred_equip) + ' kr</s><span class="gm-tag">ikke brukt</span> '
      + '<span style="font-size:12px">(80 %: ' + fmt((r.interval_80_equip || [])[0]) + ' – ' + fmt((r.interval_80_equip || [])[1]) + ' kr · CV MAE '
      + (r.cv_mape_equip != null ? Number(r.cv_mape_equip).toLocaleString('nb-NO', { maximumFractionDigits: 1 }) : '–') + ' %)</span></div>'
      + '<div class="gm-sub">Fabrikkutstyr (Car.info-pakker)</div>'
      + (pak.length ? '<div class="gm-chips">' + pak.map(function (e) {
          return '<span class="gm-chip gm-pak">' + esc(e.label)
            + (e.n_ads != null ? '<small>i ' + fmt(e.n_ads) + ' av ' + fmt(r.n_ads) + ' Finn-annonser</small>' : '<small>' + esc(e.note || 'ikke matchet') + '</small>')
            + (e.in_model ? val(e.kr) : (e.key ? '<small>ikke i modellen (for sjelden/vanlig)</small>' : '')) + '</span>';
        }).join('') + '</div>'
        : '<div class="gm-meta" style="margin:0 0 10px">Car.info har ingen pakker (fabrikkutstyr) for denne bilen.</div>')
      + '<div class="gm-sub">Øvrig utstyr</div>'
      + '<div class="gm-legend"><span>● Har (Car.info)</span><span>◌ Ukjent – finnes i ≥2 av 5 nærmeste comps, ikke i Car.info</span><span>Tall = modellens effekt for denne bilen (med minus uten), kr</span></div>'
      + (har.length ? '<div class="gm-chips">' + har.map(function (e) { return '<span class="gm-chip gm-har">' + esc(e.label) + val(e.kr) + '</span>'; }).join('') + '</div>'
        : '<div class="gm-meta" style="margin:0 0 10px">Car.info har ikke oppgitt utstyr for denne bilen.</div>')
      + (ukj.length ? '<div class="gm-chips">' + ukj.map(function (e) { return '<span class="gm-chip gm-ukj">' + esc(e.label) + '<small>' + e.n_comps + '/5 comps</small>' + val(e.kr) + '</span>'; }).join('') + '</div>' : '')
      + '</div>';
    var comps = r.comps || [];
    var hasOv = comps.some(function (c) { return c.overlap_pct != null; });
    h += '<div class="gm-card" style="overflow-x:auto"><h3>5 nærmeste comps</h3><table><thead><tr><th>Finnkode</th><th>Variant</th><th>År</th><th class="r">Km</th><th class="r">Pris</th><th>Selger</th>'
      + (hasOv ? '<th class="r">Utstyrsoverlapp</th>' : '') + '<th>Annonsetekst</th></tr></thead><tbody>'
      + comps.map(function (c) {
        return '<tr><td><a href="' + esc(c.url) + '" target="_blank" rel="noopener">' + esc(c.finnkode) + '</a></td><td>' + esc(c.variant) + '</td><td>' + esc(c.year) + '</td>'
          + '<td class="r">' + fmt(c.km) + '</td><td class="r"><b>' + fmt(c.price) + '</b></td><td>' + esc(c.dealer) + '</td>'
          + (hasOv ? '<td class="r">' + (c.overlap_pct != null ? c.overlap_pct + ' %' : '–') + ' <small>(' + fmt(c.n_equip) + ' utstyr oppført)</small></td>' : '')
          + '<td class="gm-spec">' + esc(c.spec || '') + '</td></tr>';
      }).join('') + '</tbody></table>'
      + (hasOv ? '<div class="gm-foot" style="margin-top:8px">Overlapp = andel av bilens ' + fmt(r.carinfo_equip_count) + ' mappede utstyrspunkter som også står i annonsens utstyrsliste.</div>' : '')
      + '</div>';
    h += '<div class="gm-foot">GB-ML · Finn-data ' + esc(fm.code || '') + ' · beregnet ' + esc(r.generated_at || '') + ' · ingen håndsatte kronebeløp · skriver ikke ERP, sender ikke</div>';
    el.innerHTML = h;
  }

  function status(msg) { var el = root(); if (el) el.innerHTML = '<div class="gm-card"><div class="gm-meta" style="margin:0">' + msg + '</div></div>'; }

  async function hent(force) {
    css();
    var inp = document.getElementById('gb-regnr'); if (!inp) return;
    var regnr = String(inp.value || '').toUpperCase().replace(/[\s-]/g, '');
    if (!/^[A-Z0-9]{2,8}$/.test(regnr)) return;
    var my = ++seq;
    status('GB-ML: henter ' + esc(regnr) + ' …');
    var url = WEBHOOK_URL.replace(/\/trigger-eval.*$/, '/gb-ml?regnr=' + encodeURIComponent(regnr));
    for (var i = 0; i < MAX_POLLS && my === seq; i++) {
      try {
        var r = await fetch(url + (force && i === 0 ? '&force=1' : ''), { headers: { 'Authorization': 'Bearer ' + TOKEN } });
        var j = await r.json().catch(function () { return {}; });
        if (my !== seq) return;
        if (r.status === 404) { status('GB-ML-endepunktet (/gb-ml) er ikke installert på Mini ennå.'); return; }
        if (j.status === 'ready' && j.result) {
          if (j.result.ok === false) { status('GB-ML: ' + esc(j.result.err || 'ingen modell')); return; }
          render(j.result); return;
        }
        if (j.status === 'error' || j.ok === false) { status('GB-ML: ' + esc(j.err || ('HTTP ' + r.status))); return; }
        var p = j.progress || {};
        var fm = p.finn_model || {};
        status('GB-ML: ' + (j.phase === 'train' ? 'trener modell …' : 'henter Finn-annonser'
          + (fm.name ? ' for ' + esc(fm.name) + ' (' + fmt(fm.hits) + ' treff)' : '') + (p.ads ? ' · ' + fmt(p.ads) + ' annonsesider lest' : '') + ' …')
          + ' <span style="color:#8A9199">(første gang tar noen minutter; oppdateres automatisk)</span>');
      } catch (e) {
        if (my !== seq) return;
        status('GB-ML: ' + esc(e && e.message ? e.message : String(e)));
        return;
      }
      await new Promise(function (res) { setTimeout(res, POLL_MS); });
    }
  }

  function bind() {
    var btn = document.getElementById('gb-hent');
    var inp = document.getElementById('gb-regnr');
    if (btn) btn.addEventListener('click', function () { hent(false); });
    if (inp) inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') hent(false); });
  }
  window.gbMlHent = hent;
  window.gbMlRender = function (r) { css(); render(r); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind); else bind();
})();
