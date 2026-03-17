#!/bin/bash
# peasy-backup.sh — kopierer alle relevante Peasy-filer til OneDrive
ONEDRIVE="/Users/bot/Library/CloudStorage/OneDrive-Autoringenas/C2B/Peasy/Bot/Dokumentasjon"
AUTODIR="/Users/bot/peasy-auto"
TRACKDIR="/Users/bot/peasy-track"
RAW="https://raw.githubusercontent.com/mikeljungbergtvedt/mikeljungbergtvedt.github.io/main"
DATE=$(date +"%Y-%m-%d")
echo "Peasy backup $DATE..."
cp "$AUTODIR/peasy-auto.js" "$ONEDRIVE/peasy-auto.js" && echo "  OK peasy-auto.js"
[ -f "$TRACKDIR/peasy-track.js" ] && cp "$TRACKDIR/peasy-track.js" "$ONEDRIVE/peasy-track.js" && echo "  OK peasy-track.js"
grep -o '^[A-Z_]*' "$AUTODIR/.env" > "$ONEDRIVE/.env.keys" 2>/dev/null && echo "  OK .env.keys"
curl -s "$RAW/peasy-pricing-logic.md" -o "$ONEDRIVE/peasy-pricing-logic.md" && echo "  OK peasy-pricing-logic.md"
curl -s "$RAW/peasy-pulse.html" -o "$ONEDRIVE/peasy-pulse.html" && echo "  OK peasy-pulse.html"
curl -s "$RAW/ukerapport.html" -o "$ONEDRIVE/ukerapport.html" && echo "  OK ukerapport.html"
curl -s "$RAW/peasyportal.html" -o "$ONEDRIVE/peasyportal.html" && echo "  OK peasyportal.html"
curl -s "$RAW/docs/Peasy-Systemdokumentasjon_2026_03_17.docx" -o "$ONEDRIVE/Peasy-Systemdokumentasjon 2026.03.17.docx" && echo "  OK Peasy-Systemdokumentasjon.docx"
echo "Backup ferdig -> $ONEDRIVE"
