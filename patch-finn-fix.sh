#!/bin/bash
# Fjern overflødig 'else log(...)' som ble hengende igjen etter forrige patch
set -e

cd /Users/bot/peasy-auto

python3 << 'PY'
p='peasy-auto.js'
s=open(p).read()

# Finn den overflødige linjen: 'else log(`Finn: ${regnr} ingen matchende annonse`);'
old = "    if (result) log(`Finn: ${regnr} EKSAKT regnr-match til ${result.price} kr (${result.status})`);\n    else log(`Finn: ${regnr} ingen matchende annonse med regnr i tekst`);\n    else log(`Finn: ${regnr} ingen matchende annonse`);"

new = "    if (result) log(`Finn: ${regnr} EKSAKT regnr-match til ${result.price} kr (${result.status})`);\n    else log(`Finn: ${regnr} ingen matchende annonse med regnr i tekst`);"

if s.count(old) != 1:
    print('FAIL match', s.count(old))
    # Try to find the dangling else
    lines = s.split('\n')
    for i, ln in enumerate(lines):
        if 'else log(`Finn: ${regnr} ingen matchende annonse`' in ln and 'regnr i tekst' not in ln:
            print(f'DANGLING at line {i+1}: {ln}')
    exit(1)

open(p+'.pre-finnfix', 'w').write(open(p).read())
open(p, 'w').write(s.replace(old, new))
print('PATCHED')
PY

node --check peasy-auto.js && echo SYNTAX_OK
launchctl kickstart -k gui/$(id -u)/com.peasy.auto && echo RESTARTED
