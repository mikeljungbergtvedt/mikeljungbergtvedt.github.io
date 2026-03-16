#!/bin/bash
NODE="/Users/bot/.nvm/versions/node/v24.14.0/bin/node"
FILE="/Users/bot/peasy-auto/peasy-auto.js"

$NODE << 'NODEOF'
const fs = require('fs');
let code = fs.readFileSync('/Users/bot/peasy-auto/peasy-auto.js', 'utf8');

// 1. anchor -> let in handleFinn
const oldDestructFinn = `  const { anchor, pool } = await pickAnchor(fakeCar, comps);
  if (!anchor) { await tg('Ingen anchor funnet.'); return; }`;
const newDestructFinn = `  let { anchor, pool } = await pickAnchor(fakeCar, comps);
  if (!anchor) { await tg('Ingen anchor funnet.'); return; }`;
if (!code.includes(oldDestructFinn)) { console.error('FAIL: handleFinn anchor destructure not found'); process.exit(1); }
code = code.replace(oldDestructFinn, newDestructFinn);
console.log('OK anchor -> let');

// 2. anchor override + ERP write + comment in handleFinn
const oldFinnKalkyle = `  const v = kalkyle(anchor.price);
  if (!v) { await tg('Kalkyle feilet.'); return; }

  let sdComment = null;
  if (erpCar?.hasSdComment && erpCar?.erpId) sdComment = await erpComment(erpCar.erpId);

  const card = buildCard(fakeCar, fakeSpecs, pool, anchor, v, heft, sdComment, ownListing, total, finnUrl);
  await tg(card);`;
const newFinnKalkyle = `  if (ownListing && ownListing.price < anchor.price) {
    console.log('  /finn own listing ' + ownListing.price + ' < anchor ' + anchor.price + ' — using as new anchor');
    anchor = { price: ownListing.price, km: ownListing.km || fakeCar.km, year: fakeCar.year, aiReason: 'Selgers egen Finn-annonse brukt som anker (lavere pris)' };
  }

  const v = kalkyle(anchor.price);
  if (!v) { await tg('Kalkyle feilet.'); return; }

  let sdComment = null;
  if (erpCar?.hasSdComment && erpCar?.erpId) sdComment = await erpComment(erpCar.erpId);

  const card = buildCard(fakeCar, fakeSpecs, pool, anchor, v, heft, sdComment, ownListing, total, finnUrl);
  await tg(card);

  if (erpCar?.erpId) {
    const canWrite = !heft.includes('registrert') && v.dMid >= 10000;
    if (canWrite) {
      const ok = await erpWrite(erpCar.erpId, v.dLow, v.dHigh, heft);
      console.log('  /finn ERP write: ' + (ok ? 'OK' : 'FAILED'));
      if (ok) await erpPostComment(erpCar.erpId, card);
    } else {
      console.log('  /finn ERP write: skipped (' + (heft.includes('registrert') ? 'heftelser' : 'lav verdi') + ')');
    }
  }`;
if (!code.includes(oldFinnKalkyle)) { console.error('FAIL: handleFinn kalkyle block not found'); process.exit(1); }
code = code.replace(oldFinnKalkyle, newFinnKalkyle);
console.log('OK anchor override + ERP write + comment');

fs.writeFileSync('/Users/bot/peasy-auto/peasy-auto.js', code);
console.log('All patches applied');
NODEOF
