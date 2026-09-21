/* Peasy Pulse — Læring-fane. Leser laering-agg.json (repo) og /laering-cars (Mini). */
(function () {
  var LR_PRICE = ['0–35k', '35–100k', '100–250k', '250–400k', '400k+'];
  var LR_AGE = ['0–3 år', '4–7 år', '8–12 år', '13+ år'];
  var LR_LAND = ['Uten postnr.', 'Oslo/Akershus', 'Innlandet', 'Viken sør/Vestf./Telem.', 'Agder/Rogaland', 'Vestland', 'Møre/Sogn', 'Trøndelag', 'Nordland', 'Troms/Finnmark'];
  var LR_REASON = { 1: 'Prisen lavere enn forventet', 2: 'Vil selge senere', 3: 'Selger selv / har solgt', 4: 'Annet (egen tekst)', 0: 'Ingen årsak valgt' };
  var LR_THEMES = [
    { id: 'bud', name: 'Annet bud / innbytte', keys: ['bud', 'innbytte', 'tilbud', 'fått', 'hos '] },
    { id: 'finn', name: 'Finn / markedspris', keys: ['finn', 'marked', 'verdi', 'latterlig', 'lite', 'lav'] },
    { id: 'utstyr', name: 'Utstyr og tilstand', keys: ['utstyr', 'hengerfeste', 'pen', 'innredning', 'km', 'kostet'] },
    { id: 'avstand', name: 'Avstand og henting', keys: ['nord', 'langt', 'henting', 'hentet', 'levering', 'km fra'] },
    { id: 'plan', name: 'Selger ikke nå / annen plan', keys: ['senere', 'vente', 'solgt', 'auksjon'] }
  ];
  var TI = ['null', 'én', 'to', 'tre', 'fire', 'fem', 'seks', 'sju', 'åtte', 'ni', 'ti'];
  var lrState = { period: '90', src: '', agg: null, comments: null, commentsErr: false, charts: [] };

  function nb(n) { return Math.round(n).toLocaleString('nb-NO'); }
  function pct0(n, d) { return d ? Math.round(n / d * 100) : 0; }
  function pct1(n, d) { return d ? Math.round(n / d * 1000) / 10 : 0; }
  function pct1s(n, d) { return pct1(n, d).toFixed(1).replace('.', ','); }
  function addDays(ymd, delta) {
    var p = String(ymd).split('-').map(Number);
    var dt = new Date(Date.UTC(p[0], p[1] - 1, p[2] + delta));
    return dt.toISOString().slice(0, 10);
  }
  function periodFrom(asOf, period) {
    if (period === '30') return addDays(asOf, -30);
    if (period === 'ytd') return asOf.slice(0, 4) + '-01-01';
    return addDays(asOf, -90);
  }
  function isoWeek(ymd) {
    var p = String(ymd).split('-').map(Number);
    var date = new Date(Date.UTC(p[0], p[1] - 1, p[2]));
    var day = date.getUTCDay() || 7;
    date.setUTCDate(date.getUTCDate() + 4 - day);
    var isoYear = date.getUTCFullYear();
    var jan4 = new Date(Date.UTC(isoYear, 0, 4));
    var jan4Day = jan4.getUTCDay() || 7;
    var week1Mon = new Date(jan4);
    week1Mon.setUTCDate(jan4.getUTCDate() - jan4Day + 1);
    var week = 1 + Math.round((date - week1Mon) / 604800000);
    return { isoYear: isoYear, week: week, key: isoYear + '-W' + String(week).padStart(2, '0'), label: 'U' + week };
  }
  function priceBand(p) {
    var n = Number(p);
    if (!isFinite(n) || n < 0) return null;
    if (n < 35000) return '0–35k';
    if (n < 100000) return '35–100k';
    if (n < 250000) return '100–250k';
    if (n < 400000) return '250–400k';
    return '400k+';
  }
  function ageBand(year, cy) {
    var y = Number(year);
    if (!isFinite(y) || y < 1950) return null;
    var a = cy - y;
    if (a <= 3) return '0–3 år';
    if (a <= 7) return '4–7 år';
    if (a <= 12) return '8–12 år';
    return '13+ år';
  }
  function landsdel(z) {
    if (z == null || z === '') return 'Uten postnr.';
    var d = String(z)[0];
    if (d === '0' || d === '1') return 'Oslo/Akershus';
    if (d === '2') return 'Innlandet';
    if (d === '3') return 'Viken sør/Vestf./Telem.';
    if (d === '4') return 'Agder/Rogaland';
    if (d === '5') return 'Vestland';
    if (d === '6') return 'Møre/Sogn';
    if (d === '7') return 'Trøndelag';
    if (d === '8') return 'Nordland';
    if (d === '9') return 'Troms/Finnmark';
    return 'Uten postnr.';
  }
  function empty() { return { n: 0, bestilt: 0, avvist: 0, stille: 0, admin: 0, venter: 0 }; }
  function add(c, out) { c.n++; if (c[out] != null) c[out]++; }
  function avgj(c) { return c.bestilt + c.avvist + c.stille + c.admin; }
  function themeOf(text) {
    var t = String(text || '').toLowerCase();
    for (var i = 0; i < LR_THEMES.length; i++) {
      for (var k = 0; k < LR_THEMES[i].keys.length; k++) {
        if (t.indexOf(LR_THEMES[i].keys[k]) >= 0) return LR_THEMES[i];
      }
    }
    return { id: 'annet', name: 'Annet' };
  }

  function summarize(rows, cy) {
    var totals = empty();
    var weeks = {};
    var reasons = { 1: 0, 2: 0, 3: 0, 4: 0, 0: 0 };
    var speed = { m5: 0, m60: 0, h24: 0, over: 0 };
    var priceReject = 0, priceReject5 = 0;
    var segs = { pris: {}, alder: {}, kilde: { Peasy: empty(), Drive: empty() }, landsdel: {}, merke: {} };
    LR_PRICE.forEach(function (k) { segs.pris[k] = empty(); });
    LR_AGE.forEach(function (k) { segs.alder[k] = empty(); });
    LR_LAND.forEach(function (k) { segs.landsdel[k] = empty(); });
    var miss = 0, missP = 0, missD = 0, peasyN = 0, driveN = 0;
    rows.forEach(function (r) {
      add(totals, r.out);
      var w = isoWeek(r.fe);
      if (!weeks[w.key]) weeks[w.key] = Object.assign(empty(), { key: w.key, label: w.label, isoYear: w.isoYear, week: w.week });
      add(weeks[w.key], r.out);
      if (r.out === 'avvist') {
        var rid = r.rid == null ? 0 : r.rid;
        if (reasons[rid] == null) reasons[rid] = 0;
        reasons[rid]++;
        var t = r.tmin;
        if (t != null && isFinite(t) && t >= 0) {
          if (t < 5) speed.m5++;
          else if (t < 60) speed.m60++;
          else if (t < 1440) speed.h24++;
          else speed.over++;
        }
        if (rid === 1) {
          priceReject++;
          if (t != null && t < 5) priceReject5++;
        }
      }
      var band = priceBand(r.pmin);
      if (band && segs.pris[band]) add(segs.pris[band], r.out);
      var age = ageBand(r.year, cy);
      if (age && segs.alder[age]) add(segs.alder[age], r.out);
      var kilde = r.src === 'driveno' ? 'Drive' : 'Peasy';
      add(segs.kilde[kilde], r.out);
      if (r.src === 'driveno') driveN++; else peasyN++;
      var land = landsdel(r.zip1);
      if (!segs.landsdel[land]) segs.landsdel[land] = empty();
      add(segs.landsdel[land], r.out);
      if (r.brand) {
        if (!segs.merke[r.brand]) segs.merke[r.brand] = empty();
        add(segs.merke[r.brand], r.out);
      }
      if (r.zip1 == null) {
        miss++;
        if (r.src === 'driveno') missD++; else missP++;
      }
    });
    var weekArr = Object.keys(weeks).sort().map(function (k) { return weeks[k]; });
    weekArr.forEach(function (w) { w.pagar = w.n > 0 && w.venter / w.n > 0.2; });
    function rowsOf(obj, keepOrder, top) {
      var keys = keepOrder || Object.keys(obj);
      var arr = keys.map(function (label) {
        var c = obj[label] || empty();
        return Object.assign({ label: label }, c, { avg: avgj(c) });
      }).filter(function (r) { return r.n > 0; });
      if (!keepOrder) arr.sort(function (a, b) { return b.n - a.n; });
      if (top) arr = arr.slice(0, top);
      return arr;
    }
    return {
      totals: totals, avgjorte: avgj(totals), weeks: weekArr, reasons: reasons, speed: speed,
      priceReject: priceReject, priceReject5: priceReject5,
      segs: {
        pris: rowsOf(segs.pris),
        alder: rowsOf(segs.alder),
        kilde: rowsOf(segs.kilde, ['Peasy', 'Drive']),
        landsdel: rowsOf(segs.landsdel),
        merke: rowsOf(segs.merke, null, 12)
      },
      missingZip: miss, missingZipPeasy: missP, missingZipDrive: missD, peasyN: peasyN, driveN: driveN
    };
  }

  function insights(sum) {
    var out = [];
    var avg = sum.avgjorte, t = sum.totals;
    if (!avg) return out;
    var stillePct = pct0(t.stille, avg);
    if (stillePct >= 50) {
      var x = Math.round(t.stille / avg * 10);
      var word = TI[x] || String(x);
      var cap = word.charAt(0).toUpperCase() + word.slice(1);
      out.push('<b>' + cap + ' av ti sier ingenting.</b> ' + nb(t.stille) + ' av ' + nb(avg) + ' lar estimatet gå ut på tid.');
    }
    if (t.avvist > 0 && pct0(sum.priceReject, t.avvist) >= 40) {
      out.push('<b>Prisen er grunnen.</b> ' + pct0(sum.priceReject, t.avvist) + ' % av avvisningene oppgir prisen, og ' +
        pct0(sum.priceReject5, sum.priceReject) + ' % av dem avviser innen fem minutter.');
    }
    var lands = (sum.segs.landsdel || []).filter(function (r) { return r.label !== 'Uten postnr.' && r.n >= 40 && r.avg > 0; });
    if (lands.length >= 2) {
      var scored = lands.map(function (r) { return Object.assign({}, r, { bp: pct0(r.bestilt, r.avg) }); });
      scored.sort(function (a, b) { return b.bp - a.bp; });
      var best = scored[0], worst = scored[scored.length - 1];
      if (best.bp - worst.bp >= 8) {
        out.push('<b>' + best.label + ' bestiller ' + best.bp + ' %, ' + worst.label + ' ' + worst.bp + ' %.</b>');
      }
    }
    var overallBp = pct1(t.bestilt, avg);
    var age03 = (sum.segs.alder || []).filter(function (r) { return r.label === '0–3 år'; })[0];
    var dyr = (sum.segs.pris || []).filter(function (r) { return r.label === '400k+'; })[0];
    var bits = [];
    if (age03 && age03.avg && pct1(age03.bestilt, age03.avg) <= overallBp / 2) bits.push('0–3 år ' + pct0(age03.bestilt, age03.avg) + ' %');
    if (dyr && dyr.avg && pct1(dyr.bestilt, dyr.avg) <= overallBp / 2) bits.push('400k+ ' + pct0(dyr.bestilt, dyr.avg) + ' %');
    if (bits.length) out.push('<b>Nye og dyre biler bestiller sjelden</b> (' + bits.join(', ') + ').');
    var peasy = (sum.segs.kilde || []).filter(function (r) { return r.label === 'Peasy'; })[0];
    var drive = (sum.segs.kilde || []).filter(function (r) { return r.label === 'Drive'; })[0];
    if (peasy && drive && peasy.avg && drive.avg) {
      var pb = pct0(peasy.bestilt, peasy.avg), db = pct0(drive.bestilt, drive.avg);
      if (Math.abs(pb - db) >= 3) {
        out.push(pb >= db
          ? '<b>Peasy bestiller ' + pb + ' %, Drive ' + db + ' %.</b>'
          : '<b>Drive bestiller ' + db + ' %, Peasy ' + pb + ' %.</b>');
      }
    }
    var done = (sum.weeks || []).filter(function (w) { return !w.pagar && avgj(w) > 0; });
    if (done.length >= 8) {
      var last = done.slice(-4), prev = done.slice(-8, -4);
      var bLast = last.reduce(function (s, w) { return s + w.bestilt; }, 0);
      var aLast = last.reduce(function (s, w) { return s + avgj(w); }, 0);
      var bPrev = prev.reduce(function (s, w) { return s + w.bestilt; }, 0);
      var aPrev = prev.reduce(function (s, w) { return s + avgj(w); }, 0);
      var pLast = pct0(bLast, aLast), pPrev = pct0(bPrev, aPrev);
      if (Math.abs(pLast - pPrev) >= 3) {
        out.push('<b>Bestilt ' + (pLast > pPrev ? 'opp' : 'ned') + ' fra ' + pPrev + ' til ' + pLast + ' %</b> siste fire uker.');
      }
    }
    return out;
  }

  function killCharts() {
    lrState.charts.forEach(function (c) { try { c.destroy(); } catch (e) {} });
    lrState.charts = [];
  }
  function mkChart(id, spec) {
    var el = document.getElementById(id);
    if (!el || typeof Chart === 'undefined') return;
    var ex = Chart.getChart(el);
    if (ex) ex.destroy();
    spec.options = spec.options || {};
    spec.options.animation = false;
    var ch = new Chart(el, spec);
    lrState.charts.push(ch);
    requestAnimationFrame(function () { try { ch.resize(); } catch (e) {} });
    setTimeout(function () { try { ch.resize(); } catch (e) {} }, 60);
  }

  function hBar(items, total) {
    return items.map(function (it) {
      var w = total ? Math.round(it.n / total * 100) : 0;
      return '<div class="lr-hr"><div>' + it.label + '</div><div class="lr-ht"><span' + (it.hot ? ' class="hp"' : '') + ' style="width:' + w + '%"></span></div><div class="lr-hv">' + nb(it.n) + ' · ' + w + ' %</div></div>';
    }).join('');
  }

  function segTable(rows, overallBp) {
    var head = '<table class="lr-tbl"><thead><tr><th>Segment</th><th class="lr-r">Estimater</th><th class="lr-r">Bestilt</th><th class="lr-r">Avvist</th><th class="lr-r">Stille</th><th class="lr-w">Fordeling</th></tr></thead><tbody>';
    var body = rows.map(function (r) {
      var bp = pct0(r.bestilt, r.avg), ap = pct0(r.avvist, r.avg), sp = pct0(r.stille, r.avg);
      var low = r.n < 60;
      var cls = bp <= overallBp / 2 && r.avg ? 'lr-num lo' : (bp >= overallBp + 4 && r.n >= 60 ? 'lr-num hi' : 'lr-num');
      return '<tr' + (low ? ' class="lr-low"' : '') + '><td>' + r.label + '</td><td class="lr-r">' + nb(r.n) + '</td><td class="lr-r ' + cls + '">' + bp + ' %</td><td class="lr-r">' + ap + ' %</td><td class="lr-r">' + sp + ' %</td><td class="lr-w"><div class="lr-b3"><span class="lr-bb" style="width:' + bp + '%"></span><span class="lr-ba" style="width:' + ap + '%"></span><span class="lr-bs" style="width:' + sp + '%"></span></div></td></tr>';
    }).join('');
    return head + body + '</tbody></table>';
  }

  function fmtOslo(built) {
    if (!built) return '–';
    var m = String(built).match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/);
    if (m) return m[3] + '.' + m[2] + '.' + m[1] + ' kl. ' + m[4] + ':' + m[5];
    return built;
  }

  function renderComments(from, to, src) {
    if (lrState.commentsErr) {
      return '<div class="lr-card"><div class="lr-cn">Ikke tilgjengelig — Mini svarer ikke</div></div>';
    }
    if (!lrState.comments) {
      return '<div class="lr-card"><div class="lr-cn">Henter kundetekst …</div></div>';
    }
    var items = (lrState.comments.items || lrState.comments.comments || []).filter(function (c) {
      if (c.fe && (c.fe < from || c.fe > to)) return false;
      if (src && c.src && c.src !== src) return false;
      return !!(c.comment || c.text);
    });
    items.sort(function (a, b) { return String(b.fe || '').localeCompare(String(a.fe || '')); });
    items = items.slice(0, 30);
    if (!items.length) return '<div class="lr-card"><div class="lr-cn">Ingen fritekst i perioden.</div></div>';
    var groups = [];
    var map = {};
    items.forEach(function (c) {
      var th = themeOf(c.comment || c.text);
      if (!map[th.id]) { map[th.id] = { name: th.name, items: [] }; groups.push(map[th.id]); }
      map[th.id].items.push(c);
    });
    return groups.map(function (g) {
      var qs = g.items.map(function (c) {
        var d = c.fe ? c.fe.slice(8, 10) + '.' + c.fe.slice(5, 7) + '.' : '';
        var meta = [c.regnr, c.bil, c.band ? 'estimat ' + c.band : '', d].filter(Boolean).join(' · ');
        var txt = String(c.comment || c.text || '');
        if (txt.length > 280) txt = txt.slice(0, 277) + '…';
        return '<div class="lr-q"><div class="lr-qt">«' + txt.replace(/</g, '&lt;') + '»</div><div class="lr-qm">' + meta.replace(/</g, '&lt;') + '</div></div>';
      }).join('');
      return '<div class="lr-th"><div class="lr-tt">' + g.name + ' <span>' + g.items.length + '</span></div>' + qs + '</div>';
    }).join('');
  }

  function render() {
    var body = document.getElementById('laering-body');
    if (!body || !lrState.agg) return;
    var agg = lrState.agg;
    var asOf = agg.as_of || (agg.built_at_oslo || '').slice(0, 10);
    var from = periodFrom(asOf, lrState.period);
    var rows = (agg.cars || []).filter(function (c) {
      if (c.fe < from || c.fe > asOf) return false;
      if (lrState.src && c.src !== lrState.src) return false;
      return true;
    });
    var cy = Number(asOf.slice(0, 4)) || 2026;
    var sum = summarize(rows, cy);
    var t = sum.totals, avg = sum.avgjorte;
    var ins = insights(sum);
    var overallBp = pct0(t.bestilt, avg);

    document.querySelectorAll('#laering-section [data-lr-period]').forEach(function (b) {
      b.classList.toggle('on', b.getAttribute('data-lr-period') === lrState.period);
    });
    document.querySelectorAll('#laering-section [data-lr-src]').forEach(function (b) {
      b.classList.toggle('on', b.getAttribute('data-lr-src') === lrState.src);
    });

    var html = '';
    html += '<div class="lr-kpis">';
    html += '<div class="lr-kpi b"><div class="lr-kl">Bestilt</div><div class="lr-kv">' + pct1s(t.bestilt, avg) + ' %</div><div class="lr-kd">' + nb(t.bestilt) + ' av ' + nb(avg) + ' avgjorte</div></div>';
    html += '<div class="lr-kpi a"><div class="lr-kl">Avviste selv</div><div class="lr-kv">' + pct0(t.avvist, avg) + ' %</div><div class="lr-kd">' + nb(t.avvist) + ' trykket «nei»</div></div>';
    html += '<div class="lr-kpi"><div class="lr-kl">Sa ingenting</div><div class="lr-kv">' + pct0(t.stille, avg) + ' %</div><div class="lr-kd">' + nb(t.stille) + ' timet ut etter påminnelsene</div></div>';
    html += '<div class="lr-kpi"><div class="lr-kl">Venter nå</div><div class="lr-kv">' + nb(t.venter) + '</div><div class="lr-kd">har estimat, ikke avgjort · ' + nb(t.admin) + ' lukket av admin</div></div>';
    html += '</div>';

    html += '<h2>Det vi lærer</h2><div class="lr-ins">';
    if (ins.length) html += '<ol>' + ins.map(function (s) { return '<li>' + s + '</li>'; }).join('') + '</ol>';
    else html += '<p class="lr-cn">Ingen av læringsreglene slår til i denne perioden.</p>';
    html += '</div>';

    html += '<h2>Bestilt per uke</h2><div class="lr-card"><div class="lr-cn">Andel av avgjorte estimater som ble bestilt, etter uka estimatet ble sendt. Tallet under er antall estimater.</div><div class="lr-chart"><canvas id="lr-week-bestilt"></canvas></div>';
    var pagar = sum.weeks.filter(function (w) { return w.pagar; }).map(function (w) { return w.label; });
    if (pagar.length) html += '<div class="lr-cn" style="margin-top:8px">' + pagar.join(' og ') + ' pågår — mer enn 20 % venter, så andelen tegnes ikke.</div>';
    html += '</div>';

    html += '<h2>Utfall per uke</h2><div class="lr-card"><div class="lr-cn">Bestilt / avvist / stille / admin av avgjorte, 100 % stablet.</div><div class="lr-chart"><canvas id="lr-week-stack"></canvas></div></div>';

    html += '<h2>Hvorfor de sier nei</h2><div class="lr-grid2">';
    html += '<div class="lr-card"><div class="lr-ct">Valgt årsak</div><div class="lr-cn">' + nb(t.avvist) + ' kunder som trykket «nei»</div>';
    html += hBar([
      { label: LR_REASON[1], n: sum.reasons[1] || 0, hot: true },
      { label: LR_REASON[2], n: sum.reasons[2] || 0 },
      { label: LR_REASON[3], n: sum.reasons[3] || 0 },
      { label: LR_REASON[4], n: sum.reasons[4] || 0 },
      { label: LR_REASON[0], n: sum.reasons[0] || 0 }
    ], t.avvist);
    html += '</div>';
    html += '<div class="lr-card"><div class="lr-ct">Hvor raskt</div><div class="lr-cn">Tid fra estimat sendt til kunden avviste</div>';
    html += hBar([
      { label: '< 5 min', n: sum.speed.m5, hot: true },
      { label: '5–60 min', n: sum.speed.m60 },
      { label: '1–24 t', n: sum.speed.h24 },
      { label: '> 24 t', n: sum.speed.over }
    ], t.avvist);
    html += '<div class="lr-cn" style="margin-top:10px">Av dem som oppgir prisen: ' + nb(sum.priceReject5) + ' av ' + nb(sum.priceReject) + ' innen 5 min</div>';
    html += '</div></div>';

    html += '<h2>Segmenter</h2><div class="lr-leg"><span><i style="background:#004225"></i>Bestilt</span><span><i style="background:#B8452F"></i>Avvist</span><span><i style="background:#C9C4B6"></i>Stille</span><span>Andeler av avgjorte · grå rad = under 60 biler, les forsiktig</span></div>';
    html += '<div class="lr-grid2"><div class="lr-card"><div class="lr-ct">Estimat (lav)</div>' + segTable(sum.segs.pris, overallBp) + '</div>';
    html += '<div class="lr-card"><div class="lr-ct">Bilens alder</div>' + segTable(sum.segs.alder, overallBp) + '</div></div>';
    html += '<div class="lr-card"><div class="lr-ct">Landsdel</div><div class="lr-cn">Fra kundens postnummer. ' + nb(sum.missingZip) + ' biler mangler postnummer' + (sum.peasyN ? ' — ' + nb(sum.missingZipPeasy) + ' av ' + nb(sum.peasyN) + ' Peasy-biler' : '') + '.</div>' + segTable(sum.segs.landsdel, overallBp) + '</div>';
    html += '<div class="lr-grid2"><div class="lr-card"><div class="lr-ct">Kilde</div>' + segTable(sum.segs.kilde, overallBp) + '</div>';
    html += '<div class="lr-card"><div class="lr-ct">Merke (topp 12)</div>' + segTable(sum.segs.merke, overallBp) + '</div></div>';

    html += '<h2>Kundens egne ord</h2><div class="lr-cn" style="margin:-4px 0 12px">Fritekst fra «Annet», nyeste først, maks 30. Tema etter nøkkelord.</div>';
    html += '<div id="lr-comments">' + renderComments(from, asOf, lrState.src) + '</div>';

    var peasyMissPct = sum.peasyN ? pct0(sum.missingZipPeasy, sum.peasyN) : 0;
    html += '<h2>Det vi ikke kan se ennå</h2><div class="lr-gap"><ul>';
    html += '<li><b>Hvorfor de stille forsvinner.</b> ' + pct0(t.stille, avg) + ' % gir oss ingen grunn. Én klikkbar årsak i den siste påminnelsen og i timeout-mailen ville gitt svar fra langt flere.</li>';
    html += '<li><b>Om de åpnet unbox i det hele tatt.</b> Vi vet ikke om de stille så estimatet og gikk, eller aldri åpnet lenken. Visning av unbox-siden bør logges per bil.</li>';
    html += '<li><b>Hvilken unbox-variant de så.</b> Når malene i ERP kommer, må varianten lagres på bilen, ellers kan vi ikke lese A/B-testen her.</li>';
    html += '<li><b>Postnummer.</b> ' + peasyMissPct + ' % av Peasy-bilene mangler det (' + nb(sum.missingZipPeasy) + ' av ' + nb(sum.peasyN) + '; Drive ' + nb(sum.missingZipDrive) + '). Da faller landsdelsbildet — og Nord-Norge-funnet — bort for en stor del av Peasy-kundene.</li>';
    html += '</ul></div>';

    html += '<div class="lr-foot">Data fra ERP · bygget ' + fmtOslo(agg.built_at_oslo || agg.built_at) + ' · ' + nb(rows.length) + ' biler i perioden</div>';
    body.innerHTML = html;
    drawCharts(sum);
  }

  function drawCharts(sum) {
    killCharts();
    if (typeof Chart === 'undefined') return;
    var weeks = sum.weeks;
    var labels = weeks.map(function (w) { return w.label; });
    var bestiltPct = weeks.map(function (w) { return w.pagar || !avgj(w) ? null : pct1(w.bestilt, avgj(w)); });
    var avvistPct = weeks.map(function (w) { return w.pagar || !avgj(w) ? null : pct1(w.avvist, avgj(w)); });
    var nEst = weeks.map(function (w) { return w.n; });
    var yMax = 10;
    bestiltPct.concat(avvistPct).forEach(function (v) { if (v != null && v > yMax) yMax = v; });
    yMax = Math.ceil((yMax + 4) / 5) * 5;
    mkChart('lr-week-bestilt', {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [
          { type: 'bar', label: 'Bestilt %', data: bestiltPct, backgroundColor: '#004225', yAxisID: 'y', order: 2, barPercentage: 0.72, categoryPercentage: 0.8 },
          { type: 'line', label: 'Avvist %', data: avvistPct, borderColor: '#B8452F', backgroundColor: 'transparent', pointRadius: 2.5, borderWidth: 2, yAxisID: 'y', order: 1, spanGaps: false }
        ]
      },
      plugins: [{
        id: 'lrWeekLabels',
        afterDatasetsDraw: function (chart) {
          var meta = chart.getDatasetMeta(0);
          var ctx = chart.ctx;
          ctx.save();
          ctx.textAlign = 'center';
          ctx.textBaseline = 'bottom';
          ctx.font = '600 11px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif';
          weeks.forEach(function (w, i) {
            var el = meta.data[i];
            if (!el) return;
            var txt, col;
            if (w.pagar) { txt = 'pågår'; col = '#5E6B62'; }
            else if (bestiltPct[i] == null) { return; }
            else { txt = String(bestiltPct[i]).replace('.', ',') + ' %'; col = '#16201B'; }
            ctx.fillStyle = col;
            var y = el.y - 4;
            if (y < chart.chartArea.top + 12) y = chart.chartArea.top + 12;
            ctx.fillText(txt, el.x, y);
          });
          ctx.restore();
        }
      }],
      options: {
        responsive: true, maintainAspectRatio: false,
        layout: { padding: { top: 16, bottom: 2 } },
        plugins: {
          legend: { display: true, labels: { font: { size: 11 }, boxWidth: 12 } },
          tooltip: {
            callbacks: {
              afterBody: function (items) {
                var i = items && items[0] && items[0].dataIndex;
                if (i == null || !weeks[i]) return '';
                var w = weeks[i];
                var a = avgj(w);
                if (w.pagar) return 'pågår · ' + w.n + ' estimater · ' + w.venter + ' venter';
                return w.bestilt + ' bestilt / ' + a + ' avgjorte · ' + w.n + ' estimater';
              }
            }
          }
        },
        scales: {
          x: {
            ticks: {
              color: '#5E6B62',
              font: { size: 10 },
              callback: function (val, i) { return [labels[i] || '', String(nEst[i] || '')]; }
            },
            grid: { display: false }
          },
          y: { min: 0, max: yMax, ticks: { color: '#5E6B62', font: { size: 10 }, callback: function (v) { return v + ' %'; } }, grid: { color: 'rgba(0,0,0,0.04)' } }
        }
      }
    });
    var stackBest = weeks.map(function (w) { var a = avgj(w); return w.pagar || !a ? null : pct0(w.bestilt, a); });
    var stackAvv = weeks.map(function (w) { var a = avgj(w); return w.pagar || !a ? null : pct0(w.avvist, a); });
    var stackSti = weeks.map(function (w) { var a = avgj(w); return w.pagar || !a ? null : pct0(w.stille, a); });
    var stackAdm = weeks.map(function (w) { var a = avgj(w); return w.pagar || !a ? null : pct0(w.admin, a); });
    mkChart('lr-week-stack', {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [
          { label: 'Bestilt', data: stackBest, backgroundColor: '#004225', stack: 's' },
          { label: 'Avvist', data: stackAvv, backgroundColor: '#B8452F', stack: 's' },
          { label: 'Stille', data: stackSti, backgroundColor: '#C9C4B6', stack: 's' },
          { label: 'Admin', data: stackAdm, backgroundColor: '#8A9A90', stack: 's' }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: true, labels: { font: { size: 11 }, boxWidth: 12 } },
          tooltip: {
            callbacks: {
              label: function (ctx) {
                var w = weeks[ctx.dataIndex];
                if (!w) return ctx.dataset.label;
                var key = { Bestilt: 'bestilt', Avvist: 'avvist', Stille: 'stille', Admin: 'admin' }[ctx.dataset.label];
                var n = key ? w[key] : 0;
                var p = ctx.parsed.y;
                return ctx.dataset.label + ': ' + n + ' · ' + (p == null ? '–' : p + ' %');
              }
            }
          }
        },
        scales: {
          x: { stacked: true, ticks: { color: '#5E6B62', font: { size: 10 } }, grid: { display: false } },
          y: { stacked: true, min: 0, max: 100, ticks: { color: '#5E6B62', font: { size: 10 }, callback: function (v) { return v + ' %'; } }, grid: { color: 'rgba(0,0,0,0.04)' } }
        }
      }
    });
  }

  async function fetchAgg() {
    var urls = ['laering-agg.json?t=' + Date.now(), 'https://mikeljungbergtvedt.github.io/laering-agg.json?t=' + Date.now()];
    var lastErr = null;
    for (var i = 0; i < urls.length; i++) {
      try {
        var r = await fetch(urls[i], { cache: 'no-store' });
        if (r.ok) return await r.json();
        lastErr = 'HTTP ' + r.status;
      } catch (e) { lastErr = e && e.message || e; }
    }
    throw new Error(lastErr || 'ingen agg');
  }

  async function fetchComments() {
    var base = String(window.PA_PROXY_ERP || '').replace(/\/list\/?$/, '');
    if (!base) { lrState.commentsErr = true; return; }
    try {
      var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
      var t = ctrl ? setTimeout(function () { ctrl.abort(); }, 8000) : null;
      var r = await fetch(base + '/laering-cars?t=' + Date.now(), {
        headers: { Authorization: 'Bearer ' + (window.PA_TOKEN_ERP || '') },
        signal: ctrl ? ctrl.signal : undefined
      });
      if (t) clearTimeout(t);
      if (!r.ok) throw new Error('HTTP ' + r.status);
      lrState.comments = await r.json();
      lrState.commentsErr = false;
    } catch (e) {
      lrState.commentsErr = true;
      lrState.comments = null;
    }
  }

  window.laeringSetPeriod = function (p) { lrState.period = p; render(); };
  window.laeringSetSrc = function (s) { lrState.src = s; render(); };

  var loading = false;
  window.loadLaering = async function () {
    var body = document.getElementById('laering-body');
    if (lrState.agg) { render(); fetchComments().then(function () { render(); }); return; }
    if (loading) return;
    loading = true;
    if (body) body.innerHTML = '<div class="lr-cn">Laster aggregat …</div>';
    try {
      lrState.agg = await fetchAgg();
      render();
      await fetchComments();
      render();
    } catch (e) {
      if (body) body.innerHTML = '<div class="lr-card"><div class="lr-cn">Kunne ikke lese laering-agg.json. Kjør nattjobben på Mini.</div></div>';
    } finally { loading = false; }
  };
})();
