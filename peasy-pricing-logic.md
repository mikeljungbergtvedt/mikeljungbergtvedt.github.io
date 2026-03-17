# Peasy — Prislogikk & Forretningsforståelse
**Versjon:** 1.1
**Dato:** 17. mars 2026

## Grunnleggende innsikt

> **Selger er emosjonell. Markedet er rasjonelt. Vi må bygge en bro.**

## Målsetninger

| Metric | Mål |
|--------|-----|
| Evaluering → Mottatt | **20%** |
| Mottatt → Solgt | **70%** |

## Finn-søk: Comp Pool (oppdatert 17.3.2026)

**Steg 3 — Km-nærhet (endret 17.3.2026)**
Filtrer alle treff: |comp.km - bil.km| ≤ 30 000. Sorter på km-avstand. Ta 5 nærmeste til Haiku.
Tidligere tok boten de 5 billigste (sortert på pris).

**Steg 4 — AI-anker (Claude Haiku)**
Velger billigste reelle alternativ blant de 5 nærmeste.

## Prisformel

```
Anker = billigste reelle comp (Haiku-valgt fra 5 km-nærmeste)
T     = max(anker × 0.88, anker − 10 000)

Peasy fee:
  T < 75k    → 5 900 kr
  T 75–125k  → 7 900 kr
  T > 125k   → 9 900 kr

D mid = T − fee
D lav = D mid × 0.95
D høy = D mid × 1.05
```

## PDEC1 — Estimert høyeste bud (E)

```
D mid ≤ 100k  → +10.2%
D mid ≤ 250k  →  -8.9%
D mid ≤ 400k  →  -4.6%
D mid > 400k  →  -7.3%
E = D lav × (1 + X%)
```

## Auction Price Type (nytt 17.3.2026)
- D lav < 35 000 kr → Lower price
- D lav ≥ 35 000 kr → Regular price

## Skip-logikk (nytt 17.3.2026)
Bot hopper over biler der has_sd_comment === 1 (allerede priset).
/finn overskriver alltid.

## ERP-skriving

| Situasjon | Handling |
|-----------|----------|
| QA ok, ikke på Finn | Skriv + toggles + Lagre data |
| Heftelser + QA ok | Skriv + 🚨 HEFTELSER-alarm |
| Annonsert på Finn | Ikke skriv + ⚠️ varsel |
| QA flagget | Ikke skriv + 🚨 FLAGGET-alarm |

## ERP-toggles (automatisk)
1. Heftelser kontrollert
2. Finans? (kun hvis heftelser)
3. Eiere sjekket
4. Auction price type
5. Lagre data

## QA-flaggkriterier
| Grunn | Betingelse |
|-------|-----------|
| For få treff | comps.length < 2 |
| Valuation mangler | !valuation.dLow |
| T for lavt | tEstimate < 10 000 kr |
