#!/usr/bin/env python3
"""
Pulse v16.04.c03 -> v16.04.c04

Klassifiser partnernavn:
  SpareBank 1 Nord-Norge -> Partner 1
  AutoDB -> Partner 2

Kjor pa Mini i ~/mikeljungbergtvedt.github.io/
"""
import shutil, datetime as dt, os

REPO = os.path.expanduser('~/mikeljungbergtvedt.github.io')
PULSE = os.path.join(REPO, 'peasy-pulse.html')

ts = dt.datetime.now().strftime('%Y%m%d-%H%M%S')
shutil.copy(PULSE, PULSE + f'.bak-{ts}')
print(f'Backup: peasy-pulse.html.bak-{ts}')

with open(PULSE) as f:
    src = f.read()

# Versjon-bump
src = src.replace('v16.04.c03', 'v16.04.c04')

# Bytt navn
replacements = [
    ('SpareBank 1 Nord-Norge', 'Partner 1'),
    ('SB1 Nord-Norge', 'Partner 1'),
    ('SB1 NORD-NORGE', 'PARTNER 1'),
    ('SB1NN', 'PARTNER1'),
    ('sb1nn', 'partner1'),
    ('AutoDB', 'Partner 2'),
    ('AUTODB', 'PARTNER 2'),
    ('autodb', 'partner2'),
]

# Ogsaa kostnadsmodell-tekst som avslorer AutoDB
# 'Kostnadsmodell: 300 kr per solgt lead' kan staa siden det er generisk

count = 0
for old, new in replacements:
    n = src.count(old)
    if n > 0:
        src = src.replace(old, new)
        print(f'  {old!r} -> {new!r}: {n} forekomster')
        count += n

print(f'Totalt {count} erstatninger')

with open(PULSE, 'w') as f:
    f.write(src)

print()
print('Versjon: v16.04.c04')
print('Deploy: git add -A && git commit -m "Pulse v16.04.c04 - classify partners" && git pull --rebase && git push')
