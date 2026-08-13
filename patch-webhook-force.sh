#!/bin/bash
# Fix /trigger-eval?force=true — skip confirmFinalEstimate når force=true
# (force=true skal kun slette cache + la peasy-auto plukke opp bilen på nytt)
set -e

cd /Users/bot/peasy-auto

python3 << 'PY'
p='webhook-server.js'
s=open(p).read()

if 'if (forceClear)' in s and 'skip confirm' in s:
    print('ALREADY_PATCHED')
    exit(0)

# Wrap _triggerFn call med force-check
old = """      if (_triggerFn) {
        // fire-and-forget – Pulse-knapp får raskt svar
        Promise.resolve().then(() => _triggerFn({regnr, internnr, km}))
          .catch(e => log(`[webhook] trigger EXC: ${e && e.message || e}`));
        res.writeHead(202, {'Content-Type':'application/json'});
        res.end(JSON.stringify({ok:true, queued:true, regnr}));
      }"""
new = """      if (_triggerFn) {
        // force=true → skip confirmFinalEstimate (cache er slettet, peasy-auto plukker opp neste runde)
        if (forceClear) {
          log('[webhook] force=true → skipper confirm-send, cache slettet');
          res.writeHead(202, {'Content-Type':'application/json'});
          res.end(JSON.stringify({ok:true, queued:false, force_cleared:true, note:'cache slettet, peasy-auto plukker opp neste runde', regnr}));
        } else {
          // fire-and-forget – Pulse-knapp får raskt svar
          Promise.resolve().then(() => _triggerFn({regnr, internnr, km}))
            .catch(e => log(`[webhook] trigger EXC: ${e && e.message || e}`));
          res.writeHead(202, {'Content-Type':'application/json'});
          res.end(JSON.stringify({ok:true, queued:true, regnr}));
        }
      }"""

if s.count(old) != 1:
    print('FAIL match count', s.count(old))
    exit(1)
open(p+'.pre-forceskip', 'w').write(s)
open(p, 'w').write(s.replace(old, new))
print('PATCHED')
PY

node --check webhook-server.js && echo SYNTAX_OK

# Fjern AD86442 fra peasy-cache.json om den er der, så main-loop plukker den opp
python3 << 'PY'
import json, os
p='/Users/bot/peasy-auto/peasy-cache.json'
if os.path.exists(p):
    d=json.load(open(p))
    n=len(d)
    # AD86442 internnr er 3927
    if '3927' in d:
        del d['3927']
        json.dump(d, open(p,'w'), indent=2)
        print(f'CACHE_REMOVED_3927 (was {n} entries, now {len(d)})')
    else:
        print(f'AD86442_NOT_IN_CACHE ({n} entries)')
else:
    print('NO_CACHE_FILE')
PY

launchctl kickstart -k gui/$(id -u)/com.peasy.auto && echo RESTARTED
