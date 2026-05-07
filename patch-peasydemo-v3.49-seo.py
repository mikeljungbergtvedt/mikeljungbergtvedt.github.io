#!/usr/bin/env python3
"""
peasydemo.html v3.48 -> v3.49

Endring: SEO-meta i <head>
- Forbedret <title>
- Meta description, canonical
- Open Graph (Facebook/LinkedIn deling)
- Twitter Card
- Structured data (JSON-LD: Organization + Place)
- Robots-tag (foreloepig noindex pa demo for aa unngaa Google-indeksering av demo-domenet)

Kjor pa Mini i ~/mikeljungbergtvedt.github.io/
"""
import shutil, datetime as dt, os, sys

REPO = os.path.expanduser('~/mikeljungbergtvedt.github.io')
DEMO = os.path.join(REPO, 'peasydemo.html')

ts = dt.datetime.now().strftime('%Y%m%d-%H%M%S')
shutil.copy(DEMO, DEMO + f'.bak-{ts}')
print(f'Backup: peasydemo.html.bak-{ts}')

with open(DEMO) as f:
    src = f.read()

# 1) Versjon-bump i banner og lignende
n_v348 = src.count('v3.48')
src = src.replace('v3.48', 'v3.49')
print(f'Versjon-bump: {n_v348} forekomster v3.48 -> v3.49')

# 2) Erstatt <title> og legg til SEO-meta
old_title = '<title>Peasy — Bud på din bil</title>'
if old_title not in src:
    print('FEIL: fant ikke gammel <title>')
    sys.exit(1)

new_seo = '''<title>Selg bilen raskt og trygt med Peasy – Slik gjør du det</title>
<meta name="description" content="Få en rask vurdering og enkelt salg av bilen din med Peasy. Opplev en trygg prosess i dag!">
<link rel="canonical" href="https://peasy.no/">

<!-- Robots: noindex paa demo til vi gaar live (forhindrer duplikat-indexering) -->
<meta name="robots" content="noindex, nofollow">

<!-- Open Graph (Facebook, LinkedIn, iMessage, Slack) -->
<meta property="og:title" content="Selg bilen raskt og trygt med Peasy – Slik gjør du det">
<meta property="og:description" content="Få en rask vurdering og enkelt salg av bilen din med Peasy. Opplev en trygg prosess i dag!">
<meta property="og:image" content="https://peasy.no/wp-content/uploads/2026/01/Open-graph-2026.jpeg">
<meta property="og:url" content="https://peasy.no/">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Peasy – Bud på din bil">
<meta property="og:locale" content="nb_NO">

<!-- Twitter Card -->
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="Selg bilen raskt og trygt med Peasy – Slik gjør du det">
<meta name="twitter:description" content="Få en rask vurdering og enkelt salg av bilen din med Peasy. Opplev en trygg prosess i dag!">
<meta name="twitter:image" content="https://peasy.no/wp-content/uploads/2026/01/Open-graph-2026.jpeg">

<!-- Structured data (JSON-LD): Organization + Place -->
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": "https://peasy.no/#organization",
      "name": "Peasy",
      "alternateName": "Peasy – Bud på din bil",
      "url": "https://peasy.no/",
      "logo": "https://mikeljungbergtvedt.github.io/Peasy_Logo_ORG.png",
      "parentOrganization": {
        "@type": "Organization",
        "name": "Autoringen AS",
        "vatID": "987 327 359 MVA",
        "address": {
          "@type": "PostalAddress",
          "streetAddress": "Strandveien 15-17",
          "postalCode": "1366",
          "addressLocality": "Lysaker",
          "addressCountry": "NO"
        }
      },
      "contactPoint": {
        "@type": "ContactPoint",
        "telephone": "+47 24 20 19 00",
        "email": "post@peasy.no",
        "contactType": "customer service",
        "areaServed": "NO",
        "availableLanguage": "Norwegian"
      }
    },
    {
      "@type": "Place",
      "@id": "https://peasy.no/#place",
      "address": {
        "@type": "PostalAddress",
        "streetAddress": "Strandveien 15-17",
        "postalCode": "1366",
        "addressCountry": "Norge",
        "addressLocality": "Lysaker"
      }
    }
  ]
}
</script>'''

src = src.replace(old_title, new_seo)
print('SEO-meta lagt til i <head>')

with open(DEMO, 'w') as f:
    f.write(src)

print()
print('Versjon: v3.49')
print('Deploy: git add -A && git commit -m "peasydemo v3.49 - SEO meta tags" && git pull --rebase && git push')
