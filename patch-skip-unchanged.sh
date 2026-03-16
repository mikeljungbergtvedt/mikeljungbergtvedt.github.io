#!/bin/bash
NODE="/Users/bot/.nvm/versions/node/v24.14.0/bin/node"

$NODE << 'NODEOF'
const fs = require('fs');
let code = fs.readFileSync('/Users/bot/peasy-auto/peasy-auto.js', 'utf8');

// In fetchPendingCars, add existing D low/high to car object
const oldPush = `        cars.push({
          erpId:  c.id,
          regNr:  c.registration_number,
          make:   c.manufacturer  || '',
          model:  c.model_series  || '',
          year:   c.model_year    || 0,
          km:     c.mileage       || 0,
          source: c.source        || '',
          hasSdComment: c.has_sd_comment === 1,
        });`;

const newPush = `        cars.push({
          erpId:  c.id,
          regNr:  c.registration_number,
          make:   c.manufacturer  || '',
          model:  c.model_series  || '',
          year:   c.model_year    || 0,
          km:     c.mileage       || 0,
          source: c.source        || '',
          hasSdComment: c.has_sd_comment === 1,
          existingDLow:  c.price_final_min || null,
          existingDHigh: c.price_final_max || null,
        });`;

if (!code.includes(oldPush)) { console.error('FAIL: push not found'); process.exit(1); }
code = code.replace(oldPush, newPush);
console.log('OK: added existingDLow/High to car object');

// In evalCar, skip ERP write if values unchanged
const oldCanWrite = `  const canWrite = !heft.includes('registrert') && v.dMid >= 10000;`;
const newCanWrite = `  const alreadyWritten = car.existingDLow && car.existingDHigh &&
    Math.round(car.existingDLow) === Math.round(v.dLow) &&
    Math.round(car.existingDHigh) === Math.round(v.dHigh);
  const canWrite = !heft.includes('registrert') && v.dMid >= 10000 && !alreadyWritten;`;

if (!code.includes(oldCanWrite)) { console.error('FAIL: canWrite not found'); process.exit(1); }
code = code.replace(oldCanWrite, newCanWrite);
console.log('OK: skip ERP write if unchanged');

// Update ERP section in buildCard to reflect this
const oldErpText = `  else             msg += '✅ Skrevet til ERP\\n';`;
const newErpText = `  else if (alreadyWritten) msg += '✅ Uendret — ikke overskrevet\\n';
  else             msg += '✅ Skrevet til ERP\\n';`;

// alreadyWritten is in evalCar scope not buildCard — pass it as param instead
// Simpler: just update the ERP log line in evalCar directly
const oldErpLog = `    console.log('  ERP write: ' + (ok ? 'OK' : 'FAILED'));
    if (ok) await erpPostComment(car.erpId, card);`;
const newErpLog = `    console.log('  ERP write: ' + (ok ? 'OK' : 'FAILED'));
    if (ok) await erpPostComment(car.erpId, card);`;
// No change needed there — just update canWrite log
const oldSkipLog = `    console.log('  ERP write: skipped (' + (ownListing ? 'Finn-listing' : heft.includes('registrert') ? 'heftelser' : 'lav verdi') + ')');`;
const newSkipLog = `    console.log('  ERP write: skipped (' + (alreadyWritten ? 'uendret' : heft.includes('registrert') ? 'heftelser' : 'lav verdi') + ')');`;

if (!code.includes(oldSkipLog)) { console.error('FAIL: skip log not found'); process.exit(1); }
code = code.replace(oldSkipLog, newSkipLog);
console.log('OK: updated skip log');

fs.writeFileSync('/Users/bot/peasy-auto/peasy-auto.js', code);
console.log('All patches applied');
NODEOF
