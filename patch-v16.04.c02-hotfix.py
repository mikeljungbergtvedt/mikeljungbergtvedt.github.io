#!/usr/bin/env python3
"""
Pulse v16.04.c01 -> v16.04.c02 hot-fix.

Problem: gammel markRender() pa linje ~2572 prover aa skrive til ID-er som
ikke lenger finnes (cpl-card osv) og krasjer FOR min auto-render-hook far kjort.

Fix: erstatt hele markRender-funksjonens body med kall til MARK_V16_04.render()

Kjor pa Mini i ~/mikeljungbergtvedt.github.io/
"""
import re, shutil, datetime as dt, os

REPO = os.path.expanduser('~/mikeljungbergtvedt.github.io')
PULSE = os.path.join(REPO, 'peasy-pulse.html')

ts = dt.datetime.now().strftime('%Y%m%d-%H%M%S')
shutil.copy(PULSE, PULSE + f'.bak-{ts}')
print(f'Backup: peasy-pulse.html.bak-{ts}')

with open(PULSE) as f:
    src = f.read()

# 1) Versjon-bump
src = src.replace('v16.04.c01', 'v16.04.c02')

# 2) Erstatt markRender-funksjonen
# Finn `function markRender(){`
m = re.search(r'function markRender\(\)\{', src)
if not m:
    print('FEIL: fant ikke function markRender(){')
    raise SystemExit(1)

start = m.start()
# Tell brace-depth fra etter '{' for aa finne matching '}'
depth = 1
i = m.end()  # rett etter `{`
while i < len(src) and depth > 0:
    c = src[i]
    if c == '{': depth += 1
    elif c == '}': depth -= 1
    i += 1
end = i  # peker rett etter matching `}`

print(f'Gammel markRender: {start}-{end} ({end-start} tegn)')

new_func = ('function markRender(){'
            'try{if(window.MARK_V16_04 && window.MARK_V16_04.render){'
            'setTimeout(function(){window.MARK_V16_04.render();},50);}}'
            'catch(e){console.error("markRender redirect:",e);}}')

src = src[:start] + new_func + src[end:]

with open(PULSE, 'w') as f:
    f.write(src)

print(f'Erstattet med wrapper -> MARK_V16_04.render()')
print(f'Versjon: v16.04.c02')
print()
print('Deploy: git add -A && git commit -m "Pulse v16.04.c02 - fix markRender redirect" && git pull --rebase && git push')
