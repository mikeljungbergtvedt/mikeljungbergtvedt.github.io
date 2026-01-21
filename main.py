# main.py
# Requirements: pip install pandas openpyxl requests jinja2 pyyaml

import pandas as pd
import requests
import io
from datetime import datetime
from pathlib import Path
import yaml
from jinja2 import Environment, FileSystemLoader

# Load config
with open("config.yaml", encoding="utf-8") as f:
    config = yaml.safe_load(f)

REPORT_URL = config["report"]["url"]
SHEET_NAME = config["report"]["sheet"]

COL_MOTTATT   = config["columns"]["mottatt"]
COL_PRISET    = config["columns"]["priset"]
COL_SOLGT     = config["columns"]["solgt"]
COL_RETURNERT = config["columns"]["returnert"]
COL_BUD       = config["columns"]["bud"]
COL_AVGIFT    = config["columns"]["avgift"]

# Download Excel
print("Downloading report...")
response = requests.get(REPORT_URL)
response.raise_for_status()

df = pd.read_excel(io.BytesIO(response.content), sheet_name=SHEET_NAME)

# Parse dates (robust dd.mm.yyyy or with time)
for col in [COL_MOTTATT, COL_PRISET, COL_SOLGT, COL_RETURNERT]:
    df[col] = pd.to_datetime(df[col].astype(str).str.strip(), format="%d.%m.%Y", errors="coerce")

# Parse numerics
df[COL_BUD] = pd.to_numeric(df[COL_BUD], errors="coerce").fillna(0)
df[COL_AVGIFT] = pd.to_numeric(df[COL_AVGIFT], errors="coerce").fillna(0)

# Period filter
start_date = pd.to_datetime(config["period"]["start"])
end_date   = pd.to_datetime(config["period"]["end"])
marketing_start = pd.to_datetime(config["marketing_start"])

period_mask = (
    ((df[COL_PRISET] >= start_date) & (df[COL_PRISET] <= end_date)) |
    ((df[COL_MOTTATT] >= start_date) & (df[COL_MOTTATT] <= end_date)) |
    ((df[COL_SOLGT] >= start_date) & (df[COL_SOLGT] <= end_date)) |
    ((df[COL_RETURNERT] >= start_date) & (df[COL_RETURNERT] <= end_date))
)

df_period = df[period_mask].copy()

# Counts
n_priset    = df_period[COL_PRISET].notna().sum()
n_mottatt   = df_period[COL_MOTTATT].notna().sum()
n_solgt     = df_period[COL_SOLGT].notna().sum()
n_returnert = df_period[COL_RETURNERT].notna().sum()

# Threshold splits (based on Bud at priset time)
df_sold     = df_period[df_period[COL_SOLGT].notna()]
df_returned = df_period[df_period[COL_RETURNERT].notna()]

sold_under  = (df_sold[COL_BUD] < 25000).sum()
sold_over   = (df_sold[COL_BUD] >= 25000).sum()
ret_under   = (df_returned[COL_BUD] < 25000).sum()
ret_over    = (df_returned[COL_BUD] >= 25000).sum()

# Financials
total_income = df_sold[COL_AVGIFT].sum()  # Omsetning = sum Avgift sold
commission = total_income * config["commission_rate"]

# Costs
marketing_cost = 0
if start_date >= marketing_start:
    marketing_cost = n_priset * config["costs"]["marketing_per_car"]  # or n_mottatt?

transport_cost = n_mottatt * config["costs"]["transport_per_car"]

production_cost = (
    sold_under * config["costs"]["production"]["sold_under"] +
    sold_over  * config["costs"]["production"]["sold_over"] +
    ret_under  * config["costs"]["production"]["returned_under"] +
    ret_over   * config["costs"]["production"]["returned_over"]
)

total_costs = marketing_cost + transport_cost + production_cost

brutto_fortjeneste = total_income - total_costs

# Per sold car
if n_solgt > 0:
    marketing_per_sold = round(marketing_cost / n_solgt)
    total_cost_per_sold = round(total_costs / n_solgt)
    brutto_per_sold = round(brutto_fortjeneste / n_solgt)
else:
    marketing_per_sold = total_cost_per_sold = brutto_per_sold = 0

# Rates
priset_to_mottatt_pct = round(n_mottatt / n_priset * 100, 1) if n_priset > 0 else 0.0
mottatt_to_sold_pct   = round(n_solgt / n_mottatt * 100, 1) if n_mottatt > 0 else 0.0
return_rate_pct       = round(n_returnert / n_mottatt * 100, 1) if n_mottatt > 0 else 0.0

priset_to_return_pct  = round(n_returnert / n_priset * 100, 1) if n_priset > 0 else 0.0

# Data for template
context = {
    "periode_name": config["period"]["name"],
    "periode_start": start_date.strftime("%d.%m.%Y"),
    "periode_end":   end_date.strftime("%d.%m.%Y"),
    
    "biler_priset": n_priset,
    "biler_mottatt": n_mottatt,
    "biler_solgt": n_solgt,
    "biler_returnert": n_returnert,
    
    "solgt_omsetning": f"{int(total_income):,}".replace(",", " "),
    "gj_snitt_pris_solgt": "–" if n_solgt == 0 else f"{int(total_income / n_solgt):,}".replace(",", " "),
    "brutto_per_solgt": "–" if n_solgt == 0 else f"{brutto_per_sold:,}".replace(",", " "),
    
    "priset_to_mottatt": priset_to_mottatt_pct,
    "priset_to_returnert": priset_to_return_pct,
    "mottatt_to_solgt": mottatt_to_sold_pct,
    "returneringsrate": return_rate_pct,
    
    "goals": config["goals"],
    
    "markedsforing_kost": f"{int(marketing_cost):,}".replace(",", " "),
    "produksjon_kost": f"{int(production_cost):,}".replace(",", " "),
    "gire_kost": f"{int(transport_cost):,}".replace(",", " "),
    "markedsforing_per_solgt": f"{marketing_per_sold:,}".replace(",", " "),
    "total_kost_per_solgt": f"{total_cost_per_sold:,}".replace(",", " "),
    "brutto_fortjeneste_per_solgt": brutto_per_sold,
    "totale_kostnader": f"{int(total_costs):,}".replace(",", " "),
    "total_inntekt": f"{int(total_income):,}".replace(",", " "),
    "brutto_fortjeneste": brutto_fortjeneste,
    "autoringen_kommisjon": f"{int(commission):,}".replace(",", " "),
}

# Render template
env = Environment(loader=FileSystemLoader("."))
template = env.get_template("template.html")
html = template.render(**context)

Path("Peasy_Exec_Report.html").write_text(html, encoding="utf-8")
print("Generated: Peasy_Exec_Report.html")
