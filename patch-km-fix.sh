#!/bin/bash
NODE="/Users/bot/.nvm/versions/node/v24.14.0/bin/node"

$NODE << 'NODEOF'
const fs = require('fs');
let code = fs.readFileSync('/Users/bot/peasy-auto/peasy-auto.js', 'utf8');

const oldLine = `  if (perYear < 1000 || perYear > 40000) {`;
const newLine = `  if (perYear < 5000 || perYear > 100000) {`;

if (!code.includes(oldLine)) { console.error('FAIL: line not found'); process.exit(1); }
code = code.replace(oldLine, newLine);
fs.writeFileSync('/Users/bot/peasy-auto/peasy-auto.js', code);
console.log('OK');
NODEOF
