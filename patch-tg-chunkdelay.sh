#!/bin/bash
# Legg til 1.2s delay mellom Telegram-chunks så mobil-klient viser dem separat
set -e

cd /Users/bot/peasy-auto

python3 << 'PY'
p='peasy-auto.js'
s=open(p).read()

if 'chunk-delay' in s:
    print('ALREADY_PATCHED')
    exit(0)

old = """      if (res && !res.ok) {
        const t = await res.text().catch(() => '');
        logErr('sendTelegram', new Error(`HTTP ${res.status}: ${t.slice(0, 150)}`));
      }
    }
  } catch (e) { logErr('sendTelegram', e); }"""

new = """      if (res && !res.ok) {
        const t = await res.text().catch(() => '');
        logErr('sendTelegram', new Error(`HTTP ${res.status}: ${t.slice(0, 150)}`));
      }
      // chunk-delay: sørg for at mobil-klienten ikke grupperer chunks til én visning
      if (i < chunks.length - 1) await new Promise(r => setTimeout(r, 1200));
    }
  } catch (e) { logErr('sendTelegram', e); }"""

if s.count(old) != 1:
    print('FAIL match', s.count(old))
    exit(1)
open(p+'.pre-chunkdelay', 'w').write(s)
open(p, 'w').write(s.replace(old, new))
print('PATCHED')
PY

node --check peasy-auto.js && echo SYNTAX_OK
launchctl kickstart -k gui/$(id -u)/com.peasy.auto && echo RESTARTED
