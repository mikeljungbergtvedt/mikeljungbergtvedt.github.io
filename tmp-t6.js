// V3 Trinn 6 — AI-hypothesis (variant-agent)
//
// Per v3-trinn5-6.md:
//   Dette er HJERTET av variant-ID. Alle tidligere trinn samler data;
//   Trinn 6 gjør den intelligente sammenkoblingen.
//
//   Input: all akkumulert data fra Trinn 0-5 samlet i én prompt til Claude Sonnet
//   Output: strukturert variant-JSON + per-felt confidence + samlet bulletproof-score
//
//   Gate til Trinn 7:
//     ≥ 0.90 → fortsett til comp-søk
//     0.75-0.89 → fallback (Google-DD i Trinn 6.5), re-score
//     < 0.75 → flagg som usikker variant

import 'dotenv/config';

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = process.env.V3_MODEL || 'claude-sonnet-4-5-20250929';

// System-prompt: fast per dokumentet
const SYSTEM_PROMPT = `Du er en erfaren bruktbilsjef med 20+ års erfaring fra norsk marked. Din oppgave er å bygge en bulletproof variant-hypotese for en gitt bil, basert på data fra Vegvesen, car.info og evt. Elbilradar.

Regler:
1. Identifiser hvilke felt som er verdidrivende for AKKURAT DENNE bilen i norsk marked (dvs. felt som gjør at en forhandler betaler betydelig mer/mindre). Farge, hjulstørrelse, standard-utstyr og ikke-diskriminerende felt teller IKKE.
2. For hvert verdidrivende felt, verifiser at det er bulletproof (kilde-enighet + din egen ekspertkunnskap). Hvis ikke bulletproof, rapporter usikkerheten eksplisitt.
3. Bruk egen kunnskap om PHEV-generasjoner, motorkoder, facelifts og norske variant-særegenheter. Eksempel: PHEV Vegvesen-hk = kun forbrenning; systemeffekt kommer fra car.info.
4. Ikke gjett. Ved usikkerhet, skriv "unsure" i feltet og forklar hvorfor.
5. Rapporter én samlet bulletproof-vurdering (0-1) som reflekterer om variant-ID er trygg nok til å drive pris-vurdering.
6. Les kunde-comment nøye — det kan endre pris (skade, modifikasjoner, mangler). Referer den i note_til_pipeline hvis relevant.
7. Returner strengt JSON, ingen prosa utenfor JSON.

Bulletproof-score-veiledning:
- 0.90-0.99: Alle verdidrivere låst med kilde-enighet, ingen uklarheter
- 0.80-0.89: 1 verdidriver estimert av AI-kunnskap uten ekstern bekreftelse
- 0.70-0.79: 1 verdidriver med kilde-avvik som AI kan avgjøre
- 0.50-0.69: 2+ verdidrivere estimert, eller km-kritisk avvik
- <0.50: Modell ikke gjenkjent, variant tvetydig`;

const RESPONSE_SCHEMA = `{
  "propulsion": "EV" | "PHEV" | "HEV" | "MHEV" | "FOSSIL",
  "propulsion_confidence": number,
  "verdi_drivere": {
    "<felt>": {"value": string|number, "conf": number, "source": string}
    // f.eks. make, model, generation, variant_name, karosseri, drivlinje, gir, hk_systemeffekt, batteri_kwh, el_wltp_km — velg per bil
  },
  "IKKE_verdi_drivere": [string],
  "km_verifisering": {"status": string, "confidence_delta": number},
  "bulletproof_score": number,
  "uklarheter": [string],
  "note_til_pipeline": string
}`;

/**
 * Bygg variant-hypotese fra samlet Trinn 0-5 data.
 * @param {object} fullInput  - { input, propulsion, carInfo, elbilradar, phev, kmVerifisering }
 * @returns {Promise<{ok: boolean, hypothesis?: object, raw?: string, error?: string}>}
 */
export async function buildVariantHypothesis(fullInput) {
  if (!ANTHROPIC_API_KEY) return { ok: false, error: 'ANTHROPIC_API_KEY mangler' };

  const { input, propulsion, carInfo, elbilradar, phev, kmVerifisering } = fullInput;

  const userPrompt = `Bil-data samlet under. Bygg variant-hypotese med Norges beste presisjon.

## ERP (Trinn 0)
- regnr: ${input.regnr}
- vin: ${input.vin}
- km_kunde: ${input.kmKunde}
- kunde_comment: ${input.kundeComment ? '"' + input.kundeComment + '"' : '(tom)'}
- state: ${input.state}
- duplicate_of: ${input.duplicateOf}

## Vegvesen (Trinn 1)
${JSON.stringify(input.vegvesen, null, 2)}

## Propulsion-routing (Trinn 2)
- klassifisert: ${propulsion.propulsion} (conf ${propulsion.confidence})
- reasoning: ${propulsion.reasoning.join(' | ')}

## car.info Enterprise (Trinn 3)
${carInfo ? JSON.stringify({
  car_name: carInfo.car_name,
  engine_name: carInfo.engine_name,
  engine_type: carInfo.engine_type,
  chassis: carInfo.chassis,
  generation: carInfo.generation,
  trim_package: carInfo.trim_package,
  horsepower: carInfo.horsepower,
  make: carInfo.make,
  model: carInfo.model,
  model_year: carInfo.model_year,
  first_reg_date: carInfo.first_reg_date,
  history_entries: (carInfo.history || []).length,
  valuation: carInfo.valuation,
}, null, 2) : '(ikke tilgjengelig)'}

## Trinn 4 — Propulsion-berikelse
${elbilradar ? '### Elbilradar (EV): ' + JSON.stringify(elbilradar, null, 2) : ''}
${phev ? '### PHEV AI-berikelse: ' + JSON.stringify(phev, null, 2) : ''}
${!elbilradar && !phev ? '(4C/4D skip — car.info dekker)' : ''}

## km-verifisering (Trinn 5)
${kmVerifisering ? JSON.stringify(kmVerifisering, null, 2) : '(ikke kjørt)'}

Returner JSON med denne strukturen:
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
        max_tokens: 2048,
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

    // Ekstraher JSON
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start < 0 || end < 0) {
      return { ok: false, error: 'Ingen JSON i AI-respons', raw: text };
    }
    let hypothesis;
    try {
      hypothesis = JSON.parse(text.slice(start, end + 1));
    } catch (e) {
      return { ok: false, error: `JSON parse: ${e.message}`, raw: text };
    }
    return { ok: true, hypothesis, raw: text };
  } catch (e) {
    return { ok: false, error: `Anthropic: ${e.message}` };
  }
}

/**
 * Gate: hva skjer basert på bulletproof-score
 * @param {number} score
 * @returns {'proceed'|'fallback_dd'|'flag_uncertain'}
 */
export function scoreGate(score) {
  if (score >= 0.90) return 'proceed';           // → Trinn 7 (comps)
  if (score >= 0.75) return 'fallback_dd';        // → Trinn 6.5 Google-DD
  return 'flag_uncertain';                        // → email-varsel + QA
}