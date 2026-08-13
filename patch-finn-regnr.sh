#!/bin/bash
# Finn-match: krev regnr eksplisitt i annonseteksten. Ingen andre kriterier.
# Regnr-søk finner KUNDENS EGEN annonse. Match må være 100% eller ignoreres.
set -e

cd /Users/bot/peasy-auto

python3 << 'PY'
p='peasy-auto.js'
s=open(p).read()

if 'finn-strict-regnr' in s:
    print('ALREADY_PATCHED')
    exit(0)

old = """    const make = (bil.manufacturer || '').toLowerCase().split(' ')[0];
    const result = await page.evaluate((make) => {
      const a = document.querySelector('article');
      if (!a) return null;
      const text = a.innerText || '';
      if (make && !text.toLowerCase().includes(make)) return null;
      const price = parseInt((text.match(/(\\d[\\d\\s]+)\\s*kr/) || [])[1]?.replace(/\\s/g, '')) || 0;
      const link = a.querySelector('a')?.href || '';
      var soldM = text.match(/solgt/i); var status = soldM ? 'Solgt' : 'Til salgs'; return link ? { price: price || 0, link, status } : null;
    }, make);
    if (result) log(`Finn: ${regnr} funnet til ${result.price} kr`);"""

new = """    // [finn-strict-regnr] Match KUN hvis annonsetekst inneholder eksakt regnr.
    // Formål: finne kundens egen Finn-annonse (unik ID = regnr), for anker-cap mot kundens egen pris.
    // Andre biler med samme merke/modell skal IKKE matche.
    const result = await page.evaluate((regnr) => {
      const target = String(regnr || '').toUpperCase().replace(/\\s+/g, '');
      if (!target) return null;
      const articles = Array.from(document.querySelectorAll('article'));
      for (const a of articles) {
        const text = a.innerText || '';
        const upper = text.toUpperCase().replace(/\\s+/g, '');
        if (!upper.includes(target)) continue;  // Krav: regnr må stå i annonseteksten
        const price = parseInt((text.match(/(\\d[\\d\\s]+)\\s*kr/) || [])[1]?.replace(/\\s/g, '')) || 0;
        const link = a.querySelector('a')?.href || '';
        const soldM = text.match(/solgt/i);
        const status = soldM ? 'Solgt' : 'Til salgs';
        return link ? { price: price || 0, link, status } : null;
      }
      return null;
    }, regnr);
    if (result) log(`Finn: ${regnr} EKSAKT regnr-match til ${result.price} kr (${result.status})`);
    else log(`Finn: ${regnr} ingen matchende annonse med regnr i tekst`);"""

if s.count(old) != 1:
    print('FAIL match', s.count(old))
    exit(1)

open(p+'.pre-finn-regnr', 'w').write(open(p).read())
open(p, 'w').write(s.replace(old, new))
print('PATCHED')
PY

node --check peasy-auto.js && echo SYNTAX_OK
launchctl kickstart -k gui/$(id -u)/com.peasy.auto && echo RESTARTED
