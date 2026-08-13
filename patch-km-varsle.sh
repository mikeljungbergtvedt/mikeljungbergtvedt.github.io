#!/bin/bash
# Km-svindel: VARSEL istedet for BLOKKER. Bilen prises normalt, QA får Telegram-varsel.
set -e

cd /Users/bot/peasy-auto

python3 << 'PY'
p='peasy-auto.js'
s=open(p).read()

if '_kmSvindelWarned' in s:
    print('ALREADY_PATCHED')
    exit(0)

# Endre km-svindel fra blocker.push til separat varsel-flagg
old = """    // [km-svindel] Blokker biler med tydelig kilometerteller-manipulasjon
    const _kmSvindel = _detectKmSvindel(o.oppgittKm, o.history);
    if (_kmSvindel) {
      if (_kmSvindel.type === 'kunde_lavere_enn_eu') {
        blockers.push('km_svindel_kunde' + _kmSvindel.kunde_km + '_lavere_enn_EU' + _kmSvindel.eu_km + '_' + (_kmSvindel.eu_dato||'').slice(0,10));
      } else {
        blockers.push('km_svindel_EU_hopp_' + _kmSvindel.prev_km + '_til_' + _kmSvindel.curr_km);
      }
    }"""

new = """    // [km-varsel] Varsle om km-usikkerhet men IKKE blokk — takst verifiserer km fysisk
    const _kmSvindel = _detectKmSvindel(o.oppgittKm, o.history);
    if (_kmSvindel) {
      // Marker på objektet så evalCar kan sende Telegram-varsel etter prising
      o._kmVarsel = _kmSvindel;
    }"""

if s.count(old) != 1:
    print('FAIL 1: match', s.count(old))
    exit(1)
s = s.replace(old, new)

# Legg til separat varsel-send etter _maybeBlock kall (før ERP-skriving)
# Vi trenger en helper _maybeKmVarsel og kalle den to steder (samme som _maybeVrakpant)
insert_after = "  async function _maybeVrakpant(valuation) {"
helper_add = """  async function _maybeKmVarsel(kmSvindel) {
    if (!kmSvindel || _kmSvindelWarned[erpId]) return;
    _kmSvindelWarned[erpId] = true;
    const msg = kmSvindel.type === 'kunde_lavere_enn_eu'
      ? `Kunde oppga ${kmSvindel.kunde_km.toLocaleString('nb-NO')} km, siste EU-kontroll (${(kmSvindel.eu_dato||'').slice(0,10)}) registrerte ${kmSvindel.eu_km.toLocaleString('nb-NO')} km. Kunde-oppgitt er ${(kmSvindel.eu_km - kmSvindel.kunde_km).toLocaleString('nb-NO')} km LAVERE enn siste EU — sjekk kilometerteller ved takst.`
      : `EU-historikk hopper nedover: ${kmSvindel.prev_km.toLocaleString('nb-NO')} km (${(kmSvindel.prev_dato||'').slice(0,10)}) → ${kmSvindel.curr_km.toLocaleString('nb-NO')} km (${(kmSvindel.curr_dato||'').slice(0,10)}). Mulig kilometerteller-manipulasjon — sjekk ved takst.`;
    try {
      await sendTelegram(
        '⚠️ <b>KM-USIKKERHET</b>\\n\\n' +
        'Regnr: ' + regnr + '\\nInternnr: ' + erpId + '\\n\\n' +
        msg + '\\n\\n' +
        '<a href="https://biladministrasjon.no/cars_driveno/processing/final_estimate/' + erpId + '">Åpne i ERP</a>',
        { parse_mode: 'HTML' }
      );
    } catch (e) { logErr('km-varsel', regnr, e); }
  }
  """
if s.count(insert_after) != 1:
    print('FAIL 2: match', s.count(insert_after))
    exit(1)
s = s.replace(insert_after, helper_add + insert_after)

# Legg til _kmSvindelWarned global (per erpId, forhindrer duplicate varsler)
insert_before = "  // [vrakpant] Override dLav/dHoy hvis dLav under norsk vrakpant"
if s.count(insert_before) != 1:
    print('FAIL 3: match', s.count(insert_before))
    exit(1)
s = s.replace(insert_before, "  const _kmSvindelWarned = {};\n  " + insert_before)

# Kall _maybeKmVarsel før begge _maybeBlock-kall (der o._kmVarsel er satt hvis relevant)
# Vi trenger tilgang til _detectKmSvindel output — vi kaller den direkt her
old_call_1 = "        await _maybeVrakpant(valuationF);\n        if (await _maybeBlock({ sdComment: sdCommentF, oppgittKm: bil.mileage,"
new_call_1 = "        await _maybeVrakpant(valuationF);\n        try { await _maybeKmVarsel(_detectKmSvindel(bil.mileage, (bil.carInfo && bil.carInfo.history) || [])); } catch(e) {}\n        if (await _maybeBlock({ sdComment: sdCommentF, oppgittKm: bil.mileage,"

if s.count(old_call_1) == 1:
    s = s.replace(old_call_1, new_call_1)
else:
    print('note: kall 1 ikke matchet ({s.count(old_call_1)}) — hopper')

old_call_2 = "    await _maybeVrakpant(valuation);\n    if (await _maybeBlock({ sdComment: sdComment, oppgittKm: bil.mileage,"
new_call_2 = "    await _maybeVrakpant(valuation);\n    try { await _maybeKmVarsel(_detectKmSvindel(bil.mileage, (bil.carInfo && bil.carInfo.history) || [])); } catch(e) {}\n    if (await _maybeBlock({ sdComment: sdComment, oppgittKm: bil.mileage,"

if s.count(old_call_2) == 1:
    s = s.replace(old_call_2, new_call_2)
else:
    print('note: kall 2 ikke matchet ({s.count(old_call_2)}) — hopper')

open(p+'.pre-kmvarsel', 'w').write(open(p).read())
open(p, 'w').write(s)
print('PATCHED')
PY

node --check peasy-auto.js && echo SYNTAX_OK
launchctl kickstart -k gui/$(id -u)/com.peasy.auto && echo RESTARTED
