#!/bin/bash
# Fikser Trinn 8 syntax + legger til vrakpant-logikk for begge bots
set -e

cd /Users/bot/peasy-auto/v2

# 1) Rull tilbake trinn 8 til pre-lenient
if [ -f v3-trinn8-anker.js.pre-lenient ]; then
  cp v3-trinn8-anker.js.pre-lenient v3-trinn8-anker.js
  echo T8_ROLLED_BACK
fi

# 2) Re-patch trinn 8 med korrekt backtick
python3 << 'PY'
p='v3-trinn8-anker.js'
s=open(p).read()
old = "- <0.60: Variant-usikkerhet + tynt utvalg eller kritisk skade uten prisreferanse`;"
new = """- <0.60: Variant-usikkerhet + tynt utvalg eller kritisk skade uten prisreferanse

KRITISKE PRINSIPPER:
- ALDRI sett confidence til 0. Minimum er 0.20 for lav-tillit-priser.
- confidence=0 kun ved km_status='UMULIG_LAVERE_ENN_EU' (fysisk umulig data).
- Ved 0 solgte comps: bruk aktive annonser eller car.info valuation som anker med conf 0.30-0.45. Aldri gi opp — en bruktbilsjef ville sett på Finn og priset uansett.
- Ved km_status='OK_LAV_KM' eller 'FLAGG_SVAERT_LAV_KM': behandle km-input som ekte (ny eier kan kjøre lite). Ikke juster anker ned pga km-avvik.
- Kun ved km_status='HOY_AVVIK_MISTENKELIG' eller 'UMULIG_LAVERE_ENN_EU' skal km trigge nedjustering.
`;"""
if s.count(old) != 1:
    print('T8 FAIL: match count', s.count(old))
    exit(1)
open(p, 'w').write(s.replace(old, new))
print('T8 REPATCHED')
PY

node --check v3-trinn8-anker.js && echo T8_SYNTAX_OK

# 3) Vrakpant-override i pricing-formula.js — gjelder begge bots
python3 << 'PY'
p='pricing-formula.js'
s=open(p).read()

# Finn hvor dLav/dHoy returneres og legg til override før return
import re
# Vi antar det finnes en return-linje som returnerer {dLav, dHoy, ...} eller lignende
# Fallback: append en wrapper-funksjon som brukes eksternt

# Idempotens-check
if 'applyVrakpantOverride' in s:
    print('VRAKPANT_ALREADY_PATCHED')
else:
    add = """

// Vrakpant-override: hvis D-lav < norsk vrakpant (5000), sett D-lav = 5000, D-høy = 10 000
// Flagg: "vrakpant-prising". Gjelder alle prisings-flyter (Easy + V3).
export function applyVrakpantOverride(pricing) {
  const VRAKPANT = 5000;
  const VRAKPANT_HOY = 10000;
  if (!pricing || typeof pricing !== 'object') return pricing;
  const dLav = pricing.dLav ?? pricing.d_lav;
  if (dLav != null && dLav < VRAKPANT) {
    const flags = Array.isArray(pricing.flags) ? pricing.flags.slice() : [];
    flags.push('vrakpant-prising');
    return {
      ...pricing,
      dLav: VRAKPANT,
      dHoy: VRAKPANT_HOY,
      d_lav: VRAKPANT,
      d_hoy: VRAKPANT_HOY,
      original_dLav: dLav,
      original_dHoy: pricing.dHoy ?? pricing.d_hoy,
      vrakpant_override: true,
      flags,
      vrakpant_note: `D-lav (${dLav}) var under vrakpant (${VRAKPANT}) — satt til ${VRAKPANT}/${VRAKPANT_HOY}`
    };
  }
  return pricing;
}
"""
    open(p, 'w').write(s + add)
    print('VRAKPANT_ADDED')
PY

node --check pricing-formula.js && echo PRICING_SYNTAX_OK

# 4) Restart peasy-auto
launchctl kickstart -k gui/$(id -u)/com.peasy.auto && echo RESTARTED
