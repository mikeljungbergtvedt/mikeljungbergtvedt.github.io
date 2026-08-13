// V3 Trinn 8 — Anker-beregning (MVP: 100% car.info, senere 75% car.info + 25% Finn)
//
// Per Mikes korrigering av v3-trinn8.md:
//   Finn-scraping fungerer ikke (Cloudflare, drømmepriser).
//   car.info er primær kilde (solgt-annonser fra faktisk marked).
//
// MVP-modell:
//   1. Rå anker = car.info company_valuation.result.price
//   2. AI-agent leser variant-hypothesis (Trinn 6) + kunde-comment + car.info-detaljer
//   3. AI kan justere anker basert på: skade, avskiltet, mangler, km-avvik, variant-usikkerhet
//   4. Output: anker_final, confidence, justering, note

import 'dotenv/config';

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = process.env.V3_MODEL || 'claude-sonnet-4-5-20250929';

const SYSTEM_PROMPT = `Du er en erfaren bruktbilsjef som setter forhandler-anker (ut-pris etter klargjøring, klar i butikk).

Input:
- Variant-hypothesis fra Trinn 6 (variant identifisert, bulletproof-score, kunde-comment, uklarheter)
- car.info valuation: ferdig-beregnet forhandler-anker basert på solgte annonser i norsk marked
- km-verifisering fra Trinn 5

Din oppgave: JUSTER car.info-ankeret basert på faktorer som car.info ikke kjenner:
1. Kunde-comment (skade, rust, avskiltet, modifikasjoner, mangler) — dette kan endre pris dramatisk
2. Km-avvik fra Trinn 5 (hvis KRITISK_AVVIK → juster ned; MODERAT → mindre justering)
3. Variant-usikkerhet (hvis bulletproof < 0.90 → øk usikkerhet i konfidens, ikke i anker)
4. Uklarheter Trinn 6 flagget

Regler:
- Ikke rør car.info-anker hvis bilen er "vanlig" (ingen skader, ingen avvik)
- Ved avskiltet / kritisk skade: juster kraftig NED, forklar hvor mye og hvorfor
- Ved moderat skade / bruktimport (som IKKE er reflektert i car.info): juster moderat ned
- Konfidens: kombiner bulletproof_score fra Trinn 6 med car.info classifieds_used_count
- Returner strengt JSON, ingen prosa utenfor JSON.

VIKTIG - comp-ferskhet:
Bruktbilmarkedet er et spot-marked. Gamle solgte annonser har begrenset relevans for dagens pris.
Vurder ferskhet selv basert pa solgt-datoene i comps-lista. Ingen fast tidsterskel - bruk skjonn:
- Hvis nok ferske comps (typisk siste 3-4 mnd) finnes, lene deg pa dem for a bestemme anker.
- Hvis kun gamle comps, senk confidence tilsvarende og flagg trenger_qa=true.
- car.info sin raw price er ferdig-beregnet snitt over hele utvalget - hvis det utvalget er dominert av gamle comps, kan raw price være misvisende. Da bor du overstyre.
- Kombiner comp-ferskhet med kunde-kommentar: positive drivere (serviceavtale, ekstrautstyr, LCI/facelift) kan justere anker OPP - ikke bare skade justerer ned.

DATA-BRUK — ABSOLUTT REGEL (mot hallusinasjon):
- Bruk KUN data som faktisk finnes i inputen under (Trinn 0-6.5 + car.info + kunde-comment).
- Ikke finn opp konkrete tall (kr-beløp, km-tall, datoer) eller regnr-spesifikke hendelser som ikke er i input.
- Ved manglende data: skriv eksplisitt "ingen data" i begrunnelsen — fyll aldri inn selv.
- Generell modell-/motor-kunnskap (kjente fail-modes, typisk levetid, kjente svakheter) er OK å referere.
- Referanser til priser MA komme fra car.info.classifieds_* eller kmVerifisering. Ikke oppdikt "solgt for X kr".

Konfidens-veiledning:
- 0.90+: Bulletproof variant + 15+ solgte annonser fra siste 3 mnd + ingen kunde-input-problemer
- 0.75-0.89: Solid variant + 5-14 annonser eller mindre kunde-usikkerhet
- 0.60-0.74: Tynt utvalg eller moderat kunde-usikkerhet
- <0.60: Variant-usikkerhet + tynt utvalg eller kritisk skade uten prisreferanse`;

const RESPONSE_SCHEMA = `{
  "anker_final": number,           // endelig anker i kr
  "anker_carinfo_raw": number,     // car.info sitt raw-anker
  "justering_kr": number,          // + eller - fra raw
  "justering_reason": string,      // hvorfor justert
  "confidence": number,            // 0-1
  "confidence_begrunnelse": string,
  "note_til_evalkort": string,     // vises i eval-kort
  "trenger_qa": boolean            // true hvis alvorlige flagg
}`;

/**
 * Beregn V3-anker basert på Trinn 6 hypothesis + car.info-data.
 * @param {object} hypothesis  - Fra Trinn 6
 * @param {object} carInfoFields  - Fra Trinn 3 (.fields)
 * @param {object} input  - Fra Trinn 0 (for kunde-comment)
 * @param {object} kmVerifisering - Fra Trinn 5
 * @returns {Promise<{ok: boolean, anker?: object, raw?: string, error?: string}>}
 */
export async function computeAnker(hypothesis, carInfoFields, input, kmVerifisering) {
  if (!ANTHROPIC_API_KEY) return { ok: false, error: 'ANTHROPIC_API_KEY mangler' };

  const val = carInfoFields?.valuation || {};
  const cv = val.company_valuation?.result || {};
  const ankerRaw = cv.price || null;

  if (!ankerRaw) {
    return {
      ok: false,
      error: 'car.info valuation.company_valuation.result.price mangler',
      anker: { anker_final: null, anker_carinfo_raw: null, confidence: 0, note_til_evalkort: 'Ingen anker fra car.info' },
    };
  }

  const carInfoSummary = {
    anker_raw: ankerRaw,
    classifieds_avg_price: cv.classifieds_avg_price,
    classifieds_min_price: cv.classified_min_price,
    classifieds_max_price: cv.classified_max_price,
    classifieds_avg_km: cv.classifieds_avg_km,
    classifieds_used_count: cv.classifieds_used_count,
    classifieds_total_count: cv.classifieds_total_count,
    classified_earliest_date: cv.classified_earliest_date,
    classified_latest_date: cv.classified_latest_date,
    company_alert_level: val.company_valuation?.packages?.length ? val.company_valuation?.packages : null,
    mileage_km_cost: cv.mileage_km_cost,
    slope: cv.slope,
  };

  // Bygg kompakt comp-liste med datoer sa AI kan bedomme ferskhet selv
  const rawComps = val.company_classifieds || [];
  const compsForAI = rawComps.map(c => ({
    solgt: c.ca_sold_date || c.classified_removed_date || null,
    publisert: c.classified_published_date || null,
    pris: c.classified_price != null ? Number(c.classified_price) : null,
    km: c.mileage_km != null ? Number(c.mileage_km) : null,
    dager_pa_marked: c.days != null ? Number(c.days) : null,
    status: c.classified_removed_date ? 'solgt' : 'aktiv',
    tittel: c.classified_title || null,
    finn_url: c.classified_url || null,
    same_car: c.same_car === 1,
  })).sort((a, b) => (b.solgt || b.publisert || '').localeCompare(a.solgt || a.publisert || ''));

  const userPrompt = `Beregn V3-anker for denne bilen.

## Variant-hypothesis fra Trinn 6
${JSON.stringify(hypothesis, null, 2)}

## Kunde-comment (Trinn 0)
"${input.kundeComment || '(tom)'}"

## car.info valuation - aggregat (Trinn 3)
${JSON.stringify(carInfoSummary, null, 2)}

## car.info comps - individuelle solgte annonser (sortert nyeste solgt-dato forst)
${JSON.stringify(compsForAI, null, 2)}

## km-verifisering (Trinn 5)
${kmVerifisering ? JSON.stringify(kmVerifisering, null, 2) : '(ikke kjørt)'}

Returner JSON:
${RESPONSE_SCHEMA}`;

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    });
    if (!res.ok) {
      const txt = await res.text();
      return { ok: false, error: `Anthropic HTTP ${res.status}: ${txt.slice(0, 300)}` };
    }
    const j = await res.json();
    const text = j.content?.[0]?.text || '';
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start < 0 || end < 0) return { ok: false, error: 'Ingen JSON', raw: text };
    let anker;
    try {
      anker = JSON.parse(text.slice(start, end + 1));
    } catch (e) {
      return { ok: false, error: `JSON parse: ${e.message}`, raw: text };
    }
    return { ok: true, anker, raw: text };
  } catch (e) {
    return { ok: false, error: `Anthropic: ${e.message}` };
  }
}
