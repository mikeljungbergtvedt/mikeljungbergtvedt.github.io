#!/bin/bash
# Patch V3 Trinn 5 + Trinn 8 for "tenk som bruktbilsjef" på lav-score biler
# Idempotent + backup

cd /Users/bot/peasy-auto/v2

# --- Trinn 5 patch: skill lav vs høy km-avvik ---
python3 << 'PY'
p='v3-trinn5-km.js'
s=open(p).read()

# Erstatt hele avvik-logic med "kun høy-avvik eller fysisk umulig er kritisk"
old = """  } else if (avvikPct <= 25) {
    km_status = 'MODERAT_AVVIK';
    confidence_delta = -0.05;
    notes = `Moderat avvik: kunde ${kmInput.toLocaleString('nb-NO')} vs forventet ${forventet.toLocaleString('nb-NO')} (${avvikPct.toFixed(1)}%)`;
  } else {
    km_status = 'KRITISK_AVVIK';
    confidence_delta = -0.15;
    notes = `Kritisk avvik: kunde ${kmInput.toLocaleString('nb-NO')} vs forventet ${forventet.toLocaleString('nb-NO')} (${avvikPct.toFixed(1)}%). Krever QA.`;
  }"""
new = """  } else {
    // Skill retning: kunde LAVERE enn forventet vs HØYERE enn forventet
    const kundeUnderForventet = kmInput < forventet;
    // FYSISK UMULIG: kunde-km lavere enn siste EU-registrert (kilometerteller manipulert)
    if (kmInput < siste.km) {
      km_status = 'UMULIG_LAVERE_ENN_EU';
      confidence_delta = -0.30;
      notes = `Fysisk umulig: kunde ${kmInput.toLocaleString('nb-NO')} km er LAVERE enn siste EU-registrert ${siste.km.toLocaleString('nb-NO')} km (${siste.date}). Krever manuell QA.`;
    } else if (kundeUnderForventet && avvikPct <= 50) {
      // Lav km/år vs forventet — helt normalt (ny eier, lite bruk). Ingen straff.
      km_status = 'OK_LAV_KM';
      confidence_delta = 0;
      notes = `Kunde ${kmInput.toLocaleString('nb-NO')} vs forventet ${forventet.toLocaleString('nb-NO')} (${avvikPct.toFixed(1)}% under) — lav km/år, akseptabelt`;
    } else if (kundeUnderForventet) {
      // Veldig lav km — noter, men ikke straff hardt
      km_status = 'FLAGG_SVAERT_LAV_KM';
      confidence_delta = -0.05;
      notes = `Svært lav km: kunde ${kmInput.toLocaleString('nb-NO')} vs forventet ${forventet.toLocaleString('nb-NO')} (${avvikPct.toFixed(1)}% under). Verifisér ved anlegg.`;
    } else if (avvikPct <= 25) {
      km_status = 'MODERAT_AVVIK_HOY';
      confidence_delta = -0.05;
      notes = `Moderat avvik (høyere enn forventet): kunde ${kmInput.toLocaleString('nb-NO')} vs forventet ${forventet.toLocaleString('nb-NO')} (${avvikPct.toFixed(1)}%)`;
    } else {
      km_status = 'HOY_AVVIK_MISTENKELIG';
      confidence_delta = -0.15;
      notes = `Høy km-avvik: kunde ${kmInput.toLocaleString('nb-NO')} vs forventet ${forventet.toLocaleString('nb-NO')} (${avvikPct.toFixed(1)}% over). Sjekk om kilometerteller er ekte.`;
    }
  }"""

if s.count(old) != 1:
    print('T5 FAIL: match count', s.count(old))
    exit(1)
open(p + '.pre-lenient', 'w').write(s)
open(p, 'w').write(s.replace(old, new))
print('T5 OK')
PY

# --- Trinn 8 patch: eksplisitt regel om conf=0 ---
python3 << 'PY'
p='v3-trinn8-anker.js'
s=open(p).read()

# Legg til "aldri conf=0 unntatt fysisk umulig" i konfidens-veiledning
old = """- <0.60: Variant-usikkerhet + tynt utvalg eller kritisk skade uten prisreferanse`;"""
new = """- <0.60: Variant-usikkerhet + tynt utvalg eller kritisk skade uten prisreferanse

KRITISKE PRINSIPPER:
- ALDRI sett confidence til 0. Minimum er 0.20 for lav-tillit-priser.
- confidence=0 kun ved km_status='UMULIG_LAVERE_ENN_EU' (fysisk umulig data).
- Ved 0 solgte comps: bruk aktive annonser eller car.info valuation som anker med conf 0.30-0.45. Aldri gi opp — en bruktbilsjef ville sett på Finn og priset uansett.
- Ved km_status='OK_LAV_KM' eller 'FLAGG_SVAERT_LAV_KM': behandle km-input som ekte (ny eier kan kjøre lite). Ikke juster anker ned pga km-avvik.
- Kun ved km_status='HOY_AVVIK_MISTENKELIG' eller 'UMULIG_LAVERE_ENN_EU' skal km trigge nedjustering.
\`;"""

if s.count(old) != 1:
    print('T8 FAIL: match count', s.count(old))
    exit(1)
open(p + '.pre-lenient', 'w').write(s)
open(p, 'w').write(s.replace(old, new))
print('T8 OK')
PY

node --check v3-trinn5-km.js && node --check v3-trinn8-anker.js && echo BOTH_OK && launchctl kickstart -k gui/$(id -u)/com.peasy.auto && echo RESTARTED
