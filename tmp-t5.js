// V3 Trinn 5 — km-verifisering
//
// Per v3-trinn5-6.md:
//   Input:
//     - km-input fra ERP (kunde-oppgitt)
//     - carInfo.history[] (fra Trinn 3, EU-kontroller + service)
//
//   Prosess:
//     1. Hent siste inspection-km fra history (siste entry med type === 'inspection')
//     2. Beregn forventet_km = siste_inspection_km + (dager_siden_inspection × ~34 km/dag)
//     3. Sammenlign kunde-input mot forventet:
//        - ±10%      → OK
//        - 10–25%    → MODERAT_AVVIK, confidence -0.05
//        - >25%      → KRITISK_AVVIK,  confidence -0.15, marker for QA
//     4. Sjekk km-progresjon: hopp uten forklaring → HOPP_I_HISTORIKK, -0.10
//
//   Score-impakt:
//     OK: +0.05 · MODERAT: -0.05 · KRITISK: -0.15 · HOPP: -0.10
//
// Output-schema (dokumentert):
//   { km_input, km_siste_eu, km_siste_eu_dato, km_forventet_naa,
//     km_status, confidence_delta, notes }

const NORSK_SNITT_KM_PER_DAG = 34; // ~12 500 km/år / 365 (fra doc)

/**
 * Verifiser kundeoppgitt km mot car.info history.
 * @param {number|null} kmInput            - Kunde-oppgitt km fra ERP
 * @param {Array} history                  - carInfo.history[] fra Trinn 3
 * @param {Date} [now]                     - Nåtid (default: new Date())
 * @returns {{km_input, km_siste_eu, km_siste_eu_dato, km_forventet_naa,
 *            km_status, confidence_delta, notes}}
 */
export function verifyKm(kmInput, history, now = new Date()) {
  const empty = {
    km_input: kmInput,
    km_siste_eu: null,
    km_siste_eu_dato: null,
    km_forventet_naa: null,
    km_status: 'INGEN_HISTORIKK',
    confidence_delta: 0,
    notes: 'Ingen EU-kontroll-historikk tilgjengelig — kan ikke verifisere',
  };

  if (!kmInput || !Array.isArray(history) || history.length === 0) {
    return empty;
  }

  // Sorter history etter dato synkende, filtrer inspection-entries
  const inspections = history
    .filter(h => (h.type || '').toLowerCase() === 'inspection' && h.km && h.date)
    .map(h => ({ ...h, dateObj: new Date(h.date) }))
    .filter(h => !isNaN(h.dateObj.getTime()))
    .sort((a, b) => b.dateObj - a.dateObj);

  if (inspections.length === 0) return empty;

  const siste = inspections[0];
  const daysSince = Math.max(0, Math.floor((now - siste.dateObj) / 86400000));

  // Beregn hittil-snitt (km/dag) hvis vi har ≥2 inspections — juster forventning
  let daglig = NORSK_SNITT_KM_PER_DAG;
  if (inspections.length >= 2) {
    const eldst = inspections[inspections.length - 1];
    const kmDelta = siste.km - eldst.km;
    const dagDelta = Math.max(1, (siste.dateObj - eldst.dateObj) / 86400000);
    if (kmDelta > 0 && dagDelta > 30) {
      daglig = kmDelta / dagDelta;
    }
  }

  const forventet = Math.round(siste.km + daysSince * daglig);
  const avvikPct = forventet > 0 ? Math.abs((kmInput - forventet) / forventet) * 100 : 0;

  // Sjekk km-hopp i history (ikke monotonisk stigende)
  const stigende = [...inspections].reverse(); // eldst → nyest
  let harHopp = false;
  let hoppDetalj = null;
  for (let i = 1; i < stigende.length; i++) {
    if (stigende[i].km < stigende[i - 1].km) {
      harHopp = true;
      hoppDetalj = `${stigende[i - 1].date} (${stigende[i - 1].km} km) → ${stigende[i].date} (${stigende[i].km} km)`;
      break;
    }
  }

  let km_status, confidence_delta, notes;

  if (harHopp) {
    km_status = 'HOPP_I_HISTORIKK';
    confidence_delta = -0.10;
    notes = `Ikke-monotonisk km-progresjon: ${hoppDetalj}. Krever fysisk verifisering.`;
  } else if (avvikPct <= 10) {
    km_status = 'OK';
    confidence_delta = +0.05;
    notes = `Kunde ${kmInput.toLocaleString('nb-NO')} vs forventet ${forventet.toLocaleString('nb-NO')} (${avvikPct.toFixed(1)}% avvik) — OK`;
  } else if (avvikPct <= 25) {
    km_status = 'MODERAT_AVVIK';
    confidence_delta = -0.05;
    notes = `Moderat avvik: kunde ${kmInput.toLocaleString('nb-NO')} vs forventet ${forventet.toLocaleString('nb-NO')} (${avvikPct.toFixed(1)}%)`;
  } else {
    km_status = 'KRITISK_AVVIK';
    confidence_delta = -0.15;
    notes = `Kritisk avvik: kunde ${kmInput.toLocaleString('nb-NO')} vs forventet ${forventet.toLocaleString('nb-NO')} (${avvikPct.toFixed(1)}%). Krever QA.`;
  }

  return {
    km_input: kmInput,
    km_siste_eu: siste.km,
    km_siste_eu_dato: siste.date,
    km_forventet_naa: forventet,
    km_status,
    confidence_delta,
    notes,
  };
}
