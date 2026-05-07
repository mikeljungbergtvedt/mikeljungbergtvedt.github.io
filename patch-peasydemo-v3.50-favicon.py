#!/usr/bin/env python3
"""
peasydemo.html v3.49 -> v3.50

Endring: Favicon (rask losning - bruker Peasy_Logo_ORG.png direkte)
- Legger <link rel="icon"> for PNG-favicon
- Legger <link rel="apple-touch-icon">
- Legger <link rel="shortcut icon"> for eldre browsere
- theme-color for mobil-browser-bar

Senere oppgradering: ekte multi-size favicon-pakke fra realfavicongenerator.net

Kjor pa Mini i ~/mikeljungbergtvedt.github.io/
"""
import shutil, datetime as dt, os, sys

REPO = os.path.expanduser('~/mikeljungbergtvedt.github.io')
DEMO = os.path.join(REPO, 'peasydemo.html')

ts = dt.datetime.now().strftime('%Y%m%d-%H%M%S')
shutil.copy(DEMO, DEMO + f'.bak-{ts}')
print(f'Backup: peasydemo.html.bak-{ts}')

with open(DEMO) as f:
    src = f.read()

# 1) Versjon-bump
n = src.count('v3.49')
src = src.replace('v3.49', 'v3.50')
print(f'Versjon-bump: {n} forekomster v3.49 -> v3.50')

# 2) Sett inn favicon-tags rett etter <link rel="canonical"> (siste linje for SEO blir favicon)
# Bruker canonical-linjen som anchor siden den er unik og ble lagt inn i v3.49
old = '<link rel="canonical" href="https://peasy.no/">'
if old not in src:
    print('FEIL: fant ikke canonical-anchor (var v3.49 deployet?)')
    sys.exit(1)

new = '''<link rel="canonical" href="https://peasy.no/">

<!-- Favicon (rask losning, bruker Peasy_Logo_ORG.png direkte) -->
<link rel="icon" type="image/png" href="/Peasy_Logo_ORG.png">
<link rel="shortcut icon" type="image/png" href="/Peasy_Logo_ORG.png">
<link rel="apple-touch-icon" href="/Peasy_Logo_ORG.png">
<meta name="theme-color" content="#004225">'''

src = src.replace(old, new)
print('Favicon-tags lagt til i <head>')

with open(DEMO, 'w') as f:
    f.write(src)

print()
print('Versjon: v3.50')
print('Deploy: git add -A && git commit -m "peasydemo v3.50 - favicon" && git pull --rebase && git push')
