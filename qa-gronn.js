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
    if (b.skade_egen && n === 'g') n = 'y'; /* c678: skade i egenerklæringen er aldri grønn */
    return n;
  }
  /* c696: drift-pause stopper auto-skriving. Manuell QA (Sett Finn-pris / bud) skal ikke låses av det.
     SEND krever fortsatt bekreftet Lav/Høy fra Mini (/qa/anker) eller erp.skrevet / erp_lav. */
  function driftPause(erp) {
    if (!erp) return false;
    return erp.grunn === 'drift-pause' || erp.blokkert === 'drift-pause';
  }
  function verifisertSkriv(lokal) {
    return !!(lokal && Number(lokal.dLav) > 0 && Number(lokal.dHoy) > 0);
  }
  function manuellSend(ag, b, lokal, now) {
    now = now || Date.now();
    if (verifisertSkriv(lokal)) {
      if (now - (lokal.t || 0) < 15 * 60000) return true;
      if (!(ag && ag.erp && ag.erp.skrevet === true)) return true;
    }
    if (ag && ag.pris_kilde && /^(manuell|bud)$/.test(String(ag.pris_kilde.kilde || '')) && b && Number(b.erp_lav) > 0) return true;
    /* Pris ligger i ERP (lav og høy), og den eneste auto-score-sperren er drift-pause. Ikke stopp. */
    if (b && Number(b.erp_lav) > 0 && Number(b.erp_hoy) > 0 && ag && driftPause(ag.erp) && !stopp(ag)) return true;
    return false;
  }
  function sendLas(ag, b, lokal, now) {
    if (manuellSend(ag, b, lokal, now)) return '';
    if (!ag) return 'Venter på FSD og Benchmark';
    if (stopp(ag)) return 'stopp';
    if (ag.erp && ag.erp.tidligere_avvist) return 'tidligere';
    if (!(ag.erp && ag.erp.skrevet)) {
      if (driftPause(ag.erp)) return 'drift-pause';
      return 'Pris er ikke skrevet til ERP ennå';
    }
    return '';
  }
  var api = { stopp: stopp, avvis: avvis, tvil: tvil, terskel: terskel, avvik: avvik, nivaa: nivaa, driftPause: driftPause, verifisertSkriv: verifisertSkriv, manuellSend: manuellSend, sendLas: sendLas };
  if (typeof module === 'object' && module.exports) module.exports = api; else root.QaGronn = api;
})(typeof self !== 'undefined' ? self : this);
