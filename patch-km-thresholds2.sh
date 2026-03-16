#!/bin/bash
NODE="/Users/bot/.nvm/versions/node/v24.14.0/bin/node"

$NODE << 'NODEOF'
const fs = require('fs');
let code = fs.readFileSync('/Users/bot/peasy-auto/peasy-auto.js', 'utf8');

const oldThresholds = `  if (perYear < 500 || perYear > 50000) {`;
const newThresholds = `  if (perYear < 5000 || perYear > 100000) {`;

if (!code.includes(oldThresholds)) { console.error('FAIL: thresholds not found'); process.exit(1); }
code = code.replace(oldThresholds, newThresholds);
fs.writeFileSync('/Users/bot/peasy-auto/peasy-auto.js', code);
console.log('OK <5000/yr or >100000/yr');
NODEOF
