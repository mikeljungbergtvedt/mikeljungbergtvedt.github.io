#!/bin/bash
# peasy-backup.sh
ONEDRIVE="/Users/bot/Library/CloudStorage/OneDrive-Autoringenas/C2B/Peasy/Bot/Dokumentasjon"
AUTODIR="/Users/bot/peasy-auto"
TRACKDIR="/Users/bot/peasy-track"
DATE=$(date +"%Y-%m-%d")
echo "Peasy backup $DATE..."
cp "$AUTODIR/peasy-auto.js" "$ONEDRIVE/peasy-auto.js" && echo "  OK peasy-auto.js"
[ -f "$TRACKDIR/peasy-track.js" ] && cp "$TRACKDIR/peasy-track.js" "$ONEDRIVE/peasy-track.js" && echo "  OK peasy-track.js"
grep -o '^[A-Z_]*' "$AUTODIR/.env" > "$ONEDRIVE/.env.keys" 2>/dev/null && echo "  OK .env.keys"
curl -s "https://raw.githubusercontent.com/mikeljungbergtvedt/mikeljungbergtvedt.github.io/main/peasy-pricing-logic.md" -o "$ONEDRIVE/peasy-pricing-logic.md" && echo "  OK peasy-pricing-logic.md"
curl -s "https://raw.githubusercontent.com/mikeljungbergtvedt/mikeljungbergtvedt.github.io/main/peasy-pulse.html" -o "$ONEDRIVE/peasy-pulse.html" && echo "  OK peasy-pulse.html"
curl -s "https://raw.githubusercontent.com/mikeljungbergtvedt/mikeljungbergtvedt.github.io/main/ukerapport.html" -o "$ONEDRIVE/ukerapport.html" && echo "  OK ukerapport.html"
curl -s "https://raw.githubusercontent.com/mikeljungbergtvedt/mikeljungbergtvedt.github.io/main/peasyportal.html" -o "$ONEDRIVE/peasyportal.html" && echo "  OK peasyportal.html"
echo "Backup ferdig"
