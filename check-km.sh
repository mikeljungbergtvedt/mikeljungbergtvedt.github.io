#!/bin/bash
NODE="/Users/bot/.nvm/versions/node/v24.14.0/bin/node"

$NODE << 'NODEOF'
const fs = require('fs');
let code = fs.readFileSync('/Users/bot/peasy-auto/peasy-auto.js', 'utf8');

// Find and print current kmSanityCheck
const idx = code.indexOf('function kmSanityCheck');
console.log(code.substring(idx, idx + 300));
NODEOF
