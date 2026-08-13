#!/bin/bash
# Vrakpant-override for LIVE peasy-auto.js (ikke v2/peasy-bot.js)
# 1) Fjern d_lav_under_vrakpant blocker
# 2) Legg til override + varsel før begge _maybeBlock-kall
set -e

cd /Users/bot/peasy-auto

python3 << 'PY'
p='peasy-auto.js'
s=open(p).read()

if 'VRAKPANT_MIN' in s:
    print('ALREADY_PATCHED')
    exit(0)

# 1) Fjern d_lav_under_vrakpant blocker (håndteres nå oppstrøms)
old1 = "    if (Number(o.dLav) < 3000) blockers.push('d_lav_under_vrakpant_' + o.dLav);\n"
if s.count(old1) != 1:
    print('FAIL 1: match', s.count(old1))
    exit(1)
s = s.replace(old1, '')

# 2) Legg til override + varsel-helper (defineres én gang, kalles to steder)
# Sett inn før _computeBlockers-funksjonen (linje 1777)
insert_after = "  function _computeBlockers(o) {"
helper = """
  // [vrakpant] Override dLav/dHoy hvis dLav under norsk vrakpant, send varsel, returner om override skjedde
  const VRAKPANT_MIN = 5000;
  const VRAKPANT_MAX = 10000;
  async function _maybeVrakpant(valuation) {
    if (Number(valuation.dLav) >= VRAKPANT_MIN) return false;
    const orig = valuation.dLav;
    valuation.dLav = VRAKPANT_MIN;
    valuation.dHoy = VRAKPANT_MAX;
    log('[vrakpant] ' + regnr + ': dLav ' + orig + ' -> ' + VRAKPANT_MIN + ', dHoy -> ' + VRAKPANT_MAX);
    try {
      await sendTelegram(
        '⚠️ <b>VRAKPANT-PRISING</b>\\n\\n' +
        'Regnr: ' + regnr + '\\nInternnr: ' + erpId + '\\n\\n' +
        'AI foreslo dLav: ' + orig + ' kr (under vrakpant ' + VRAKPANT_MIN + ')\\n' +
        'Justert til: ' + VRAKPANT_MIN + ' – ' + VRAKPANT_MAX + ' kr\\n\\n' +
        '<a href="https://biladministrasjon.no/cars_driveno/processing/final_estimate/' + erpId + '">Åpne i ERP</a>',
        { parse_mode: 'HTML' }
      );
    } catch (e) { logErr('vrakpant-alarm', regnr, e); }
    return true;
  }
"""
if s.count(insert_after) != 1:
    print('FAIL 2: match', s.count(insert_after))
    exit(1)
s = s.replace(insert_after, helper + insert_after)

# 3) Kall _maybeVrakpant(valuationF) før første _maybeBlock (linje 2159 i original)
old3 = "        if (await _maybeBlock({ sdComment: sdCommentF, oppgittKm: bil.mileage, history: (bil.carInfo && bil.carInfo.history) || [], valgteComps: poolF, segConfidence: segF && segF.confidence, dLav: valuationF.dLav, dHoy: valuationF.dHoy })) return;"
new3 = "        await _maybeVrakpant(valuationF);\n        if (await _maybeBlock({ sdComment: sdCommentF, oppgittKm: bil.mileage, history: (bil.carInfo && bil.carInfo.history) || [], valgteComps: poolF, segConfidence: segF && segF.confidence, dLav: valuationF.dLav, dHoy: valuationF.dHoy })) return;"
if s.count(old3) != 1:
    print('FAIL 3: match', s.count(old3))
    exit(1)
s = s.replace(old3, new3)

# 4) Kall _maybeVrakpant(valuation) før andre _maybeBlock (linje 2246 i original)
old4 = "    if (await _maybeBlock({ sdComment: sdComment, oppgittKm: bil.mileage, history: (bil.carInfo && bil.carInfo.history) || [], valgteComps: (v2 && v2.anchor && v2.anchor.valgte_comps) || [], segConfidence: seg && seg.confidence, dLav: valuation.dLav, dHoy: valuation.dHoy })) return;"
new4 = "    await _maybeVrakpant(valuation);\n    if (await _maybeBlock({ sdComment: sdComment, oppgittKm: bil.mileage, history: (bil.carInfo && bil.carInfo.history) || [], valgteComps: (v2 && v2.anchor && v2.anchor.valgte_comps) || [], segConfidence: seg && seg.confidence, dLav: valuation.dLav, dHoy: valuation.dHoy })) return;"
if s.count(old4) != 1:
    print('FAIL 4: match', s.count(old4))
    exit(1)
s = s.replace(old4, new4)

open(p + '.pre-vrakpant', 'w').write(open(p).read())
open(p, 'w').write(s)
print('PATCHED')
PY

node --check peasy-auto.js && echo SYNTAX_OK

# Fjern AD86442 (internnr 3927) fra cache så peasy-auto plukker den opp
python3 << 'PY'
import json, os
p='/Users/bot/peasy-auto/peasy-cache.json'
if os.path.exists(p):
    d=json.load(open(p))
    n=len(d)
    if '3927' in d:
        del d['3927']
        json.dump(d, open(p,'w'), indent=2)
        print(f'CACHE_REMOVED_3927 ({n} -> {len(d)})')
    else:
        print(f'3927_NOT_IN_CACHE ({n} entries)')
PY

launchctl kickstart -k gui/$(id -u)/com.peasy.auto && echo RESTARTED
