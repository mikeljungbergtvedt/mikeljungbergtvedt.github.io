/* qa-gronn.js – felles fargelogikk for QA-kort (grønn/gul/rød). Brukes av Pulse (auto-tab.js) og Minien (auto-send grønne, AUTO_SEND_GREEN).
   28.10 (Mike): én kilde, så Pulse og auto-send aldri glir fra hverandre. */
(function (root) {
  function stopp(ag) { return !!(ag && ((ag.fsd && ag.fsd.stopp) || (ag.benchmark && ag.benchmark.stopp))); }
  function avvis(ag) { return !!(ag && ((ag.fsd && ag.fsd.avvis) || (ag.benchmark && ag.benchmark.avvis))); }
  function tvil(ag) { var r = []; if (ag && ag.fsd && ag.fsd.tvil) r.push('FSD: ' + ag.fsd.tvil); if (ag && ag.benchmark && ag.benchmark.tvil) r.push('BM: ' + ag.benchmark.tvil); return r.join(' · '); }
  function terskel(mid) { return Math.min(50000, Math.max(5000, 0.05 * mid)); }
  function avvik(ag) {
    var f = ag.fsd && ag.fsd.pris, bm = ag.benchmark && ag.benchmark.pris;
    var mid = ag.mid_pris != null ? ag.mid_pris : stopp(ag) ? null : (f && bm ? Math.round((f + bm) / 2) : f || bm) || null;
    var diff = f && bm ? Math.abs(f - bm) : null;
    var t = mid ? terskel(mid) : null;
    return { mid: mid, diff: diff, terskel: t, varsel: !!(diff != null && t && diff > t) };
  }
  function nivaa(b) {
    var n = b.score >= 80 ? 'g' : b.score < 50 ? 'r' : 'y';
    var ag = b.agent || null;
    if (ag) { var a = avvik(ag); n = avvis(ag) || stopp(ag) ? 'r' : tvil(ag) ? 'y' : !a.mid ? 'r' : a.varsel ? 'y' : 'g'; }
    return n;
  }
  var api = { stopp: stopp, avvis: avvis, tvil: tvil, terskel: terskel, avvik: avvik, nivaa: nivaa };
  if (typeof module === 'object' && module.exports) module.exports = api; else root.QaGronn = api;
})(typeof self !== 'undefined' ? self : this);
