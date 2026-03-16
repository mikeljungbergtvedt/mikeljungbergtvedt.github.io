#!/bin/bash
NODE="/Users/bot/.nvm/versions/node/v24.14.0/bin/node"
FILE="/Users/bot/peasy-auto/peasy-auto.js"

$NODE << 'NODEOF'
const fs = require('fs');
let code = fs.readFileSync('/Users/bot/peasy-auto/peasy-auto.js', 'utf8');

// ── 1. Add kmSanityCheck() after fmtNOK/n utils ──────────────────────────────
const newFunc = `
function kmSanityCheck(km, year) {
  const age = new Date().getFullYear() - year;
  if (age <= 0) return { ok: true, km };
  const perYear = km / age;
  // Flag if under 1 000 km/year or over 40 000 km/year
  if (perYear < 1000 || perYear > 40000) {
    const estimated = Math.round(age * 15000 / 1000) * 1000;
    return {
      ok: false,
      km: estimated,
      original: km,
      perYear: Math.round(perYear),
      estimated,
    };
  }
  return { ok: true, km };
}
`;

const insertAfter = 'const n      = x => x.toLocaleString(\'nb-NO\');';
if (!code.includes(insertAfter)) { console.error('FAIL: utils not found'); process.exit(1); }
code = code.replace(insertAfter, insertAfter + '\n' + newFunc);
console.log('OK kmSanityCheck added');

// ── 2. Use kmSanityCheck in evalCar() before Finn search ─────────────────────
const oldEvalStart = `  const specs     = await vegvesen(car.regNr);
  console.log('  ' + specs.fuel + ' | ' + specs.gearbox + ' | ' + specs.drive + ' | ' + specs.kw + 'kW | ' + specs.bodyType);`;

const newEvalStart = `  const specs     = await vegvesen(car.regNr);
  console.log('  ' + specs.fuel + ' | ' + specs.gearbox + ' | ' + specs.drive + ' | ' + specs.kw + 'kW | ' + specs.bodyType);

  // Sanity-check km from ERP vs expected for car age
  const kmCheck = kmSanityCheck(car.km, car.year);
  if (!kmCheck.ok) {
    console.log('  ⚠️ KM SANITY: ' + n(car.km) + ' km (' + n(kmCheck.perYear) + ' km/år) — bruker estimert ' + n(kmCheck.estimated) + ' km');
    car = { ...car, km: kmCheck.estimated, kmWarning: car.km };
  }`;

if (!code.includes(oldEvalStart)) { console.error('FAIL: evalCar start not found'); process.exit(1); }
code = code.replace(oldEvalStart, newEvalStart);
console.log('OK kmSanityCheck call in evalCar');

// ── 3. Show km warning in buildCard header ────────────────────────────────────
const oldHeader = `  msg += car.regNr + ' | ' + car.make + ' ' + car.model + ' ' + car.year + ' | ' + n(car.km) + 'km | ' + specs.fuel + ' | ' + specs.gearbox + ' | ' + specs.drive + ' | ' + hkStr + '\\n';`;

const newHeader = `  const kmDisplay = car.kmWarning
    ? n(car.km) + 'km ⚠️ (ERP: ' + n(car.kmWarning) + ' km — sanity-justert)'
    : n(car.km) + 'km';
  msg += car.regNr + ' | ' + car.make + ' ' + car.model + ' ' + car.year + ' | ' + kmDisplay + ' | ' + specs.fuel + ' | ' + specs.gearbox + ' | ' + specs.drive + ' | ' + hkStr + '\\n';`;

if (!code.includes(oldHeader)) { console.error('FAIL: buildCard header not found'); process.exit(1); }
code = code.replace(oldHeader, newHeader);
console.log('OK km warning in buildCard header');

// ── 4. car needs let not const in evalCar ────────────────────────────────────
const oldCarConst = `  const card = buildCard({ ...car }, specs, pool, anchor, v, heft, sdComment, ownListing, total, finnUrl);`;
// car is already spread so no change needed — kmWarning is set via spread above

fs.writeFileSync('/Users/bot/peasy-auto/peasy-auto.js', code);
console.log('\nAll patches applied');
NODEOF
