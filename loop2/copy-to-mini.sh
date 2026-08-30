#!/bin/bash
# Copy loop2 runner onto Mini's peasy-auto tree. Does not touch Easy / V3 / V3G / Bot 4.
set -euo pipefail
SRC="$(cd "$(dirname "$0")" && pwd)"
DEST="${1:-/Users/bot/peasy-auto/loop2}"
mkdir -p "$DEST"
rsync -a --delete \
  --exclude '.git' \
  --exclude 'node_modules' \
  "$SRC/" "$DEST/"
chmod +x "$DEST/copy-to-mini.sh" "$DEST/run.js" 2>/dev/null || true
echo "Copied $SRC → $DEST"
echo "writes_erp is hardcoded false. Run:"
echo "  cd $DEST"
echo "  set -a && source /Users/bot/peasy-auto/.env && set +a"
echo "  node run.js --cars cars.json --dry-run --out ~/mikeljungbergtvedt.github.io/loop2-measurements.jsonl"
