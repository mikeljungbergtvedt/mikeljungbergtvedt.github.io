#!/bin/bash
# Km-svindel-blokker: hvis kunde-km < siste EU-km, eller EU-historikk har hopp nedover, BLOKK + varsel
set -e

cd /Users/bot/peasy-auto

python3 << 'PY'
p='peasy-auto.js'
s=open(p).read()

if '_maybeKmSvindel' in s:
    print('ALREADY_PATCHED')
    exit(0)

# Legg til km-svindel-sjekk som helper og som blocker i _computeBlockers
# Vi legger til FØR _computeBlockers en async helper som beregner km-status.
# Blokkere-flagg brukes så det stopper skriving og sender varsel.

insert_after = "  function _computeBlockers(o) {"
helper = """
  // [km-svindel] Sjekker om kunde-km < siste EU-km eller EU-historikk har hopp nedover
  function _detectKmSvindel(oppgittKm, history) {
    if (!oppgittKm || !Array.isArray(history)) return null;
    const insp = history.filter(h => h && h.type === 'inspection' && h.km);
    if (insp.length === 0) return null;
    // Siste EU-registrerte km
    const siste = insp.reduce((a, b) => (Number(b.km) > Number(a.km) ? b : a), insp[0]);
    const sisteKm = Number(siste.km);
    // 1) Kunde-km lavere enn siste EU
    if (Number(oppgittKm) < sisteKm - 500) {  // 500 km toleranse for avrunding
      return { type: 'kunde_lavere_enn_eu', eu_km: sisteKm, eu_dato: siste.date, kunde_km: Number(oppgittKm) };
    }
    // 2) EU-historikk har hopp nedover (kilometerteller skrudd ned mellom EU-kontroller)
    const sorted = insp.slice().sort((a, b) => String(a.date).localeCompare(String(b.date)));
    for (let i = 1; i < sorted.length; i++) {
      const prev = Number(sorted[i-1].km), curr = Number(sorted[i].km);
      if (curr < prev - 500) {
        return { type: 'eu_historikk_hopp', prev_km: prev, prev_dato: sorted[i-1].date, curr_km: curr, curr_dato: sorted[i].date };
      }
    }
    return null;
  }
  """
if s.count(insert_after) != 1:
    print('FAIL 1: match', s.count(insert_after))
    exit(1)
s = s.replace(insert_after, helper + insert_after)

# Legg km-svindel-blocker inn i _computeBlockers
old = "    // v20.70: km_konflikt-blokker fjernet — km-override gjøres oppstrøms i evalCar"
new = """    // [km-svindel] Blokker biler med tydelig kilometerteller-manipulasjon
    const _kmSvindel = _detectKmSvindel(o.oppgittKm, o.history);
    if (_kmSvindel) {
      if (_kmSvindel.type === 'kunde_lavere_enn_eu') {
        blockers.push('km_svindel_kunde' + _kmSvindel.kunde_km + '_lavere_enn_EU' + _kmSvindel.eu_km + '_' + (_kmSvindel.eu_dato||'').slice(0,10));
      } else {
        blockers.push('km_svindel_EU_hopp_' + _kmSvindel.prev_km + '_til_' + _kmSvindel.curr_km);
      }
    }
    // v20.70: km_konflikt-blokker fjernet — km-override gjøres oppstrøms i evalCar"""
if s.count(old) != 1:
    print('FAIL 2: match', s.count(old))
    exit(1)
s = s.replace(old, new)

open(p+'.pre-kmsvindel', 'w').write(open(p).read())
open(p, 'w').write(s)
print('PATCHED')
PY

node --check peasy-auto.js && echo SYNTAX_OK
launchctl kickstart -k gui/$(id -u)/com.peasy.auto && echo RESTARTED
