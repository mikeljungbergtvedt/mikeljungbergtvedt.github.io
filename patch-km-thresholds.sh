#!/bin/bash
NODE="/Users/bot/.nvm/versions/node/v24.14.0/bin/node"
FILE="/Users/bot/peasy-auto/peasy-auto.js"

$NODE << 'NODEOF'
const fs = require('fs');
let code = fs.readFileSync('/Users/bot/peasy-auto/peasy-auto.js', 'utf8');

const oldCheck = `function kmSanityCheck(km, year) {
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
}`;

const newCheck = `function kmSanityCheck(km, year) {
  const age = new Date().getFullYear() - year;
  if (age <= 0) return { ok: true, km };
  const perYear = km / age;
  // Only flag truly impossible values: under 500 km/year or over 50 000 km/year
  if (perYear < 500 || perYear > 50000) {
    const estimated = Math.round(age * 12000 / 1000) * 1000;
    return {
      ok: false,
      km: estimated,
      original: km,
      perYear: Math.round(perYear),
      estimated,
    };
  }
  return { ok: true, km };
}`;

if (!code.includes(oldCheck)) { console.error('FAIL: kmSanityCheck not found'); process.exit(1); }
code = code.replace(oldCheck, newCheck);
fs.writeFileSync('/Users/bot/peasy-auto/peasy-auto.js', code);
console.log('OK thresholds updated: <500/yr or >50000/yr, estimate = age*12000');
NODEOF
