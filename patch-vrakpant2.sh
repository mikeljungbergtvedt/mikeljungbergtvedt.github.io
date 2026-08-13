#!/bin/bash
# Vrakpant-override v2 (fix tom linje)
set -e

cd /Users/bot/peasy-auto/v2

python3 << 'PY'
p='peasy-bot.js'
s=open(p).read()

if 'VRAKPANT_MIN' in s:
    print('VRAKPANT_ALREADY_PATCHED')
    exit(0)

# Match dLav/dHoy blokken (uansett tomme linjer rundt)
old = "    const dLav = pricing.dLav;\n    const dHoy = pricing.dHoy;\n    const auctionTypeId = dLav < 35000 ? 2 : 1;"

new = """    let dLav = pricing.dLav;
    let dHoy = pricing.dHoy;
    // [vrakpant] Hvis dLav under norsk vrakpant → override til (5000, 10000) og varsel
    const VRAKPANT_MIN = 5000;
    const VRAKPANT_MAX = 10000;
    let _vrakpantOverride = false;
    let _origDLav = null;
    if (Number(dLav) < VRAKPANT_MIN) {
      _origDLav = dLav;
      dLav = VRAKPANT_MIN;
      dHoy = VRAKPANT_MAX;
      _vrakpantOverride = true;
      log('[vrakpant] ' + regnr + ': dLav ' + _origDLav + ' -> ' + VRAKPANT_MIN + ', dHoy -> ' + VRAKPANT_MAX);
      try {
        await sendTelegram(
          '⚠️ <b>VRAKPANT-PRISING</b>\\n\\n' +
          'Regnr: ' + regnr + '\\nInternnr: ' + erpId + '\\n\\n' +
          'AI foreslo dLav: ' + _origDLav + ' kr (under vrakpant ' + VRAKPANT_MIN + ')\\n' +
          'Justert til: ' + VRAKPANT_MIN + ' – ' + VRAKPANT_MAX + ' kr\\n\\n' +
          '<a href="https://biladministrasjon.no/cars_driveno/processing/final_estimate/' + erpId + '">Åpne i ERP</a>',
          { parse_mode: 'HTML' }
        );
      } catch (e) { logErr('vrakpant-alarm', e); }
    }
    const auctionTypeId = dLav < 35000 ? 2 : 1;"""

if s.count(old) != 1:
    print('FAIL 1: match count', s.count(old))
    exit(1)
s = s.replace(old, new)

# Fjern d_lav_under_vrakpant-blocker (håndteres nå oppstrøms)
old2 = "      if (Number(dLav) < 3000) blockers.push('d_lav_under_vrakpant_' + dLav);\n"
if s.count(old2) != 1:
    print('FAIL 2: match count', s.count(old2))
    exit(1)
s = s.replace(old2, '')

open(p + '.pre-vrakpant', 'w').write(open(p).read())
open(p, 'w').write(s)
print('PATCHED')
PY

node --check peasy-bot.js && echo SYNTAX_OK
launchctl kickstart -k gui/$(id -u)/com.peasy.auto && echo RESTARTED
