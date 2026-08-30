# loop2 — Mini shadow runner

Claude, Grok 4.6 and Gemini each price a car. Pulse QA (c328) plots the three `finn_utpris` dots on **Ny loop**. This runner never writes ERP.

`peasy-pulse.html` is already live as c328. Do not edit it from here.

## Hard rules

- `writes_erp` is always `false`. There is no `--write-erp` flag.
- Never call ERP write / send / persist-eval endpoints.
- Do not change Easy, V3, V3G, or Bot 4.
- Internnr even/odd does **not** pick chefs. Every car gets three named API calls: Claude, Grok, Gemini.
- Keys from env only. Never hardcode secrets.

## What JR does (identity, not chef)

Per car, JR builds:

1. One origin CV: `regnr`, `internnr`, `merke`, `modell`, `aar`, `km`, `drivstoff`, `gir`, `hk`, `drivlinje`, `vin` if present.
2. A raw folder of listings:
   - Finn now
   - sold under 3 months
   - own sold
   - origin-on-Finn

No km/year cut in the search. No locked twin window (`±n km`, `±n year`). Twin pick is the chef’s job.

JR try-requires Mini Easy/V3/V3G **at runtime** (no copies, no edits). `peasy-auto.js` is listed but never `require`d — it calls `main()` on load.

When the runner lives at `/Users/bot/peasy-auto/loop2`:

| Adapter | Mini require paths |
|---------|-------------------|
| `clients/finn.js` | `../finn-origin.js`, `../ai-finn-comp-filter.js`, `../v2/v3-eval.js`, `../v2/v3-eval-runner.js`, `../v3g/v3g-eval.js`, `../origin-cv.js`, `../ident-comps-score.js` |
| `clients/carinfo.js` | `../v2/v3-eval.js`, `../v2/v3-eval-runner.js`, `../v3g/v3g-eval.js`, `../origin-cv.js`, `../ident-comps-score.js`, `../finn-origin.js`, `../ai-finn-comp-filter.js` |

Absolute equivalents: `/Users/bot/peasy-auto/<same>`. First existing module with `searchRaw` / `search` / `fetchComps` / `finnSearch` (then a few aliases) wins. Call flags are always `kmCut:false yearCut:false twinLock:false`. If Easy/V3 already windowed a pool, JR maps the raw arrays and does not re-apply ±km / ±year.

If no Mini module is loadable, `searchRaw` returns `{ available: false, reason }` and the runner writes `ok: false` instead of crashing Pulse. ERP lookup stays GET-only (`clients/erp-read.js`).

## Chefs

Three named calls per car — not internnr parity, not Cursor Auto-route:

| evaluator | API | env key |
|-----------|-----|---------|
| `claude` | Anthropic Messages | `ANTHROPIC_API_KEY` |
| `grok` | xAI `grok-4.6` | `XAI_API_KEY` or `GROK` |
| `gemini` | Gemini | `GEMINI_API_KEY` or `GOOGLE_API_KEY` |

Optional model overrides: `ANTHROPIC_MODEL`, `XAI_MODEL` / `GROK_MODEL`, `GEMINI_MODEL`.

Each chef returns `finn_utpris` (number), a short rationale (max 3 lines), and which twins they used. Latest `timestamp` wins per `regnr` + `evaluator` (Pulse already does this).

## JSONL contract (live Bot 4 schema)

One object per chef per car. Pulse fetches `/loop2-measurements` then falls back to `https://mikeljungbergtvedt.github.io/loop2-measurements.jsonl`.

Required fields — **do not invent** `finn_pris`, `at`, or `why`:

```
evaluator      claude | grok | gemini
ok             boolean
timestamp      ISO
internnr
erpId
regnr
km
merke
modell
aar
finn_utpris    the Finn-pris Pulse plots (number, or null on failure)
rationale      max 3 lines
n_comps
writes_erp     false
error          null when ok
```

`ok: false` or a non-numeric `finn_utpris` → Pulse shows **—** (same rule as Bot 4). A later `ok: true` line with a newer timestamp lights the dot.

## Mini: copy and run

On Mini, this repo is `~/mikeljungbergtvedt.github.io`. Bots live in `/Users/bot/peasy-auto`. Copy **only** `loop2/` — leave Easy / V3 / V3G / Bot 4 alone.

```bash
# 1) Update Pages checkout and copy the runner
cd ~/mikeljungbergtvedt.github.io
git pull
./loop2/copy-to-mini.sh
# same as: rsync -a --delete loop2/ /Users/bot/peasy-auto/loop2/

# 2) Keys from Mini .env (never paste keys into the repo)
set -a && source /Users/bot/peasy-auto/.env && set +a

# 3) First run — weekend 26 list later. writes_erp is hardcoded false.
cd /Users/bot/peasy-auto/loop2
# edit cars.json (internnr and/or regnr), then:
node run.js --cars cars.json --dry-run \
  --out ~/mikeljungbergtvedt.github.io/loop2-measurements.jsonl

# 4) When Finn/car.info hooks are wired on Mini, drop --dry-run.
#    Missing clients still write ok:false instead of crashing.
node run.js --cars cars.json \
  --out ~/mikeljungbergtvedt.github.io/loop2-measurements.jsonl
```

CLI also accepts a list: `node run.js --cars 4237,UN35424 --dry-run`.

## Publish (same as Bot 4)

Bot 4 publishes by committing `bot4-measurements.jsonl` in this GitHub Pages repo (`bot4 measurements update <ISO>`). Loop2 does the same file-next-to-it:

```bash
cd ~/mikeljungbergtvedt.github.io
git add loop2-measurements.jsonl
git commit -m "loop2 measurements update $(date -u +%Y-%m-%dT%H:%M)"
git push
```

Or from the runner (after a run that wrote the file):

```bash
node run.js --cars cars.json --out ~/mikeljungbergtvedt.github.io/loop2-measurements.jsonl --commit
```

`--commit` uses message `loop2 measurements update <ISO>` and `git push`. Add `--no-push` to commit only.

Pulse already looks at the Pages fallback, so a push is enough to light Ny-loop dots. Mini may also serve `/loop2-measurements` later; that is outside this folder.

## Weekend 26

`cars.json` is empty on purpose. Put internnr/regnr there when the weekend 26 list is ready. See `cars.example.json` for the row shape.

## Tests

```bash
cd loop2 && node test.js
```

No extra npm packages. Node 18+ (`fetch`).
